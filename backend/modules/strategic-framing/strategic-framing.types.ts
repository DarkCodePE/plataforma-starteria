export type StrategicFramingSourceMode =
  | 'public_entry'
  | 'enterprise_direct'
  | 'existing_portfolio'
  | 'bootstrap'
  | 'unknown';

export type StrategicFramingPromotionResponse = {
  promotionId: string;
  challengeCandidateId: string;
  challengeId: string;
  challengeTitle: string;
  strategicFrontId: string;
  challengeStatus: 'draft';
  retry: boolean;
};

export type FramingProvenance =
  | 'user_declared'
  | 'extracted'
  | 'ai_inferred'
  | 'ai_suggested'
  | 'user_confirmed'
  | 'unknown';

export type DerivedFramingItem = {
  id: string;
  kind: 'observation' | 'driver' | 'gap' | 'opportunity';
  statement: string;
  sourceRefs: string[];
  provenance: 'extracted' | 'ai_inferred' | 'ai_suggested' | 'user_confirmed' | 'derived';
  confidence?: 'low' | 'medium' | 'high' | null;
  canonical: false;
};

export type StrategicFramingReadModel = {
  context: {
    organizationId?: string | null;
    userId: string;
    bootstrapSessionId?: string | null;
    sourceContinuationId?: string | null;
    sourceMode: StrategicFramingSourceMode;
  };
  anchor: {
    id?: string | null;
    status: 'anchor_insufficient' | 'anchor_provisional' | 'anchor_sufficient' | 'anchor_confirmed' | 'anchor_conflicting' | 'unknown';
    intendedMovement?: string | null;
    whyItMatters?: string | null;
    signal: { status: 'confirmed' | 'proxy' | 'suggested' | 'unknown' | 'conflicting'; value?: string | null } | null;
    decisionToEnable?: string | null;
    parentContext: {
      status: 'known' | 'provisional' | 'unresolved' | 'unknown';
      label?: string | null;
      sourceRefs: string[];
    };
    provenance: ReadonlyArray<{ sourceRef: string; kind: FramingProvenance }>;
  };
  scopeAssessment: {
    level: 'front_like' | 'challenge_like' | 'initiative_like' | 'unresolved';
    confidence: 'low' | 'medium' | 'high' | 'unknown';
    rationale: string[];
    provenance: string[];
    canonicalized: false;
  };
  existingWork: Array<{
    id: string;
    label: string;
    stateHint?: string | null;
    ownerCandidate?: string | null;
    alignment: {
      status: 'confirmed_alignment' | 'probable_alignment' | 'partial_alignment' | 'alignment_unknown' | 'possible_misalignment' | 'confirmed_misalignment' | 'out_of_current_priority' | 'unknown';
      provenance?: string | null;
    };
    sourceRefs: string[];
  }>;
  framingSignals: {
    observations: DerivedFramingItem[];
    drivers: DerivedFramingItem[];
    gaps: DerivedFramingItem[];
    opportunities: DerivedFramingItem[];
  };
  sufficiency: {
    status: 'sufficient' | 'insufficient' | 'conflicting' | 'unknown';
    blockers: string[];
    softGaps: string[];
    optionalContext: string[];
  };
  nextBestAction: {
    kind: 'clarify_anchor' | 'review_parent_context' | 'review_alignment' | 'inspect_existing_work' | 'ready_for_structured_framing' | 'resolve_conflict' | 'unknown';
    reason: string;
  };
  generatedAt: string;
};

export type StrategicFramingReadInput = {
  context: StrategicFramingReadModel['context'];
  anchor?: {
    id?: string | null;
    status?: string | null;
    outcomeStatement?: string | null;
    contextSummary?: string | null;
    decisionToEnable?: string | null;
    businessSignalStatus?: string | null;
    businessSignalValue?: string | null;
    sourceRefs?: unknown;
    provenanceStatus?: string | null;
  } | null;
  workItems?: Array<{
    id: string;
    rawLabel: string;
    proposedName?: string | null;
    proposedPurpose?: string | null;
    currentStateHint?: string | null;
    ownerCandidate?: string | null;
    sourceRefs?: unknown;
  }>;
  strategicConnections?: Array<{
    workItemId: string;
    status?: string | null;
    provenanceStatus?: string | null;
    sourceRefs?: unknown;
    rationale?: string | null;
  }>;
  advancementConditions?: Array<{
    id?: string;
    type?: string | null;
    status?: string | null;
    statement: string;
    severity?: string | null;
    movementAffected?: string | null;
    provenanceStatus?: string | null;
    sourceRefs?: unknown;
  }>;
  proposedMutations?: Array<{
    id: string;
    status?: string | null;
    materiality?: string | null;
    uncertainty?: string | null;
    rationale?: string | null;
    sourceRefs?: unknown;
  }>;
  canonicalContext?: {
    strategicFrontId?: string | null;
    strategicFrontLabel?: string | null;
    challengeId?: string | null;
    initiativeId?: string | null;
    sourceRefs?: string[];
  } | null;
  now?: () => Date;
};

export type StrategicFramingProvisionalSourceMode = 'public_entry' | 'enterprise_direct' | 'existing_portfolio';
export type StrategicFramingProvisionalSubject = 'front_like' | 'challenge_like' | 'initiative_like' | 'unresolved';
export type StrategicFramingParentContextStatus = 'known' | 'provisional' | 'unresolved';

export type StrategicFramingPriorityCandidateKind = 'gap' | 'opportunity';
export type StrategicFramingHumanDisposition = 'undecided' | 'address_now' | 'observe' | 'discard';
export type StrategicFramingRecommendationDisposition = 'address_now' | 'observe' | 'discard' | 'uncertain' | 'needs_clarification';

export type StrategicFramingRecommendationSnapshot = {
  recommendationVersion: string;
  inputStateVersion: number;
  recommendedDisposition: StrategicFramingRecommendationDisposition;
  rationale: string[];
  sourceRefs: string[];
};

export type StrategicFramingRecommendationEvidenceQuality = 'low' | 'medium' | 'high';

export type StrategicFramingPriorityRecommendationItem = {
  candidateId: string;
  kind: StrategicFramingPriorityCandidateKind;
  statementSnapshot: string;
  recommendedDisposition: StrategicFramingRecommendationDisposition;
  recommendedRank: number | null;
  rationale: string[];
  whyNow: string[];
  whyNotNow: string[];
  sourceRefs: string[];
  evidenceQuality: StrategicFramingRecommendationEvidenceQuality;
  humanDisposition: StrategicFramingHumanDisposition;
  recommendationSnapshot: StrategicFramingRecommendationSnapshot;
};

export type StrategicFramingPrioritizationRecommendationResult = {
  stateId: string;
  stateVersion: number;
  sourceMode: StrategicFramingProvisionalSourceMode;
  focusSlots: number | null;
  capacityStatus: 'unknown' | 'none' | 'limited' | 'available';
  recommendations: StrategicFramingPriorityRecommendationItem[];
  warnings: string[];
  limitations: string[];
  recommendationVersion: string;
};

export type StrategicFramingPriorityHumanDecision = {
  disposition: StrategicFramingHumanDisposition;
  actorUserId: string;
  decidedAt: string;
  rationale: string | null;
  appliedFromStateVersion: number;
  recommendationSnapshot: StrategicFramingRecommendationSnapshot;
};

export type StrategicFramingPriorityCandidate = {
  candidateId: string;
  kind: StrategicFramingPriorityCandidateKind;
  statementSnapshot: string;
  sourceCandidateRef: string;
  sourceVersion: string;
  sourceRefs: string[];
  provenance: 'extracted' | 'ai_inferred' | 'ai_suggested' | 'user_confirmed' | 'derived';
  confidence: 'low' | 'medium' | 'high' | null;
  uncertainty: string | null;
  humanDisposition: StrategicFramingHumanDisposition;
  humanDecision: StrategicFramingPriorityHumanDecision | null;
};

export type StrategicFramingPrioritizationState = {
  schemaVersion: 1;
  nonCanonical: true;
  focusSlots: number | null;
  focusRationale: string | null;
  candidates: StrategicFramingPriorityCandidate[];
};

export type StrategicFramingChallengeStructureKind = 'lightweight_challenge' | 'one_challenge' | 'multiple_challenges';

export type StrategicFramingChallengeCandidate = {
  challengeCandidateId: string;
  sourceCandidateIds: string[];
  relatedWorkRefs: string[];
  statement: string;
  structureKind: StrategicFramingChallengeStructureKind;
  structuralRecommendationRef: string | null;
  structuralRecommendationVersion: string | null;
  confirmedByUserId: string;
  confirmedAt: string;
  createdFromStateVersion: number;
};

export type StrategicFramingChallengeStructuringState = {
  schemaVersion: 1;
  nonCanonical: true;
  candidates: StrategicFramingChallengeCandidate[];
};

export type StrategicFramingCorrection = {
  intendedMovement?: string | null;
  whyItMatters?: string | null;
  movementSignalStatus?: string | null;
  movementSignalValue?: string | null;
  horizonContext?: string | null;
  decisionToEnable?: string | null;
  subjectLevel?: StrategicFramingProvisionalSubject;
  // Internal SF-3B compatibility fields. SF-3C's strict HTTP schema does not
  // expose these to browsers; existing initialization/service callers may use them.
  scopeAssessment?: StrategicFramingReadModel['scopeAssessment'];
  rationaleUncertainty?: string | null;
  parentStatus?: StrategicFramingParentContextStatus;
  parentContext?: { label?: string | null; sourceRefs?: string[] };
  sufficiency?: StrategicFramingReadModel['sufficiency'];
};

export type StrategicFramingProvisionalState = {
  id: string;
  userId: string;
  organizationId: string | null;
  sourceMode: StrategicFramingProvisionalSourceMode;
  logicalContextKey: string;
  sourceRefs: string[];
  provenance: ReadonlyArray<{ sourceRef: string; kind: FramingProvenance | 'source_or_derived' | 'human_corrected' | 'human_confirmed' | 'unresolved' }>;
  intendedMovement: string | null;
  whyItMatters: string | null;
  movementSignalStatus: string | null;
  movementSignalValue: string | null;
  horizonContext: string | null;
  decisionToEnable: string | null;
  subjectLevel: StrategicFramingProvisionalSubject;
  scopeAssessment: StrategicFramingReadModel['scopeAssessment'];
  rationaleUncertainty: string | null;
  parentStatus: StrategicFramingParentContextStatus;
  parentContext: { label: string | null; sourceRefs: string[] };
  sufficiency: StrategicFramingReadModel['sufficiency'];
  prioritizationState: StrategicFramingPrioritizationState;
  challengeStructuringState?: StrategicFramingChallengeStructuringState;
  version: number;
  createdAt: string;
  updatedAt: string;
};

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
  sourceMode: StrategicFramingProvisionalSourceMode;
  depthHint: 'light' | 'standard' | 'deep';
  suggestions: StrategicLensSuggestion[];
  generatedAt: string;
};
