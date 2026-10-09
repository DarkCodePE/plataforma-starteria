import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { PortfolioEntryAnalysisV2 } from '../../portfolio-entry-runtime/domain/analysis.schema';
import type { PortfolioEntryHandoffV2 } from '../../portfolio-entry-runtime/domain/handoff.schema';
import type { SessionContext, SessionTurnTrace } from '../../portfolio-entry-runtime/domain/session.types';
import type { CriticalHandoffProjection } from '../../portfolio-entry/presentation/critical-handoff-projection';
import { PortfolioEntrySessionError } from '../application/portfolio-entry-session-errors';
import { hashPublicAccessToken, PortfolioEntrySessionService } from '../application/portfolio-entry-session.service';
import { PrismaPortfolioEntrySessionMapper } from '../infrastructure/prisma-portfolio-entry-session.mapper';
import { PrismaPortfolioEntrySessionRepository } from '../infrastructure/prisma-portfolio-entry-session.repository';

const describeIntegration = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
if (process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1') {
  const databaseURL = process.env.DATABASE_URL;
  let database: URL | undefined;
  try {
    database = databaseURL ? new URL(databaseURL) : undefined;
  } catch {
    database = undefined;
  }
  if (!database || database.pathname !== '/starteria_e2e' || !['localhost', '127.0.0.1'].includes(database.hostname)) {
    throw new Error('Portfolio Entry Prisma integration tests require the disposable starteria_e2e database on localhost.');
  }
}
const prisma = new PrismaClient();

const versioning = {
  contractVersion: 'portfolio-entry-contract-v0.1',
  runtimeVersion: 'portfolio-entry-runtime-v0.2',
  schemaVersion: 'portfolio-entry-schema-v0.2',
  promptManifestId: 'portfolio-entry-prompts-v0.2',
};

const createdSessionIds = new Set<string>();

describeIntegration('PrismaPortfolioEntrySessionRepository', () => {
  afterEach(async () => {
    if (createdSessionIds.size === 0) return;
    await prisma.portfolioEntrySession.deleteMany({
      where: { id: { in: [...createdSessionIds] } },
    });
    createdSessionIds.clear();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates, reads, authorizes, claims and expires a pre-canonical session', async () => {
    const { service, repository } = makeService();
    const { session, publicAccessToken } = await createSession(service);
    const storedRow = await prisma.portfolioEntrySession.findUnique({ where: { id: session.id } });

    expect(storedRow).toMatchObject({
      id: session.id,
      ownershipState: 'ANONYMOUS',
      lifecycleStatus: 'ENTRY_CAPTURED',
      revision: 0,
    });
    expect(storedRow?.publicAccessTokenHash).toBe(hashPublicAccessToken(publicAccessToken));
    expect(JSON.stringify(storedRow)).not.toContain(publicAccessToken);
    await expect(repository.findSessionById(session.id)).resolves.toMatchObject({ id: session.id });
    await expect(service.getForPublicAccess({ sessionId: session.id, publicAccessToken })).resolves.toMatchObject({ id: session.id });

    const claimed = await service.claimOwnership(session.id, 'user-portfolio-entry-db');
    await expect(service.getForOwner(session.id, 'user-portfolio-entry-db')).resolves.toMatchObject({ id: session.id });
    expect(claimed.revision).toBe(1);

    const expired = await service.markExpired(session.id);
    expect(expired.lifecycleStatus).toBe('EXPIRED');
    expect(expired.expiredAt).toBeInstanceOf(Date);
    await expect(repository.touchActivity(session.id, new Date(), expired.revision))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_EXPIRED' });
  });

  it('persists pending input as the next CAS revision before a turn is appended', async () => {
    const { service, repository } = makeService();
    const { session } = await createSession(service);

    const pending = await service.persistPendingInput({
      sessionId: session.id,
      value: 'Necesitamos ordenar el portafolio antes de decidir foco.',
      expectedRevision: 0,
    });

    expect(pending.revision).toBe(1);
    expect(pending.semanticState.pendingInput?.status).toBe('ANALYSIS_PENDING');
    await expect(repository.findSessionById(session.id)).resolves.toMatchObject({
      revision: 1,
      semanticState: { pendingInput: { id: pending.semanticState.pendingInput?.id } },
    });
  });

  it('appends ordered turns atomically and preserves responded_resolves without harness metadata', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);
    const first = await service.appendTurn({
      ...makeTurnInput(session.id, 1, 'questions_required'),
      matchedQuestionIds: ['q1'],
      respondedResolves: ['decision_to_enable'],
    });
    await service.appendTurn(makeTurnInput(session.id, 2, 'no_questions_required'));

    const turns = await repository.listTurns(session.id);
    const stored = await repository.findSessionById(session.id);
    expect(turns.map((turn) => turn.turnIndex)).toEqual([1, 2]);
    expect(turns[0]?.emittedQuestions[0]?.reason_to_ask).toBe('Aclarar decision');
    expect(first.respondedResolves).toEqual(['decision_to_enable']);
    expect(stored?.semanticState.answeredGaps).toEqual([]);
    expect(JSON.stringify(turns)).not.toContain('response_rule_ids_used');
    expect(JSON.stringify(turns)).not.toContain('fallback_used');
  });

  it('round-trips answer and correction intent and defaults an omitted intent for a legacy row', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);

    await service.appendTurn({
      ...makeTurnInput(session.id, 1, 'questions_required'),
      inputIntent: 'answer',
    });
    await service.appendTurn({
      ...makeTurnInput(session.id, 2, 'no_questions_required'),
      inputIntent: 'correction',
    });

    const legacyTurn = makePortfolioEntryTurn(session.id, 3, session.revision + 2);
    const legacyData = new PrismaPortfolioEntrySessionMapper().turnCreateData(legacyTurn);
    delete legacyData.inputIntent;
    await prisma.portfolioEntryTurn.create({ data: legacyData });

    const storedRows = await prisma.portfolioEntryTurn.findMany({
      where: { sessionId: session.id },
      orderBy: { turnIndex: 'asc' },
      select: { inputIntent: true },
    });
    const turns = await repository.listTurns(session.id);

    expect(storedRows.map((turn) => turn.inputIntent)).toEqual(['answer', 'correction', 'answer']);
    expect(turns.map((turn) => turn.inputIntent)).toEqual(['answer', 'correction', 'answer']);
  });

  it('rejects duplicate turn indexes and rolls back semantic state updates', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);
    await service.appendTurn(makeTurnInput(session.id, 1, 'questions_required'));
    const current = await requireSession(repository, session.id);
    const duplicateTurn = makePortfolioEntryTurn(session.id, 1, current.revision);
    const mutatedSession = {
      ...current,
      semanticState: { ...current.semanticState, answeredGaps: ['should-not-persist'] },
      revision: current.revision + 1,
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    };

    await expect(repository.appendTurn(duplicateTurn, mutatedSession, current.revision))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
    const after = await requireSession(repository, session.id);
    expect(after.semanticState.answeredGaps).toEqual([]);
  });

  it('uses expectedRevision as compare-and-set and rejects lost updates', async () => {
    const { service, repository } = makeService();
    const { session } = await createSession(service);
    const current = await requireSession(repository, session.id);

    await expect(repository.saveSessionState({
      session: { ...current, revision: current.revision + 1, updatedAt: new Date() },
      expectedRevision: current.revision - 1,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });

    const firstUpdate = {
      ...current,
      executionStatus: 'RUNNING' as const,
      revision: current.revision + 1,
      updatedAt: new Date(),
    };
    const secondUpdate = {
      ...current,
      executionStatus: 'TECHNICAL_ERROR' as const,
      revision: current.revision + 1,
      updatedAt: new Date(),
    };
    const results = await Promise.allSettled([
      repository.saveSessionState({ session: firstUpdate, expectedRevision: current.revision }),
      repository.saveSessionState({ session: secondUpdate, expectedRevision: current.revision }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('versions handoffs and rejects duplicate versions', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);
    const turn = await service.appendTurn(makeTurnInput(session.id, 1, 'no_questions_required'));
    await service.transitionLifecycle(session.id, 'HANDOFF_GENERATING');
    const handoff = await service.saveHandoff({ sessionId: session.id, handoff: makeHandoff(), sourceTurnId: turn.id });
    const current = await requireSession(repository, session.id);

    expect(handoff.version).toBe(1);
    await expect(repository.saveHandoff(
      { ...handoff, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() },
      { ...current, revision: current.revision + 1, updatedAt: new Date(), lastActivityAt: new Date() },
      current.revision,
    )).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('defaults historical session contextRevision to zero and advances it independently from session revision', async () => {
    const { service, repository } = makeService();
    const { session } = await createSession(service);
    const historicalId = randomUUID();
    const historicalData = new PrismaPortfolioEntrySessionMapper().sessionCreateData({ ...session, id: historicalId });
    delete historicalData.contextRevision;
    historicalData.publicAccessTokenHash = null;
    createdSessionIds.add(historicalId);
    await prisma.portfolioEntrySession.create({ data: historicalData });

    expect(await repository.readContextRevision(historicalId)).toBe(0);
    const advanced = await repository.advanceContextRevision(historicalId, 0, new Date('2026-10-09T10:01:00.000Z'));
    const stored = await requireSession(repository, historicalId);

    expect(advanced).toBe(1);
    expect(stored.contextRevision).toBe(1);
    expect(stored.revision).toBe(0);
  });

  it('creates append-only Critical Handoff versions with strict payload round-trip and latest source turn binding', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);
    const sourceTurn = await service.appendTurn(makeTurnInput(session.id, 1, 'no_questions_required'));
    const sourceContextRevision = await repository.readContextRevision(session.id);

    const first = await service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision,
      payload: makeCriticalHandoffProjection(),
    });
    const second = await service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision,
      payload: makeCriticalHandoffProjection(),
    });
    const stored = await prisma.portfolioEntryCriticalHandoff.findUnique({ where: { id: first.id } });
    const latest = await service.getLatestCriticalHandoff(session.id);

    expect(first).toMatchObject({
      sessionId: session.id,
      artifactVersion: 1,
      schemaVersion: 'critical-handoff-projection-v0.1',
      sourceContextRevision,
      sourceTurnId: sourceTurn.id,
      confirmationState: 'provisional',
      payload: makeCriticalHandoffProjection(),
    });
    expect(second.artifactVersion).toBe(2);
    expect(stored?.payload).toEqual(makeCriticalHandoffProjection());
    expect(latest).toMatchObject({ artifact: { id: second.id, artifactVersion: 2 }, isCurrent: true });
    expect(await prisma.portfolioEntryCriticalHandoff.count({ where: { sessionId: session.id } })).toBe(2);
  });

  it('does not invent a source turn for a session with no persisted analyzed turns', async () => {
    const { service } = makeService();
    const { session } = await createSession(service);

    const artifact = await service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision: session.contextRevision,
      payload: makeCriticalHandoffProjection(),
    });

    expect(artifact.sourceTurnId).toBeUndefined();
  });

  it('rejects source turns from a different session', async () => {
    const { service } = makeService();
    const first = await createAnalyzingSession(service);
    const foreignTurn = await service.appendTurn(makeTurnInput(first.session.id, 1, 'no_questions_required'));
    const second = await createSession(service);

    await expect(service.createCriticalHandoff({
      sessionId: second.session.id,
      sourceContextRevision: second.session.contextRevision,
      sourceTurnId: foreignTurn.id,
      payload: makeCriticalHandoffProjection(),
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('rejects a persisted source turn older than the latest analyzed turn', async () => {
    const { service } = makeService();
    const { session } = await createAnalyzingSession(service);
    const olderTurn = await service.appendTurn(makeTurnInput(session.id, 1, 'questions_required'));
    await service.appendTurn(makeTurnInput(session.id, 2, 'no_questions_required'));

    await expect(service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision: session.contextRevision,
      sourceTurnId: olderTurn.id,
      payload: makeCriticalHandoffProjection(),
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('marks the latest Critical Handoff stale after an explicit context revision advance', async () => {
    const { service } = makeService();
    const { session } = await createSession(service);
    const artifact = await service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision: session.contextRevision,
      payload: makeCriticalHandoffProjection(),
    });

    await service.advanceContextRevision(session.id, session.contextRevision);
    const latest = await service.getLatestCriticalHandoff(session.id);

    expect(latest?.artifact.id).toBe(artifact.id);
    expect(latest?.isCurrent).toBe(false);
    expect(await prisma.portfolioEntryCriticalHandoff.count({ where: { sessionId: session.id } })).toBe(1);
  });

  it('keeps Critical Handoff separate from readable legacy handoff rows', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    const legacyBefore = await prisma.portfolioEntryHandoff.findUnique({ where: { id: handoff.id } });

    const critical = await service.createCriticalHandoff({
      sessionId: session.id,
      sourceContextRevision: session.contextRevision,
      payload: makeCriticalHandoffProjection(),
    });
    const legacyAfter = await prisma.portfolioEntryHandoff.findUnique({ where: { id: handoff.id } });
    const loadedSession = await repository.findSessionById(session.id);

    expect(legacyAfter?.handoffPayload).toEqual(legacyBefore?.handoffPayload);
    expect(loadedSession?.latestHandoff?.id).toBe(handoff.id);
    expect(loadedSession?.latestHandoff?.id).not.toBe(critical.id);
    expect(await prisma.portfolioEntryCriticalHandoff.count({ where: { sessionId: session.id } })).toBe(1);
  });

  it('links confirmations to same-session handoffs and keeps CONFIRMED separate from conversion eligibility', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');

    const confirmation = await service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'CONFIRMED',
      acceptedFields: ['understanding'],
      confirmedByUserId: 'user-portfolio-entry-db',
    });

    const stored = await requireSession(repository, session.id);
    expect(confirmation.handoffId).toBe(handoff.id);
    expect(stored.lifecycleStatus).toBe('CONFIRMED');
    expect(stored.lifecycleStatus).not.toBe('CONVERSION_ELIGIBLE');

    await expect(repository.saveConfirmation(
      { ...confirmation, id: randomUUID(), version: 1, createdAt: new Date(), updatedAt: new Date() },
      { ...stored, revision: stored.revision + 1, updatedAt: new Date(), lastActivityAt: new Date() },
      stored.revision,
    )).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });

    await service.markConversionEligible(session.id);
  });

  it('rejects cross-session confirmation handoff references', async () => {
    const { service, repository } = makeService();
    const first = await createSessionWithHandoff(service);
    const second = await createSessionWithHandoff(service);
    const secondSession = await requireSession(repository, second.session.id);

    await expect(repository.saveConfirmation(
      {
        id: randomUUID(),
        sessionId: second.session.id,
        handoffId: first.handoff.id,
        version: 1,
        status: 'PARTIALLY_CONFIRMED',
        acceptedFields: [],
        correctedFields: {},
        rejectedFields: [],
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      { ...secondSession, revision: secondSession.revision + 1, updatedAt: new Date(), lastActivityAt: new Date() },
      secondSession.revision,
    )).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('persists model executions as observability metadata with optional turn and handoff references', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    const [turn] = await repository.listTurns(session.id);

    await service.appendModelExecution({
      sessionId: session.id,
      turnId: turn.id,
      handoffId: handoff.id,
      purpose: 'handoff_generation',
      provider: 'openai_responses',
      requestedModel: 'gpt-5.6-luna',
      providerReportedModel: 'gpt-5.6-luna',
      callId: 'call-portfolio-entry-db',
      durationMs: 42,
      retryCount: 0,
      usage: { input_tokens: 10 },
      schemaErrors: [],
      parsedOutputPresent: true,
      validatedOutputPresent: true,
    });

    const executions = await repository.listModelExecutions(session.id);
    const stored = await requireSession(repository, session.id);
    expect(executions).toHaveLength(1);
    expect(executions[0]?.turnId).toBe(turn.id);
    expect(executions[0]?.handoffId).toBe(handoff.id);
    expect(JSON.stringify(stored.semanticState)).not.toContain('openai_responses');
  });

  it('rejects cross-session execution references', async () => {
    const { service } = makeService();
    const first = await createSessionWithHandoff(service);
    const second = await createSessionWithHandoff(service);
    const [firstTurn] = await new PrismaPortfolioEntrySessionRepository(prisma).listTurns(first.session.id);

    await expect(service.appendModelExecution({
      sessionId: second.session.id,
      turnId: firstTurn.id,
      purpose: 'analysis_turn',
      provider: 'openai_responses',
      requestedModel: 'gpt-5.6-luna',
      callId: 'cross-session-call',
      durationMs: 1,
      retryCount: 0,
      schemaErrors: [],
      parsedOutputPresent: true,
      validatedOutputPresent: true,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('cascades session deletion to child records', async () => {
    const { service } = makeService();
    const { session } = await createSessionWithHandoff(service);
    await service.appendModelExecution({
      sessionId: session.id,
      purpose: 'analysis_turn',
      provider: 'openai_responses',
      requestedModel: 'gpt-5.6-luna',
      callId: 'cascade-call',
      durationMs: 1,
      retryCount: 0,
      schemaErrors: [],
      parsedOutputPresent: true,
      validatedOutputPresent: true,
    });

    await prisma.portfolioEntrySession.delete({ where: { id: session.id } });
    createdSessionIds.delete(session.id);

    await expect(prisma.portfolioEntryTurn.count({ where: { sessionId: session.id } })).resolves.toBe(0);
    await expect(prisma.portfolioEntryHandoff.count({ where: { sessionId: session.id } })).resolves.toBe(0);
    await expect(prisma.portfolioEntryConfirmation.count({ where: { sessionId: session.id } })).resolves.toBe(0);
    await expect(prisma.portfolioEntryModelExecution.count({ where: { sessionId: session.id } })).resolves.toBe(0);
  });

  it('rejects malformed persisted JSON during mapping', async () => {
    const id = randomUUID();
    createdSessionIds.add(id);
    await prisma.portfolioEntrySession.create({
      data: {
        id,
        rawEntry: 'Entrada corrupta para mapper',
        entryOrigin: 'public_start',
        lifecycleStatus: 'ENTRY_CAPTURED',
        executionStatus: 'NOT_STARTED',
        interactionMode: 'quick_clarification',
        ownershipState: 'ANONYMOUS',
        semanticState: {},
        questionBudget: { quickQuestionBudget: 3, quickQuestionsAsked: 0, explorationRound: 0, questionsAskedCurrentRound: 0 },
        contractVersion: versioning.contractVersion,
        runtimeVersion: versioning.runtimeVersion,
        schemaVersion: versioning.schemaVersion,
        promptManifestId: versioning.promptManifestId,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(new PrismaPortfolioEntrySessionRepository(prisma).findSessionById(id))
      .rejects.toThrow(/Invalid persisted Portfolio Entry JSON at session.semanticState/);
  });
});

function makeService() {
  const repository = new PrismaPortfolioEntrySessionRepository(prisma);
  const service = new PortfolioEntrySessionService(
    repository,
    { ttlMs: 60_000, versioning },
    () => new Date('2026-09-11T10:00:00.000Z'),
  );
  return { repository, service };
}

async function createSession(service: PortfolioEntrySessionService) {
  const created = await service.createAnonymousSession({
    rawEntry: 'Necesito ordenar el portafolio de iniciativas comerciales.',
    entryOrigin: 'public_start',
  });
  createdSessionIds.add(created.session.id);
  return created;
}

async function createAnalyzingSession(service: PortfolioEntrySessionService) {
  const created = await createSession(service);
  await service.transitionLifecycle(created.session.id, 'ANALYZING');
  return created;
}

async function createSessionWithHandoff(service: PortfolioEntrySessionService) {
  const created = await createAnalyzingSession(service);
  const turn = await service.appendTurn(makeTurnInput(created.session.id, 1, 'no_questions_required'));
  await service.transitionLifecycle(created.session.id, 'HANDOFF_GENERATING');
  const handoff = await service.saveHandoff({
    sessionId: created.session.id,
    handoff: makeHandoff(),
    sourceTurnId: turn.id,
  });
  return { ...created, handoff };
}

async function requireSession(repository: PrismaPortfolioEntrySessionRepository, sessionId: string) {
  const session = await repository.findSessionById(sessionId);
  if (!session) throw PortfolioEntrySessionError.notFound();
  return session;
}

function makeTurnInput(
  sessionId: string,
  turnIndex: number,
  questionStatus: 'questions_required' | 'no_questions_required',
) {
  return {
    sessionId,
    runtimeTurn: makeRuntimeTurn(turnIndex, questionStatus),
    runtimeContextAfter: makeRuntimeContext(questionStatus === 'questions_required' ? 'in_progress' : 'ready_for_handoff'),
  };
}

function makePortfolioEntryTurn(sessionId: string, turnIndex: number, revision: number) {
  const runtimeTurn = makeRuntimeTurn(turnIndex, 'questions_required');
  return {
    id: randomUUID(),
    sessionId,
    turnIndex,
    userInput: runtimeTurn.user_input,
    emittedQuestions: runtimeTurn.questions_asked,
    matchedQuestionIds: [],
    respondedResolves: [],
    analysisSnapshot: runtimeTurn.analysis,
    semanticStateAfter: {
      previousQuestions: [],
      answeredGaps: [],
      primaryIntent: runtimeTurn.analysis.primary_intent,
      currentFrame: runtimeTurn.analysis.current_frame,
      initialEntryState: runtimeTurn.analysis.initial_entry_state,
    },
    budgetBefore: runtimeTurn.available_question_budget,
    budgetAfter: runtimeTurn.transition.budget_after,
    transition: runtimeTurn.transition,
    versioning,
    createdAt: new Date(),
    updatedAt: new Date(),
    revision,
  };
}

function makeRuntimeTurn(
  turnIndex: number,
  questionStatus: 'questions_required' | 'no_questions_required',
): SessionTurnTrace {
  const questions = questionStatus === 'questions_required'
    ? [{
        id: 'q1',
        question: 'Que decision quieres habilitar?',
        reason_to_ask: 'Aclarar decision',
        question_type: 'clarification',
        resolves: ['decision_to_enable'],
        turn_index: turnIndex,
        interaction_mode: 'quick_clarification' as const,
        asked_at_budget_remaining: 3,
      }]
    : [];
  return {
    turn_index: turnIndex,
    user_input: `Mensaje ${turnIndex}`,
    analysis: makeAnalysis(),
    initial_entry_state: 'portfolio_first',
    current_frame: 'portfolio_first',
    intent: {
      primary_intent: 'portfolio_prioritization',
      secondary_intents: [],
    },
    reverse_alignment: makeAnalysis().reverse_alignment,
    question_plan: {
      questions: questions.map((question) => ({
        id: question.id,
        question: question.question,
        question_type: 'clarification',
        reason_to_ask: 'Aclarar decision',
        resolves: question.resolves,
        priority: 1,
        expected_answer_type: 'text',
      })),
      question_count: questions.length,
      status: questionStatus,
      stop_reason: questionStatus === 'no_questions_required' ? 'sufficient_context' : undefined,
    },
    interaction_mode: 'quick_clarification',
    available_question_budget: 3,
    received_question_count: questions.length,
    emitted_question_count: questions.length,
    questions_asked: questions,
    budget_overflow: false,
    transition: {
      from_status: turnIndex === 1 ? 'not_started' : 'in_progress',
      to_status: questionStatus === 'questions_required' ? 'in_progress' : 'ready_for_handoff',
      from_mode: 'quick_clarification',
      to_mode: 'quick_clarification',
      reason: questionStatus === 'questions_required' ? 'questions_emitted' : 'sufficient_context',
      trigger: 'agent_output',
      budget_before: 3,
      budget_after: 3 - questions.length,
    },
  };
}

function makeRuntimeContext(status: SessionContext['clarification_status']): SessionContext {
  return {
    interaction_mode: 'quick_clarification',
    quick_question_budget: 3,
    quick_questions_asked: status === 'in_progress' ? 1 : 0,
    exploration_round: 0,
    questions_asked_current_round: 0,
    previous_questions: [],
    answered_gaps: [],
    exploration_goal: null,
    user_exploration_choice: 'not_offered',
    clarification_status: status,
    stop_reason: status === 'ready_for_handoff' ? 'sufficient_context' : null,
  };
}

function makeAnalysis(): PortfolioEntryAnalysisV2 {
  return {
    entry_id: 'entry-1',
    analysis_version: 'v0.2',
    primary_intent: 'portfolio_prioritization',
    secondary_intents: [],
    initial_entry_state: 'portfolio_first',
    current_frame: 'portfolio_first',
    extracted_context: { goal: 'Priorizar iniciativas' },
    ambiguities: [],
    contradictions: [],
    reverse_alignment: {
      required: false,
      subject_type: 'unknown',
      subject: null,
      connection_state: 'not_required',
    },
    provenance: [{
      path: 'extracted_context.goal',
      origin: 'EXTRACTED_FROM_USER_TEXT',
      review_disposition: 'UNREVIEWED',
      source_text: 'priorizar',
    }],
    status: 'ready',
  };
}

function makeHandoff(): PortfolioEntryHandoffV2 {
  return {
    understanding: {
      value: 'El usuario quiere ordenar prioridades del portafolio.',
      provenance: { origin: 'EXTRACTED_FROM_USER_TEXT', source_path: 'raw_entry' },
    },
    desired_outcome: {
      value: 'Habilitar una decision de priorizacion.',
      provenance: { origin: 'EXTRACTED_FROM_USER_TEXT', source_path: 'raw_entry' },
    },
    decision_to_enable: 'unresolved',
    alternative_approaches: [],
    known_context: [],
    unresolved_context: [{ gap_id: 'decision_to_enable', description: 'Decision especifica pendiente.' }],
    gap_resolution_map: [{
      gap_id: 'decision_to_enable',
      gap_description: 'Decision especifica pendiente.',
      resolution_type: 'REQUIRES_ORGANIZATIONAL_INPUT',
      resolution_stage: 'PORTFOLIO',
    }],
    evidence_or_clarity_needed: [],
    starteria_path: [{ action: 'resolve_gaps', description: 'Aclarar la decision antes de convertir.' }],
    recommended_cta: 'Revisar handoff',
    provenance_summary: [{ origin: 'EXTRACTED_FROM_USER_TEXT', source_path: 'raw_entry' }],
    handoff_status: 'ready_with_uncertainty',
  };
}

function makeCriticalHandoffProjection(): CriticalHandoffProjection {
  return {
    conclusionStatus: 'supported',
    finalReading: 'La evidencia disponible llega después del checkpoint.',
    decisionInView: 'Qué evidencia llevar al checkpoint.',
    usableNow: [{ item: 'El análisis de churn existente.', howItCanHelp: 'Permite comparar señales.' }],
    decisionChangingUnknowns: [{ uncertainty: 'Cuándo llega la señal.', whyItMatters: 'Puede cambiar la secuencia.' }],
    firstMovement: {
      movement: 'Revisar el resultado existente.',
      whyNow: 'El checkpoint está próximo.',
      whatItMayClarify: 'Qué opciones tienen respaldo.',
      boundary: 'No toma la decisión por la persona.',
      existingAssetsUsed: ['El análisis de churn existente.'],
    },
  };
}
