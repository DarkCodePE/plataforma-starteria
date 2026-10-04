/**
 * Reconstrucción de trabajo existente con gating retroactivo.
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §14: "Ya existe mucho trabajo". Starteria aplica
 * reconstruction + gating retroactivo, no reinicio metodológico. Devuelve qué se puede sostener,
 * la evidencia disponible, contradicciones, gaps y la siguiente incertidumbre material.
 *
 * Es una lectura: no crea Project, Steps ni Claims. Lo que la persona declara queda marcado como
 * USER_DECLARED; nada se valida por haber sido importado (Core: una observación no es evidencia
 * validada). Para trabajarla, la persona crea la iniciativa y entra por Mission Review.
 */
export type EvidenceClassification = 'supports' | 'contradicts' | 'insufficient';

export interface ReconstructionInput {
  name: string;
  summary: string;
  goal?: string;
  evidence: Array<{ summary: string; classification: EvidenceClassification; source?: string }>;
  decisionsTaken?: string[];
}

// Preguntas del gating retroactivo, en el orden de los Steps (contratos de rigor, §19).
const GATES = [
  { step: 0, key: 'goal', question: '¿Qué se buscaba mover y qué decisión habilitaba?' },
  { step: 1, key: 'support', question: '¿Hay evidencia que respalde el foco?' },
  { step: 2, key: 'test', question: '¿Se definió cómo observar el resultado (métrica, umbral)?' },
  { step: 3, key: 'result', question: '¿Hay resultados observados, a favor y en contra?' },
  { step: 4, key: 'decision', question: '¿Se tomó o se puede pedir una decisión sustentada?' },
] as const;

const METRIC = /\d+(?:[.,]\d+)?\s*%|\b(baj[oóa]|subi[oóa]|aument[oóa]|reduj|creci[oó]|cay[oó])\b/i;

export interface ReconstructionReading {
  provenance: 'USER_DECLARED';
  restartFromStep0: false;
  sustainableClaims: Array<{ claim: string; evidence: string[] }>;
  availableEvidence: { supports: number; contradicts: number; insufficient: number };
  contradictions: Array<{ supports: string; contradicts: string }>;
  gaps: Array<{ step: number; question: string }>;
  gates: Array<{ step: number; question: string; status: 'met' | 'partial' | 'missing' }>;
  nextMaterialUncertainty: string;
  suggestedReentryStep: number;
}

export function reconstruct(input: ReconstructionInput): ReconstructionReading {
  const supports = input.evidence.filter((item) => item.classification === 'supports');
  const contradicts = input.evidence.filter((item) => item.classification === 'contradicts');
  const insufficient = input.evidence.filter((item) => item.classification === 'insufficient');
  const text = [input.summary, ...input.evidence.map((item) => item.summary)].join(' ');

  const status: Record<string, 'met' | 'partial' | 'missing'> = {
    goal: input.goal?.trim() ? 'met' : input.summary.trim() ? 'partial' : 'missing',
    support: supports.length > 0 ? (contradicts.length > 0 ? 'partial' : 'met') : 'missing',
    test: METRIC.test(text) ? 'partial' : 'missing',
    result: supports.length + contradicts.length > 0 ? (supports.length > 0 && contradicts.length > 0 ? 'met' : 'partial') : 'missing',
    decision: (input.decisionsTaken ?? []).length > 0 ? 'met' : supports.length > 0 && contradicts.length === 0 ? 'partial' : 'missing',
  };
  const gates = GATES.map((gate) => ({ step: gate.step, question: gate.question, status: status[gate.key] }));
  const gaps = gates.filter((gate) => gate.status !== 'met').map(({ step, question }) => ({ step, question }));

  // Lo sostenible: cada evidencia a favor que ninguna en contra disputa; si hay contradicción,
  // sólo se sostiene acotado a donde la evidencia lo muestra.
  const sustainableClaims = supports.map((item) => ({
    claim: contradicts.length > 0 ? `${item.summary} (sólo donde se observó; hay evidencia en contra)` : item.summary,
    evidence: [item.source ?? item.summary],
  }));
  const contradictions = contradicts.flatMap((against) => supports.map((favor) => ({ supports: favor.summary, contradicts: against.summary })));

  // Re-entrada: el primer gate no cumplido. No se reinicia desde 0 si lo anterior se sostiene.
  const firstOpen = gates.find((gate) => gate.status !== 'met');
  const suggestedReentryStep = firstOpen?.step ?? 4;
  const nextMaterialUncertainty = contradictions.length > 0
    ? `Explicar por qué "${contradictions[0].supports}" y "${contradictions[0].contradicts}" no coinciden antes de escalar o cerrar.`
    : firstOpen
      ? firstOpen.question
      : 'Pedir la decisión: la evidencia disponible ya sostiene una recomendación.';

  return {
    provenance: 'USER_DECLARED',
    restartFromStep0: false,
    sustainableClaims,
    availableEvidence: { supports: supports.length, contradicts: contradicts.length, insufficient: insufficient.length },
    contradictions,
    gaps,
    gates,
    nextMaterialUncertainty,
    suggestedReentryStep,
  };
}
