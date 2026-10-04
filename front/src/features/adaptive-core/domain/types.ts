import type { ChallengeType } from '../../initial-review/domain/types';

export type AdaptiveRouteType =
  | 'explore_validate'
  | 'design_solution'
  | 'implement_handoff'
  | 'plan_coordinate'
  | 'reconstruct_existing'
  | 'lightweight_plan';

export type AdaptiveDepthLevel = 'essential' | 'standard' | 'extended';
export type AdaptiveCheckpointStatus = 'locked' | 'ready' | 'in_progress' | 'completed' | 'blocked';
export type AdaptiveQuestionSource =
  | 'method_catalog'
  | 'company_context'
  | 'challenge_context'
  | 'critical_missing'
  | 'ai_controlled'
  | 'core'
  | 'route'
  | 'challenge_type'
  | 'previous_answer'
  | 'ai_generated';
export type AdaptiveEvidenceStrength = 'none' | 'weak' | 'medium' | 'strong';
export type AdaptiveGateSeverity = 'soft' | 'hard';

export interface ContextSnapshot {
  id: string;
  type: 'company' | 'challenge' | 'front';
  label: string;
  source: string;
  coverage: number;
  confidence: AdaptiveEvidenceStrength;
  capturedAt: string;
  constraints: string[];
  actors: string[];
  confirmable: boolean;
}

export interface AdaptiveQuestion {
  id: string;
  checkpointId: string;
  prompt: string;
  purpose: string;
  clarifiesVariable: string;
  priority: 'must' | 'should' | 'could';
  answerType: 'single_choice' | 'multi_choice' | 'free_text' | 'evidence_link' | 'date' | 'owner';
  reason: string;
  source: AdaptiveQuestionSource;
  sourceRefs?: string[];
  required?: boolean;
  checkpointKey?: string;
  configurationVersion?: number;
  allowsUnknown: boolean;
  optional: boolean;
  prefilledFrom?: string;
  contextDerived?: boolean;
  confirmationRequired?: boolean;
}

export interface AdaptiveGate {
  id: string;
  severity: AdaptiveGateSeverity;
  label: string;
  condition: string;
  resolution: string;
}

export interface StepCheckpoint {
  id: string;
  step: 0 | 1 | 2 | 3 | 4;
  code: string;
  title: string;
  purpose: string;
  status: AdaptiveCheckpointStatus;
  outputKey: string;
  completionCriteria: string[];
  questions: AdaptiveQuestion[];
  gates: AdaptiveGate[];
}

export interface StepConfiguration {
  id: string;
  step: 0 | 1 | 2 | 3 | 4;
  version: number;
  visibleName: string;
  stablePurpose: string;
  objective: string;
  expectedOutput: string;
  routeType: AdaptiveRouteType;
  depthLevel: AdaptiveDepthLevel;
  checkpoints: StepCheckpoint[];
  closureCriteria: string[];
  generatedAt: string;
  generatedBy: 'deterministic_fallback' | 'ai_controlled';
}

export interface InitiativeMasterContext {
  id: string;
  version: number;
  initialReviewSnapshotId?: string;
  challengeType?: ChallengeType;
  routeType: AdaptiveRouteType;
  depthLevel: AdaptiveDepthLevel;
  maturity: 'idea' | 'problem' | 'solution_proposed' | 'in_execution' | 'legacy_reconstruction';
  knownFacts: string[];
  assumptions: string[];
  missingCriticalInformation: string[];
  risks: string[];
  decisions: string[];
  contextSnapshots: ContextSnapshot[];
  /** Empresa elegida para la iniciativa: su Contexto de Aplicación (E2E Job-Driven §16). */
  companySnapshot?: { name: string; area: string | null; coverage: number; lowCoverage: boolean } | null;
  /** Reto heredado, si la iniciativa está asignada a uno. */
  challengeSnapshot?: { id: string; title?: string } | null;
  createdAt: string;
}

export interface ProgressSignal {
  id: string;
  step: 0 | 1 | 2 | 3 | 4;
  checkpointCode: string;
  checkpointTitle: string;
  health: 'healthy' | 'attention' | 'blocked' | 'ready_for_decision';
  hypothesis: string;
  evidence: string;
  evidenceStrength: AdaptiveEvidenceStrength;
  blocker: string;
  actorRequired: string;
  nextAction: string;
  upcomingDecision: string;
  updatedAt: string;
}

export interface AdaptiveTruthClaim {
  id: string;
  statement: string;
  verificationState?: string | null;
}

export interface AdaptiveEvidence {
  id: string;
  name?: string | null;
  truthStatus?: string | null;
  sourceRefId?: string | null;
  targetClaimId?: string | null;
}

export interface AdaptiveSourceRef {
  id: string;
  sourceType: string;
  reference: string;
}

export interface ChallengeContribution {
  subproblem: string;
  hypothesis: string;
  kpi: string;
  contributionType: 'discover' | 'validate' | 'partially_solve' | 'directly_solve';
  evidenceStrength: AdaptiveEvidenceStrength;
  scope: string;
  overlap: 'low' | 'medium' | 'high';
}

export interface AdaptiveInitiativeCore {
  schemaVersion: 'PRD-03-v0.4';
  masterContext: InitiativeMasterContext;
  stepConfigurations: StepConfiguration[];
  activeStepConfigurationId: string;
  progressSignal: ProgressSignal;
  challengeContribution?: ChallengeContribution;
  activeCheckpoint?: {
    id: string;
    step: 0 | 1 | 2 | 3 | 4;
    checkpointKey: string;
    status: AdaptiveCheckpointStatus;
    sequence: number;
    questions: AdaptiveQuestion[];
    sufficiency?: unknown;
    /** Respuestas ya confirmadas para este checkpoint (vacio si aun no se confirmo). */
    responses?: Record<string, unknown>;
    configurationId: string;
  } | null;
  checkpointInstances?: Array<Record<string, unknown>>;
  /**
   * Respuestas confirmadas de todos los checkpoints, fusionadas en orden cronologico por
   * el backend. Es la fuente de verdad del recorrido: la UI lee de aqui en vez de
   * reconstruir las variables desde el formulario legacy de cada Step.
   */
  confirmedResponses?: Record<string, unknown>;
  evidence?: AdaptiveEvidence[];
  sourceRefs?: AdaptiveSourceRef[];
  truthClaims?: AdaptiveTruthClaim[];
  stepOutputs?: Array<Record<string, unknown>>;
  auditEvents: Array<{
    id: string;
    type: string;
    createdAt: string;
    summary: string;
  }>;
}
