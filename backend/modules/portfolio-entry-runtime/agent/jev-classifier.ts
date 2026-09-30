import type { PortfolioEntryAnalysisV2 } from '../domain/analysis.schema';

// ADR-032 / KAN-77: Jev (TypeSafe System One) es el ÚNICO clasificador de Portfolio Entry
// cuando PORTFOLIO_ENTRY_CLASSIFIER=jev. El LLM recibe esta clasificación como dato fijo.
//
// Criterios = las definiciones de doc/entry-01 §5-6, SIN sus ejemplos: varios ejemplos
// son los casos del AI Harness, y ponerlos acá haría que la suite mida memoria, no juicio.

export type PortfolioEntryIntent = PortfolioEntryAnalysisV2['primary_intent'];
export type PortfolioEntryFrame = PortfolioEntryAnalysisV2['current_frame'];

const INTENT_CRITERIA: Record<PortfolioEntryIntent, string> = {
  strategic_goal: 'Quiere mover un resultado, objetivo o prioridad de negocio',
  portfolio_alignment: 'Quiere entender si sus iniciativas están conectadas con prioridades, objetivos o resultados del negocio',
  portfolio_tracking: 'Quiere entender estado, avance, bloqueos o seguimiento de varias iniciativas',
  portfolio_prioritization: 'Necesita comparar, ordenar, decidir continuidad o asignar atención/recursos entre varias iniciativas',
  portfolio_reporting: 'Necesita explicar, resumir o presentar el estado/valor del portafolio a otra persona o instancia',
  portfolio_governance: 'Necesita definir reglas, responsables o instancias para gobernar el portafolio',
  initiative_governance: 'Entra desde una iniciativa o solución concreta y necesita justificar, orientar, revisar o gobernar su continuidad',
  unknown: 'No existe suficiente soporte para asignar un intent útil sin inventar',
};

const FRAME_CRITERIA: Record<PortfolioEntryFrame, string> = {
  strategy_first: 'Entra desde un objetivo, resultado o prioridad de negocio',
  portfolio_first: 'Entra desde varias iniciativas o desde la necesidad de entender el conjunto',
  initiative_first: 'Entra desde una iniciativa ya identificada como unidad de trabajo',
  solution_first: 'Entra desde una solución concreta que propone directamente',
  problem_first: 'Entra desde una fricción, dolor o situación negativa',
  opportunity_first: 'Entra desde una oportunidad positiva o señal de potencial',
  decision_first: 'Entra desde una decisión que necesita tomar',
  reporting_first: 'Entra desde la necesidad de explicar o presentar información',
  unknown: 'No existe suficiente soporte para clasificar el punto de entrada',
};

// Sin calibrar: salen de los 26 casos del AI Harness (2026-09-30). Debajo del umbral el
// campo queda `unknown` (entry-01 ID-02 y ID-03) y el LLM pregunta en vez de adivinar.
export const JEV_THRESHOLDS = { entryState: 0.5, primaryIntent: 0.7, secondaryIntent: 0.9 } as const;

const API_URL = 'https://api.typesafe.ai/v1/systemone';
const SECONDARY_PREFIX = 'also_';

export type JevClassification = {
  frame: PortfolioEntryFrame;
  primary_intent: PortfolioEntryIntent;
  secondary_intents: PortfolioEntryIntent[];
  confidence: { frame: number; primary_intent: number };
  source: 'jev' | 'jev_unavailable';
  model?: string;
  duration_ms: number;
  error?: string;
};

export type JevClassifierConfig = {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type JevChoice = { choice?: string; confidence?: number };
type JevScore = { score?: number };

export class JevClassifier {
  constructor(private readonly config: JevClassifierConfig) {}

  /**
   * Clasifica el mensaje nuevo. En turnos de seguimiento el mensaje suele ser la respuesta a una
   * pregunta del agente, así que se le pasa esa pregunta como contexto. Nunca lanza.
   */
  async classify(input: { rawInput: string; priorQuestions?: string[] }): Promise<JevClassification> {
    const startedAt = Date.now();
    const fetchImpl = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);
    try {
      const response = await fetchImpl(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: describeState(input.rawInput, input.priorQuestions ?? []),
          model: this.config.model ?? 'jev-latest',
          questions: QUESTIONS,
        }),
      });
      if (!response.ok) throw new Error(`Jev HTTP ${response.status}`);
      const body = await response.json() as { answers?: Record<string, JevChoice & JevScore>; model?: string };
      return { ...fromAnswers(body.answers ?? {}), source: 'jev', model: body.model, duration_ms: Date.now() - startedAt };
    } catch (err) {
      // Si Jev no está, el turno sigue: sin clasificación confiable, todo queda en `unknown`.
      return {
        frame: 'unknown', primary_intent: 'unknown', secondary_intents: [], confidence: { frame: 0, primary_intent: 0 },
        source: 'jev_unavailable', duration_ms: Date.now() - startedAt, error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

const QUESTIONS = {
  entry_state: {
    type: 'choice',
    instructions: 'Desde dónde entra el usuario: el punto de partida de su mensaje, no lo que termina necesitando',
    criteria: FRAME_CRITERIA,
  },
  primary_intent: {
    type: 'choice',
    instructions: 'Cuál es el trabajo principal que el usuario necesita resolver ahora',
    criteria: INTENT_CRITERIA,
  },
  ...Object.fromEntries(
    Object.entries(INTENT_CRITERIA)
      .filter(([intent]) => intent !== 'unknown')
      .map(([intent, criterion]) => [`${SECONDARY_PREFIX}${intent}`, {
        type: 'score',
        instructions: `¿El mensaje expresa también esta necesidad, aunque no sea la principal? ${criterion}`,
        criteria: ['No la expresa', 'La expresa de forma explícita'],
      }]),
  ),
};

function describeState(rawInput: string, priorQuestions: string[]): string {
  if (priorQuestions.length === 0) return `Mensaje del usuario en la entrada de Starteria: ${rawInput}`;
  return [
    'Entrada de Starteria. Preguntas que Starteria ya le hizo al usuario:',
    ...priorQuestions.map((question) => `- ${question}`),
    `Nuevo mensaje del usuario: ${rawInput}`,
  ].join('\n');
}

function fromAnswers(answers: Record<string, JevChoice & JevScore>): Omit<JevClassification, 'source' | 'model' | 'duration_ms'> {
  const frame = gated(answers.entry_state, FRAME_CRITERIA, JEV_THRESHOLDS.entryState);
  const primary = gated(answers.primary_intent, INTENT_CRITERIA, JEV_THRESHOLDS.primaryIntent);
  const secondary = (Object.keys(INTENT_CRITERIA) as PortfolioEntryIntent[]).filter((intent) =>
    intent !== 'unknown'
    && intent !== primary.value
    && (answers[`${SECONDARY_PREFIX}${intent}`]?.score ?? 0) >= JEV_THRESHOLDS.secondaryIntent);
  return {
    frame: frame.value,
    primary_intent: primary.value,
    // Sin intent principal no hay de qué ser secundario.
    secondary_intents: primary.value === 'unknown' ? [] : secondary,
    confidence: { frame: frame.confidence, primary_intent: primary.confidence },
  };
}

function gated<T extends string>(answer: JevChoice | undefined, vocabulary: Record<T, string>, threshold: number): { value: T | 'unknown'; confidence: number } {
  const confidence = Number(answer?.confidence ?? 0);
  const choice = answer?.choice;
  if (!choice || !(choice in vocabulary) || confidence < threshold) return { value: 'unknown', confidence };
  return { value: choice as T, confidence };
}
