/**
 * adapters.ts — issue #100.
 *
 * Maps the backend `/portfolio` responses into the rich portfolio-lead domain types so
 * the provider can hydrate from real data instead of the mock fixtures. The backend list
 * endpoints return a subset of the domain shape; everything the UI also reads is filled
 * with safe defaults (mirroring how createStrategicFront/createChallenge build new rows).
 *
 * Scope: READ path only. Mutations in the provider stay local for now (follow-up).
 */
import { buildDefaultActivationInputs } from './actions';
import type {
  Challenge,
  Initiative,
  InitiativeStep,
  StrategicFront,
} from './types';

type Raw = Record<string, any>;

function isoDate(value: unknown): string {
  return typeof value === 'string' ? value.split('T')[0] : '';
}

/** Backend `en_step_N` (legacy) → "Step N"; falls back to the project's numeric step. */
function stepLabel(status: unknown, projectCurrentStep?: unknown): InitiativeStep {
  const m = typeof status === 'string' ? /^en_step_([0-4])$/.exec(status) : null;
  if (m) return `Step ${m[1]}` as InitiativeStep;
  if (typeof projectCurrentStep === 'number') {
    const n = Math.min(4, Math.max(0, projectCurrentStep));
    return `Step ${n}` as InitiativeStep;
  }
  return 'Step 0';
}

export function adaptStrategicFront(raw: Raw): StrategicFront {
  return {
    id: raw.id,
    name: raw.name ?? '',
    strategicObjective: raw.strategicObjective ?? '',
    whyNow: raw.whyNow ?? '',
    sponsorEmail: raw.sponsorEmail ?? undefined,
    mainKpi: raw.mainKpi ?? '',
    constraints: raw.constraints ?? '',
    baseline: raw.baseline ?? '',
    target: raw.target ?? '',
    threshold: raw.threshold ?? undefined,
    horizon: raw.horizon ?? '',
    endDate: raw.endDate ?? undefined,
    area: raw.area ?? undefined,
    sponsor: raw.sponsor ?? '',
    priority: raw.priority ?? 'Media',
    status: raw.status ?? 'draft',
    createdAt: isoDate(raw.createdAt),
    lastUpdatedAt: isoDate(raw.updatedAt) || undefined,
    notes: raw.notes ?? undefined,
    challengeCount: raw._count?.challenges ?? 0,
    initiativeCount: 0,
  };
}

// `activationInputs` viaja en una columna Json, asi que lo que vuelve del backend es
// `unknown`: se comprueba antes de adoptarlo. Basta con que sea un objeto con los 9 ejes
// presentes — zod ya valido los VALORES al escribir (portfolio.schemas.ts); aqui solo se
// evita adoptar null/basura y quedarse sin selects que pintar.
const ACTIVATION_INPUT_KEYS = [
  'urgency', 'timeAvailable', 'estimatedEffort', 'challengeClarity', 'informationSensitivity',
  'internalCapacity', 'technicalNeed', 'sponsorStatus', 'dependency',
] as const;

function isActivationInputs(value: unknown): value is Challenge['activationInputs'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return ACTIVATION_INPUT_KEYS.every((k) => typeof (value as Record<string, unknown>)[k] === 'string');
}

export function adaptChallenge(raw: Raw): Challenge {
  const sponsorStatus = raw.sponsorStatus ?? 'definido';
  return {
    id: raw.id,
    name: raw.name ?? raw.title ?? '',
    strategicFrontId: raw.strategicFrontId,
    challengeType: raw.type ?? raw.challengeType ?? '',
    whatWeWantToMove: raw.whatWeWantToMove ?? '',
    objective: raw.objective ?? '',
    whyNow: raw.whyNow ?? '',
    successCriteria: raw.successCriteria ?? '',
    knownFacts: raw.knownFacts ?? '',
    openQuestions: raw.openQuestions ?? '',
    constraints: raw.constraints ?? '',
    dependencies: raw.dependencies ?? '',
    expectedDecision: raw.expectedDecision ?? '',
    challengeOwner: raw.challengeOwner ?? '',
    sponsorName: raw.sponsorName ?? undefined,
    sponsorEmail: raw.sponsorEmail ?? undefined,
    horizon: raw.horizon ?? undefined,
    area: raw.area ?? undefined,
    notes: raw.publicationNotes ?? undefined,
    activationMode: raw.activationMode ?? 'convocatoria_abierta',
    status: raw.status ?? 'draft',
    createdAt: isoDate(raw.createdAt),
    lastUpdatedAt: isoDate(raw.updatedAt) || undefined,
    challengeOwnerStatus: raw.challengeOwnerStatus ?? 'definido',
    sponsorStatus,
    openCallStatus: raw.openCallStatus === 'activa' ? 'activa' : 'inactiva',
    selectedPeople: Array.isArray(raw.selectedPeople)
      ? raw.selectedPeople.map((p: Raw) => ({ id: p.id, value: p.value, status: p.status ?? 'definido' }))
      : [],
    assignedSquad: Array.isArray(raw.assignedSquad)
      ? raw.assignedSquad.map((s: Raw) => ({ id: s.id, value: s.value, role: s.role ?? 'colaborador' }))
      : [],
    initiativeCount: raw._count?.initiativeMetas ?? 0,
    coverageStatus: raw.coverageStatus ?? 'sin_cobertura',
    visibleToParticipants: raw.visibleToParticipants ?? false,
    publicationNotes: raw.publicationNotes ?? '',
    lastPublishedAt: isoDate(raw.lastPublishedAt) || undefined,
    // MVP-P0-02: los 3 campos de autoria de la activacion YA se persisten (Challenge.*).
    // Antes se rellenaban siempre con defaults, asi que lo escrito por el usuario moria en
    // la primera lectura; por eso reconcileChallenge tenia que preservarlos a mano. Ahora se
    // leen del backend y el default solo cubre la fila que nunca los guardo (columna null).
    activationInputs: isActivationInputs(raw.activationInputs)
      ? raw.activationInputs
      : buildDefaultActivationInputs(sponsorStatus),
    activationRecommendationNote: typeof raw.activationRecommendationNote === 'string'
      ? raw.activationRecommendationNote
      : '',
    activationMessageDraft: typeof raw.activationMessageDraft === 'string'
      ? raw.activationMessageDraft
      : '',
  };
}

// ── domain → backend (write path, #104) ──────────────────────────────────────
// The backend zod schemas are non-strict (unknown keys are stripped), so front-only
// fields like activationInputs pass through harmlessly. But field NAMES and ENUMS must
// be coerced: the backend requires `title` (front uses `name`) and only accepts the
// legacy enum sets. These maps coerce canonical→legacy and drop unsupported values.

const FRONT_STATUS_TO_BACKEND: Record<string, 'draft' | 'active' | 'paused' | 'closed'> = {
  draft: 'draft', in_definition: 'draft',
  active: 'active', with_active_challenges: 'active', in_tracking: 'active', tracking: 'active', pending_decision: 'active',
  paused: 'paused',
  closed: 'closed',
};
const PRIORITY_TO_BACKEND: Record<string, 'Alta' | 'Media' | 'Baja'> = {
  Alta: 'Alta', Media: 'Media', Baja: 'Baja', Critica: 'Alta',
};
const CHALLENGE_TYPE_TO_BACKEND: Record<string, 'correccion' | 'crecimiento' | 'exploracion'> = {
  correccion: 'correccion', crecimiento: 'crecimiento', exploracion: 'exploracion',
  correction: 'correccion', growth: 'crecimiento', exploration: 'exploracion',
};
const CHALLENGE_STATUS_TO_BACKEND: Record<string, string> = {
  draft: 'draft',
  listo_para_activar: 'listo_para_activar', ready_to_activate: 'listo_para_activar',
  activo_interno: 'activo_interno', activating_team: 'activo_interno', active: 'activo_interno',
  publicado: 'publicado',
  recibiendo_iniciativas: 'recibiendo_iniciativas', receiving_initiatives: 'recibiendo_iniciativas',
  con_iniciativas_activas: 'con_iniciativas_activas', in_tracking: 'con_iniciativas_activas',
  pendiente_de_decision: 'pendiente_de_decision', pending_decision: 'pendiente_de_decision',
  // ADR-030: `paused` se acepta como alias de entrada por simetria con el resto del mapa,
  // pero SIEMPRE sale `pausado`: lo que se escribe en Postgres es la forma legacy.
  pausado: 'pausado', paused: 'pausado',
  cerrado: 'cerrado', closed: 'cerrado',
};
const CHALLENGE_ACTIVATION_BACKEND = new Set(['convocatoria_abierta', 'personas_seleccionadas', 'squad_asignado']);
const CHALLENGE_COVERAGE_BACKEND = new Set(['sin_cobertura', 'cobertura_parcial', 'cobertura_suficiente', 'resuelto', 'reformular', 'cerrar']);

const has = (v: unknown): boolean => v != null && v !== '';

export function toBackendStrategicFront(input: Raw): Raw {
  const out: Raw = {};
  for (const k of ['name', 'strategicObjective', 'whyNow', 'mainKpi', 'baseline', 'target', 'horizon', 'sponsor']) {
    if (has(input[k])) out[k] = input[k];
  }
  // Restricciones del Frente: opcionales, '' borra.
  if (typeof input.constraints === 'string') out.constraints = input.constraints;
  if (has(input.status)) out.status = FRONT_STATUS_TO_BACKEND[input.status] ?? 'draft';
  if (has(input.priority)) out.priority = PRIORITY_TO_BACKEND[input.priority] ?? 'Media';
  return out;
}

export function toBackendChallenge(input: Raw): Raw {
  const out: Raw = {};
  const name = input.name ?? input.title;
  if (has(name)) { out.title = name; out.name = name; }
  for (const k of ['whatWeWantToMove', 'objective', 'whyNow', 'successCriteria', 'challengeOwner', 'publicationNotes']) {
    if (has(input[k])) out[k] = input[k];
  }
  // Envelope del Reto (Core §14.1): opcional, así que '' es un borrado legítimo y viaja.
  for (const k of ['knownFacts', 'openQuestions', 'constraints', 'dependencies', 'expectedDecision']) {
    if (typeof input[k] === 'string') out[k] = input[k];
  }
  if (has(input.challengeType)) { const t = CHALLENGE_TYPE_TO_BACKEND[input.challengeType]; if (t) out.type = t; }
  if (has(input.challengeOwnerStatus)) out.challengeOwnerStatus = input.challengeOwnerStatus;
  if (has(input.sponsorStatus)) out.sponsorStatus = input.sponsorStatus;
  if (has(input.openCallStatus)) out.openCallStatus = input.openCallStatus;
  if (typeof input.visibleToParticipants === 'boolean') out.visibleToParticipants = input.visibleToParticipants;
  if (has(input.status)) { const s = CHALLENGE_STATUS_TO_BACKEND[input.status]; if (s) out.status = s; }
  if (input.activationMode && CHALLENGE_ACTIVATION_BACKEND.has(input.activationMode)) out.activationMode = input.activationMode;
  if (input.coverageStatus && CHALLENGE_COVERAGE_BACKEND.has(input.coverageStatus)) out.coverageStatus = input.coverageStatus;
  // MVP-P0-02: los 3 campos de autoria de la activacion ya tienen columna, asi que dejan de
  // ser front-only y viajan. Se mandan aunque vengan vacios ('' es un borrado legitimo del
  // usuario), por eso NO pasan por `has()`, que descarta la cadena vacia.
  if (isActivationInputs(input.activationInputs)) out.activationInputs = input.activationInputs;
  if (typeof input.activationRecommendationNote === 'string') out.activationRecommendationNote = input.activationRecommendationNote;
  if (typeof input.activationMessageDraft === 'string') out.activationMessageDraft = input.activationMessageDraft;
  return out;
}

// ── domain → backend: initiative meta WRITE path (#114 / ADR-024) ────────────
// Only EDITABLE tracking fields are sent. DERIVED fields (status, blockedDays,
// lastActivity, currentStep) are owned by the backend sync (initiative-progress.ts)
// and the derived team cache (teamMembers/teamOwner/teamLabel) is rejected server-side
// — sending them would be a no-op at best, so we omit them here.
// Keep this allowlist in lockstep with InitiativeEditableMeta (domain/types.ts). Legacy
// decision fields (alignmentNotes/decisionNotes) are intentionally NOT here — they have no
// portfolio-lead UI and are absent from InitiativeEditableMeta, so forwarding them would be
// dead code (caught in ADR-023 review).
const INITIATIVE_META_EDITABLE = [
  'mentor', 'sponsorTouchpoint', 'mainAlert', 'nextActionRecommended', 'attackedArea',
  'hypothesisCovered', 'mainMetric', 'signalSummary', 'mainBlocker', 'executiveSummary',
  'experimentSummary', 'aiCommentSummary', 'mentorCommentSummary', 'decisionRecommendationReason',
  'progressSignal', 'challengeContribution',
] as const;
const INITIATIVE_META_BOOL = [
  'requiresSponsor', 'readyForDecision', 'requiresExternalCapability', 'partialSignal', 'resolvedCorePart',
] as const;
const CONTRIBUTION_TYPE_BACKEND = new Set(['descubrir', 'validar', 'resolver_parcialmente', 'resolver_directamente']);
const ESTIMATED_CONTRIBUTION_BACKEND = new Set(['bajo', 'medio', 'alto']);

export function toBackendInitiativeMeta(challengeId: string, input: Raw): Raw {
  const out: Raw = { challengeId };
  for (const k of INITIATIVE_META_EDITABLE) {
    if (has(input[k])) out[k] = input[k];
  }
  for (const k of INITIATIVE_META_BOOL) {
    if (typeof input[k] === 'boolean') out[k] = input[k];
  }
  if (input.contributionType && CONTRIBUTION_TYPE_BACKEND.has(input.contributionType)) out.contributionType = input.contributionType;
  if (input.estimatedContribution && ESTIMATED_CONTRIBUTION_BACKEND.has(input.estimatedContribution)) out.estimatedContribution = input.estimatedContribution;
  if (Array.isArray(input.deliverables)) out.deliverables = input.deliverables;
  if (Array.isArray(input.stepsTimeline)) out.stepsTimeline = input.stepsTimeline;
  return out;
}

export function adaptInitiative(raw: Raw): Initiative {
  const project = raw.project ?? {};
  return {
    id: raw.id,
    projectId: project.id ?? raw.projectId,
    name: project.name ?? raw.name ?? 'Iniciativa',
    strategicFrontId: raw.strategicFrontId ?? '',
    challengeId: raw.challengeId,
    teamOwner: raw.teamOwner ?? project.owner?.name ?? '',
    currentStep: stepLabel(raw.status, project.currentStep),
    status: raw.status ?? 'en_step_0',
    mentor: raw.mentor ?? '',
    sponsorTouchpoint: raw.sponsorTouchpoint ?? '',
    mainAlert: raw.mainAlert ?? '',
    nextActionRecommended: raw.nextActionRecommended ?? '',
    attackedArea: raw.attackedArea ?? '',
    hypothesisCovered: raw.hypothesisCovered ?? '',
    mainMetric: raw.mainMetric ?? '',
    contributionType: raw.contributionType ?? 'descubrir',
    estimatedContribution: raw.estimatedContribution ?? 'bajo',
    lastActivity: raw.lastActivity ?? '',
    signalSummary: raw.signalSummary ?? '',
    mainBlocker: raw.mainBlocker ?? '',
    teamLabel: raw.teamLabel ?? '',
    requiresSponsor: raw.requiresSponsor ?? false,
    readyForDecision: raw.readyForDecision ?? false,
    blockedDays: raw.blockedDays ?? 0,
    requiresExternalCapability: raw.requiresExternalCapability ?? false,
    partialSignal: raw.partialSignal ?? false,
    resolvedCorePart: raw.resolvedCorePart ?? false,
    teamMembers: Array.isArray(raw.teamMembers) ? raw.teamMembers : [],
    executiveSummary: raw.executiveSummary ?? '',
    experimentSummary: raw.experimentSummary ?? '',
    deliverables: Array.isArray(raw.deliverables) ? raw.deliverables : [],
    aiCommentSummary: raw.aiCommentSummary ?? '',
    mentorCommentSummary: raw.mentorCommentSummary ?? '',
    decisionRecommendationReason: raw.decisionRecommendationReason ?? '',
    stepsTimeline: Array.isArray(raw.stepsTimeline) ? raw.stepsTimeline : [],
    progressSignal: raw.progressSignal ?? project.step0Data?.adaptiveCore?.progressSignal ?? undefined,
    challengeContribution: raw.challengeContribution ?? project.step0Data?.adaptiveCore?.challengeContribution ?? undefined,
    adaptationEvents: Array.isArray(raw.adaptationEvents) ? raw.adaptationEvents : [],
  };
}
