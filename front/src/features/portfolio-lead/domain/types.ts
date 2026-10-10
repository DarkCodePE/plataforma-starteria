export type PortfolioRole = 'owner' | 'mentor' | 'admin' | 'sponsor' | 'portfolio_lead';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple';
export type RiskLevel = 'low' | 'medium' | 'high';
import type { ChallengeContribution, ProgressSignal } from '../../adaptive-core/domain/types';

export interface StatusCopy {
  label: string;
  shortLabel: string;
  description?: string;
  visualIntent?: StatusTone;
}

export interface StatusVisualConfig {
  label: string;
  shortLabel?: string;
  tone: StatusTone;
  iconKey?: string;
  description?: string;
}

export type PortfolioStepNumber = 0 | 1 | 2 | 3 | 4;

export type StrategicFrontStatusCanonical =
  | 'draft'
  | 'in_definition'
  | 'with_active_challenges'
  | 'in_tracking'
  | 'pending_decision'
  | 'closed';
export type StrategicFrontStatusLegacy = 'active' | 'tracking' | 'paused';
export type StrategicFrontStatus = StrategicFrontStatusCanonical | StrategicFrontStatusLegacy;

export type ChallengeStatusCanonical =
  | 'draft'
  | 'ready_to_activate'
  | 'activating_team'
  | 'active'
  | 'receiving_initiatives'
  | 'in_tracking'
  | 'pending_decision'
  | 'closed';
export type ChallengeStatusLegacy =
  | 'listo_para_activar'
  | 'activo_interno'
  | 'publicado'
  | 'recibiendo_iniciativas'
  | 'con_iniciativas_activas'
  | 'pendiente_de_decision'
  // ADR-030: sin gemelo canonico a proposito. El valor que vive en Postgres es el
  // legacy; añadir un `paused` canonico dejaria el enum mestizo sin migrar los datos.
  | 'pausado'
  | 'cerrado';
export type ChallengeStatus = ChallengeStatusCanonical | ChallengeStatusLegacy;

export type ChallengeCoverageStatusCanonical =
  | 'no_coverage'
  | 'partial'
  | 'sufficient'
  | 'overlapped'
  | 'ready_for_decision'
  | 'needs_reformulation';
export type ChallengeCoverageStatusLegacy =
  | 'sin_cobertura'
  | 'cobertura_parcial'
  | 'cobertura_suficiente'
  | 'resuelto'
  | 'reformular'
  | 'cerrar'
  | 'necesita_reformulacion';
export type ChallengeCoverageStatus = ChallengeCoverageStatusCanonical | ChallengeCoverageStatusLegacy;

export type InitiativePortfolioStatusCanonical =
  | 'draft'
  | 'imported_pending_validation'
  | 'in_step_0'
  | 'in_step_1'
  | 'in_step_2'
  | 'in_step_3'
  | 'in_step_4'
  | 'blocked'
  | 'ready_for_decision'
  | 'closed';
export type InitiativePortfolioStatusLegacy =
  | 'en_step_0'
  | 'en_step_1'
  | 'en_step_2'
  | 'en_step_3'
  | 'en_step_4'
  | 'bloqueada'
  | 'esperando_revision'
  | 'lista_para_decision'
  | 'cerrada';
export type InitiativePortfolioStatus = InitiativePortfolioStatusCanonical | InitiativePortfolioStatusLegacy;

export type ImportSessionStatus =
  | 'uploaded'
  | 'processing'
  | 'review_required'
  | 'partially_published'
  | 'published'
  | 'failed';

export type ImportedItemStatus =
  | 'detected'
  | 'needs_classification'
  | 'conflict'
  | 'ready_to_publish'
  | 'published'
  | 'discarded';

export type StepContentStatus =
  | 'empty'
  | 'partial'
  | 'complete_preliminary'
  | 'complete_with_observations'
  | 'validated';

export type StepValidationStatus =
  | 'not_reviewed'
  | 'ai_reviewed'
  | 'requires_mentor'
  | 'requires_challenge_owner'
  | 'requires_sponsor'
  | 'approved';

export type EvidenceVerificationStatus =
  | 'unverified'
  | 'ai_detected'
  | 'user_confirmed'
  | 'mentor_confirmed';

export type DecisionType =
  | 'continue_validating'
  | 'iterate'
  | 'pivot'
  | 'scale_same_area'
  | 'scale_similar_area'
  | 'transfer_to_it'
  | 'integrate_to_roadmap'
  | 'pause'
  | 'close_with_learning';

export type ChallengeTypeCanonical = 'correction' | 'growth' | 'exploration';
export type ChallengeTypeLegacy = 'correccion' | 'crecimiento' | 'exploracion';
export type ChallengeType = ChallengeTypeCanonical | ChallengeTypeLegacy;

export type ContributionType = 'discover' | 'validate' | 'partially_solve' | 'directly_solve';

export type ContributionTypeLegacy =
  | 'descubrir'
  | 'validar'
  | 'resolver_parcialmente'
  | 'resolver_directamente';

export type ConfidentialityLevel = 'low' | 'medium' | 'high' | 'no_ai_full_content';
export type ConfidentialityLevelLegacy = ConfidentialityLevel;

export type ImportSourceType = 'excel' | 'csv' | 'doc' | 'pdf' | 'ppt' | 'text' | 'url' | 'folder';
export type ImportContextMode =
  | 'map_to_existing_structure'
  | 'propose_structure'
  | 'classify_only'
  | 'specific_front'
  | 'specific_challenge';
export type ImportedItemTargetEntity = 'front' | 'challenge' | 'initiative' | 'step_progress' | 'evidence';
export type PortfolioValidationRole = 'ai' | 'mentor' | 'challenge_owner' | 'sponsor' | 'portfolio_lead';
export type PortfolioValidationStatus = 'approved' | 'needs_iteration' | 'blocked' | 'commented';
export type PortfolioEvidenceType = 'file' | 'text' | 'link' | 'metric' | 'interview' | 'observation' | 'report';

export type StrategicFrontPriority = 'Baja' | 'Media' | 'Alta' | 'Critica';
export type ChallengeActivationMode =
  | 'convocatoria_abierta'
  | 'personas_seleccionadas'
  | 'squad_asignado'
  | 'equipo_core_encargado'
  | 'innovacion_abierta_partner_externo'
  | 'mantener_en_definicion';
export type ChallengeActivation = ChallengeActivationMode;
export type StakeholderStatus = 'definido' | 'notificado' | 'confirmado';
export type SponsorStatus = StakeholderStatus;
export type ChallengeOwnerStatus = StakeholderStatus;
export type InvitationStatus = 'pendiente' | 'notificado' | 'confirmado' | 'declinado';
export type SquadRole = 'lider' | 'colaborador';
export type InitiativeStep = 'Step 0' | 'Step 1' | 'Step 2' | 'Step 3' | 'Step 4';
export type InitiativeContributionType = ContributionType | ContributionTypeLegacy;
export type EstimatedContribution = 'bajo' | 'medio' | 'alto';
export type InitiativeOverlapLevel = 'bajo' | 'medio' | 'alto';
export type PortfolioDecisionOutcome =
  | 'pasar_a_segunda_fase'
  | 'iterar_desde_otro_angulo'
  | 'transferir_a_ti'
  | 'transferir_al_area_afectada'
  | 'evaluar_innovacion_abierta'
  | 'escalar_piloto'
  | 'cerrar_con_aprendizaje';
export type InitiativeStepProgressState = 'completado' | 'en_progreso' | 'pendiente' | 'bloqueado';
export type ExecutiveOutputStatus =
  | 'borrador_ejecutivo'
  | 'listo_para_compartir'
  | 'compartido_con_sponsor'
  | 'compartido_con_gerencia'
  | 'decision_recibida'
  | 'aprobado'
  | 'aprobado_con_ajustes'
  | 'rechazado'
  | 'transferido'
  | 'escalado_a_segunda_fase'
  | 'cerrado';
export type ChallengeActivationUrgency = 'alta' | 'media' | 'baja';
export type ChallengeActivationTimeAvailability = 'muy_poco' | 'acotado' | 'suficiente';
export type ChallengeActivationEffort = 'alto' | 'medio' | 'bajo';
export type ChallengeActivationClarity = 'alta' | 'media' | 'baja';
export type ChallengeActivationSensitivity = 'alta' | 'media' | 'baja';
export type ChallengeActivationCapacity = 'alta' | 'media' | 'baja';
export type ChallengeActivationTechnicalNeed = 'alta' | 'media' | 'baja';
export type ChallengeActivationDependency = 'ninguna' | 'ti' | 'legal' | 'data' | 'operaciones' | 'comercial';

export interface ChallengeActivationInputs {
  urgency: ChallengeActivationUrgency;
  timeAvailable: ChallengeActivationTimeAvailability;
  estimatedEffort: ChallengeActivationEffort;
  challengeClarity: ChallengeActivationClarity;
  informationSensitivity: ChallengeActivationSensitivity;
  internalCapacity: ChallengeActivationCapacity;
  technicalNeed: ChallengeActivationTechnicalNeed;
  sponsorStatus: SponsorStatus;
  dependency: ChallengeActivationDependency;
}

export interface StrategicFront {
  id: string;
  name: string;
  strategicObjective: string;
  whyNow: string;
  sponsorEmail?: string;
  mainKpi: string;
  baseline: string;
  target: string;
  threshold?: string;
  horizon: string;
  /** Restricciones estratégicas conocidas (Core §13). */
  constraints?: string;
  endDate?: string;
  area?: string;
  sponsor: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
  createdAt: string;
  lastUpdatedAt?: string;
  notes?: string;
  challengeCount: number;
  initiativeCount: number;
}

export interface CreateStrategicFrontInput {
  name: string;
  strategicObjective: string;
  whyNow: string;
  sponsorEmail?: string;
  mainKpi: string;
  baseline: string;
  target: string;
  threshold?: string;
  horizon: string;
  constraints?: string;
  endDate?: string;
  area?: string;
  sponsor: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
  notes?: string;
}

export type StrategicFrontQualityStatus = 'red' | 'yellow' | 'green';
export type StrategicFrontQualityCriterionStatus = 'complete' | 'needs_improvement' | 'missing';

export interface StrategicFrontQualityCriterion {
  id:
    | 'business_priority'
    | 'not_solution'
    | 'responsible_area'
    | 'sponsor'
    | 'progress_signal'
    | 'metric_coherence'
    | 'horizon'
    | 'scope'
    | 'actionable_challenges';
  label: string;
  status: StrategicFrontQualityCriterionStatus;
  feedback: string;
}

export interface StrategicFrontQualityInput {
  name: string;
  strategicObjective: string;
  sponsor: string;
  sponsorEmail?: string;
  mainKpi: string;
  baseline: string;
  target: string;
  threshold?: string;
  area?: string;
  horizon: string;
  endDate?: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
  whyNow?: string;
  notes?: string;
}

export interface StrategicFrontQualityEvaluation {
  qualityStatus: StrategicFrontQualityStatus;
  diagnosis: string;
  nextBestAction: {
    title: string;
    description: string;
  };
  criteria: StrategicFrontQualityCriterion[];
  warnings: string[];
  missingCriticalFields: string[];
  missingRecommendedFields: string[];
  canGenerateChallenges: boolean;
}

export interface StrategicFrontQualityReview {
  qualityStatus: StrategicFrontQualityStatus;
  diagnosis: string;
  strengths: string[];
  risks: string[];
  missingElements: string[];
  suggestedRewrite?: string;
  canGenerateChallenges: boolean;
  suggestedChallenges: string[];
  confidenceNote: string;
}

export interface ChallengeInvitation {
  id: string;
  value: string;
  status: InvitationStatus;
}

export interface SquadMember {
  id: string;
  value: string;
  role: SquadRole;
}

export interface Challenge {
  id: string;
  name: string;
  strategicFrontId: string;
  challengeType: ChallengeType | '';
  whatWeWantToMove: string;
  objective: string;
  whyNow: string;
  successCriteria: string;
  // Challenge Constraint Envelope (Core §14.1, E2E Job-Driven §15).
  knownFacts?: string;
  openQuestions?: string;
  constraints?: string;
  dependencies?: string;
  expectedDecision?: string;
  challengeOwner: string;
  challengeOwnerName?: string;
  sponsorName?: string;
  sponsorEmail?: string;
  horizon?: string;
  area?: string;
  notes?: string;
  currentMetricValue?: string;
  activationMode: ChallengeActivationMode;
  status: ChallengeStatus;
  createdAt: string;
  lastUpdatedAt?: string;
  challengeOwnerStatus: StakeholderStatus;
  sponsorStatus: StakeholderStatus;
  openCallStatus: 'inactiva' | 'activa';
  selectedPeople: ChallengeInvitation[];
  assignedSquad: SquadMember[];
  initiativeCount: number;
  blockedInitiativesCount?: number;
  coverageStatus: ChallengeCoverageStatus;
  visibleToParticipants: boolean;
  publicationNotes: string;
  lastPublishedAt?: string;
  activationInputs: ChallengeActivationInputs;
  activationRecommendationNote: string;
  activationMessageDraft: string;
}

export interface InitiativeDeliverable {
  id: string;
  title: string;
  type: 'Resumen' | 'PDF' | 'Deck' | 'Video' | 'Link';
  note: string;
}

export interface InitiativeStepTimelineEntry {
  step: InitiativeStep;
  state: InitiativeStepProgressState;
  note: string;
}

export interface ImportSession {
  id: string;
  organizationId?: string;
  uploadedBy: string;
  sourceType: ImportSourceType;
  sourceName?: string;
  status: ImportSessionStatus;
  contextMode: ImportContextMode;
  confidentialityLevel: ConfidentialityLevel;
  createdAt: string;
  updatedAt: string;
}

export interface ImportedItem {
  id: string;
  importSessionId: string;
  detectedName: string;
  detectedSummary?: string;
  suggestedFrontId?: string;
  suggestedFrontName?: string;
  suggestedChallengeId?: string;
  suggestedChallengeName?: string;
  suggestedOwnerEmail?: string;
  suggestedChallengeType?: ChallengeType;
  estimatedStep: PortfolioStepNumber;
  confidenceScore: number;
  missingCriticalFields: string[];
  risks: string[];
  duplicateOfItemId?: string;
  status: ImportedItemStatus;
}

export interface FieldMapping {
  id: string;
  importedItemId: string;
  targetEntity: ImportedItemTargetEntity;
  targetField: string;
  suggestedValue: string;
  sourceReference: string;
  confidenceScore: number;
  userConfirmed: boolean;
  userEditedValue?: string;
}

export interface StepProgress {
  id: string;
  initiativeId: string;
  step: PortfolioStepNumber;
  contentStatus: StepContentStatus;
  validationStatus: StepValidationStatus;
  completionScore: number;
  missingCriticalFields: string[];
  risks: string[];
  sourceRefs?: string[];
  lastReviewedAt?: string;
}

export interface PortfolioEvidence {
  id: string;
  initiativeId: string;
  step?: PortfolioStepNumber;
  moduleKey?: string;
  type: PortfolioEvidenceType;
  title: string;
  description?: string;
  storageUrl?: string;
  sourceDocumentId?: string;
  verificationStatus: EvidenceVerificationStatus;
  createdBy: string;
  createdAt: string;
}

export interface PortfolioValidation {
  id: string;
  initiativeId: string;
  step?: PortfolioStepNumber;
  validatorRole: PortfolioValidationRole;
  validatorId?: string;
  status: PortfolioValidationStatus;
  comments?: string;
  createdAt: string;
}

export interface Initiative {
  id: string;
  /** Real backend Project id (#100). Present when hydrated from the API; enables
   *  deep-linking into the Steps portal (#94). Absent on mock fixtures. */
  projectId?: string;
  name: string;
  strategicFrontId: string;
  challengeId: string;
  teamOwner: string;
  currentStep: InitiativeStep;
  status: InitiativePortfolioStatus;
  mentor: string;
  sponsorTouchpoint: string;
  mainAlert: string;
  nextActionRecommended: string;
  attackedArea: string;
  hypothesisCovered: string;
  mainMetric: string;
  contributionType: InitiativeContributionType;
  estimatedContribution: EstimatedContribution;
  lastActivity: string;
  signalSummary: string;
  mainBlocker: string;
  teamLabel: string;
  requiresSponsor: boolean;
  readyForDecision: boolean;
  blockedDays: number;
  requiresExternalCapability: boolean;
  partialSignal: boolean;
  resolvedCorePart: boolean;
  teamMembers: string[];
  executiveSummary: string;
  experimentSummary: string;
  deliverables: InitiativeDeliverable[];
  aiCommentSummary: string;
  mentorCommentSummary: string;
  decisionRecommendationReason: string;
  stepsTimeline: InitiativeStepTimelineEntry[];
  progressSignal?: ProgressSignal;
  challengeContribution?: ChallengeContribution;
  adaptationEvents?: Array<{
    id: string;
    eventType: string;
    summary: string;
    createdAt: string;
  }>;
}

export type PortfolioInitiative = Initiative;

/**
 * ADR-024 (#114): the subset of initiative fields a portfolio lead may edit and persist
 * via PUT /portfolio/initiatives/:projectId/meta. DERIVED fields (status, blockedDays,
 * lastActivity, currentStep) and the derived team cache (teamMembers/teamOwner/teamLabel)
 * are owned by the backend sync and are intentionally excluded.
 */
export type InitiativeEditableMeta = Partial<Pick<Initiative,
  | 'mentor' | 'sponsorTouchpoint' | 'mainAlert' | 'nextActionRecommended' | 'attackedArea'
  | 'hypothesisCovered' | 'mainMetric' | 'contributionType' | 'estimatedContribution'
  | 'signalSummary' | 'mainBlocker' | 'requiresSponsor' | 'readyForDecision'
  | 'requiresExternalCapability' | 'partialSignal' | 'resolvedCorePart'
  | 'executiveSummary' | 'experimentSummary' | 'aiCommentSummary' | 'mentorCommentSummary'
  | 'decisionRecommendationReason' | 'deliverables' | 'stepsTimeline' | 'progressSignal' | 'challengeContribution'
>>;

export interface InitiativeOverlap {
  id: string;
  challengeId: string;
  initiativeAId: string;
  initiativeBId: string;
  level: InitiativeOverlapLevel;
  rationale: string;
  recommendation: 'seguir' | 'fusionar' | 'reformular_una' | 'dejar_como_backup' | 'cerrar_una';
}

export interface PortfolioDecisionItem {
  id: string;
  challengeId: string;
  initiativeId: string;
  recommendation: PortfolioDecisionOutcome;
  summary: string;
  successReading: string;
  reviewReason: string;
}

export interface PortfolioDecisionRecord {
  id: string;
  initiativeId: string;
  challengeId?: string;
  decisionType: DecisionType;
  rationale: string;
  evidenceIds: string[];
  decidedBy: string;
  nextStep: string;
  ownerNextStep?: string;
  dueDate?: string;
  createdAt: string;
}

export type PortfolioDecision = PortfolioDecisionItem | PortfolioDecisionRecord;

export interface ExecutiveTimelineEntry {
  label: string;
  note: string;
}

export interface ExecutiveOutput {
  id: string;
  challengeId: string;
  initiativeId: string;
  recommendation: PortfolioDecisionOutcome;
  status: ExecutiveOutputStatus;
  whyNow: string;
  kpiToMove: string;
  approachSummary: string;
  scopeSummary: string;
  evidenceSummary: string;
  keyDeliverableSummary: string;
  cautionSummary: string;
  recommendationWhy: string;
  secondaryOptions: string;
  managementNeeds: string[];
  nextStepSummary: string;
  nextStepOwner: string;
  nextStepHorizon: string;
  nextStepExpectedResult: string;
  timeline: ExecutiveTimelineEntry[];
}

export type ExecutiveReport = ExecutiveOutput;

export interface EvidenceSummary {
  label: string;
  value: string;
  tone?: 'positive' | 'neutral' | 'risk';
}

export interface PortfolioAlert {
  id: string;
  tone: 'slate' | 'amber' | 'rose' | 'violet' | 'sky' | 'emerald';
  type?: 'decision' | 'activation' | 'coverage' | 'stakeholder' | 'blocker';
  title: string;
  description: string;
  contextLabel?: string;
  whyItMatters?: string;
  recommendedAction?: string;
  actionLabel?: string;
  actionPath?: string;
  frontId?: string;
  challengeId?: string;
  initiativeId?: string;
}

export interface PortfolioNextAction {
  label: string;
  description: string;
  ctaLabel?: string;
  contextLabel?: string;
  impactLabel?: string;
  riskLabel?: string;
  path?: string;
  frontId?: string;
  challengeId?: string;
  initiativeId?: string;
}

export interface CreateChallengeInput {
  name: string;
  strategicFrontId: string;
  challengeType: ChallengeType | '';
  whatWeWantToMove: string;
  objective: string;
  whyNow: string;
  successCriteria: string;
  knownFacts?: string;
  openQuestions?: string;
  constraints?: string;
  dependencies?: string;
  expectedDecision?: string;
  challengeOwner: string;
  sponsorName?: string;
  sponsorEmail?: string;
  horizon?: string;
  area?: string;
  notes?: string;
  challengeOwnerStatus?: StakeholderStatus;
  sponsorStatus?: StakeholderStatus;
  activationInputs?: Partial<ChallengeActivationInputs>;
  activationMode: ChallengeActivationMode;
  status: ChallengeStatus;
}

export interface PortfolioLeadState {
  strategicFronts: StrategicFront[];
  challenges: Challenge[];
  initiatives: Initiative[];
  initiativeOverlaps: InitiativeOverlap[];
  portfolioDecisions: PortfolioDecisionItem[];
  executiveOutputs: ExecutiveOutput[];
}

export interface PortfolioLeadSummary {
  fronts: number;
  activeFronts: number;
  /** Frentes con al menos una iniciativa en curso, esté o no el frente en estado activo. */
  frontsWithActiveInitiatives: number;
  challenges: number;
  /** Retos publicados (visibles para participantes); no mira si tienen iniciativas. */
  activeChallenges: number;
  /** Retos con al menos una iniciativa en curso, publicados o no. */
  challengesWithActiveInitiatives: number;
  challengesReadyToActivate: number;
  initiatives: number;
  activeInitiatives: number;
  blockedInitiatives: number;
  pendingDecisions: number;
  readyForDecisionInitiatives: number;
  executiveOutputs: number;
}

export interface PortfolioHomeBannerAction {
  label: string;
  path?: string;
  tone?: 'primary' | 'secondary' | 'ghost';
}

export interface PortfolioHomeSummaryCard {
  id: string;
  label: string;
  value: string;
  microcopy: string;
  tone: 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'slate';
  icon: 'fronts' | 'challenges' | 'activation' | 'blockers' | 'decisions' | 'activity' | 'ready';
  path?: string;
}

export interface PortfolioFrontOverviewCard {
  id: string;
  name: string;
  objective?: string;
  statusLabel?: string;
  executiveState: string;
  executiveTone: 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';
  coverageLabel?: string;
  mainKpi: string;
  progressPercent: number;
  progressLabel: string;
  stateReadout?: string;
  detail: string;
  challengesCount: number;
  initiativesCount: number;
  blockedInitiativesCount?: number;
  pendingDecisionsCount: number;
  createdLabel: string;
  lastActivityLabel: string;
  alerts: string[];
  nextAction: string;
  nextActionDescription: string;
  actionLabel: string;
  actionPath: string;
}

export interface PortfolioImportantChangeCard {
  id: string;
  impactLabel?: 'Impacto alto' | 'Impacto medio' | 'Impacto bajo';
  frontName: string;
  itemName: string;
  whyItMatters: string;
  risk: string;
  suggestedAction: string;
  actionLabel: string;
  actionPath?: string;
  tone: 'amber' | 'rose' | 'violet' | 'sky' | 'emerald' | 'slate';
  type: string;
}

export interface PortfolioPendingDecisionRow {
  id: string;
  decision: string;
  frontName: string;
  itemName: string;
  evidenceLevel: string;
  urgency: string;
  actionLabel: string;
  actionPath: string;
}

export interface PortfolioRecentActivityItem {
  id: string;
  label: string;
  description: string;
  timeLabel: string;
  tone: 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'slate';
}

export interface PortfolioAttentionQueueItem {
  id: string;
  tone: 'emerald' | 'amber' | 'rose' | 'violet' | 'sky' | 'slate';
  iconKey: 'target' | 'flag' | 'rocket' | 'alert' | 'lock' | 'check' | 'sparkles' | 'file' | 'decision' | 'users';
  title: string;
  subtitle: string;
  badgeLabel: string;
  actionLabel: string;
  actionPath?: string;
  contextLabel?: string;
  frontName?: string;
  challengeName?: string;
  initiativeName?: string;
  alertType?: 'bloqueo' | 'decision' | 'baja_cobertura' | 'sin_owner' | 'falta_evidencia' | 'activacion';
  severity?: 'Alta' | 'Media' | 'Baja';
  recommendedAction?: string;
}

export interface StrategicObjectiveChallengeRow {
  id: string;
  name: string;
  statusLabel: string;
  severity: 'critical' | 'attention' | 'healthy' | 'neutral';
  attentionLabel: string;
  initiativesCount: number;
  peopleCount: number;
  ownerLabel: string;
  progressPercent: number;
  coverageLabel: string;
  nextActionLabel: string;
  blockerLabel?: string;
  pendingDecisionLabel?: string;
  actionPath: string;
}

export interface StrategicObjectiveFrontAlert {
  id: string;
  label: string;
  actionLabel: string;
  actionPath: string;
  tone: 'rose' | 'violet' | 'amber' | 'slate';
}

export interface StrategicObjectiveFrontCard {
  id: string;
  name: string;
  strategicObjective: string;
  mainKpi: string;
  baseline: string;
  currentValue: string;
  target: string;
  progressPercent: number;
  statusLabel: string;
  statusTone: 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';
  healthStatus: 'requires_attention' | 'pending_decision' | 'tracking' | 'definition' | 'closed';
  attentionPriorityScore: number;
  sponsor: string;
  horizon: string;
  challengesCount: number;
  initiativesCount: number;
  blockersCount: number;
  pendingDecisionsCount: number;
  nextActionLabel: string;
  nextActionDescription: string;
  primaryActionLabel: string;
  primaryActionPath: string;
  alerts: StrategicObjectiveFrontAlert[];
  viewPath: string;
  createChallengePath: string;
  importPath: string;
  reportPath: string;
  hiddenChallengesCount: number;
  challenges: StrategicObjectiveChallengeRow[];
}

export interface PortfolioStrategicOverviewModel {
  fronts: StrategicObjectiveFrontCard[];
}

export interface PortfolioWelcomeBannerActionGroup {
  primary: PortfolioHomeBannerAction;
  secondary: PortfolioHomeBannerAction;
  tertiary?: PortfolioHomeBannerAction;
}

export interface PortfolioHomeExperienceModel {
  banner: {
    title: string;
    subtitle: string;
    actions: PortfolioWelcomeBannerActionGroup;
  };
  summaryCards: PortfolioHomeSummaryCard[];
  strategicOverview: PortfolioStrategicOverviewModel;
  strategicFronts: PortfolioFrontOverviewCard[];
  importantChanges: PortfolioImportantChangeCard[];
  pendingDecisions: PortfolioPendingDecisionRow[];
  recentActivity: PortfolioRecentActivityItem[];
}

export interface PortfolioDecisionCard {
  id: string;
  initiativeId: string;
  initiativeName: string;
  challengeId: string;
  challengeName: string;
  frontId: string;
  frontName: string;
  evidenceLabel: string;
  evidenceSummary: string;
  suggestedRoute: string;
  evidenceLevel?: string;
  urgency?: string;
  actionLabel: string;
  actionPath: string;
}

export interface ReadyToActivateChallengeCard {
  id: string;
  name: string;
  frontId: string;
  frontName: string;
  challengeTypeLabel: string;
  urgencyLabel: string;
  challengeOwner: string;
  sponsor: string;
  actionLabel: string;
  actionPath: string;
}

export interface ActiveFrontCard {
  id: string;
  name: string;
  mainKpi: string;
  coverageLabel: string;
  challengesCount: number;
  initiativesCount: number;
  nextActionLabel: string;
  actionLabel: string;
  actionPath: string;
}

export interface PortfolioHomeHeader {
  title: string;
  summaryLine: string;
  supportingLine: string;
}

export interface PortfolioHomeEmptyState {
  title: string;
  description: string;
  actionLabel: string;
  actionPath: string;
}

export interface HomeCommandCenterModel {
  header: PortfolioHomeHeader;
  nextAction: PortfolioNextAction;
  summary: PortfolioLeadSummary;
  alerts: PortfolioAlert[];
  pendingDecisions: PortfolioDecisionCard[];
  readyToActivateChallenges: ReadyToActivateChallengeCard[];
  activeFronts: ActiveFrontCard[];
  emptyState: PortfolioHomeEmptyState | null;
}

export interface StrategicFrontCardModel {
  id: string;
  name: string;
  strategicObjective: string;
  whyNow: string;
  sponsorEmail?: string;
  mainKpi: string;
  baseline: string;
  target: string;
  threshold?: string;
  horizon: string;
  endDate?: string;
  area?: string;
  sponsor: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
  statusLabel: string;
  lastUpdatedAt?: string;
  notes?: string;
  coverageStatus: ChallengeCoverageStatus;
  coverageLabel: string;
  challengesCount: number;
  initiativesCount: number;
  blockedInitiativesCount: number;
  pendingDecisionsCount: number;
  areaLabel: string;
  relevantBlocker: string;
  nextActionLabel: string;
  nextActionDescription: string;
  actionLabel: string;
  actionPath: string;
  focusReason: string;
}

export interface StrategicFrontsSummary {
  totalFronts: number;
  activeFronts: number;
  frontsWithoutChallenges: number;
  partialCoverageFronts: number;
  frontsPendingDecision: number;
}

export interface StrategicFrontFocusRecommendation {
  frontId: string;
  frontName: string;
  title: string;
  description: string;
  whyItMatters: string;
  missingPiece: string;
  actionLabel: string;
  actionPath: string;
  impactLabel: string;
  riskLabel: string;
}

export interface ChallengeActivationReadiness {
  challengeId: string;
  activationState: 'solo_definido' | 'listo_para_activar' | 'activo_interno' | 'publicado';
  activationStateLabel: string;
  readyToActivate: boolean;
  missingItems: string[];
}

export interface ChallengeActivationRecommendationModel {
  challengeId: string;
  recommendedMode: ChallengeActivationMode;
  recommendedModeLabel: string;
  justification: string;
  risks: string[];
  missingItems: string[];
  nextSteps: string[];
  confidenceLabel: 'Alta' | 'Media' | 'Baja';
  confidenceScore: number;
  sponsorRisk: boolean;
}

export interface ChallengeCardModel {
  id: string;
  name: string;
  frontId: string;
  frontName: string;
  challengeTypeLabel: string;
  whatWeWantToMove: string;
  mainSignalLabel: string;
  urgencyLabel: string;
  horizonLabel: string;
  challengeOwner: string;
  sponsor: string;
  status: ChallengeStatus;
  statusLabel: string;
  activationMode: ChallengeActivationMode;
  activationModeLabel: string;
  activationState: ChallengeActivationReadiness['activationState'];
  activationStateLabel: string;
  coverageStatus: ChallengeCoverageStatus;
  coverageLabel: string;
  initiativesCount: number;
  blockedInitiativesCount: number;
  pendingDecisionsCount: number;
  nextActionLabel: string;
  nextActionDescription: string;
  actionLabel: string;
  actionPath: string;
  focusReason: string;
  relevantBlocker: string;
}

export interface ChallengesSummary {
  totalChallenges: number;
  readyToActivate: number;
  activeChallenges: number;
  challengesWithoutCoverage: number;
  partialCoverageChallenges: number;
  challengesWithPendingDecision: number;
  blockedChallenges: number;
}

export interface ChallengesByActivationState {
  soloDefinidos: ChallengeCardModel[];
  listosParaActivar: ChallengeCardModel[];
  activosInternos: ChallengeCardModel[];
  publicados: ChallengeCardModel[];
}

export interface ChallengeFocusRecommendation {
  challengeId: string;
  challengeName: string;
  frontName: string;
  title: string;
  description: string;
  whyItMatters: string;
  missingPiece: string;
  riskLabel: string;
  actionLabel: string;
  actionPath: string;
}

export interface PortfolioLeadContextValue extends PortfolioLeadState {
  refreshPortfolioData: () => Promise<void>;
  createStrategicFront: (input: CreateStrategicFrontInput) => StrategicFront;
  updateStrategicFront: (frontId: string, input: CreateStrategicFrontInput) => void;
  updateStrategicFrontStatus: (frontId: string, status: StrategicFrontStatus) => void;
  createChallenge: (input: CreateChallengeInput) => Challenge;
  updateChallenge: (challengeId: string, input: Partial<Challenge>) => void;
  updateChallengeActivationMode: (challengeId: string, mode: ChallengeActivationMode) => void;
  updateChallengeActivationInputs: (challengeId: string, input: Partial<ChallengeActivationInputs>) => void;
  updateChallengeStakeholderStatus: (
    challengeId: string,
    stakeholder: 'challengeOwnerStatus' | 'sponsorStatus',
    status: StakeholderStatus,
  ) => void;
  acceptChallengeActivationRecommendation: (challengeId: string) => void;
  updateChallengeActivationRecommendationNote: (challengeId: string, note: string) => void;
  updateChallengeActivationMessageDraft: (challengeId: string, draft: string) => void;
  activateOpenCall: (challengeId: string) => void;
  addSelectedPerson: (challengeId: string, value: string) => void;
  updateSelectedPersonStatus: (challengeId: string, invitationId: string, status: InvitationStatus) => void;
  addSquadMember: (challengeId: string, value: string, role: SquadRole) => void;
  updateSquadMemberRole: (challengeId: string, memberId: string, role: SquadRole) => void;
  confirmAssignedSquad: (challengeId: string) => void;
  activateChallenge: (challengeId: string) => void;
  publishChallenge: (challengeId: string) => void;
  loadChallengeCoverageDemo: (challengeId: string) => void;
  createExecutiveOutput: (initiativeId: string, recommendation: PortfolioDecisionOutcome) => ExecutiveOutput | null;
  updateExecutiveOutputStatus: (outputId: string, status: ExecutiveOutputStatus) => void;
  // ADR-024 (#114): persist editable tracking fields of a reto-linked iniciativa.
  updateInitiativeMeta: (projectId: string, input: InitiativeEditableMeta) => void;
}
