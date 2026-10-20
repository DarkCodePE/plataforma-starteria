/**
 * P7 Step 0 semantic Card.
 *
 * This is deliberately deterministic and conservative. It turns an interaction
 * into a proposed, typed Card delta; it never treats an AI response as truth or
 * a user message as a completed checkpoint.
 */

export type Step0SemanticField = 'objective' | 'scope' | 'owner' | 'priorityHypothesis' | 'decisionCriteria';
export type KnowledgeKind = 'declared_fact' | 'claim' | 'hypothesis' | 'assumption' | 'inference' | 'suggestion' | 'unknown' | 'contradiction' | 'constraint' | 'blocker' | 'source' | 'evidence';

export interface SemanticSourceRef {
  id: string;
  reference: string;
  sourceType: string;
  validationStatus: 'unvalidated';
}

export interface SemanticFieldValue {
  value: string;
  kind: KnowledgeKind;
  origin: 'human' | 'inherited' | 'system';
  sourceRefIds: string[];
  version: number;
}

export interface Step0SemanticCard {
  schemaVersion: 'step0-semantic-card-v1';
  initiativeId: string;
  cardVersion: number;
  inheritedContext: Record<string, unknown>;
  fields: Partial<Record<Step0SemanticField, SemanticFieldValue>>;
  claims: Array<{ id: string; field: Step0SemanticField; statement: string; kind: KnowledgeKind; origin: 'human'; sourceRefIds: string[]; createdAt: string }>;
  unknowns: Array<{ field: Step0SemanticField; reason: string; createdAt: string }>;
  contradictions: Array<{ field: Step0SemanticField; previous: string; proposed: string; sourceRefIds: string[]; createdAt: string; status: 'open' }>;
  sources: SemanticSourceRef[];
  hardGaps: string[];
  softGaps: string[];
  sufficiency: { sufficient: boolean; criticalRequirements: string[]; hardGaps: string[]; softGaps: string[]; reason: string };
  requiresReview: boolean;
  checkpoint: { state: 'not_ready' | 'ready_for_human_confirmation'; humanConfirmationRequired: true; openItems: string[] };
  handoff: {
    toStep: 1;
    structured: true;
    fields: Partial<Record<Step0SemanticField, string>>;
    claimIds: string[];
    sourceRefIds: string[];
    constraints: string[];
    gaps: string[];
    contradictions: Array<{ field: Step0SemanticField; status: 'open'; sourceRefIds: string[] }>;
  } | null;
  lastIntervention: 'ask' | 'analyze' | 'review' | 'checkpoint' | 'no_change' | 'unblock';
  lastDelta: { operation: 'add' | 'amend' | 'mark_unknown' | 'mark_contradiction' | 'link_source' | 'request_review' | 'no_change'; field: Step0SemanticField | null; reason: string };
  history: Array<{ event: 'input' | 'contradiction' | 'ai_unavailable'; field: Step0SemanticField | null; value?: string; at: string }>;
}

export interface Step0SemanticInput {
  content: string;
  fieldHint?: Step0SemanticField;
  sourceRefs?: SemanticSourceRef[];
  aiAvailable?: boolean;
  now?: string;
}

export interface Step0SemanticResult {
  card: Step0SemanticCard;
  changed: boolean;
}

const CRITICAL_FIELDS: Step0SemanticField[] = ['objective', 'scope', 'owner', 'priorityHypothesis', 'decisionCriteria'];
// Do not use `\b` here: JavaScript's word boundary is ASCII-oriented and fails
// after the accented `é` in the material phrase “No sé”.
const UNKNOWN = /^(no\s*s[eé]|no lo s[eé]|desconozco|a[uú]n no|todav[ií]a no)(?:\s|$)/i;
const IRRELEVANT = /\b(f[uú]tbol|pizza|clima|irrelevante|lorem ipsum)\b/i;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function fieldFor(content: string, explicit?: Step0SemanticField): Step0SemanticField | null {
  if (explicit) return explicit;
  const text = normalize(content);
  if (/\b(hip[oó]tesis|si .+ entonces|supuesto)\b/.test(text)) return 'priorityHypothesis';
  if (/\b(alcance|fuera de alcance|equipo|proceso)\b/.test(text)) return 'scope';
  if (/\b(responsable|owner|encargad[oa])\b/.test(text)) return 'owner';
  if (/\b(criterio|decisi[oó]n|evidencia necesaria)\b/.test(text)) return 'decisionCriteria';
  if (/\b(objetivo|resultado|reducir|aumentar|mejorar|lograr)\b/.test(text)) return 'objective';
  return null;
}

function inheritedFields(context: Record<string, unknown>): Partial<Record<Step0SemanticField, SemanticFieldValue>> {
  const values: Partial<Record<Step0SemanticField, SemanticFieldValue>> = {};
  const raw = context ?? {};
  const assign = (field: Step0SemanticField, value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      values[field] = { value: value.trim(), kind: field === 'priorityHypothesis' ? 'hypothesis' : 'declared_fact', origin: 'inherited', sourceRefIds: [], version: 0 };
    }
  };
  assign('objective', raw.initiativeTitle ?? raw.objective ?? (raw.challengeSnapshot as any)?.objective);
  assign('scope', raw.initiativeFrame ?? raw.scope);
  assign('priorityHypothesis', raw.initialFocus ?? raw.priorityHypothesis);
  assign('decisionCriteria', (Array.isArray(raw.decisions) ? raw.decisions[0] : undefined) ?? raw.decisionCriteria);
  return values;
}

export function createStep0SemanticCard(initiativeId: string, inheritedContext: Record<string, unknown>, now = new Date().toISOString()): Step0SemanticCard {
  const fields = inheritedFields(inheritedContext);
  return finalize({
    schemaVersion: 'step0-semantic-card-v1',
    initiativeId,
    cardVersion: 0,
    inheritedContext: clone(inheritedContext),
    fields,
    claims: [],
    unknowns: [],
    contradictions: [],
    sources: [],
    hardGaps: [],
    softGaps: [],
    sufficiency: { sufficient: false, criticalRequirements: [], hardGaps: [], softGaps: [], reason: '' },
    requiresReview: false,
    checkpoint: { state: 'not_ready', humanConfirmationRequired: true, openItems: [] },
    handoff: null,
    lastIntervention: 'ask',
    lastDelta: { operation: 'no_change', field: null, reason: 'Card inicializada desde contexto heredado.' },
    history: [{ event: 'input', field: null, at: now }],
  });
}

function finalize(card: Step0SemanticCard): Step0SemanticCard {
  const missing = CRITICAL_FIELDS.filter(field => !card.fields[field]?.value).map(field => `missing:${field}`);
  const contradictionGaps = card.contradictions.filter(item => item.status === 'open').map(item => `review:${item.field}`);
  card.hardGaps = [...missing, ...contradictionGaps];
  card.softGaps = card.unknowns.filter(item => !CRITICAL_FIELDS.includes(item.field)).map(item => `unknown:${item.field}`);
  card.sufficiency = {
    sufficient: card.hardGaps.length === 0,
    criticalRequirements: CRITICAL_FIELDS,
    hardGaps: card.hardGaps,
    softGaps: card.softGaps,
    reason: card.hardGaps.length === 0
      ? 'Las variables críticas de Step 0 están presentes; queda confirmación humana.'
      : `Faltan o requieren revisión: ${card.hardGaps.join(', ')}.`,
  };
  card.requiresReview = card.contradictions.some(item => item.status === 'open');
  card.checkpoint = {
    state: card.sufficiency.sufficient ? 'ready_for_human_confirmation' : 'not_ready',
    humanConfirmationRequired: true,
    openItems: [...card.hardGaps, ...card.softGaps],
  };
  card.handoff = card.sufficiency.sufficient
    ? {
        toStep: 1,
        structured: true,
        fields: Object.fromEntries(Object.entries(card.fields).map(([field, value]) => [field, value?.value])) as Partial<Record<Step0SemanticField, string>>,
        claimIds: card.claims.map(claim => claim.id),
        sourceRefIds: card.sources.map(source => source.id),
        constraints: Array.isArray((card.inheritedContext.handoffMandate as any)?.constraints)
          ? (card.inheritedContext.handoffMandate as any).constraints.map(String)
          : Array.isArray(card.inheritedContext.constraints) ? card.inheritedContext.constraints.map(String) : [],
        gaps: [...card.hardGaps, ...card.softGaps],
        contradictions: card.contradictions.map(item => ({ field: item.field, status: item.status, sourceRefIds: item.sourceRefIds })),
      }
    : null;
  return card;
}

/** Applies one interaction while retaining all prior Card knowledge and provenance. */
export function applyStep0SemanticInput(previous: Step0SemanticCard, input: Step0SemanticInput): Step0SemanticResult {
  const card = clone(previous);
  const now = input.now ?? new Date().toISOString();
  const content = input.content.trim();
  const field = fieldFor(content, input.fieldHint);
  const suppliedSources = input.sourceRefs ?? [];
  for (const source of suppliedSources) {
    if (!card.sources.some(existing => existing.id === source.id)) card.sources.push({ ...source, validationStatus: 'unvalidated' });
  }

  if (input.aiAvailable === false) {
    card.lastIntervention = 'unblock';
    card.lastDelta = { operation: 'no_change', field: null, reason: 'El intérprete no está disponible; el estado previo se preservó.' };
    card.history.push({ event: 'ai_unavailable', field: null, at: now });
    return { card: finalize(card), changed: false };
  }
  if (!field || !content || IRRELEVANT.test(content)) {
    card.lastIntervention = 'ask';
    card.lastDelta = { operation: 'no_change', field, reason: 'El texto no responde una variable material de Step 0.' };
    return { card: finalize(card), changed: false };
  }
  if (UNKNOWN.test(content)) {
    if (!card.unknowns.some(item => item.field === field)) card.unknowns.push({ field, reason: 'Declarado desconocido por la persona.', createdAt: now });
    card.cardVersion += 1;
    card.lastIntervention = 'ask';
    card.lastDelta = { operation: 'mark_unknown', field, reason: 'La variable permanece desconocida y no satisface el requisito.' };
    card.history.push({ event: 'input', field, at: now });
    return { card: finalize(card), changed: true };
  }

  const existing = card.fields[field];
  if (existing && normalize(existing.value) === normalize(content)) {
    card.lastIntervention = 'analyze';
    card.lastDelta = { operation: 'no_change', field, reason: 'El dato ya está presente y vigente; no se duplica.' };
    return { card: finalize(card), changed: false };
  }

  card.cardVersion += 1;
  const sourceRefIds = suppliedSources.map(source => source.id);
  if (existing) {
    card.contradictions.push({ field, previous: existing.value, proposed: content, sourceRefIds, createdAt: now, status: 'open' });
    card.lastIntervention = 'review';
    card.lastDelta = { operation: 'mark_contradiction', field, reason: 'El nuevo dato contradice el estado vigente; se conserva la versión anterior y requiere revisión.' };
    card.history.push({ event: 'contradiction', field, value: content, at: now });
  }
  card.fields[field] = {
    value: content,
    kind: field === 'priorityHypothesis' ? 'hypothesis' : 'declared_fact',
    origin: 'human',
    sourceRefIds,
    version: card.cardVersion,
  };
  if (!card.claims.some(claim => claim.field === field && normalize(claim.statement) === normalize(content))) {
    card.claims.push({ id: `step0-claim-v${card.cardVersion}-${field}`, field, statement: content, kind: card.fields[field]!.kind, origin: 'human', sourceRefIds, createdAt: now });
  }
  card.unknowns = card.unknowns.filter(item => item.field !== field);
  if (!existing) {
    card.lastIntervention = card.sufficiency.sufficient ? 'checkpoint' : 'ask';
    card.lastDelta = { operation: suppliedSources.length > 0 ? 'link_source' : 'add', field, reason: suppliedSources.length > 0 ? 'Dato declarado con SourceRef; la fuente sigue sin validación automática.' : 'Dato declarado por la persona.' };
    card.history.push({ event: 'input', field, value: content, at: now });
  }
  finalize(card);
  if (card.sufficiency.sufficient && !card.requiresReview) card.lastIntervention = 'checkpoint';
  return { card, changed: true };
}
