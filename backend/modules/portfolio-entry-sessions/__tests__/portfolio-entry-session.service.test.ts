import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { PortfolioEntryAnalysisV2 } from '../../portfolio-entry-runtime/domain/analysis.schema';
import type { PortfolioEntryHandoffV2 } from '../../portfolio-entry-runtime/domain/handoff.schema';
import type { SessionContext, SessionTurnTrace } from '../../portfolio-entry-runtime/domain/session.types';
import { InMemoryPortfolioEntrySessionRepository } from '../infrastructure/in-memory-portfolio-entry-session.repository';
import { redactArbitraryPortfolioEntryPayload, redactPortfolioEntrySessionForLog } from '../observability/portfolio-entry-session-redaction';
import { hashPublicAccessToken, PortfolioEntrySessionService } from '../application/portfolio-entry-session.service';
import { PortfolioEntrySessionError } from '../application/portfolio-entry-session-errors';

const versioning = {
  contractVersion: 'portfolio-entry-contract-v0.1',
  runtimeVersion: 'portfolio-entry-runtime-v0.2',
  schemaVersion: 'portfolio-entry-schema-v0.2',
  promptManifestId: 'portfolio-entry-prompts-v0.2',
};

describe('PortfolioEntrySessionService', () => {
  it('creates an anonymous session', async () => {
    const { service } = makeService();
    const { session, publicAccessToken } = await service.createAnonymousSession({
      rawEntry: 'Necesito ordenar el portafolio de iniciativas comerciales.',
      entryOrigin: 'public_start',
    });

    expect(session.ownershipState).toBe('ANONYMOUS');
    expect(session.lifecycleStatus).toBe('ENTRY_CAPTURED');
    expect(session.executionStatus).toBe('NOT_STARTED');
    expect(session.revision).toBe(0);
    expect(publicAccessToken).toHaveLength(64);
  });

  it('does not persist the raw public access token', async () => {
    const { service, repository } = makeService();
    const { session, publicAccessToken } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });
    const stored = await repository.findSessionById(session.id);

    expect(stored?.publicAccessTokenHash).toBe(hashPublicAccessToken(publicAccessToken));
    expect(stored?.publicAccessTokenHash).not.toBe(publicAccessToken);
  });

  it('does not authorize public access with UUID alone', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    await expect(service.getForPublicAccess({ sessionId: session.id, publicAccessToken: '' }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED' });
  });

  it('authorizes public access with the valid token hash', async () => {
    const { service } = makeService();
    const { session, publicAccessToken } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    await expect(service.getForPublicAccess({ sessionId: session.id, publicAccessToken }))
      .resolves.toMatchObject({ id: session.id });
  });

  it('claims anonymous ownership for an authenticated user', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    const claimed = await service.claimOwnership(session.id, 'user-1');

    expect(claimed.ownershipState).toBe('CLAIMED');
    expect(claimed.ownerUserId).toBe('user-1');
    await expect(service.getForOwner(session.id, 'user-1')).resolves.toMatchObject({ id: session.id });
  });

  it('rejects an invalid ownership claim', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });
    await service.claimOwnership(session.id, 'user-1');

    await expect(service.claimOwnership(session.id, 'user-2'))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_INVALID_OWNERSHIP_CLAIM' });
  });

  it('rejects expired sessions', async () => {
    const now = new Date('2026-09-11T10:00:00.000Z');
    const { service } = makeService({ now });
    const { session, publicAccessToken } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
      now,
    });

    await expect(service.getForPublicAccess({
      sessionId: session.id,
      publicAccessToken,
      now: new Date('2026-09-11T10:01:01.000Z'),
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_EXPIRED' });
  });

  it('does not silently reactivate an expired session', async () => {
    const { service, repository } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });
    await service.markExpired(session.id);
    const stored = await repository.findSessionById(session.id);

    await expect(repository.touchActivity(session.id, new Date(), stored?.revision ?? -1))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_EXPIRED' });
  });

  it('persists ordered turns', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);

    await service.appendTurn(makeTurnInput(session.id, 1, 'questions_required'));
    await service.appendTurn(makeTurnInput(session.id, 2, 'no_questions_required'));

    expect((await repository.listTurns(session.id)).map((turn) => turn.turnIndex)).toEqual([1, 2]);
  });

  it('preserves responded_resolves without answered gap promotion', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);

    await service.appendTurn({
      ...makeTurnInput(session.id, 1, 'questions_required'),
      respondedResolves: ['decision_to_enable'],
    });
    const [turn] = await repository.listTurns(session.id);
    const stored = await repository.findSessionById(session.id);

    expect(turn.respondedResolves).toEqual(['decision_to_enable']);
    expect(stored?.semanticState.answeredGaps).toEqual([]);
  });

  it('keeps a valid clarification turn open for the next user message', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);

    await service.appendTurn({
      ...makeTurnInput(session.id, 1, 'questions_required'),
      runtimeContextAfter: {
        ...makeRuntimeContext('ended_with_uncertainty'),
        quick_questions_asked: 3,
        stop_reason: 'scripted_response_unavailable',
      },
    });
    const stored = await repository.findSessionById(session.id);

    expect(stored?.lifecycleStatus).toBe('CLARIFYING');
    expect(stored?.lifecycleStatus).not.toBe('ABANDONED');
    expect(stored?.questionBudget.quickQuestionsAsked).toBeLessThanOrEqual(3);
  });

  it('maps only explicit runtime abandonment to ABANDONED', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);

    await service.appendTurn({
      ...makeTurnInput(session.id, 1, 'questions_required'),
      runtimeContextAfter: makeRuntimeContext('abandoned'),
    });
    const stored = await repository.findSessionById(session.id);

    expect(stored?.lifecycleStatus).toBe('ABANDONED');
  });

  it('rejects unknown runtime lifecycle status instead of falling back to ABANDONED', async () => {
    const { service } = makeService();
    const { session } = await createAnalyzingSession(service);

    await expect(service.appendTurn({
      ...makeTurnInput(session.id, 1, 'questions_required'),
      runtimeContextAfter: {
        ...makeRuntimeContext('in_progress'),
        clarification_status: undefined as unknown as SessionContext['clarification_status'],
      },
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_INVALID_TRANSITION' });
  });

  it('does not persist harness-only scripted responder metadata on product turns', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);

    const runtimeTurn = {
      ...makeRuntimeTurn(1, 'questions_required'),
      scripted_response_result: {
        response: 'Respuesta',
        matched_question_ids: ['q1'],
        response_rule_ids_used: ['fixture-rule'],
        responded_resolves: ['decision_to_enable'],
        unmatched_questions: [],
        fallback_used: true,
        consumed_once_rule_ids: ['fixture-rule'],
      },
    };
    await service.appendTurn({
      sessionId: session.id,
      runtimeTurn,
      runtimeContextAfter: makeRuntimeContext('in_progress'),
      matchedQuestionIds: ['q1'],
      respondedResolves: ['decision_to_enable'],
    });
    const [turn] = await repository.listTurns(session.id);

    expect(JSON.stringify(turn)).not.toContain('response_rule_ids_used');
    expect(JSON.stringify(turn)).not.toContain('fallback_used');
    expect(JSON.stringify(turn)).not.toContain('fixture-rule');
  });

  it('allows valid lifecycle transitions', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    const analyzing = await service.transitionLifecycle(session.id, 'ANALYZING');

    expect(analyzing.lifecycleStatus).toBe('ANALYZING');
    expect(analyzing.revision).toBe(1);
  });

  it('rejects stale expectedRevision updates', async () => {
    const { service, repository } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    await expect(repository.saveSessionState({
      session: {
        ...session,
        executionStatus: 'RUNNING',
        revision: session.revision + 1,
        updatedAt: new Date(),
      },
      expectedRevision: session.revision - 1,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('rejects duplicate turn indexes without mutating latest semantic state', async () => {
    const { service, repository } = makeService();
    const { session } = await createAnalyzingSession(service);
    await service.appendTurn(makeTurnInput(session.id, 1, 'questions_required'));
    const current = await repository.findSessionById(session.id);
    if (!current) throw new Error('Expected session.');
    const duplicate = makeStoredTurn(current.id, 1);

    await expect(repository.appendTurn(
      duplicate,
      {
        ...current,
        semanticState: { ...current.semanticState, answeredGaps: ['should-not-persist'] },
        revision: current.revision + 1,
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      },
      current.revision,
    )).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });

    await expect(repository.findSessionById(session.id))
      .resolves.toMatchObject({ semanticState: { answeredGaps: [] } });
  });

  it('rejects invalid lifecycle transitions', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    await expect(service.transitionLifecycle(session.id, 'CONVERSION_ELIGIBLE'))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_INVALID_TRANSITION' });
  });

  it('keeps semantic lifecycle unchanged when execution fails', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    const failed = await service.recordExecutionStatus(session.id, 'TECHNICAL_ERROR');

    expect(failed.lifecycleStatus).toBe('ENTRY_CAPTURED');
    expect(failed.executionStatus).toBe('TECHNICAL_ERROR');
  });

  it('saves partial confirmation', async () => {
    const { service } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');

    const confirmation = await service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'PARTIALLY_CONFIRMED',
      acceptedFields: ['understanding'],
      correctedFields: { desired_outcome: 'Corregido por usuario' },
    });

    expect(confirmation.status).toBe('PARTIALLY_CONFIRMED');
    expect(confirmation.version).toBe(1);
  });

  it('saves full confirmation', async () => {
    const { service } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');

    const confirmation = await service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'CONFIRMED',
      acceptedFields: ['understanding', 'desired_outcome'],
      confirmedByUserId: 'user-1',
    });

    expect(confirmation.status).toBe('CONFIRMED');
    expect(confirmation.confirmedAt).toBeInstanceOf(Date);
  });

  it('does not treat CONFIRMED as CONVERSION_ELIGIBLE automatically', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');
    await service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'CONFIRMED',
      confirmedByUserId: 'user-1',
    });

    const stored = await repository.findSessionById(session.id);

    expect(stored?.lifecycleStatus).toBe('CONFIRMED');
  });

  it('abandons only a confirmed Brief, advances revision once, and is idempotent', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');
    await service.saveConfirmation({ sessionId: session.id, handoffId: handoff.id, status: 'CONFIRMED', confirmedByUserId: 'user-1' });
    const abandoned = await service.abandonConfirmedSession(session.id);
    const repeated = await service.abandonConfirmedSession(session.id);
    expect(abandoned.lifecycleStatus).toBe('ABANDONED');
    expect(abandoned.revision).toBe(repeated.revision);
    expect((await repository.findSessionById(session.id))?.lifecycleStatus).toBe('ABANDONED');
  });

  it('requires an explicit conversion eligibility guard', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');
    await service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'CONFIRMED',
      confirmedByUserId: 'user-1',
    });

    await service.markConversionEligible(session.id);
    const stored = await repository.findSessionById(session.id);

    expect(stored?.lifecycleStatus).toBe('CONVERSION_ELIGIBLE');
  });

  it('keeps CONVERTED terminal for semantic Entry mutations', async () => {
    const { service, repository } = makeService();
    const { session, handoff } = await createSessionWithHandoff(service);
    await service.transitionLifecycle(session.id, 'AWAITING_CONFIRMATION');
    await service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'CONFIRMED',
      confirmedByUserId: 'user-1',
    });
    await service.markConversionEligible(session.id);
    const eligible = await repository.findSessionById(session.id);
    const converted = await service.transitionLifecycle(session.id, 'CONVERTED');

    expect(eligible?.lifecycleStatus).toBe('CONVERSION_ELIGIBLE');
    expect(converted.lifecycleStatus).toBe('CONVERTED');
    await expect(service.appendTurn(makeTurnInput(session.id, 99, 'questions_required')))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_INVALID_TRANSITION' });
    await expect(service.saveHandoff({ sessionId: session.id, handoff: makeHandoff() }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_INVALID_TRANSITION' });
    await expect(service.saveConfirmation({
      sessionId: session.id,
      handoffId: handoff.id,
      status: 'CONFIRMED',
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_INVALID_TRANSITION' });
  });

  it('keeps execution metadata separated from semantic state', async () => {
    const { service, repository } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Entrada publica',
      entryOrigin: 'public_start',
    });

    await service.appendModelExecution({
      sessionId: session.id,
      purpose: 'analysis_turn',
      provider: 'openai_responses',
      requestedModel: 'gpt-5.6-luna',
      providerReportedModel: 'gpt-5.6-luna',
      callId: 'call-1',
      durationMs: 1200,
      retryCount: 0,
      schemaErrors: [],
      parsedOutputPresent: true,
      validatedOutputPresent: true,
    });
    const stored = await repository.findSessionById(session.id);
    const executions = await repository.listModelExecutions(session.id);

    expect(executions).toHaveLength(1);
    expect(JSON.stringify(stored?.semanticState)).not.toContain('openai_responses');
  });

  it('redacts sensitive session and arbitrary payload fields', async () => {
    const { service } = makeService();
    const { session } = await service.createAnonymousSession({
      rawEntry: 'Mi email es persona@example.com y mi telefono es 555.',
      entryOrigin: 'public_start',
      sourceMetadata: { userAgent: 'browser', email: 'persona@example.com', nested: { provider_raw: { text: 'secret' } } },
    });

    const redactedSession = redactPortfolioEntrySessionForLog(session);
    const redactedPayload = redactArbitraryPortfolioEntryPayload({
      rawEntry: session.rawEntry,
      accessToken: 'token',
      providerRaw: { output: 'raw' },
    });

    expect(JSON.stringify(redactedSession)).not.toContain('persona@example.com');
    expect(JSON.stringify(redactedSession)).not.toContain(session.rawEntry);
    expect(JSON.stringify(redactedPayload)).not.toContain('token');
    expect(JSON.stringify(redactedPayload)).not.toContain('"output":"raw"');
  });

  it('keeps runtime independent from the persistence module', () => {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const backendRoot = join(thisDir, '..', '..', '..');
    const runtimeRoot = join(backendRoot, 'modules', 'portfolio-entry-runtime');
    const violations = listFiles(runtimeRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return extractImportSpecifiers(source)
        .filter((specifier) => specifier.includes('portfolio-entry-sessions'))
        .map((specifier) => `${relative(backendRoot, file)} -> ${specifier}`);
    });

    expect(violations).toEqual([]);
  });
});

function makeService(input: { now?: Date } = {}) {
  const repository = new InMemoryPortfolioEntrySessionRepository();
  const service = new PortfolioEntrySessionService(
    repository,
    { ttlMs: 60_000, versioning },
    () => input.now ?? new Date('2026-09-11T10:00:00.000Z'),
  );
  return { repository, service };
}

async function createAnalyzingSession(service: PortfolioEntrySessionService) {
  const created = await service.createAnonymousSession({
    rawEntry: 'Necesito decidir que iniciativas comerciales priorizar.',
    entryOrigin: 'public_start',
  });
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

function makeRuntimeTurn(
  turnIndex: number,
  questionStatus: 'questions_required' | 'no_questions_required',
): SessionTurnTrace {
  const questions = questionStatus === 'questions_required'
    ? [{
        id: 'q1',
        question: 'Que decision quieres habilitar?',
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

function makeStoredTurn(sessionId: string, turnIndex: number) {
  const runtimeTurn = makeRuntimeTurn(turnIndex, 'questions_required');
  return {
    id: `turn-${turnIndex}-duplicate`,
    sessionId,
    turnIndex,
    userInput: runtimeTurn.user_input,
    emittedQuestions: runtimeTurn.questions_asked,
    matchedQuestionIds: [],
    respondedResolves: [],
    analysisSnapshot: runtimeTurn.analysis,
    semanticStateAfter: semanticStateFromAnalysis(runtimeTurn.analysis),
    budgetBefore: runtimeTurn.available_question_budget,
    budgetAfter: runtimeTurn.transition.budget_after,
    transition: runtimeTurn.transition,
    versioning,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function semanticStateFromAnalysis(analysis: PortfolioEntryAnalysisV2) {
  return {
    initialEntryState: analysis.initial_entry_state,
    currentFrame: analysis.current_frame,
    primaryIntent: analysis.primary_intent,
    secondaryIntents: analysis.secondary_intents,
    extractedContext: analysis.extracted_context,
    ambiguities: analysis.ambiguities,
    contradictions: analysis.contradictions,
    reverseAlignment: analysis.reverse_alignment,
    provenance: analysis.provenance,
    previousQuestions: [],
    answeredGaps: [],
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

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return listFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importRegex = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}
