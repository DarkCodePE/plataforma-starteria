/** Shared P8 semantic engine. Step specializations supply only the governed shape. */
export type SemanticStep = 1 | 2 | 3 | 4;
export type SemanticKind = 'fact' | 'assumption' | 'hypothesis' | 'ai_inference' | 'unknown' | 'observation' | 'interpretation' | 'recommendation' | 'evidence';

export interface StepSemanticInput { content: string; field: string; sourceRefs?: Array<{ id: string; reference: string }>; unavailable?: boolean; now?: string }
export interface StepSemanticCard {
  schemaVersion: 'step-semantic-card-v1'; step: SemanticStep; version: number;
  context: Record<string, unknown>; values: Record<string, { value: string; kind: SemanticKind; sourceRefIds: string[]; version: number }>;
  unknowns: string[]; contradictions: Array<{ field: string; previous: string; proposed: string; sourceRefIds: string[] }>;
  sources: Array<{ id: string; reference: string; validationStatus: 'unvalidated' }>;
  hardGaps: string[]; softGaps: string[]; requiresReview: boolean;
  sufficiency: { sufficient: boolean; critical: string[]; hardGaps: string[]; softGaps: string[] };
  handoff: null | { toStep: SemanticStep | 'Decision'; values: Record<string, string>; sourceRefIds: string[]; gaps: string[]; contradictions: Array<{ field: string; sourceRefIds: string[] }>; version: number };
  lastOperation: 'add' | 'no_change' | 'unknown' | 'contradiction' | 'unavailable';
}

const SPECS: Record<SemanticStep, { critical: string[]; to: SemanticStep | 'Decision'; kinds: Record<string, SemanticKind> }> = {
  1: { critical: ['focus', 'fact', 'hypothesis', 'evidence'], to: 2, kinds: { fact: 'fact', assumption: 'assumption', hypothesis: 'hypothesis', inference: 'ai_inference', evidence: 'evidence' } },
  2: { critical: ['selectedWork', 'measurementPlan', 'capacityBoundary'], to: 3, kinds: { selectedWork: 'hypothesis', measurementPlan: 'fact', capacityBoundary: 'assumption', evidence: 'evidence' } },
  3: { critical: ['execution', 'observation', 'interpretation'], to: 4, kinds: { execution: 'fact', observation: 'observation', interpretation: 'interpretation', recommendation: 'recommendation', evidence: 'evidence' } },
  4: { critical: ['learning', 'recommendation', 'decisionRequest'], to: 'Decision', kinds: { learning: 'interpretation', recommendation: 'recommendation', decisionRequest: 'fact', evidence: 'evidence' } },
};
// Keep the deterministic classifier independent of source-file encoding.
const UNKNOWN = /^(no\s*(?:se|s\u00e9)|desconozco|aun no|todavia no)(?:\s|$)/i;
const IRRELEVANT = /\b(pizza|futbol|clima|lorem ipsum|irrelevante)\b/i;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function finalize(card: StepSemanticCard): StepSemanticCard {
  const spec = SPECS[card.step];
  const missing = spec.critical.filter(key => !card.values[key]?.value).map(key => `missing:${key}`);
  const contradictions = card.contradictions.map(item => `review:${item.field}`);
  card.hardGaps = [...missing, ...contradictions];
  card.softGaps = card.unknowns.filter(key => !spec.critical.includes(key)).map(key => `unknown:${key}`);
  card.requiresReview = card.contradictions.length > 0;
  card.sufficiency = { sufficient: card.hardGaps.length === 0, critical: spec.critical, hardGaps: card.hardGaps, softGaps: card.softGaps };
  card.handoff = card.sufficiency.sufficient ? {
    toStep: spec.to, values: Object.fromEntries(Object.entries(card.values).map(([key, value]) => [key, value.value])),
    sourceRefIds: card.sources.map(source => source.id), gaps: [...card.hardGaps, ...card.softGaps],
    contradictions: card.contradictions.map(item => ({ field: item.field, sourceRefIds: item.sourceRefIds })), version: card.version,
  } : null;
  return card;
}

export function createSemanticStepCard(step: SemanticStep, context: Record<string, unknown>): StepSemanticCard {
  return finalize({ schemaVersion: 'step-semantic-card-v1', step, version: 0, context: clone(context), values: {}, unknowns: [], contradictions: [], sources: [], hardGaps: [], softGaps: [], requiresReview: false, sufficiency: { sufficient: false, critical: [], hardGaps: [], softGaps: [] }, handoff: null, lastOperation: 'no_change' });
}

export function applySemanticStepInput(previous: StepSemanticCard, input: StepSemanticInput): StepSemanticCard {
  const card = clone(previous); const content = input.content.trim(); const now = input.now ?? new Date().toISOString(); void now;
  const field = input.field.trim(); const spec = SPECS[card.step];
  if (input.unavailable) { card.lastOperation = 'unavailable'; return card; }
  if (!field || !content || IRRELEVANT.test(content)) { card.lastOperation = 'no_change'; return card; }
  if (UNKNOWN.test(content)) {
    if (!card.unknowns.includes(field)) card.unknowns.push(field);
    card.version += 1;
    card.lastOperation = 'unknown';
    return finalize(card);
  }
  const refs = input.sourceRefs ?? [];
  let sourceChanged = false;
  for (const source of refs) if (!card.sources.some(existing => existing.id === source.id)) {
    card.sources.push({ ...source, validationStatus: 'unvalidated' });
    sourceChanged = true;
  }
  const prior = card.values[field];
  if (prior?.value === content) {
    if (sourceChanged) { card.version += 1; return finalize(card); }
    card.lastOperation = 'no_change';
    return card;
  }
  if (prior && prior.value !== content) card.contradictions.push({ field, previous: prior.value, proposed: content, sourceRefIds: refs.map(source => source.id) });
  card.values[field] = { value: content, kind: spec.kinds[field] ?? 'fact', sourceRefIds: refs.map(source => source.id), version: card.version + 1 };
  card.version += 1; card.lastOperation = prior ? 'contradiction' : 'add';
  return finalize(card);
}
