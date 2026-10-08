import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PortfolioEntryHandoffV2 } from '../../portfolio-entry-runtime/domain/handoff.schema';
import type { SessionContext, SessionTurnTrace } from '../../portfolio-entry-runtime/domain/session.types';
import type {
  PortfolioEntryConfirmation,
  PortfolioEntryConfirmationFieldMap,
  PortfolioEntryConfirmationStatus,
} from '../domain/portfolio-entry-confirmation.types';
import { createPortfolioEntryExpiry } from '../domain/portfolio-entry-session-expiry';
import {
  canTransitionPortfolioEntrySession,
  type PortfolioEntryExecutionStatus,
  type PortfolioEntrySessionLifecycleStatus,
} from '../domain/portfolio-entry-session.lifecycle';
import type {
  PortfolioEntryHandoffRecord,
  PortfolioEntryOrigin,
  PortfolioEntryQuestionBudgetState,
  PortfolioEntrySemanticState,
  PortfolioEntrySession,
  PortfolioEntrySourceMetadata,
  PortfolioEntryTurn,
  PortfolioEntryTurnInputIntent,
  PortfolioEntryVersioning,
} from '../domain/portfolio-entry-session.types';
import { semanticStateFromRuntimeContext, type PortfolioEntryPendingInput } from '../domain/portfolio-entry-session.types';
import type { PortfolioEntryModelExecutionRecord } from '../observability/portfolio-entry-execution-metadata';
import { PortfolioEntrySessionError } from './portfolio-entry-session-errors';
import { assertLifecycleTransition, assertSessionIsActive, isSessionConversionEligible } from './portfolio-entry-session-guards';
import type { PortfolioEntrySessionRepository } from './portfolio-entry-session.repository';

export type PortfolioEntrySessionServiceConfig = {
  ttlMs: number;
  versioning: PortfolioEntryVersioning;
};

export type CreatePortfolioEntrySessionServiceInput = {
  rawEntry?: string;
  entryOrigin: PortfolioEntryOrigin;
  sourceMetadata?: PortfolioEntrySourceMetadata;
  interactionMode?: PortfolioEntrySession['interactionMode'];
  now?: Date;
};

export type CreatePortfolioEntrySessionServiceResult = {
  session: PortfolioEntrySession;
  publicAccessToken: string;
};

export type PublicSessionAccessInput = {
  sessionId: string;
  publicAccessToken: string;
  now?: Date;
};

export type SaveTurnInput = {
  sessionId: string;
  runtimeTurn: SessionTurnTrace;
  runtimeContextAfter: SessionContext;
  inputIntent?: PortfolioEntryTurnInputIntent;
  matchedQuestionIds?: string[];
  respondedResolves?: string[];
  expectedRevision?: number;
  now?: Date;
};

export type ApplyRuntimeContextInput = {
  sessionId: string;
  runtimeContextAfter: SessionContext;
  expectedRevision?: number;
  now?: Date;
};

export type SaveHandoffInput = {
  sessionId: string;
  handoff: PortfolioEntryHandoffV2;
  sourceTurnId?: string;
  expectedRevision?: number;
  now?: Date;
};

export type SaveConfirmationInput = {
  sessionId: string;
  handoffId: string;
  status: PortfolioEntryConfirmationStatus;
  acceptedFields?: string[];
  correctedFields?: PortfolioEntryConfirmationFieldMap;
  rejectedFields?: string[];
  notes?: string;
  confirmedByUserId?: string | null;
  expectedRevision?: number;
  now?: Date;
};

export type AppendExecutionInput = Omit<PortfolioEntryModelExecutionRecord, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: Date;
};

export class PortfolioEntrySessionService {
  constructor(
    private readonly repository: PortfolioEntrySessionRepository,
    private readonly config: PortfolioEntrySessionServiceConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createAnonymousSession(
    input: CreatePortfolioEntrySessionServiceInput,
  ): Promise<CreatePortfolioEntrySessionServiceResult> {
    const now = input.now ?? this.now();
    const publicAccessToken = createPublicAccessToken();
    const initialBudget = createInitialBudget();
    const session: PortfolioEntrySession = {
      id: randomUUID(),
      ownerUserId: null,
      publicAccessTokenHash: hashPublicAccessToken(publicAccessToken),
      ownershipState: 'ANONYMOUS',
      rawEntry: input.rawEntry ?? '',
      entryOrigin: input.entryOrigin,
      sourceMetadata: input.sourceMetadata,
      lifecycleStatus: 'ENTRY_CAPTURED',
      executionStatus: 'NOT_STARTED',
      interactionMode: input.interactionMode ?? 'quick_clarification',
      semanticState: {
        previousQuestions: [],
        answeredGaps: [],
      },
      questionBudget: initialBudget,
      latestAnalysis: null,
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
      latestHandoff: null,
      confirmation: null,
      versioning: this.config.versioning,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      expiresAt: createPortfolioEntryExpiry(now, this.config),
      expiredAt: null,
    };

    return {
      session: await this.repository.createSession(session),
      publicAccessToken,
    };
  }

  async getForPublicAccess(input: PublicSessionAccessInput): Promise<PortfolioEntrySession> {
    const session = await this.repository.findSessionForPublicAccess(
      input.sessionId,
      hashPublicAccessToken(input.publicAccessToken),
    );
    if (!session) throw PortfolioEntrySessionError.unauthorized();
    if (session.ownershipState !== 'ANONYMOUS') throw PortfolioEntrySessionError.unauthorized();
    assertSessionIsActive(session, input.now ?? this.now());
    return session;
  }

  async getForOwner(sessionId: string, ownerUserId: string, now = this.now()): Promise<PortfolioEntrySession> {
    const session = await this.repository.findSessionForOwner(sessionId, ownerUserId);
    if (!session) throw PortfolioEntrySessionError.unauthorized();
    assertSessionIsActive(session, now);
    return session;
  }

  async claimOwnership(
    sessionId: string,
    ownerUserId: string,
    now = this.now(),
    expectedRevision?: number,
  ): Promise<PortfolioEntrySession> {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    assertSessionIsActive(session, now);
    return this.repository.claimOwnership({
      sessionId,
      ownerUserId,
      expectedRevision: expectedRevision ?? session.revision,
      now,
    });
  }

  async transitionLifecycle(
    sessionId: string,
    nextStatus: PortfolioEntrySessionLifecycleStatus,
    now = this.now(),
  ): Promise<PortfolioEntrySession> {
    const session = await this.requireSession(sessionId);
    assertSessionIsActive(session, now);
    assertLifecycleTransition(session, nextStatus);
    return this.repository.saveSessionState({
      session: {
        ...session,
        lifecycleStatus: nextStatus,
        revision: session.revision + 1,
        updatedAt: now,
        lastActivityAt: now,
      },
      expectedRevision: session.revision,
    });
  }

  async abandonConfirmedSession(sessionId: string, now = this.now()): Promise<PortfolioEntrySession> {
    const session = await this.requireSession(sessionId);
    if (session.lifecycleStatus === 'ABANDONED') return session;
    assertSessionIsActive(session, now);
    if (session.lifecycleStatus !== 'CONFIRMED' || session.confirmation?.status !== 'CONFIRMED') {
      throw PortfolioEntrySessionError.invalidTransition('Only a confirmed Portfolio Entry session can be discarded.');
    }
    assertLifecycleTransition(session, 'ABANDONED');
    try {
      return await this.repository.saveSessionState({
        session: { ...session, lifecycleStatus: 'ABANDONED', revision: session.revision + 1, updatedAt: now, lastActivityAt: now },
        expectedRevision: session.revision,
      });
    } catch (error) {
      const current = await this.repository.findSessionById(sessionId);
      if (current?.lifecycleStatus === 'ABANDONED') return current;
      throw error;
    }
  }

  async recordExecutionStatus(
    sessionId: string,
    executionStatus: PortfolioEntryExecutionStatus,
    now = this.now(),
  ): Promise<PortfolioEntrySession> {
    const session = await this.requireSession(sessionId);
    assertSessionIsActive(session, now);
    return this.repository.saveSessionState({
      session: {
        ...session,
        executionStatus,
        revision: session.revision + 1,
        updatedAt: now,
      },
      expectedRevision: session.revision,
    });
  }

  async appendTurn(input: SaveTurnInput): Promise<PortfolioEntryTurn> {
    const now = input.now ?? this.now();
    const session = await this.requireSession(input.sessionId);
    assertSessionIsActive(session, now);
    const expectedRevision = input.expectedRevision ?? session.revision;
    if (session.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();

    const semanticState = semanticStateFromRuntimeContext(
      input.runtimeContextAfter,
      input.runtimeTurn.analysis,
    );
    const analyzedPending = session.semanticState.pendingInput
      ? { ...session.semanticState.pendingInput, status: 'ANALYZED' as const, analysisVersion: input.runtimeTurn.analysis.analysis_version, updatedAt: now.toISOString() }
      : undefined;
    const updatedSession: PortfolioEntrySession = {
      ...session,
      lifecycleStatus: deriveLifecycleFromRuntimeStatus(input.runtimeContextAfter.clarification_status),
      executionStatus: 'SUCCEEDED',
      interactionMode: input.runtimeContextAfter.interaction_mode,
      semanticState: { ...semanticState, ...(analyzedPending ? { pendingInput: analyzedPending } : {}) },
      questionBudget: budgetFromRuntimeContext(input.runtimeContextAfter),
      latestAnalysis: input.runtimeTurn.analysis,
      revision: expectedRevision + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    assertTurnLifecycleApplication(session, updatedSession.lifecycleStatus);

    const turn: PortfolioEntryTurn = {
      id: randomUUID(),
      sessionId: session.id,
      turnIndex: input.runtimeTurn.turn_index,
      userInput: input.runtimeTurn.user_input,
      inputIntent: input.inputIntent ?? 'answer',
      emittedQuestions: input.runtimeTurn.questions_asked,
      matchedQuestionIds: input.matchedQuestionIds ?? [],
      respondedResolves: input.respondedResolves ?? [],
      analysisSnapshot: input.runtimeTurn.analysis,
      semanticStateAfter: semanticState,
      budgetBefore: input.runtimeTurn.available_question_budget,
      budgetAfter: input.runtimeTurn.transition.budget_after,
      transition: input.runtimeTurn.transition,
      provenanceDelta: input.runtimeTurn.provenance_delta,
      versioning: session.versioning,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.appendTurn(turn, updatedSession, expectedRevision);
  }

  async persistPendingInput(input: {
    sessionId: string;
    value: string;
    expectedRevision: number;
    now?: Date;
  }): Promise<PortfolioEntrySession> {
    const now = input.now ?? this.now();
    const session = await this.requireSession(input.sessionId);
    assertSessionIsActive(session, now);
    if (session.revision !== input.expectedRevision) throw PortfolioEntrySessionError.conflict();
    const existing = session.semanticState.pendingInput;
    if (existing && existing.value !== input.value && ['ANALYSIS_PENDING', 'FAILED_RETRYABLE'].includes(existing.status)) {
      throw PortfolioEntrySessionError.conflict();
    }
    const pending: PortfolioEntryPendingInput = {
      id: existing?.value === input.value ? existing.id : randomUUID(),
      value: input.value,
      status: 'ANALYSIS_PENDING',
      receivedAt: existing?.value === input.value ? existing.receivedAt : now.toISOString(),
      updatedAt: now.toISOString(),
      provenance: existing?.value === input.value
        ? existing.provenance
        : { origin: 'USER_DECLARED', sourcePath: 'messages.message', sourceText: input.value },
    };
    return this.repository.saveSessionState({
      session: { ...session, executionStatus: 'RUNNING', semanticState: { ...session.semanticState, pendingInput: pending }, revision: input.expectedRevision + 1, updatedAt: now, lastActivityAt: now },
      expectedRevision: input.expectedRevision,
    });
  }

  async markPendingInputFailed(input: {
    sessionId: string;
    expectedRevision: number;
    errorType: string;
    technicalError?: string;
    now?: Date;
  }): Promise<PortfolioEntrySession> {
    const now = input.now ?? this.now();
    const session = await this.requireSession(input.sessionId);
    const pending = session.semanticState.pendingInput;
    if (!pending || session.revision !== input.expectedRevision) throw PortfolioEntrySessionError.conflict();
    return this.repository.saveSessionState({
      session: {
        ...session,
        executionStatus: input.errorType === 'schema_invalid' ? 'SCHEMA_ERROR' : 'FAILED_RETRYABLE',
        semanticState: {
          ...session.semanticState,
          pendingInput: { ...pending, status: 'FAILED_RETRYABLE', updatedAt: now.toISOString(), failure: { errorType: input.errorType, ...(input.technicalError ? { technicalError: input.technicalError } : {}) } },
        },
        revision: input.expectedRevision + 1,
        updatedAt: now,
        lastActivityAt: now,
      },
      expectedRevision: input.expectedRevision,
    });
  }

  async applyRuntimeContext(input: ApplyRuntimeContextInput): Promise<PortfolioEntrySession> {
    const now = input.now ?? this.now();
    const session = await this.requireSession(input.sessionId);
    assertSessionIsActive(session, now);
    const expectedRevision = input.expectedRevision ?? session.revision;
    if (session.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();

    const semanticState = semanticStateFromRuntimeContext(
      input.runtimeContextAfter,
      session.latestAnalysis ?? undefined,
    );
    const updatedSession: PortfolioEntrySession = {
      ...session,
      lifecycleStatus: deriveLifecycleFromRuntimeStatus(input.runtimeContextAfter.clarification_status),
      executionStatus: 'SUCCEEDED',
      interactionMode: input.runtimeContextAfter.interaction_mode,
      semanticState,
      questionBudget: budgetFromRuntimeContext(input.runtimeContextAfter),
      revision: expectedRevision + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    assertTurnLifecycleApplication(session, updatedSession.lifecycleStatus);
    return this.repository.saveSessionState({ session: updatedSession, expectedRevision });
  }

  async appendModelExecution(input: AppendExecutionInput): Promise<PortfolioEntryModelExecutionRecord> {
    const session = await this.requireSession(input.sessionId);
    assertSessionIsActive(session, input.createdAt ?? this.now());
    return this.repository.appendModelExecution({
      ...input,
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? this.now(),
    });
  }

  async saveHandoff(input: SaveHandoffInput): Promise<PortfolioEntryHandoffRecord> {
    const now = input.now ?? this.now();
    const session = await this.requireSession(input.sessionId);
    assertSessionIsActive(session, now);
    const expectedRevision = input.expectedRevision ?? session.revision;
    if (session.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();
    assertHandoffLifecycleApplication(session);

    const latest = session.latestHandoff;
    const handoff: PortfolioEntryHandoffRecord = {
      id: randomUUID(),
      sessionId: session.id,
      version: (latest?.version ?? 0) + 1,
      handoff: input.handoff,
      sourceTurnId: input.sourceTurnId,
      status: input.handoff.handoff_status,
      versioning: session.versioning,
      createdAt: now,
      updatedAt: now,
    };
    const updatedSession = {
      ...session,
      lifecycleStatus: 'HANDOFF_READY' as const,
      latestHandoff: handoff,
      revision: expectedRevision + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    return this.repository.saveHandoff(handoff, updatedSession, expectedRevision);
  }

  async saveConfirmation(input: SaveConfirmationInput): Promise<PortfolioEntryConfirmation> {
    const now = input.now ?? this.now();
    const session = await this.requireSession(input.sessionId);
    assertSessionIsActive(session, now);
    const expectedRevision = input.expectedRevision ?? session.revision;
    if (session.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();
    const nextLifecycle = lifecycleFromConfirmationStatus(input.status);
    assertConfirmationLifecycleApplication(session, nextLifecycle);

    const confirmation: PortfolioEntryConfirmation = {
      id: randomUUID(),
      sessionId: session.id,
      handoffId: input.handoffId,
      version: (session.confirmation?.version ?? 0) + 1,
      status: input.status,
      acceptedFields: input.acceptedFields ?? [],
      correctedFields: input.correctedFields ?? {},
      rejectedFields: input.rejectedFields ?? [],
      notes: input.notes,
      confirmedByUserId: input.confirmedByUserId ?? null,
      confirmedAt: input.status === 'CONFIRMED' ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    const updatedSession = {
      ...session,
      lifecycleStatus: nextLifecycle,
      confirmation,
      revision: expectedRevision + 1,
      updatedAt: now,
      lastActivityAt: now,
    };
    return this.repository.saveConfirmation(confirmation, updatedSession, expectedRevision);
  }

  async markConversionEligible(sessionId: string, now = this.now()): Promise<PortfolioEntrySession> {
    const session = await this.requireSession(sessionId);
    assertSessionIsActive(session, now);
    if (!isSessionConversionEligible(session)) {
      throw PortfolioEntrySessionError.invalidTransition('Portfolio Entry session is not conversion eligible.');
    }
    assertLifecycleTransition(session, 'CONVERSION_ELIGIBLE');
    return this.repository.saveSessionState({
      session: {
        ...session,
        lifecycleStatus: 'CONVERSION_ELIGIBLE',
        revision: session.revision + 1,
        updatedAt: now,
        lastActivityAt: now,
      },
      expectedRevision: session.revision,
    });
  }

  async markExpired(sessionId: string, now = this.now()): Promise<PortfolioEntrySession> {
    const session = await this.requireSession(sessionId);
    assertLifecycleTransition(session, 'EXPIRED');
    return this.repository.markExpired(session.id, now, session.revision);
  }

  private async requireSession(sessionId: string): Promise<PortfolioEntrySession> {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    return session;
  }
}

export function hashPublicAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createPublicAccessToken(): string {
  return randomBytes(32).toString('hex');
}

function createInitialBudget(): PortfolioEntryQuestionBudgetState {
  return {
    quickQuestionBudget: 3,
    quickQuestionsAsked: 0,
    explorationRound: 0,
    questionsAskedCurrentRound: 0,
  };
}

function budgetFromRuntimeContext(context: SessionContext): PortfolioEntryQuestionBudgetState {
  return {
    quickQuestionBudget: context.quick_question_budget,
    quickQuestionsAsked: context.quick_questions_asked,
    explorationRound: context.exploration_round,
    questionsAskedCurrentRound: context.questions_asked_current_round,
  };
}

function deriveLifecycleFromRuntimeStatus(status: SessionContext['clarification_status']): PortfolioEntrySessionLifecycleStatus {
  switch (status) {
    case 'not_started':
      return 'ENTRY_CAPTURED';
    case 'ready_for_handoff':
      return 'HANDOFF_ELIGIBLE';
    case 'in_progress':
    case 'exploration_offered':
    case 'guided_exploration':
    case 'ended_with_uncertainty':
      return 'CLARIFYING';
    case 'abandoned':
      return 'ABANDONED';
    default:
      throw PortfolioEntrySessionError.invalidTransition(`Unknown Portfolio Entry runtime clarification status: ${String(status)}`);
  }
}

function lifecycleFromConfirmationStatus(status: PortfolioEntryConfirmationStatus): PortfolioEntrySessionLifecycleStatus {
  if (status === 'CONFIRMED') return 'CONFIRMED';
  if (status === 'REVISIONS_REQUESTED') return 'REVISIONS_REQUESTED';
  return 'AWAITING_CONFIRMATION';
}

function assertTurnLifecycleApplication(
  session: PortfolioEntrySession,
  nextStatus: PortfolioEntrySessionLifecycleStatus,
): void {
  if (canTransitionPortfolioEntrySession(session.lifecycleStatus, nextStatus)) return;
  if (
    (session.lifecycleStatus === 'ENTRY_CAPTURED' || session.lifecycleStatus === 'CLARIFYING' || session.lifecycleStatus === 'REVISIONS_REQUESTED') &&
    canTransitionPortfolioEntrySession(session.lifecycleStatus, 'ANALYZING') &&
    canTransitionPortfolioEntrySession('ANALYZING', nextStatus)
  ) {
    return;
  }
  throw PortfolioEntrySessionError.invalidTransition(
    `Invalid Portfolio Entry session lifecycle transition: ${session.lifecycleStatus} -> ${nextStatus}`,
  );
}

function assertHandoffLifecycleApplication(session: PortfolioEntrySession): void {
  if (canTransitionPortfolioEntrySession(session.lifecycleStatus, 'HANDOFF_READY')) return;
  if (
    canTransitionPortfolioEntrySession(session.lifecycleStatus, 'HANDOFF_GENERATING') &&
    canTransitionPortfolioEntrySession('HANDOFF_GENERATING', 'HANDOFF_READY')
  ) {
    return;
  }
  throw PortfolioEntrySessionError.invalidTransition(
    `Invalid Portfolio Entry session lifecycle transition: ${session.lifecycleStatus} -> HANDOFF_READY`,
  );
}

function assertConfirmationLifecycleApplication(
  session: PortfolioEntrySession,
  nextStatus: PortfolioEntrySessionLifecycleStatus,
): void {
  if (canTransitionPortfolioEntrySession(session.lifecycleStatus, nextStatus)) return;
  if (
    canTransitionPortfolioEntrySession(session.lifecycleStatus, 'AWAITING_CONFIRMATION') &&
    canTransitionPortfolioEntrySession('AWAITING_CONFIRMATION', nextStatus)
  ) {
    return;
  }
  throw PortfolioEntrySessionError.invalidTransition(
    `Invalid Portfolio Entry session lifecycle transition: ${session.lifecycleStatus} -> ${nextStatus}`,
  );
}
