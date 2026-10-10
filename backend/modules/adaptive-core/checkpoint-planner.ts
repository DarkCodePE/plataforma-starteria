/**
 * Planificador de checkpoints (PRD-03 §8, §17).
 *
 * El catalogo anterior devolvia siempre las mismas preguntas por `checkpointKey`: recibia
 * las respuestas previas pero solo las usaba para rellenar `sourceRefs`. El resultado era
 * que CP-0.2 preguntaba lo mismo hubieras contestado lo que hubieras contestado en CP-0.1,
 * y la pagina necesitaba un formulario estatico al lado para capturar el resto.
 *
 * Aqui el checkpoint se ARMA con lo que ya se sabe:
 *
 *   respuestas de checkpoints previos
 * + outputs confirmados de steps anteriores
 * + revision inicial (pre-Step 0)
 * + contexto de empresa
 * + ruta / tipo de reto
 *        │
 *        ├─► variable ya conocida  → no se vuelve a preguntar; viaja como prellenada
 *        │                           y confirmable
 *        └─► variable pendiente    → se pregunta, y el enunciado cita lo ya dicho
 *
 * La decision de QUE preguntar es determinista a proposito: es el gate de cierre del Step
 * y debe ser trazable y testeable. La redaccion puede afinarse despues con el ai-service
 * (`refineCheckpointQuestions`), siempre con este resultado como fallback.
 */

import type { AdaptiveQuestionSource, MaterializedQuestion } from './adaptive-core.types';

export type AnswerType = MaterializedQuestion['answerType'];

export interface CheckpointVariableSpec {
  variable: string;
  /** Enunciado base. `{{variable}}` se sustituye por un valor ya conocido. */
  prompt: string;
  reason: string;
  answerType?: AnswerType;
  priority?: 'must' | 'should' | 'could';
  allowsUnknown?: boolean;
  source?: AdaptiveQuestionSource;
  /** Solo se incluye si la iniciativa tiene contexto de empresa cargado. */
  requiresCompanyContext?: boolean;
  /** Solo se incluye si la iniciativa cuelga de un reto. */
  requiresChallenge?: boolean;
}

/**
 * Variables que cada checkpoint debe dejar resueltas para cerrar su outputKey.
 *
 * Incluye las que antes vivian sueltas en el formulario estatico del front
 * (`primaryObjective`, `impactWho`, `whyNowText`, `evidenceType`...), para que exista una
 * sola definicion de que se pregunta en Step 0.
 */
export const CHECKPOINT_VARIABLES: Record<string, CheckpointVariableSpec[]> = {
  'CP-0.1': [
    {
      variable: 'initiativeTitle',
      prompt: '¿Cómo se llama esta iniciativa?',
      reason: 'Un nombre simple para poder referirse a ella; se puede ajustar después.',
      priority: 'should',
    },
    {
      variable: 'initiativeFrame',
      prompt: '¿Cómo quieres enmarcarla hoy: corregir una fricción, capturar una oportunidad, explorar una apuesta o mejorar un proceso?',
      reason: 'El encuadre orienta qué tipo de hipótesis tiene sentido construir.',
      answerType: 'single_choice',
      priority: 'should',
    },
    {
      variable: 'objective',
      prompt: '¿Qué resultado o cambio debe quedar entendible para un líder?',
      reason: 'Step 0 no puede cerrar sin un propósito que un tercero entienda.',
      allowsUnknown: false,
    },
    {
      variable: 'challengeType',
      prompt: '¿Qué tipo de reto describe mejor la iniciativa hoy?',
      reason: 'El tipo de reto ajusta profundidad y preguntas posteriores.',
      answerType: 'single_choice',
      // `should`: se pregunta, pero el unico hard gate de CP-0.1 sigue siendo `objective`.
      priority: 'should',
      source: 'challenge_type',
    },
    {
      variable: 'primaryObjective',
      prompt: 'Sobre {{objective}}, ¿qué objetivo de negocio ayudaría a moverlo?',
      reason: 'Sin objetivo de negocio el brief no conecta con una prioridad.',
      answerType: 'single_choice',
      priority: 'should',
    },
    {
      variable: 'challengeContribution.subproblem',
      prompt: '¿Qué parte del reto padre aborda esta iniciativa?',
      reason: 'La iniciativa vinculada debe reportar su contribución al reto.',
      priority: 'should',
      requiresChallenge: true,
      source: 'challenge_context',
    },
  ],
  'CP-0.2': [
    {
      variable: 'scope',
      prompt: 'Dijiste que buscas {{objective}}. ¿Cuál es el alcance inicial de eso y qué queda fuera por ahora?',
      reason: 'El cierre de Step 0 requiere un alcance inicial delimitado.',
    },
    {
      variable: 'owner_and_actor_required',
      prompt: '¿Quién es el owner operativo y qué actor debe confirmar condiciones?',
      reason: 'Sin owner, Step 0 no puede cerrarse.',
      answerType: 'owner',
      allowsUnknown: false,
    },
    {
      variable: 'outcome',
      prompt: '¿A quién impacta {{objective}} y cómo lo notaría esa persona?',
      reason: 'El brief necesita a quién afecta, no solo qué se quiere mover.',
      priority: 'should',
    },
    {
      variable: 'whyNow',
      prompt: '¿Por qué conviene moverlo ahora y no más adelante?',
      reason: 'La urgencia es lo que un líder usa para priorizar.',
      priority: 'should',
    },
    {
      variable: 'company_constraints',
      prompt: '¿Qué restricción de la empresa podría afectar evidencia, datos o aprobaciones?',
      reason: 'El contexto empresarial sugiere revisar restricciones antes de avanzar.',
      requiresCompanyContext: true,
      source: 'company_context',
      priority: 'should',
    },
  ],
  'CP-0.3': [
    {
      variable: 'priorityHypothesis',
      prompt: 'Con {{scope}} en manos de {{owner_and_actor_required}}, ¿cuál es la hipótesis prioritaria que debe validarse?',
      reason: 'Step 0 cierra con una hipótesis a validar; es lo que recibe Step 1.',
      allowsUnknown: false,
    },
    {
      variable: 'availableEvidence',
      prompt: '¿Qué señales o evidencia tienes hoy sobre esa hipótesis?',
      reason: 'Distinguir lo que ya se sabe de lo que hay que ir a buscar en Step 1.',
      priority: 'should',
    },
    {
      variable: 'decisionCriteria',
      prompt: '¿Qué evidencia o criterio permitiría tomar la siguiente decisión?',
      reason: 'El criterio de decisión se deriva de las respuestas previas y lo que falta.',
      source: 'previous_answer',
    },
  ],
};

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Primer texto util de una lista de candidatos. */
function firstText(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === 'string' && candidate[0].trim()) {
      return candidate[0].trim();
    }
  }
  return undefined;
}

export interface KnownValue {
  value: unknown;
  /** De donde salio, para poder mostrarlo como confirmable en vez de re-preguntarlo. */
  from: string;
}

/**
 * Resuelve que se sabe ya de una variable, en orden de autoridad:
 * respuestas confirmadas > outputs de steps previos > revision inicial > contexto empresa.
 */
export function resolveKnownValues(
  masterContext: any,
  previousAnswers: Record<string, unknown>[],
): Record<string, KnownValue> {
  const known: Record<string, KnownValue> = {};
  const remember = (variable: string, value: unknown, from: string) => {
    if (!hasValue(value) || known[variable]) return;
    known[variable] = { value, from };
  };

  // 1. Respuestas confirmadas de checkpoints previos (la fuente mas autoritativa).
  for (const answers of previousAnswers) {
    for (const [variable, value] of Object.entries(answers ?? {})) {
      remember(variable, value, 'checkpoint_previo');
    }
  }

  // 2. Output confirmado de Step 0 (relevante cuando se configuran Steps 1-4).
  const step0 = masterContext?.step0Output;
  if (step0) {
    remember('objective', step0.objective, 'output_step0');
    remember('scope', step0.scope, 'output_step0');
    remember('priorityHypothesis', step0.priorityHypothesis, 'output_step0');
    remember('decisionCriteria', step0.decisionCriteria, 'output_step0');
  }

  // 3. Revision inicial (pre-Step 0): lo que la persona ya conto antes de entrar al Step.
  remember('initiativeTitle', masterContext?.initiativeTitle, 'revision_inicial');
  remember('initiativeFrame', masterContext?.initiativeFrame, 'revision_inicial');
  remember('objective', firstText(masterContext?.knownFacts), 'revision_inicial');
  remember('challengeType', masterContext?.challengeType, 'revision_inicial');
  remember('priorityHypothesis', firstText(masterContext?.assumptions), 'revision_inicial');

  // 4. Contexto de empresa: restricciones y actores ya documentados.
  const company = masterContext?.companySnapshot;
  if (company) {
    remember('company_constraints', firstText(company.restrictions), 'contexto_empresa');
    remember('owner_and_actor_required', firstText(company.actors), 'contexto_empresa');
  }

  // 5. Reto padre.
  const challenge = masterContext?.challengeSnapshot;
  if (challenge) {
    remember('challengeContribution.subproblem', challenge.subproblem, 'reto_padre');
  }

  return known;
}

/** Cómo se lee en pantalla la procedencia de un dato ya conocido (la clave sigue en `prefilledFrom`). */
const KNOWN_FROM_LABELS: Record<string, string> = {
  checkpoint_previo: 'un checkpoint anterior',
  contexto_empresa: 'el contexto de la empresa',
  reto_padre: 'el reto padre',
  revision_inicial: 'tu revisión inicial',
};

/** Sustituye {{variable}} por lo ya conocido; si no se sabe, deja un texto neutro. */
function interpolate(prompt: string, known: Record<string, KnownValue>): string {
  return prompt.replace(/\{\{(.*?)\}\}/g, (_match, rawVariable: string) => {
    const entry = known[String(rawVariable).trim()];
    const text = typeof entry?.value === 'string' ? entry.value.trim() : '';
    if (!text) return 'lo que definiste';
    return text.length > 90 ? `${text.slice(0, 87)}...` : text;
  });
}

export interface PlanCheckpointInput {
  checkpointKey: string;
  configurationVersion: number;
  masterContext: any;
  previousAnswers: Record<string, unknown>[];
}

/**
 * Arma las preguntas de un checkpoint a partir del contexto acumulado.
 *
 * Devuelve TODAS las variables del checkpoint: las pendientes como preguntas a responder y
 * las ya conocidas marcadas con `prefilledFrom` + `confirmationRequired`, para que la
 * persona confirme en vez de volver a escribir lo mismo.
 */
export function planCheckpointQuestions(input: PlanCheckpointInput): MaterializedQuestion[] {
  const { checkpointKey, configurationVersion, masterContext, previousAnswers } = input;
  const specs = CHECKPOINT_VARIABLES[checkpointKey] ?? [];
  const known = resolveKnownValues(masterContext, previousAnswers);
  const hasCompany = Boolean(masterContext?.companySnapshot);
  const hasChallenge = Boolean(masterContext?.challengeSnapshot);

  const applicable = specs.filter(spec => {
    if (spec.requiresCompanyContext && !hasCompany) return false;
    if (spec.requiresChallenge && !hasChallenge) return false;
    return true;
  });

  // Un dato derivado de un contexto de empresa poco cubierto no se presenta como hecho:
  // viaja como hipotesis a confirmar. Nunca endurece el gate.
  const companyLowCoverage = Boolean(masterContext?.companySnapshot?.lowCoverage);

  return applicable.map((spec, index) => {
    const alreadyKnown = known[spec.variable];
    const derivedFromWeakCompanyContext =
      companyLowCoverage && (alreadyKnown?.from === 'contexto_empresa' || spec.source === 'company_context');
    const sourceRefs = alreadyKnown
      ? [alreadyKnown.from]
      : spec.source === 'company_context'
        ? masterContext?.companySnapshot?.sources ?? []
        : ['PRD-03:9.4'];

    return {
      id: `${checkpointKey.toLowerCase().replace('.', '-')}-v${configurationVersion}-q${index + 1}`,
      checkpointKey,
      configurationVersion,
      prompt: interpolate(spec.prompt, known),
      purpose: spec.reason,
      clarifiesVariable: spec.variable,
      answerType: spec.answerType ?? 'free_text',
      reason: derivedFromWeakCompanyContext
        ? 'El contexto de la empresa todavía es parcial: tómalo como una hipótesis a confirmar, no como un requisito.'
        : alreadyKnown
          ? `Ya lo tenemos de ${KNOWN_FROM_LABELS[alreadyKnown.from] ?? alreadyKnown.from.replace(/_/g, ' ')}. Confirma o ajusta.`
          : spec.reason,
      // La procedencia la declara el spec (de donde NACE la pregunta). Solo cuando no la
      // declara y el valor viene de un checkpoint previo se marca como `previous_answer`.
      source: (spec.source ?? (alreadyKnown ? 'previous_answer' : 'core')) as AdaptiveQuestionSource,
      sourceRefs,
      // Una variable ya resuelta no vuelve a bloquear el cierre del checkpoint.
      required: alreadyKnown ? false : (spec.priority ?? 'must') === 'must',
      priority: alreadyKnown ? 'could' : spec.priority ?? 'must',
      optional: Boolean(alreadyKnown) || (spec.priority ?? 'must') === 'could',
      allowsUnknown: spec.allowsUnknown ?? true,
      prefilledFrom: alreadyKnown?.from,
      contextDerived: Boolean(alreadyKnown) || spec.source === 'company_context',
      confirmationRequired: Boolean(alreadyKnown) || derivedFromWeakCompanyContext,
    } satisfies MaterializedQuestion;
  });
}

/** Variables obligatorias que siguen sin resolverse: es el gate de cierre del checkpoint. */
export function missingRequiredVariables(
  checkpointKey: string,
  masterContext: any,
  previousAnswers: Record<string, unknown>[],
  responses: Record<string, unknown>,
): string[] {
  const known = resolveKnownValues(masterContext, [...previousAnswers, responses]);
  return (CHECKPOINT_VARIABLES[checkpointKey] ?? [])
    .filter(spec => (spec.priority ?? 'must') === 'must')
    .filter(spec => !spec.requiresCompanyContext || Boolean(masterContext?.companySnapshot))
    .filter(spec => !spec.requiresChallenge || Boolean(masterContext?.challengeSnapshot))
    .filter(spec => !hasValue(known[spec.variable]?.value))
    .map(spec => spec.variable);
}
