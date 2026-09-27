export type SubjectLevel = 'front_like' | 'challenge_like' | 'initiative_like' | 'unresolved';
export type ParentStatus = 'known' | 'provisional' | 'unresolved';
export type SignalStatus = 'confirmed' | 'proxy' | 'suggested' | 'unknown' | 'conflicting';

export type StrategicFramingState = {
  id: string;
  sourceMode: string;
  intendedMovement: string | null;
  whyItMatters: string | null;
  movementSignalStatus: SignalStatus | null;
  movementSignalValue: string | null;
  horizonContext: string | null;
  decisionToEnable: string | null;
  subjectLevel: SubjectLevel;
  scopeAssessment: { confidence: string; rationale: string[] };
  parentStatus: ParentStatus;
  parentContext: { label: string | null; sourceRefs: string[] };
  sufficiency: { status: string; blockers: string[]; softGaps: string[]; optionalContext: string[] };
  version: number;
  createdAt: string;
  updatedAt: string;
  prioritizationState?: StrategicFramingPrioritizationState;
  challengeStructuringState?: StrategicFramingChallengeStructuringState | null;
};

export type HumanDisposition = 'undecided' | 'address_now' | 'observe' | 'discard';
export type PriorityCandidate = { candidateId: string; kind: 'gap' | 'opportunity'; statementSnapshot: string; sourceRefs: string[]; humanDisposition: HumanDisposition; humanDecision: unknown | null };
export type StrategicFramingPrioritizationState = { schemaVersion: 1; nonCanonical: true; focusSlots: number | null; focusRationale: string | null; candidates: PriorityCandidate[] };
export type ChallengeCandidate = { challengeCandidateId: string; sourceCandidateIds: string[]; relatedWorkRefs: string[]; statement: string; structureKind: 'lightweight_challenge' | 'one_challenge' | 'multiple_challenges'; structuralRecommendationRef: string | null; structuralRecommendationVersion: string | null; confirmedByUserId: string; confirmedAt: string; createdFromStateVersion: number };
export type StrategicFramingChallengeStructuringState = { schemaVersion: 1; nonCanonical: true; candidates: ChallengeCandidate[] };
export type PrioritizationRecommendation = { candidateId: string; recommendedDisposition: 'address_now' | 'observe' | 'discard' | 'uncertain' | 'needs_clarification'; rationale: string[]; sourceRefs: string[]; humanDisposition: HumanDisposition; recommendationSnapshot: { recommendationVersion: string; inputStateVersion: number; recommendedDisposition: string; rationale: string[]; sourceRefs: string[] } };
export type PrioritizationRecommendationResult = { stateId: string; stateVersion: number; focusSlots: number | null; capacityStatus: string; recommendations: PrioritizationRecommendation[]; warnings: string[]; limitations: string[]; recommendationVersion: string };
export type PromotionSummary = { promotionId: string; challengeCandidateId: string; challengeId: string; challengeTitle?: string | null; strategicFrontId: string; status: string; promotedAt: string };
export type StrategicFramingPromotionResponse = { promotionId: string; challengeCandidateId: string; challengeId: string; challengeTitle: string; strategicFrontId: string; challengeStatus: 'draft'; retry: boolean };

export type StrategicFramingDraft = Pick<StrategicFramingState, 'intendedMovement' | 'whyItMatters' | 'movementSignalStatus' | 'movementSignalValue' | 'horizonContext' | 'decisionToEnable' | 'subjectLevel' | 'parentStatus'> & { parentLabel: string | null };

export type StrategicLensKey =
  | 'value_outcome'
  | 'customer_opportunity'
  | 'process_capability'
  | 'learning_evidence'
  | 'financial'
  | 'culture_organization'
  | 'technology'
  | 'risk_compliance'
  | 'ecosystem_partners';

export type StrategicLensSuggestion = {
  lens: StrategicLensKey;
  label: string;
  reason: string;
  materialQuestion: string;
  sourceRefs: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type StrategicLensSuggestionResult = {
  stateId: string;
  stateVersion: number;
  sourceMode: 'public_entry' | 'enterprise_direct' | 'existing_portfolio';
  depthHint: 'light' | 'standard' | 'deep';
  suggestions: StrategicLensSuggestion[];
  generatedAt: string;
};
