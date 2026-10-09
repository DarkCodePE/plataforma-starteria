import { createHash, randomUUID } from 'node:crypto';
import type {
  PortfolioEntryAgentAdapterV2,
  PortfolioEntryAnalyzeTurnInputV2,
  PortfolioEntryAnalyzeTurnOutputV2,
  PortfolioEntryHandoffMaterializer,
  SessionContext,
} from '../../portfolio-entry-runtime';
import {
  applyAnswerResolution,
  createSessionContextFromPersistedProjection,
  latestActiveQuestion,
  normalizePortfolioEntryTurnForPersistence,
  PortfolioEntrySessionController,
} from '../../portfolio-entry-runtime';
import { LiveModelExecutionError } from '../../portfolio-entry-runtime/model/live-model-error';
import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import {
  normalizeCriticalSituationSynthesisInput,
  type CriticalSituationSynthesisAuthorizedSnapshot,
} from '../../portfolio-entry-runtime/synthesis/critical-situation-synthesis-input';
import { hashPublicAccessToken, PortfolioEntrySessionService } from '../../portfolio-entry-sessions/application/portfolio-entry-session.service';
import type { PortfolioEntrySessionRepository } from '../../portfolio-entry-sessions/application/portfolio-entry-session.repository';
import { PortfolioEntrySessionError } from '../../portfolio-entry-sessions/application/portfolio-entry-session-errors';
import type { PortfolioEntrySession, PortfolioEntryTurn, PortfolioEntryTurnInputIntent } from '../../portfolio-entry-sessions/domain/portfolio-entry-session.types';
import { isCriticalHandoffCurrent } from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import type { PortfolioEntryModelExecutionRecord } from '../../portfolio-entry-sessions/observability/portfolio-entry-execution-metadata';
import {
  toPortfolioEntryAuthenticatedProvisionalContinuationDto,
  toCriticalHandoffClientDto,
  toPortfolioEntrySessionClientDto,
  toPortfolioEntryConfirmedBriefDto,
  type PortfolioEntryConfirmedBriefDto,
  type PortfolioEntrySessionClientDto,
} from '../portfolio-entry.dto';
import {
  toCriticalHandoffProjection,
  type CriticalHandoffProjection,
} from '../presentation/critical-handoff-projection';
import {
  liveUnderstandingUnavailableViewModel,
  toLiveUnderstandingViewModel,
  type LiveUnderstandingViewModel,
} from '../presentation/live-understanding-view-model';
import { PortfolioEntryApiError } from '../portfolio-entry.errors';
import type { ConfirmationBody, ConfirmedBriefIdentity, CreateSessionBody, GuidedExplorationBody, SubmitMessageBody } from '../portfolio-entry.schemas';
import type {
  PortfolioEntryIdempotencyRecord,
  PortfolioEntryIdempotencyRepository,
} from './portfolio-entry-idempotency.repository';

type Principal = { id: string };
type RequestContext = {
  requestId?: string;
  publicAccessToken?: string;
  principal?: Principal;
  idempotencyKey?: string;
  idempotencyRecordId?: string;
};
type Operation = 'submit_message' | 'guided_exploration_choice' | 'materialize_handoff' | 'confirm_handoff' | 'confirm_critical_handoff' | 'claim_session' | 'abandon_session';
const USER_CONFIRMABLE_FIELDS = new Set([
  'understood_need', 'understanding', 'desired_outcome', 'decision_to_enable', 'known_context',
  'unresolved_context', 'evidence_or_clarity_needed', 'recommended_approach',
]);
const ORGANIZATIONAL_FIELDS = new Set([
  'organization', 'organization_id', 'portfolio', 'portfolio_membership', 'portfolio_authority',
  'sponsor', 'sponsor_decision', 'management_priority', 'organizational_role', 'owner',
  'ownership', 'permission', 'permissions', 'access', 'initiative_owner', 'initiative',
  'project', 'steps', 'kpi', 'approval', 'organizational_unknowns',
]);
type RecoveryHint = {
  kind: 'portfolio-entry-recovery';
  operation: Operation;
  expectedRevision: number;
  inputIntent?: PortfolioEntryTurnInputIntent;
  pendingInputId?: string;
  turnIndex?: number;
  ownerUserId?: string;
};

export type PortfolioEntryExperimentalSessionConfig = {
  idempotencyTtlMs: number;
  versioning: PortfolioEntrySession['versioning'];
};

export type PortfolioEntryLiveUnderstandingSynthesisRequest = {
  purpose: 'live_understanding' | 'critical_handoff';
  sessionId: string;
  sessionRevision: number;
  contextRevision: number;
  turnIndex: number;
  sourceTurnId: string;
  authorizedSnapshot: CriticalSituationSynthesisAuthorizedSnapshot;
};

export interface PortfolioEntryLiveUnderstandingSynthesizer {
  synthesize(input: PortfolioEntryLiveUnderstandingSynthesisRequest): Promise<CriticalSituationSynthesis | null>;
}

export class PortfolioEntryExperimentalSessionService {
  constructor(
    private readonly sessionService: PortfolioEntrySessionService,
    private readonly sessionRepository: PortfolioEntrySessionRepository,
    private readonly idempotencyRepository: PortfolioEntryIdempotencyRepository,
    private readonly agentAdapter: PortfolioEntryAgentAdapterV2,
    private readonly handoffMaterializer: PortfolioEntryHandoffMaterializer,
    private readonly config: PortfolioEntryExperimentalSessionConfig,
    private readonly liveUnderstandingSynthesizer: PortfolioEntryLiveUnderstandingSynthesizer,
    private readonly criticalHandoffProjector: (source: unknown) => CriticalHandoffProjection = toCriticalHandoffProjection,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createAnonymousSession(body: CreateSessionBody) {
    const result = await this.sessionService.createAnonymousSession({
      entryOrigin: 'public_start',
      sourceMetadata: body.sourceMetadata,
      now: this.now(),
    });
    const turns = await this.sessionRepository.listTurns(result.session.id);
    return {
      session: toPortfolioEntrySessionClientDto(result.session, turns),
      publicAccessToken: result.publicAccessToken,
    };
  }

  async readSession(input: { sessionId: string; publicAccessToken?: string; principal?: Principal }): Promise<PortfolioEntrySessionClientDto> {
    const session = await this.authorize(input.sessionId, input);
    return this.toDto(session);
  }

  async readAuthenticatedProvisionalContinuation(sessionId: string, principal?: Principal): Promise<PortfolioEntrySessionClientDto> {
    if (!principal) throw PortfolioEntrySessionError.unauthorized();
    const session = await this.requireSession(sessionId);
    if (session.ownershipState !== 'CLAIMED' || session.ownerUserId !== principal.id) {
      throw PortfolioEntryApiError.forbiddenOwner();
    }
    if (session.expiresAt <= this.now()) throw PortfolioEntrySessionError.expired();
    return this.toProvisionalDto(session);
  }

  async resolveConfirmedBrief(sessionId: string, identity: ConfirmedBriefIdentity, principal?: Principal): Promise<PortfolioEntryConfirmedBriefDto> {
    if (!principal) throw PortfolioEntrySessionError.unauthorized();
    const session = await this.sessionRepository.findSessionById(sessionId);
    if (!session) throw PortfolioEntryApiError.briefResolution('NOT_FOUND');
    if (session.ownershipState !== 'CLAIMED' || session.ownerUserId !== principal.id) throw PortfolioEntryApiError.briefResolution('UNAUTHORIZED');
    if (session.lifecycleStatus === 'ABANDONED') throw PortfolioEntryApiError.briefResolution('ABANDONED');
    if (session.lifecycleStatus === 'EXPIRED' || session.expiredAt || session.expiresAt <= this.now()) throw PortfolioEntryApiError.briefResolution('EXPIRED');
    if (session.lifecycleStatus !== 'CONFIRMED') throw PortfolioEntryApiError.briefResolution('NOT_CONFIRMED');
    if (session.revision !== identity.sessionRevision) throw PortfolioEntryApiError.briefResolution('REVISION_MISMATCH');
    const handoff = session.latestHandoff;
    if (!handoff || handoff.id !== identity.handoffId || handoff.version !== identity.handoffVersion) throw PortfolioEntryApiError.briefResolution('INVALID_HANDOFF');
    const confirmation = session.confirmation;
    if (!confirmation || confirmation.status !== 'CONFIRMED' || confirmation.id !== identity.confirmationId || confirmation.version !== identity.confirmationVersion || confirmation.handoffId !== handoff.id) {
      throw PortfolioEntryApiError.briefResolution('INVALID_CONFIRMATION');
    }
    return { ...toPortfolioEntryConfirmedBriefDto(session), revision: identity.sessionRevision };
  }

  async submitMessage(sessionId: string, body: SubmitMessageBody, context: RequestContext): Promise<PortfolioEntrySessionClientDto> {
    const initial = await this.authorize(sessionId, context);
    assertNotConverted(initial);
    const inputIntent = body.intent ?? 'answer';
    return this.withIdempotency('submit_message', sessionId, body, context, async () => {
      const session = await this.authorize(sessionId, context);
      assertNotConverted(session);
      this.assertExpectedRevision(session, body.expectedRevision);
      const turnsBefore = await this.sessionRepository.listTurns(sessionId);
      const criticalHandoffSnapshot = await this.sessionService.getLatestCriticalHandoff(sessionId);
      if (inputIntent === 'correction' && criticalHandoffSnapshot?.artifact.confirmationState === 'confirmed') {
        throw PortfolioEntrySessionError.invalidTransition('A confirmed Critical Handoff cannot be edited in this slice.');
      }
      const hasCriticalHandoff = criticalHandoffSnapshot !== null;
      assertMessageInputAllowed(session, turnsBefore, inputIntent, hasCriticalHandoff);
      if (session.semanticState.pendingInput?.value === body.message
        && session.semanticState.pendingInput.status === 'ANALYZED'
        && (turnsBefore.at(-1)?.inputIntent ?? 'answer') === inputIntent) {
        return this.toDto(session);
      }
      // Accepting input is its own versioned mutation. Every subsequent
      // mutation in this request must use the returned revision.
      const pendingSession = await this.sessionService.persistPendingInput({
        sessionId,
        value: body.message,
        expectedRevision: body.expectedRevision,
        now: this.now(),
      });
      await this.storeRecovery(context, {
        kind: 'portfolio-entry-recovery',
        operation: 'submit_message',
        expectedRevision: body.expectedRevision,
        inputIntent,
        pendingInputId: pendingSession.semanticState.pendingInput?.id,
      });
      const activeQuestion = latestActiveQuestion(turnsBefore);
      const answer = applyAnswerResolution(
        contextFromSession(pendingSession, turnsBefore),
        activeQuestion,
        body.matchedQuestionIds,
        body.message,
      );
      const runtimeContext = answer.context;
      const controller = new PortfolioEntrySessionController(this.agentAdapter, {
        runId: context.requestId ?? randomUUID(),
        candidateId: 'portfolio-entry-api-v1',
      });
      let result;
      try {
        result = await controller.execute({
          caseId: sessionId,
          sessionId,
          runId: context.requestId ?? randomUUID(),
          candidateId: 'portfolio-entry-api-v1',
          initialUserInput: body.message,
          initialContext: runtimeContext,
          priorAnalysis: pendingSession.latestAnalysis ?? undefined,
          userInputIntent: inputIntent,
        });
      } catch (error) {
        await this.recordFailure(sessionId, error);
        const failed = await this.sessionService.markPendingInputFailed({
          sessionId,
          expectedRevision: pendingSession.revision,
          errorType: error instanceof LiveModelExecutionError && error.result.error_type === 'SCHEMA_ERROR' ? 'schema_invalid' : 'provider_unavailable',
          technicalError: error instanceof LiveModelExecutionError ? error.result.technical_error : undefined,
          now: this.now(),
        });
        return this.toDto(failed);
      }
      const runtimeTurn = result.trace.turns.at(-1);
      if (!runtimeTurn) throw PortfolioEntryApiError.schemaFailure();
      const resolvedAnswer = applyAnswerResolution(
        result.final_context,
        activeQuestion,
        answer.matchedQuestionIds,
        body.message,
        runtimeTurn.analysis,
      );
      result.final_context = resolvedAnswer.context;
      const runtimeTurnForPersistence = normalizePortfolioEntryTurnForPersistence(runtimeTurn, turnsBefore.length + 1);
      if (result.modelExecution) await this.recordExecution(sessionId, result.modelExecution);
      await this.storeRecovery(context, {
        kind: 'portfolio-entry-recovery',
        operation: 'submit_message',
        expectedRevision: body.expectedRevision,
        inputIntent,
        pendingInputId: pendingSession.semanticState.pendingInput?.id,
        turnIndex: runtimeTurnForPersistence.turn_index,
      });
      const appendedTurn = await this.sessionService.appendTurn({
        sessionId,
        runtimeTurn: runtimeTurnForPersistence,
        runtimeContextAfter: result.final_context,
        inputIntent,
        allowCriticalHandoffCorrectionReopen: inputIntent === 'correction' && hasCriticalHandoff,
        allowConfirmedCriticalHandoffContextAdvance: inputIntent === 'answer'
          && criticalHandoffSnapshot?.artifact.confirmationState === 'confirmed',
        matchedQuestionIds: resolvedAnswer.matchedQuestionIds,
        respondedResolves: resolvedAnswer.respondedResolves,
        expectedRevision: pendingSession.revision,
        expectedContextRevision: pendingSession.contextRevision,
        now: this.now(),
      });
      const analyzedRevision = pendingSession.revision + 1;
      let liveUnderstanding: LiveUnderstandingViewModel = liveUnderstandingUnavailableViewModel();
      try {
        const contextRevision = pendingSession.contextRevision + 1;
        const authorizedSnapshot = buildAuthorizedSynthesisSnapshot(
          sessionId,
          contextRevision,
          [...turnsBefore, appendedTurn],
          appendedTurn,
        );
        const synthesis = await this.liveUnderstandingSynthesizer.synthesize({
          purpose: 'live_understanding',
          sessionId,
          sessionRevision: analyzedRevision,
          contextRevision,
          turnIndex: appendedTurn.turnIndex,
          sourceTurnId: appendedTurn.id,
          authorizedSnapshot,
        });
        liveUnderstanding = synthesis
          ? toLiveUnderstandingViewModel(synthesis)
          : liveUnderstandingUnavailableViewModel();
      } catch {
        // Critical Situation Synthesis is secondary; its failure cannot undo an analyzed turn.
        liveUnderstanding = liveUnderstandingUnavailableViewModel();
      }

      const responseTurns = await this.sessionRepository.listTurns(sessionId);
      const responseSession = await this.requireSession(sessionId);
      const resultIsCurrent = responseSession.revision === analyzedRevision
        && responseTurns.at(-1)?.id === appendedTurn.id;
      return toPortfolioEntrySessionClientDto(
        responseSession,
        responseTurns,
        resultIsCurrent ? liveUnderstanding : liveUnderstandingUnavailableViewModel(),
      );
    }, (record) => this.recoverSubmit(sessionId, record, body.expectedRevision, body.message, inputIntent));
  }

  async chooseGuidedExploration(sessionId: string, body: GuidedExplorationBody, context: RequestContext): Promise<PortfolioEntrySessionClientDto> {
    const initial = await this.authorize(sessionId, context);
    assertNotConverted(initial);
    return this.withIdempotency('guided_exploration_choice', sessionId, body, context, async () => {
      this.assertExpectedRevision(initial, body.expectedRevision);
      const session = await this.authorize(sessionId, context);
      assertNotConverted(session);
      this.assertExpectedRevision(session, body.expectedRevision);
      const turnsBefore = await this.sessionRepository.listTurns(sessionId);
      const runtimeContext = contextFromSession(session, turnsBefore);
      if (runtimeContext.clarification_status !== 'exploration_offered') {
        throw PortfolioEntrySessionError.invalidTransition('Guided Exploration is not currently offered.');
      }
      if (body.choice === 'accept' && runtimeContext.interaction_mode !== 'quick_clarification') {
        throw PortfolioEntrySessionError.invalidTransition('Guided Exploration can only be accepted from the first checkpoint.');
      }
      const controller = new PortfolioEntrySessionController(this.agentAdapter, {
        runId: context.requestId ?? randomUUID(),
        candidateId: 'portfolio-entry-api-v1',
      });
      let result;
      try {
        result = await controller.execute({
          caseId: sessionId,
          sessionId,
          runId: context.requestId ?? randomUUID(),
          candidateId: 'portfolio-entry-api-v1',
          initialUserInput: '',
          initialContext: runtimeContext,
          priorAnalysis: session.latestAnalysis ?? undefined,
          guidedExplorationChoice: body.choice,
        });
      } catch (error) {
        await this.recordFailure(sessionId, error);
        throw error;
      }
      const runtimeTurn = result.trace.turns.at(-1);
      if (result.modelExecution) await this.recordExecution(sessionId, result.modelExecution);
      await this.storeRecovery(context, {
        kind: 'portfolio-entry-recovery',
        operation: 'guided_exploration_choice',
        expectedRevision: body.expectedRevision,
        turnIndex: runtimeTurn ? turnsBefore.length + 1 : undefined,
      });
      if (runtimeTurn) {
        const runtimeTurnForPersistence = normalizePortfolioEntryTurnForPersistence(runtimeTurn, turnsBefore.length + 1);
        await this.sessionService.appendTurn({
          sessionId,
          runtimeTurn: runtimeTurnForPersistence,
          runtimeContextAfter: result.final_context,
          inputIntent: 'checkpoint_choice',
          expectedRevision: body.expectedRevision,
          now: this.now(),
        });
      } else {
        await this.sessionService.applyRuntimeContext({
          sessionId,
          runtimeContextAfter: result.final_context,
          expectedRevision: body.expectedRevision,
          now: this.now(),
        });
      }
      return this.toDto(await this.requireSession(sessionId));
    }, (record) => this.recoverSessionRevision(sessionId, record, body.expectedRevision));
  }

  async materializeHandoff(sessionId: string, expectedRevision: number, context: RequestContext): Promise<PortfolioEntrySessionClientDto> {
    const initial = await this.authorize(sessionId, context);
    assertNotConverted(initial);
    return this.withIdempotency('materialize_handoff', sessionId, { expectedRevision }, context, async () => {
      this.assertExpectedRevision(initial, expectedRevision);
      const session = await this.authorize(sessionId, context);
      assertNotConverted(session);
      this.assertExpectedRevision(session, expectedRevision);
      if (!session.latestAnalysis) throw PortfolioEntrySessionError.invalidTransition('Portfolio Entry analysis is not ready for handoff.');
      const shouldMaterializeCriticalHandoff = isCriticalHandoffCheckpoint(session);
      const sourceContextRevision = session.contextRevision;
      const sourceTurnId = shouldMaterializeCriticalHandoff
        ? latestAnalyzedContextTurn(await this.sessionRepository.listTurns(sessionId))?.id
        : undefined;
      let materialized;
      try {
        materialized = await this.handoffMaterializer.materialize({
          sessionId,
          runId: context.requestId ?? randomUUID(),
          analysis: session.latestAnalysis,
          context: contextFromSession(session),
        });
      } catch (error) {
        await this.recordFailure(sessionId, error);
        throw error;
      }
      if (materialized.modelExecution) await this.recordExecution(sessionId, materialized.modelExecution);
      await this.storeRecovery(context, { kind: 'portfolio-entry-recovery', operation: 'materialize_handoff', expectedRevision });
      await this.sessionService.saveHandoff({ sessionId, handoff: materialized.handoff, expectedRevision, now: this.now() });

      // Critical Handoff is a side-car to the KEEP_COMPAT legacy handoff. The
      // legacy artifact is committed first; a failed KAN-114 synthesis or a
      // stale source must not turn the legacy endpoint into a provider-dependent
      // failure or synthesize from a newer context than the one this request saw.
      if (shouldMaterializeCriticalHandoff && sourceTurnId) {
        try {
          const currentSession = await this.authorize(sessionId, context);
          const currentTurns = await this.sessionRepository.listTurns(sessionId);
          const currentSourceTurn = latestAnalyzedContextTurn(currentTurns);
          if (currentSession.contextRevision === sourceContextRevision
            && currentSourceTurn?.id === sourceTurnId) {
            await this.materializeCriticalHandoff(currentSession, currentSession.revision, currentTurns);
          }
        } catch {
          // Legacy handoff availability is independent of the Critical Handoff
          // projection. Its GET endpoint remains empty until a real artifact is
          // successfully synthesized and persisted.
        }
      }
      return this.toDto(await this.requireSession(sessionId));
    }, (record) => this.recoverSessionRevision(sessionId, record, expectedRevision));
  }

  async readHandoff(input: { sessionId: string; publicAccessToken?: string; principal?: Principal }): Promise<PortfolioEntrySessionClientDto> {
    return this.readSession(input);
  }

  async readCriticalHandoff(input: { sessionId: string; publicAccessToken?: string; principal?: Principal }) {
    const session = await this.authorize(input.sessionId, input);
    const latest = await this.sessionService.getLatestCriticalHandoff(session.id);
    if (!latest) return null;
    return toCriticalHandoffClientDto(latest.artifact, latest.isCurrent);
  }

  async confirmCriticalHandoff(
    sessionId: string,
    artifactId: string,
    body: { action: 'confirm'; expectedArtifactVersion: number; expectedContextRevision: number },
    context: RequestContext,
  ) {
    // This confirms representativeness for continuing; it does not validate claims or choose a path.
    if (!context.principal) throw PortfolioEntrySessionError.unauthorized();
    const initial = await this.sessionRepository.findSessionById(sessionId);
    if (!initial) throw PortfolioEntrySessionError.notFound();
    if (initial.ownershipState !== 'CLAIMED' || initial.ownerUserId !== context.principal.id) {
      throw PortfolioEntryApiError.forbiddenOwner();
    }
    assertNotConverted(initial);
    await this.sessionService.getForOwner(sessionId, context.principal.id, this.now());

    const request = { artifactId, ...body };
    return this.withIdempotency('confirm_critical_handoff', sessionId, request, context, async () => {
      const session = await this.sessionService.getForOwner(sessionId, context.principal!.id, this.now());
      assertNotConverted(session);
      const confirmed = await this.sessionService.confirmCriticalHandoff({
        sessionId,
        artifactId,
        expectedArtifactVersion: body.expectedArtifactVersion,
        expectedContextRevision: body.expectedContextRevision,
        confirmingActorId: context.principal!.id,
        now: this.now(),
      });
      const isCurrent = isCriticalHandoffCurrent(
        confirmed.artifact,
        confirmed.artifact,
        confirmed.currentContextRevision,
      );
      return toCriticalHandoffClientDto(confirmed.artifact, isCurrent);
    }, async () => {
      const latest = await this.sessionService.getLatestCriticalHandoff(sessionId);
      if (!latest
        || !latest.isCurrent
        || latest.artifact.id !== artifactId
        || latest.artifact.artifactVersion !== body.expectedArtifactVersion
        || latest.artifact.sourceContextRevision !== body.expectedContextRevision
        || latest.artifact.confirmationState !== 'confirmed') return null;
      return toCriticalHandoffClientDto(latest.artifact, true);
    });
  }

  private async materializeCriticalHandoff(
    session: PortfolioEntrySession,
    expectedRevision: number,
    turns: PortfolioEntryTurn[],
  ): Promise<void> {
    if (session.semanticState.pendingInput?.status === 'ANALYSIS_PENDING') {
      throw PortfolioEntrySessionError.conflict();
    }
    const sourceTurn = latestAnalyzedContextTurn(turns);
    if (!sourceTurn) throw PortfolioEntrySessionError.invalidTransition('No analyzed user context is available for Critical Handoff.');

    const existing = await this.sessionService.getLatestCriticalHandoff(session.id);
    if (existing?.isCurrent
      && existing.artifact.sourceContextRevision === session.contextRevision
      && existing.artifact.sourceTurnId === sourceTurn.id) return;

    let projection: CriticalHandoffProjection;
    try {
      const authorizedSnapshot = buildAuthorizedSynthesisSnapshot(
        session.id,
        session.contextRevision,
        turns,
        sourceTurn,
      );
      const synthesis = await this.liveUnderstandingSynthesizer.synthesize({
        purpose: 'critical_handoff',
        sessionId: session.id,
        sessionRevision: expectedRevision,
        contextRevision: session.contextRevision,
        turnIndex: sourceTurn.turnIndex,
        sourceTurnId: sourceTurn.id,
        authorizedSnapshot,
      });
      if (!synthesis) throw new Error('KAN-114 returned no synthesis.');
      const validated = criticalSituationSynthesisSchema.parse(synthesis);
      projection = this.criticalHandoffProjector(validated);
    } catch (error) {
      await this.recordFailure(session.id, error);
      throw PortfolioEntryApiError.criticalHandoffSynthesisUnavailable();
    }

    await this.sessionService.createCriticalHandoff({
      sessionId: session.id,
      expectedSessionRevision: expectedRevision,
      sourceContextRevision: session.contextRevision,
      sourceTurnId: sourceTurn.id,
      payload: projection,
    });
  }

  async abandonConfirmedSession(sessionId: string, expectedRevision: number, context: RequestContext) {
    const current = await this.requireSession(sessionId);
    if (current.lifecycleStatus === 'ABANDONED') {
      const owned = context.principal
        ? current.ownershipState === 'CLAIMED' && current.ownerUserId === context.principal.id
        : Boolean(context.publicAccessToken && current.ownershipState === 'ANONYMOUS'
          && await this.sessionRepository.findSessionForPublicAccess(sessionId, hashPublicAccessToken(context.publicAccessToken)));
      if (!owned) throw PortfolioEntrySessionError.unauthorized();
      return { sessionId: current.id, lifecycleStatus: current.lifecycleStatus, revision: current.revision };
    }
    const initial = await this.authorize(sessionId, context);
    if (initial.lifecycleStatus !== 'CONFIRMED' || initial.confirmation?.status !== 'CONFIRMED' || !initial.latestHandoff) {
      throw PortfolioEntrySessionError.invalidTransition('Only a confirmed Brief can be discarded.');
    }
    this.assertExpectedRevision(initial, expectedRevision);
    return this.withIdempotency('abandon_session', sessionId, { expectedRevision }, context, async () => {
      const session = await this.authorize(sessionId, context);
      if (session.lifecycleStatus !== 'CONFIRMED' || session.confirmation?.status !== 'CONFIRMED' || !session.latestHandoff) {
        throw PortfolioEntrySessionError.invalidTransition('Only a confirmed Brief can be discarded.');
      }
      this.assertExpectedRevision(session, expectedRevision);
      const abandoned = await this.sessionService.abandonConfirmedSession(sessionId, this.now());
      return { sessionId: abandoned.id, lifecycleStatus: abandoned.lifecycleStatus, revision: abandoned.revision };
    }, async () => {
      const abandoned = await this.requireSession(sessionId);
      return abandoned.lifecycleStatus === 'ABANDONED'
        ? { sessionId: abandoned.id, lifecycleStatus: abandoned.lifecycleStatus, revision: abandoned.revision }
        : null;
    });
  }

  async confirmOrCorrect(sessionId: string, body: ConfirmationBody, context: RequestContext): Promise<PortfolioEntrySessionClientDto> {
    if (!context.principal) throw PortfolioEntrySessionError.unauthorized();
    validateConfirmationCommand(body);
    const initial = await this.authorize(sessionId, context);
    assertNotConverted(initial);
    return this.withIdempotency('confirm_handoff', sessionId, body, context, async () => {
      this.assertExpectedRevision(initial, body.expectedRevision);
      const session = await this.authorize(sessionId, context);
      assertNotConverted(session);
      this.assertExpectedRevision(session, body.expectedRevision);
      if (!session.latestHandoff) throw PortfolioEntrySessionError.invalidTransition('Portfolio Entry handoff is not available.');
      const status = body.action === 'confirm' ? 'CONFIRMED' : 'REVISIONS_REQUESTED';
      const acceptedFields = normalizeAcceptedFields(body);
      const correctedFields = normalizeCorrectedFields(body.correctedFields);
      await this.storeRecovery(context, { kind: 'portfolio-entry-recovery', operation: 'confirm_handoff', expectedRevision: body.expectedRevision });
      await this.sessionService.saveConfirmation({
        sessionId,
        handoffId: session.latestHandoff.id,
        status,
        acceptedFields,
        correctedFields,
        rejectedFields: body.rejectedFields,
        notes: body.notes,
        confirmedByUserId: context.principal?.id,
        expectedRevision: body.expectedRevision,
        now: this.now(),
      });
      return this.toProvisionalDto(await this.requireSession(sessionId));
    }, (record) => this.recoverSessionRevision(sessionId, record, body.expectedRevision));
  }

  async claim(sessionId: string, expectedRevision: number, context: RequestContext): Promise<PortfolioEntrySessionClientDto> {
    if (!context.principal) throw PortfolioEntrySessionError.unauthorized();
    const current = await this.requireSession(sessionId);
    if (current.expiresAt <= this.now()) throw PortfolioEntrySessionError.expired();

    // A claimed session is readable only by its owner. Returning the existing
    // projection makes same-user retries deterministic without a second CAS.
    if (current.ownershipState === 'CLAIMED') {
      if (current.ownerUserId !== context.principal.id) throw PortfolioEntryApiError.forbiddenOwner();
      return this.toProvisionalDto(current);
    }

    if (!context.publicAccessToken) throw PortfolioEntrySessionError.unauthorized();
    const initial = await this.sessionService.getForPublicAccess({ sessionId, publicAccessToken: context.publicAccessToken, now: this.now() });
    return this.withIdempotency('claim_session', sessionId, { expectedRevision }, context, async () => {
      this.assertExpectedRevision(initial, expectedRevision);
      const session = await this.sessionService.getForPublicAccess({ sessionId, publicAccessToken: context.publicAccessToken!, now: this.now() });
      this.assertExpectedRevision(session, expectedRevision);
      await this.storeRecovery(context, { kind: 'portfolio-entry-recovery', operation: 'claim_session', expectedRevision, ownerUserId: context.principal!.id });
      await this.sessionService.claimOwnership(sessionId, context.principal!.id, this.now(), expectedRevision);
      return this.toProvisionalDto(await this.requireSession(sessionId));
    }, (record) => this.recoverClaim(sessionId, record, expectedRevision));
  }

  private async authorize(sessionId: string, context: { publicAccessToken?: string; principal?: Principal }): Promise<PortfolioEntrySession> {
    if (context.principal) {
      try { return await this.sessionService.getForOwner(sessionId, context.principal.id, this.now()); } catch {
        if (!context.publicAccessToken) {
          const candidate = await this.sessionRepository.findSessionById(sessionId);
          if (candidate?.ownershipState === 'CLAIMED') throw PortfolioEntryApiError.forbiddenOwner();
        }
        /* An anonymous session may still be accessed with its public credential. */
      }
    }
    if (!context.publicAccessToken) throw PortfolioEntryApiError.missingPublicToken();
    return this.sessionService.getForPublicAccess({ sessionId, publicAccessToken: context.publicAccessToken, now: this.now() });
  }

  private async requireSession(sessionId: string): Promise<PortfolioEntrySession> {
    const session = await this.sessionRepository.findSessionById(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    return session;
  }

  private async toDto(session: PortfolioEntrySession): Promise<PortfolioEntrySessionClientDto> {
    return toPortfolioEntrySessionClientDto(session, await this.sessionRepository.listTurns(session.id));
  }

  private async toProvisionalDto(session: PortfolioEntrySession): Promise<PortfolioEntrySessionClientDto> {
    return toPortfolioEntryAuthenticatedProvisionalContinuationDto(
      session,
      await this.sessionRepository.listTurns(session.id),
    );
  }

  private assertExpectedRevision(session: PortfolioEntrySession, expectedRevision: number): void {
    if (session.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();
  }

  private async withIdempotency<T>(operation: Operation, sessionId: string, payload: unknown, context: RequestContext, run: () => Promise<T>, recover: (record: PortfolioEntryIdempotencyRecord) => Promise<T | null>): Promise<T> {
    const key = context.idempotencyKey;
    if (!key) throw PortfolioEntryApiError.missingIdempotencyKey();
    const now = this.now();
    const hash = createHash('sha256').update(stableJson(payload)).digest('hex');
    const existing = await this.idempotencyRepository.findActive(operation, sessionId, key, now);
    if (existing) {
      if (existing.requestPayloadHash !== hash) throw PortfolioEntryApiError.idempotencyConflict();
      if (existing.status === 'COMPLETED') return existing.responseSnapshot as T;
      const recovered = await recover(existing);
      if (recovered !== null) {
        await this.idempotencyRepository.complete({ id: existing.id, responseSnapshot: recovered });
        return recovered;
      }
      if (existing.status === 'FAILED') {
        context.idempotencyRecordId = existing.id;
        try {
          const result = await run();
          await this.idempotencyRepository.complete({ id: existing.id, responseSnapshot: result });
          return result;
        } catch (error) {
          await this.idempotencyRepository.markFailed(existing.id).catch(() => undefined);
          throw error;
        }
      }
      throw PortfolioEntryApiError.idempotencyInProgress();
    }
    const record = await this.idempotencyRepository.create({
      operation,
      scope: sessionId,
      sessionId,
      idempotencyKey: key,
      requestPayloadHash: hash,
      expiresAt: new Date(now.getTime() + this.config.idempotencyTtlMs),
    });
    context.idempotencyRecordId = record.id;
    try {
      const result = await run();
      await this.idempotencyRepository.complete({ id: record.id, responseSnapshot: result });
      return result;
    } catch (error) {
      await this.idempotencyRepository.markFailed(record.id).catch(() => undefined);
      throw error;
    }
  }

  private async storeRecovery(context: RequestContext, hint: RecoveryHint): Promise<void> {
    if (!context.idempotencyRecordId) return;
    await this.idempotencyRepository.storeRecoveryHint({ id: context.idempotencyRecordId, recoverySnapshot: hint });
  }

  private async recoverSubmit(
    sessionId: string,
    record: PortfolioEntryIdempotencyRecord,
    expectedRevision: number,
    message: string,
    inputIntent: PortfolioEntryTurnInputIntent,
  ): Promise<PortfolioEntrySessionClientDto | null> {
    const hint = recoveryHint(record, 'submit_message', expectedRevision);
    if (!hint?.pendingInputId) return null;
    if (hint.inputIntent !== undefined && hint.inputIntent !== inputIntent) return null;
    const session = await this.requireSession(sessionId);
    const pending = session.semanticState.pendingInput;
    if (!pending || pending.id !== hint.pendingInputId || pending.value !== message) return null;
    const turns = await this.sessionRepository.listTurns(sessionId);
    if (pending.status === 'FAILED_RETRYABLE') return toPortfolioEntrySessionClientDto(session, turns);
    if (pending.status !== 'ANALYZED' || !hint.turnIndex) return null;
    if (!turns.some((turn) => turn.turnIndex === hint.turnIndex
      && turn.userInput === pending.value
      && (turn.inputIntent ?? 'answer') === inputIntent)) return null;
    return toPortfolioEntrySessionClientDto(session, turns);
  }

  private async recoverSessionRevision(sessionId: string, record: PortfolioEntryIdempotencyRecord, expectedRevision: number): Promise<PortfolioEntrySessionClientDto | null> {
    const hint = recoveryHint(record, record.operation as Operation, expectedRevision);
    if (!hint) return null;
    const session = await this.requireSession(sessionId);
    return session.revision === expectedRevision + 1 ? this.toDto(session) : null;
  }

  private async recoverClaim(sessionId: string, record: PortfolioEntryIdempotencyRecord, expectedRevision: number): Promise<PortfolioEntrySessionClientDto | null> {
    const hint = recoveryHint(record, 'claim_session', expectedRevision);
    if (!hint?.ownerUserId) return null;
    const session = await this.requireSession(sessionId);
    if (session.revision !== expectedRevision + 1 || session.ownerUserId !== hint.ownerUserId) return null;
    return this.toProvisionalDto(session);
  }

  private async recordFailure(sessionId: string, error: unknown): Promise<void> {
    if (!(error instanceof LiveModelExecutionError)) return;
    const result = error.result;
    await this.recordExecution(sessionId, result);
  }

  private async recordExecution(sessionId: string, result: import('../../portfolio-entry-runtime').ModelExecutionResult<unknown>): Promise<void> {
    const metadata = result.execution_metadata;
    const execution: PortfolioEntryModelExecutionRecord = {
      id: randomUUID(),
      sessionId,
      purpose: metadata.purpose,
      provider: metadata.provider,
      requestedModel: metadata.requested_model ?? metadata.model,
      providerReportedModel: metadata.provider_reported_model,
      callId: metadata.call_id,
      durationMs: metadata.duration_ms,
      retryCount: metadata.retry_count,
      technicalError: result.technical_error,
      schemaErrors: result.schema_errors,
      parsedOutputPresent: result.parsed_output !== null,
      validatedOutputPresent: result.validated_output !== null,
      createdAt: this.now(),
    };
    await this.sessionService.appendModelExecution(execution).catch(() => undefined);
  }
}

export class UnconfiguredPortfolioEntryAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  async analyzeTurn(_input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    throw PortfolioEntryApiError.providerFailure();
  }
}

export class DeterministicPortfolioEntryAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    const ready = input.rawInput.length > 40;
    const explicitDecision = extractExplicitDecision(input.rawInput);
    return {
      analysis: {
        entry_id: input.entryId,
        analysis_version: 'deterministic-dev',
        primary_intent: 'portfolio_tracking',
        secondary_intents: [],
        initial_entry_state: 'initiative_first',
        current_frame: ready ? 'portfolio_first' : 'initiative_first',
        extracted_context: {
          summary: input.rawInput,
          ...(explicitDecision ? { decision_to_enable: explicitDecision } : {}),
        },
        ambiguities: ready ? [] : ['decision_to_enable'],
        contradictions: [],
        reverse_alignment: {
          required: true,
          subject_type: 'initiative',
          subject: input.rawInput,
          connection_state: ready ? 'partial' : 'insufficient_input',
          missing_links: ready ? [] : ['decision_to_enable'],
        },
        provenance: [{ path: 'extracted_context.summary', origin: 'EXTRACTED_FROM_USER_TEXT', review_disposition: 'UNREVIEWED' }],
        status: ready ? 'ready' : 'insufficient_input',
      },
      question_plan: ready ? { questions: [], question_count: 0, status: 'no_questions_required', stop_reason: 'sufficient_context' } : {
        question_count: 1,
        status: 'questions_required',
        questions: [{ id: 'decision_to_enable', question: 'Que decision necesitas habilitar?', question_type: 'critical_gap', reason_to_ask: 'Falta decision posterior.', resolves: ['decision_to_enable'], priority: 1, expected_answer_type: 'decision' }],
      },
    };
  }
}

/**
 * Preserve a decision the user stated directly in a deterministic turn.
 * The handoff may suggest framing, but it must not lose an explicit human
 * decision merely because the lightweight adapter has no model extraction.
 */
export function extractExplicitDecision(rawInput: string): string | null {
  const normalized = rawInput.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  const match = normalized.match(/\b(?:necesito|quiero|queremos|debemos)\s+decidir\s+(.+)$/i)
    ?? normalized.match(/\bdecidir\s+(.+)$/i);
  if (!match?.[1]) return null;

  const subject = match[1].trim().replace(/[.!?]+$/, '');
  return subject ? `Decidir ${subject}` : null;
}

function contextFromSession(session: PortfolioEntrySession, turns?: PortfolioEntryTurn[]): SessionContext {
  return createSessionContextFromPersistedProjection({
    interactionMode: session.interactionMode,
    quickQuestionsAsked: session.questionBudget.quickQuestionsAsked,
    explorationRound: session.questionBudget.explorationRound,
    questionsAskedCurrentRound: session.questionBudget.questionsAskedCurrentRound,
    previousQuestions: session.semanticState.previousQuestions,
    answeredGaps: session.semanticState.answeredGaps,
    lifecycleStatus: session.lifecycleStatus,
    runtimeClarificationStatus: session.semanticState.runtimeClarificationStatus ?? turns?.at(-1)?.transition.to_status,
  });
}

function buildAuthorizedSynthesisSnapshot(
  sessionId: string,
  contextRevision: number,
  turns: PortfolioEntryTurn[],
  sourceTurn: PortfolioEntryTurn,
): CriticalSituationSynthesisAuthorizedSnapshot {
  const contextTurns = turns.filter((turn) => turn.inputIntent !== 'checkpoint_choice');
  return normalizeCriticalSituationSynthesisInput({
    snapshot: {
      snapshot_id: `${sessionId}-context-revision-${contextRevision}`,
      captured_at: sourceTurn.createdAt.toISOString(),
    },
    user_messages: contextTurns
      .filter((turn) => (turn.inputIntent ?? 'answer') === 'answer')
      .map((turn) => ({ id: turn.id, text: turn.userInput, turn_index: turn.turnIndex })),
    user_corrections: contextTurns
      .filter((turn) => turn.inputIntent === 'correction')
      .map((turn) => ({ id: turn.id, text: turn.userInput, corrects_ref: null, turn_index: turn.turnIndex })),
    explicitly_provided_context: [],
    provisional_extracted_context: sourceTurn.analysisSnapshot.extracted_context,
    provisional_extracted_context_provenance: sourceTurn.analysisSnapshot.provenance,
    source_refs: [],
  });
}

function latestAnalyzedContextTurn(turns: PortfolioEntryTurn[]): PortfolioEntryTurn | undefined {
  return [...turns]
    .filter((turn) => turn.inputIntent === 'answer' || turn.inputIntent === 'correction')
    .sort((left, right) => left.turnIndex - right.turnIndex || left.createdAt.getTime() - right.createdAt.getTime())
    .at(-1);
}

function isCriticalHandoffCheckpoint(session: PortfolioEntrySession): boolean {
  return session.lifecycleStatus === 'HANDOFF_ELIGIBLE'
    && session.semanticState.runtimeClarificationStatus === 'ready_for_handoff'
    && session.semanticState.userExplorationChoice === 'provisional_route';
}

function assertMessageInputAllowed(
  session: PortfolioEntrySession,
  turns: PortfolioEntryTurn[],
  inputIntent: PortfolioEntryTurnInputIntent,
  hasCriticalHandoff: boolean,
): void {
  const clarificationStatus = session.semanticState.runtimeClarificationStatus ?? turns.at(-1)?.transition.to_status;
  if (inputIntent === 'correction') {
    const correctionAllowedLifecycles = new Set(['ENTRY_CAPTURED', 'ANALYZING', 'CLARIFYING', 'HANDOFF_ELIGIBLE', 'HANDOFF_READY']);
    if (!correctionAllowedLifecycles.has(session.lifecycleStatus)
      || (session.latestHandoff && !hasCriticalHandoff)
      || session.confirmation) {
      throw PortfolioEntrySessionError.invalidTransition('A user correction can only reopen an unconfirmed Portfolio Entry reading.');
    }
    if (session.semanticState.pendingInput?.status === 'ANALYSIS_PENDING') {
      throw PortfolioEntrySessionError.conflict();
    }
    return;
  }

  if (clarificationStatus === 'exploration_offered') {
    throw PortfolioEntrySessionError.invalidTransition('At an exploration checkpoint, submit an explicit correction or choose a checkpoint action.');
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
}

function validateConfirmationCommand(body: ConfirmationBody): void {
  const canonicalField = (field: string) => field === 'understood_need' || field === 'understanding' ? 'understood_need' : field;
  const acceptedFields = body.acceptedFields ?? [];
  for (const field of acceptedFields) {
    if (ORGANIZATIONAL_FIELDS.has(field) || !USER_CONFIRMABLE_FIELDS.has(field)) {
      throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" no puede confirmarse en esta etapa.`);
    }
  }
  const correctedFields = body.correctedFields ?? {};
  for (const field of Object.keys(correctedFields)) {
    if (ORGANIZATIONAL_FIELDS.has(field) || !USER_CONFIRMABLE_FIELDS.has(field)) {
      throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" no puede corregirse en esta etapa.`);
    }
  }
  const accepted = new Set(acceptedFields.map(canonicalField));
  const corrected = new Set(Object.keys(correctedFields).map(canonicalField));
  const rejected = new Set((body.rejectedFields ?? []).map(canonicalField));
  for (const field of accepted) {
    if (corrected.has(field)) {
      throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" tiene estados de confirmacion contradictorios.`);
    }
  }
  for (const field of rejected) {
    if (!USER_CONFIRMABLE_FIELDS.has(field)) {
      throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" no puede rechazarse en esta etapa.`);
    }
    if (accepted.has(field) || corrected.has(field)) {
      throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" tiene estados de confirmacion contradictorios.`);
    }
  }
  if (body.action === 'correct' && Object.keys(correctedFields).length === 0) {
    throw PortfolioEntryApiError.invalidConfirmation('Indica al menos un dato propio que quieras corregir.');
  }
  validateUserValue(correctedFields.understood_need, 'understood_need');
  validateUserValue(correctedFields.desired_outcome, 'desired_outcome');
  if (correctedFields.known_context !== undefined) validateKnownContext(correctedFields.known_context);
  if (correctedFields.understanding !== undefined) validateUserValue(correctedFields.understanding, 'understanding');
  for (const field of ['decision_to_enable', 'recommended_approach'] as const) {
    if (correctedFields[field] !== undefined) validateUserValue(correctedFields[field], field);
  }
  for (const field of ['unresolved_context', 'evidence_or_clarity_needed'] as const) {
    if (correctedFields[field] !== undefined) validateTextList(correctedFields[field], field);
  }
}

function normalizeAcceptedFields(body: ConfirmationBody): string[] {
  if (body.action === 'confirm' && !body.acceptedFields?.length) {
    return ['understood_need', 'desired_outcome', 'known_context'];
  }
  return [...new Set((body.acceptedFields ?? []).map((field) => field === 'understanding' ? 'understood_need' : field))];
}

function normalizeCorrectedFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const normalized: Record<string, unknown> = {};
  if (fields.understood_need !== undefined) normalized.understood_need = normalizeTextValue(fields.understood_need);
  if (fields.understanding !== undefined) normalized.understood_need = normalizeTextValue(fields.understanding);
  if (fields.desired_outcome !== undefined) normalized.desired_outcome = normalizeTextValue(fields.desired_outcome);
  if (fields.known_context !== undefined) normalized.known_context = normalizeKnownContext(fields.known_context);
  for (const field of ['decision_to_enable', 'recommended_approach'] as const) {
    if (fields[field] !== undefined) normalized[field] = normalizeTextValue(fields[field]);
  }
  for (const field of ['unresolved_context', 'evidence_or_clarity_needed'] as const) {
    if (fields[field] !== undefined) normalized[field] = normalizeTextList(fields[field]);
  }
  return normalized;
}

function validateUserValue(value: unknown, field: string): void {
  if (value === undefined) return;
  const text = normalizeTextValue(value);
  if (!text) throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" no puede estar vacío.`);
}

function normalizeTextValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') return value.value.trim();
  throw PortfolioEntryApiError.invalidConfirmation('Los datos corregidos deben ser texto propio de la entrada.');
}

function validateKnownContext(value: unknown): void {
  normalizeKnownContext(value);
}

function validateTextList(value: unknown, field: string): void {
  normalizeTextList(value, field);
}

function normalizeTextList(value: unknown, field = 'contexto'): string[] {
  if (typeof value !== 'string' && !Array.isArray(value)) {
    throw PortfolioEntryApiError.invalidConfirmation(`El campo "${field}" debe contener una lista de textos.`);
  }
  const entries = typeof value === 'string' ? value.split(/\r?\n/) : value;
  return entries.map((entry) => normalizeTextValue(entry)).filter(Boolean);
}

function normalizeKnownContext(value: unknown): Array<{ key: string; value: string }> {
  const entries = typeof value === 'string'
    ? value.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
      const separator = line.indexOf(':');
      return separator > 0
        ? { key: line.slice(0, separator), value: line.slice(separator + 1) }
        : { key: `Contexto ${index + 1}`, value: line };
    })
    : Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([key, item]) => ({ key, value: item }))
      : null;
  if (!entries) throw PortfolioEntryApiError.invalidConfirmation('El contexto conocido debe ser una lista de datos propios.');
  return entries.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string') {
      throw PortfolioEntryApiError.invalidConfirmation('Cada dato de contexto necesita una clave y un valor.');
    }
    const valueText = normalizeTextValue(item.value);
    if (!item.key.trim() || !valueText) throw PortfolioEntryApiError.invalidConfirmation('Cada dato de contexto necesita una clave y un valor.');
    return { key: item.key.trim(), value: valueText };
  });
}

function assertNotConverted(session: PortfolioEntrySession): void {
  if (session.lifecycleStatus === 'CONVERTED') {
    throw PortfolioEntrySessionError.invalidTransition('Portfolio Entry session has already been converted.');
  }
}

function recoveryHint(record: PortfolioEntryIdempotencyRecord, operation: Operation, expectedRevision: number): RecoveryHint | null {
  const snapshot = record.responseSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidate = snapshot as Partial<RecoveryHint>;
  if (candidate.kind !== 'portfolio-entry-recovery' || candidate.operation !== operation || candidate.expectedRevision !== expectedRevision) return null;
  return candidate as RecoveryHint;
}
