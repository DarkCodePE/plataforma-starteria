import type { PortfolioEntryConfirmation } from '../portfolio-entry-sessions/domain/portfolio-entry-confirmation.types';
import type {
  PortfolioEntryHandoffRecord,
  PortfolioEntrySession,
  PortfolioEntryTurn,
} from '../portfolio-entry-sessions/domain/portfolio-entry-session.types';
import type { LiveUnderstandingViewModel } from './presentation/live-understanding-view-model';
import type { CriticalHandoffProjection } from './presentation/critical-handoff-projection';
import type { PortfolioEntryCriticalHandoffRecord } from '../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';

export type PortfolioEntrySessionClientDto = {
  id: string;
  lifecycleStatus: PortfolioEntrySession['lifecycleStatus'];
  executionStatus: PortfolioEntrySession['executionStatus'];
  continuationProfile?: PortfolioEntrySession['continuationProfile'];
  revision: number;
  expiresAt: string;
  ownership: {
    state: PortfolioEntrySession['ownershipState'];
    ownerUserId?: string;
  };
  conversation: Array<{
    id: string;
    turnIndex: number;
    userInput: string;
    emittedQuestions: PortfolioEntryTurn['emittedQuestions'];
    matchedQuestionIds: string[];
    respondedResolves: string[];
    createdAt: string;
  }>;
  clarification: {
    interactionMode: PortfolioEntrySession['interactionMode'];
    quickQuestionBudget: 3;
    quickQuestionsAsked: number;
    explorationRound: number;
    questionsAskedCurrentRound: number;
    previousQuestions: Array<Omit<PortfolioEntrySession['semanticState']['previousQuestions'][number], 'reason_to_ask'>>;
    answeredGaps: string[];
    checkpoint?: 'quick' | 'guided';
  };
  semanticProjection: {
    initialEntryState?: PortfolioEntrySession['semanticState']['initialEntryState'];
    currentFrame?: PortfolioEntrySession['semanticState']['currentFrame'];
    primaryIntent?: PortfolioEntrySession['semanticState']['primaryIntent'];
    reverseAlignment?: PortfolioEntrySession['semanticState']['reverseAlignment'];
    ambiguities?: PortfolioEntrySession['semanticState']['ambiguities'];
    contradictions?: PortfolioEntrySession['semanticState']['contradictions'];
    understanding?: {
      value: string;
      source: 'latestAnalysis.extracted_context';
    };
  };
  nextAction: 'submit_message' | 'answer_clarification' | 'offer_guided_exploration' | 'generate_handoff' | 'review_handoff' | 'retry_analysis' | 'continue_provisional_reading' | 'claim_or_close' | 'closed';
  handoff?: PortfolioEntryHandoffClientDto;
  confirmation?: PortfolioEntryConfirmationClientDto;
  pendingInput?: PortfolioEntrySession['semanticState']['pendingInput'];
  handoffMode?: 'live' | 'deterministic' | 'degraded';
  liveUnderstanding?: LiveUnderstandingViewModel;
  provisionalContinuation?: PortfolioEntryAuthenticatedProvisionalContinuationDto;
};

export type PortfolioEntryAuthenticatedProvisionalContinuationDto = {
  state: 'AUTHENTICATED_PROVISIONAL_CONTINUATION';
  sessionId: string;
  handoff: { id: string; version: number } | null;
  revision: number;
  ownerUserId: string;
  access: {
    portfolio: 'PROVISIONAL_ONLY';
    organizationScope: 'ORGANIZATIONAL_UNKNOWN';
    canonicalEntityCreation: false;
  };
  payload: {
    rawPublicContext: string;
    understoodNeed: PortfolioEntryHandoffRecord['handoff']['understanding'];
    desiredOutcome: PortfolioEntryHandoffRecord['handoff']['desired_outcome'];
    knownContext: PortfolioEntryHandoffRecord['handoff']['known_context'];
    provenance: PortfolioEntryHandoffRecord['handoff']['provenance_summary'];
    currentOpenItems: PortfolioEntryHandoffRecord['handoff']['evidence_or_clarity_needed'];
    laterWorkItems: PortfolioEntryHandoffRecord['handoff']['starteria_path'];
    organizationalUnknowns: PortfolioEntryHandoffRecord['handoff']['unresolved_context'];
    continuationSummary: PortfolioEntryHandoffRecord['handoff']['recommended_approach'] | null;
    selectedMaterialGap: PortfolioEntryHandoffRecord['handoff']['unresolved_context'][number] | null;
    decisionMetadata: {
      decisionToEnable: PortfolioEntryHandoffRecord['handoff']['decision_to_enable'];
      handoffStatus: PortfolioEntryHandoffRecord['handoff']['handoff_status'];
      starteriaPath: PortfolioEntryHandoffRecord['handoff']['starteria_path'];
      conversionEligible: false;
      initiativeProfileSelected: false;
    };
  };
};

export type PortfolioEntryHandoffClientDto = {
  id: string;
  version: number;
  status: PortfolioEntryHandoffRecord['status'];
  reviewDisposition: 'UNREVIEWED';
  handoff: PortfolioEntryHandoffRecord['handoff'];
  createdAt: string;
};

export type PortfolioEntryCriticalHandoffClientDto = {
  id: string;
  version: number;
  sourceContextRevision: number;
  state: 'current' | 'stale';
  confirmationState: 'provisional' | 'confirmed';
  confirmedAt: string | null;
  projection: CriticalHandoffProjection;
};

export type PortfolioEntryCriticalHandoffMaterializationClientDto = {
  sessionRevision: number;
  criticalHandoff: PortfolioEntryCriticalHandoffClientDto;
};

export type PortfolioEntryConfirmationClientDto = {
  id: string;
  version: number;
  status: PortfolioEntryConfirmation['status'];
  acceptedFields: string[];
  correctedFields: PortfolioEntryConfirmation['correctedFields'];
  rejectedFields: string[];
  notes?: string;
  confirmedAt?: string | null;
  createdAt: string;
};

export type PortfolioEntryConfirmedBriefDto = {
  source: 'portfolio_entry';
  sessionId: string;
  revision: number;
  handoffId: string;
  handoffVersion: number;
  confirmationId: string;
  confirmationVersion: number;
  brief: {
    rawEntry: string;
    handoff: PortfolioEntryHandoffRecord['handoff'];
    confirmation: {
      status: 'CONFIRMED';
      acceptedFields: string[];
      correctedFields: PortfolioEntryConfirmation['correctedFields'];
      rejectedFields: string[];
    };
  };
};

export function toPortfolioEntryConfirmedBriefDto(session: PortfolioEntrySession): PortfolioEntryConfirmedBriefDto {
  const handoff = session.latestHandoff!;
  const confirmation = session.confirmation!;
  return {
    source: 'portfolio_entry', sessionId: session.id, revision: session.revision,
    handoffId: handoff.id, handoffVersion: handoff.version,
    confirmationId: confirmation.id, confirmationVersion: confirmation.version,
    brief: {
      rawEntry: session.rawEntry,
      handoff: handoff.handoff,
      confirmation: {
        status: 'CONFIRMED', acceptedFields: confirmation.acceptedFields,
        correctedFields: confirmation.correctedFields, rejectedFields: confirmation.rejectedFields,
      },
    },
  };
}

export function toPortfolioEntrySessionClientDto(
  session: PortfolioEntrySession,
  turns: PortfolioEntryTurn[],
  liveUnderstanding?: LiveUnderstandingViewModel | null,
  options: { includeLegacyHandoff?: boolean } = {},
): PortfolioEntrySessionClientDto {
  const includeLegacyHandoff = options.includeLegacyHandoff ?? true;
  const activeTurnId = turns.at(-1)?.id;
  return {
    id: session.id,
    lifecycleStatus: session.lifecycleStatus,
    executionStatus: session.executionStatus,
    continuationProfile: session.continuationProfile ?? undefined,
    revision: session.revision,
    expiresAt: session.expiresAt.toISOString(),
    ownership: {
      state: session.ownershipState,
      ownerUserId: session.ownerUserId ?? undefined,
    },
    conversation: turns.map((turn) => ({
      id: turn.id,
      turnIndex: turn.turnIndex,
      userInput: turn.userInput,
      emittedQuestions: turn.emittedQuestions.map((question, index) => {
        if (turn.id === activeTurnId && index === 0) return question;
        const { reason_to_ask: _retiredReason, ...historicalQuestion } = question;
        return historicalQuestion;
      }),
      matchedQuestionIds: turn.matchedQuestionIds,
      respondedResolves: turn.respondedResolves,
      createdAt: turn.createdAt.toISOString(),
    })),
    clarification: {
      interactionMode: session.interactionMode,
      quickQuestionBudget: session.questionBudget.quickQuestionBudget,
      quickQuestionsAsked: session.questionBudget.quickQuestionsAsked,
      explorationRound: session.questionBudget.explorationRound,
      questionsAskedCurrentRound: session.questionBudget.questionsAskedCurrentRound,
      previousQuestions: session.semanticState.previousQuestions.map(({ reason_to_ask: _reason, ...question }) => question),
      answeredGaps: session.semanticState.answeredGaps,
      checkpoint: session.semanticState.runtimeClarificationStatus === 'exploration_offered'
        ? session.interactionMode === 'guided_exploration' ? 'guided' : 'quick'
        : undefined,
    },
    semanticProjection: {
      initialEntryState: session.semanticState.initialEntryState,
      currentFrame: session.semanticState.currentFrame,
      primaryIntent: session.semanticState.primaryIntent,
      reverseAlignment: session.semanticState.reverseAlignment,
      ambiguities: session.semanticState.ambiguities,
      contradictions: session.semanticState.contradictions,
      understanding: buildUnderstanding(session),
    },
    nextAction: deriveNextAction(session, turns),
    ...(includeLegacyHandoff && session.latestHandoff
      ? { handoff: toHandoffClientDto(session.latestHandoff) }
      : {}),
    confirmation: session.confirmation ? toConfirmationClientDto(session.confirmation) : undefined,
    pendingInput: session.semanticState.pendingInput,
    handoffMode: includeLegacyHandoff && session.latestHandoff
      ? session.semanticState.pendingInput?.status === 'FAILED_RETRYABLE' ? 'degraded' : 'deterministic'
      : undefined,
    ...(liveUnderstanding ? { liveUnderstanding } : {}),
  };
}

export function toPortfolioEntryAuthenticatedProvisionalContinuationDto(
  session: PortfolioEntrySession,
  turns: PortfolioEntryTurn[],
): PortfolioEntrySessionClientDto {
  const dto = toPortfolioEntrySessionClientDto(session, turns);
  const handoff = session.latestHandoff?.handoff;
  if (!session.ownerUserId) return dto;

  const confirmation = session.confirmation;
  const payload = buildProvisionalPayload(session, handoff, confirmation);
  return {
    ...dto,
    provisionalContinuation: {
      state: 'AUTHENTICATED_PROVISIONAL_CONTINUATION',
      sessionId: session.id,
      handoff: session.latestHandoff
        ? { id: session.latestHandoff.id, version: session.latestHandoff.version }
        : null,
      revision: session.revision,
      ownerUserId: session.ownerUserId,
      access: {
        portfolio: 'PROVISIONAL_ONLY',
        organizationScope: 'ORGANIZATIONAL_UNKNOWN',
        canonicalEntityCreation: false,
      },
      payload,
    },
  };
}

function buildProvisionalPayload(
  session: PortfolioEntrySession,
  handoff: PortfolioEntryHandoffRecord['handoff'] | undefined,
  confirmation: PortfolioEntryConfirmation | null | undefined,
): PortfolioEntryAuthenticatedProvisionalContinuationDto['payload'] {
  const corrected = confirmation?.correctedFields ?? {};
  const accepted = new Set(confirmation?.acceptedFields ?? []);
  const understoodCorrection = typeof corrected.understood_need === 'string' ? corrected.understood_need : undefined;
  const desiredCorrection = typeof corrected.desired_outcome === 'string' ? corrected.desired_outcome : undefined;
  const knownCorrection = Array.isArray(corrected.known_context) ? corrected.known_context as Array<{ key: string; value: string }> : undefined;
  const understood = understoodCorrection
    ? { value: understoodCorrection, provenance: { origin: 'USER_DECLARED' as const, source_path: 'confirmation.correctedFields.understood_need', source_text: understoodCorrection, review_disposition: 'USER_CONFIRMED' as const } }
    : addUserReview(handoff?.understanding, accepted.has('understood_need'));
  const desired = desiredCorrection
    ? { value: desiredCorrection, provenance: { origin: 'USER_DECLARED' as const, source_path: 'confirmation.correctedFields.desired_outcome', source_text: desiredCorrection, review_disposition: 'USER_CONFIRMED' as const } }
    : addUserReview(handoff?.desired_outcome, accepted.has('desired_outcome'));
  const known = knownCorrection
    ? knownCorrection.map((item) => ({ ...item, provenance: { origin: 'USER_DECLARED' as const, source_path: 'confirmation.correctedFields.known_context', source_text: item.value, review_disposition: 'USER_CONFIRMED' as const } }))
    : (handoff?.known_context ?? []).map((item) => addUserReview(item, accepted.has('known_context')));
  return {
    rawPublicContext: session.rawEntry,
    understoodNeed: understood ?? { value: '', provenance: undefined },
    desiredOutcome: desired ?? { value: '', provenance: undefined },
    knownContext: known,
    provenance: handoff?.provenance_summary ?? [],
    currentOpenItems: handoff?.evidence_or_clarity_needed ?? [],
    laterWorkItems: handoff?.starteria_path ?? [],
    organizationalUnknowns: handoff?.unresolved_context ?? [],
    continuationSummary: handoff?.recommended_approach ?? null,
    selectedMaterialGap: handoff?.unresolved_context?.[0] ?? null,
    decisionMetadata: {
      decisionToEnable: handoff?.decision_to_enable ?? 'unresolved',
      handoffStatus: handoff?.handoff_status ?? 'insufficient_input',
      starteriaPath: handoff?.starteria_path ?? [],
      conversionEligible: false,
      initiativeProfileSelected: false,
    },
  };
}

function addUserReview<T extends { provenance?: unknown }>(value: T | undefined, confirmed: boolean): T | undefined {
  if (!value || !confirmed) return value;
  return { ...value, provenance: { ...(value.provenance as Record<string, unknown> | undefined), review_disposition: 'USER_CONFIRMED' } } as T;
}

export function toHandoffClientDto(handoff: PortfolioEntryHandoffRecord): PortfolioEntryHandoffClientDto {
  return {
    id: handoff.id,
    version: handoff.version,
    status: handoff.status,
    reviewDisposition: 'UNREVIEWED',
    handoff: handoff.handoff,
    createdAt: handoff.createdAt.toISOString(),
  };
}

export function toCriticalHandoffClientDto(
  artifact: PortfolioEntryCriticalHandoffRecord,
  isCurrent: boolean,
): PortfolioEntryCriticalHandoffClientDto {
  return {
    id: artifact.id,
    version: artifact.artifactVersion,
    sourceContextRevision: artifact.sourceContextRevision,
    state: isCurrent ? 'current' : 'stale',
    confirmationState: artifact.confirmationState,
    // Confirmation evidence has its own timestamp; updatedAt remains record maintenance metadata.
    confirmedAt: artifact.confirmedAt?.toISOString() ?? null,
    projection: artifact.payload,
  };
}

function toConfirmationClientDto(confirmation: PortfolioEntryConfirmation): PortfolioEntryConfirmationClientDto {
  return {
    id: confirmation.id,
    version: confirmation.version,
    status: confirmation.status,
    acceptedFields: confirmation.acceptedFields,
    correctedFields: confirmation.correctedFields,
    rejectedFields: confirmation.rejectedFields,
    notes: confirmation.notes,
    confirmedAt: confirmation.confirmedAt?.toISOString() ?? null,
    createdAt: confirmation.createdAt.toISOString(),
  };
}

function deriveNextAction(session: PortfolioEntrySession, turns: PortfolioEntryTurn[]): PortfolioEntrySessionClientDto['nextAction'] {
  if (session.semanticState.pendingInput?.status === 'FAILED_RETRYABLE') return 'retry_analysis';
  if (session.semanticState.runtimeClarificationStatus === 'exploration_offered') return 'offer_guided_exploration';
  if (session.lifecycleStatus === 'ENTRY_CAPTURED' || session.lifecycleStatus === 'CLARIFYING') {
    return (turns.at(-1)?.emittedQuestions.length ?? 0) > 0 ? 'answer_clarification' : 'submit_message';
  }
  if (session.lifecycleStatus === 'HANDOFF_ELIGIBLE') return 'generate_handoff';
  if (session.lifecycleStatus === 'HANDOFF_READY' || session.lifecycleStatus === 'AWAITING_CONFIRMATION') return 'review_handoff';
  if (session.lifecycleStatus === 'CONFIRMED' || session.lifecycleStatus === 'REVISIONS_REQUESTED') return 'claim_or_close';
  return 'closed';
}

function buildUnderstanding(session: PortfolioEntrySession): PortfolioEntrySessionClientDto['semanticProjection']['understanding'] {
  const context = session.latestAnalysis?.extracted_context ?? session.semanticState.extractedContext;
  if (!context) return undefined;

  const values = [
    ['portfolio_size', 'portafolio'],
    ['initiatives_mentioned', 'iniciativas'],
    ['goal', 'objetivo'],
    ['decision_need', 'decisión'],
    ['problem', 'situación'],
    ['metric', 'señal'],
    ['constraints', 'restricción'],
    ['reporting_need', 'necesidad de reporte'],
  ] as const;
  const anchors = values
    .map(([key, label]) => {
      const value = context[key];
      if (value === null || value === undefined || value === '') return null;
      const rendered = Array.isArray(value) ? value.join(', ') : String(value);
      return `${label}: ${rendered}`;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);

  if (anchors.length < 2) return undefined;
  return {
    value: `Así estoy entendiendo lo que me dices: ${anchors.slice(0, 2).join('; ')}. ${anchors[2] ? `También aparece ${anchors[2]}.` : ''}`.trim(),
    source: 'latestAnalysis.extracted_context',
  };
}
