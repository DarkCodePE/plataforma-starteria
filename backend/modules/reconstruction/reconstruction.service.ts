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
  /** `claim`: a qué afirmación se refiere la evidencia. Si viene, manda para emparejar. */
  evidence: Array<{ summary: string; classification: EvidenceClassification; source?: string; claim?: string }>;
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
  /** Evidencia en contra que habla de OTRA cosa (p. ej. bajó el abandono, subió el costo): un costo
   * o efecto lateral a sopesar, no una contradicción (auditoría E2E F-09). */
  tradeoffs: Array<{ benefit: string; cost: string }>;
  gaps: Array<{ step: number; question: string }>;
  gates: Array<{ step: number; question: string; status: 'met' | 'partial' | 'missing' }>;
  nextMaterialUncertainty: string;
  suggestedReentryStep: number;
}

// Palabras que no identifican de qué habla una evidencia: conectores, dirección del cambio,
// cantidades. Lo que queda (abandono, costo, sucursal, retrabajo…) es el tema.
const NOT_SUBJECT = new Set([
  'para', 'pero', 'como', 'esta', 'este', 'esto', 'estos', 'estas', 'entre', 'desde', 'hasta', 'sobre', 'cuando', 'donde',
  'muestra', 'muestran', 'cambios', 'cambio', 'hubo', 'tiene', 'tienen', 'sigue', 'siguen', 'despues', 'antes',
  'bajo', 'baja', 'bajaron', 'subio', 'sube', 'subieron', 'aumento', 'aumentaron', 'redujo', 'redujeron', 'crecio',
  'cayo', 'cayeron', 'mejoro', 'empeoro', 'menos', 'mas', 'mayor', 'menor', 'igual', 'nada', 'ningun', 'ninguna',
]);

function subject(text: string): Set<string> {
  const words = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-zñ]+/g) ?? [];
  return new Set(words.filter((word) => word.length >= 4 && !NOT_SUBJECT.has(word)).map((word) => word.replace(/(es|s)$/, '')));
}

/** Hablan de lo mismo si declaran el mismo claim o, si no lo declaran, si comparten tema. */
function sameClaim(a: { summary: string; claim?: string }, b: { summary: string; claim?: string }): boolean {
  if (a.claim?.trim() && b.claim?.trim()) return a.claim.trim().toLowerCase() === b.claim.trim().toLowerCase();
  const left = subject(a.claim ?? a.summary);
  for (const word of subject(b.claim ?? b.summary)) if (left.has(word)) return true;
  return false;
}

export function reconstruct(input: ReconstructionInput): ReconstructionReading {
  const supports = input.evidence.filter((item) => item.classification === 'supports');
  const contradicts = input.evidence.filter((item) => item.classification === 'contradicts');
  const insufficient = input.evidence.filter((item) => item.classification === 'insufficient');
  const text = [input.summary, ...input.evidence.map((item) => item.summary)].join(' ');

  // Sólo es contradicción la evidencia en contra sobre la MISMA afirmación. Si habla de otra cosa
  // es un tradeoff: antes se cruzaba todo contra todo por polaridad (F-09).
  const contradictions = contradicts.flatMap((against) =>
    supports.filter((favor) => sameClaim(favor, against)).map((favor) => ({ supports: favor.summary, contradicts: against.summary })));
  const tradeoffs = contradicts.flatMap((against) =>
    supports.filter((favor) => !sameClaim(favor, against)).map((favor) => ({ benefit: favor.summary, cost: against.summary })));
  const disputed = new Set(contradictions.map((c) => c.supports));

  const status: Record<string, 'met' | 'partial' | 'missing'> = {
    goal: input.goal?.trim() ? 'met' : input.summary.trim() ? 'partial' : 'missing',
    support: supports.length > 0 ? (contradictions.length > 0 ? 'partial' : 'met') : 'missing',
    test: METRIC.test(text) ? 'partial' : 'missing',
    result: supports.length + contradicts.length > 0 ? (supports.length > 0 && contradicts.length > 0 ? 'met' : 'partial') : 'missing',
    decision: (input.decisionsTaken ?? []).length > 0 ? 'met' : supports.length > 0 && contradictions.length === 0 ? 'partial' : 'missing',
  };
  const gates = GATES.map((gate) => ({ step: gate.step, question: gate.question, status: status[gate.key] }));
  const gaps = gates.filter((gate) => gate.status !== 'met').map(({ step, question }) => ({ step, question }));

  // Lo sostenible: cada evidencia a favor; si otra la disputa, acotada a donde se observó.
  const sustainableClaims = supports.map((item) => ({
    claim: disputed.has(item.summary) ? `${item.summary} (sólo donde se observó; hay evidencia en contra)` : item.summary,
    evidence: [item.source ?? item.summary],
  }));

  // Re-entrada: el primer gate no cumplido. No se reinicia desde 0 si lo anterior se sostiene.
  const firstOpen = gates.find((gate) => gate.status !== 'met');
  const suggestedReentryStep = firstOpen?.step ?? 4;
  const nextMaterialUncertainty = contradictions.length > 0
    ? `Explicar por qué "${contradictions[0].supports}" y "${contradictions[0].contradicts}" no coinciden antes de escalar o cerrar.`
    : tradeoffs.length > 0
      ? `Sopesar si "${tradeoffs[0].benefit}" compensa "${tradeoffs[0].cost}" antes de escalar o cerrar.`
      : firstOpen
      ? firstOpen.question
      : 'Pedir la decisión: la evidencia disponible ya sostiene una recomendación.';

  return {
    provenance: 'USER_DECLARED',
    restartFromStep0: false,
    sustainableClaims,
    availableEvidence: { supports: supports.length, contradicts: contradicts.length, insufficient: insufficient.length },
    contradictions,
    tradeoffs,
    gaps,
    gates,
    nextMaterialUncertainty,
    suggestedReentryStep,
  };
}
