import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioBootstrapRouter } from '../portfolio-bootstrap.router';
import { PortfolioBootstrapSemanticService } from '../portfolio-bootstrap-semantic.service';
import { PortfolioBootstrapSemanticOrchestratorService } from '../portfolio-bootstrap-semantic-orchestrator.service';
import { canonicalContextHash, companyEntryFingerprint } from '../portfolio-bootstrap-context.service';

const describeIntegration = process.env.PORTFOLIO_BOOTSTRAP_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const organizationId = 'kan244-semantic-org';
const userId = 'kan244-semantic-owner';
const otherUserId = 'kan244-semantic-other';
const sessionId = 'kan244-semantic-session';
const base = `/api/v1/portfolio-bootstrap/sessions/${sessionId}/context/semantic`;
const permissions = permissionsForRoles(['portfolio_lead']);

describeIntegration('KAN-244 E1 semantic persistence', () => {
  afterEach(cleanup);
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('persists an evidence-bound fact ledger and owner-scoped reentry without changing ContextReview', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const result = await service.appendTurn(command({
      facts: [fact('pilot_experience', 'nunca hemos probado pedidos a oficinas')],
      hypotheses: [hypothesis()], answeredGaps: ['pilot_experience'],
      emittedQuestion: question('situation'),
    }));

    expect(result.state).toMatchObject({ version: 1, answeredGaps: ['pilot_experience'] });
    expect(result.state.factLedger[0]).toMatchObject({ conceptId: 'pilot_experience', provenance: 'user_declared' });
    expect(result.state.hypotheses).toHaveLength(1);
    const read = await request(makeApp(userId)).get(base).expect(200);
    expect(read.body.data).toMatchObject({ enabled: false, state: { version: 1 }, turns: [{ semanticVersion: 1 }] });
    expect(await prisma.portfolioBootstrapContextReview.findUnique({ where: { bootstrapSessionId: sessionId } }))
      .toMatchObject({ version: 1, status: 'confirmed', confirmedSnapshotJson: { legacy: true } });
  });

  it('feeds inference the exact confirmed history version while a later correction remains draft', async () => {
    await seed();
    const review = await prisma.portfolioBootstrapContextReview.update({
      where: { bootstrapSessionId: sessionId },
      data: { version: 2, status: 'draft', draftJson: { legacy: false, corrected: true } },
    });
    await prisma.portfolioBootstrapContextReviewVersion.create({ data: {
      reviewId: review.id, version: 2, action: 'draft_saved', actorUserId: userId,
      snapshotJson: { context: { legacy: false, corrected: true }, provenance: [], status: 'draft' },
    } });

    const inference = await new PortfolioBootstrapSemanticService(prisma).getInferenceContext({
      sessionId, authenticatedUserId: userId, permissions,
    });

    expect(inference.confirmedContext).toEqual({ version: 1, context: { legacy: true }, provenance: [] });
  });

  it('resolves multiple cross-field gaps, retires one question and converges on the next version', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const first = await service.appendTurn(command({
      emittedQuestion: question('situation'), questionBudget: { limit: 3, used: 1 },
    }));
    const second = await service.appendTurn(command({
      expectedVersion: first.state.version, idempotencyKey: 'turn-2',
      inputText: 'Somos tres personas, no tenemos departamentos y nunca hicimos un piloto.',
      facts: [
        fact('organization_structure', 'no tenemos departamentos'),
        fact('pilot_experience', 'nunca hicimos un piloto'),
      ],
      answeredGaps: ['organization_structure', 'pilot_experience'],
      answeredQuestionId: first.state.activeQuestion.id,
      emittedQuestion: null,
      convergence: { status: 'ready_for_human_review', reason: 'Suficiente para revisar E1.' },
      questionBudget: { limit: 3, used: 1 },
    }));
    expect(second.state).toMatchObject({
      version: 2, activeQuestion: null,
      answeredGaps: ['organization_structure', 'pilot_experience'],
      answeredQuestionIds: [first.state.activeQuestion.id],
      convergence: { status: 'ready_for_human_review' },
    });
  });

  it('enforces idempotency, exact replay and CAS including a concurrent same-key retry', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const input = command({ idempotencyKey: 'same-key' });
    const [left, right] = await Promise.all([service.appendTurn(input), service.appendTurn(input)]);
    expect(right).toEqual(left);
    expect(await (prisma as any).portfolioBootstrapSemanticTurn.count()).toBe(1);
    await expect(service.appendTurn(command({ idempotencyKey: 'same-key', inputText: 'Otro payload' })))
      .rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_CONFLICT' });
    await expect(service.appendTurn(command({ idempotencyKey: 'stale-key', expectedVersion: 0 })))
      .rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SEMANTIC_VERSION_CONFLICT' });
  });

  it('claims the raw turn durably before inference and lets only one concurrent caller spend', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const inputText = 'Somos una cafetería y nunca hemos probado pedidos a oficinas.';
    const requestHash = canonicalContextHash({ expectedVersion: 0, inputText, answeredQuestionId: null });
    const claimInput = {
      sessionId, authenticatedUserId: userId, permissions,
      idempotencyKey: 'orchestrated-turn', requestHash, expectedVersion: 0,
      inputText, answeredQuestionId: null, leaseMs: 60_000,
    };

    const claims = await Promise.all([service.claimInference(claimInput), service.claimInference(claimInput)]);
    expect(claims.filter((claim) => claim.claimed)).toHaveLength(1);
    const winner = claims.find((claim) => claim.claimed)!;
    expect(winner.result.turn).toMatchObject({
      status: 'failed_retryable', inputText,
      error: { code: 'inference_pending', retryable: true },
    });
    expect(await (prisma as any).portfolioBootstrapSemanticTurn.count()).toBe(1);

    const completed = await service.completeInference({
      ...command({
        idempotencyKey: 'orchestrated-turn',
        expectedVersion: winner.result.state.version,
        facts: [fact('pilot_experience', 'nunca hemos probado pedidos a oficinas')],
        answeredGaps: ['pilot_experience'],
      }),
      requestHash,
    });
    expect(completed.turn).toMatchObject({ id: winner.result.turn.id, status: 'completed', attempt: 2 });
    expect(completed.state.answeredGaps).toEqual(['pilot_experience']);

    const replay = await service.claimInference(claimInput);
    expect(replay).toEqual({ claimed: false, result: completed });
    expect(await (prisma as any).portfolioBootstrapSemanticTurn.count()).toBe(1);
  });

  it('renews the claim lease when reclaiming an old failed turn so a delayed inference cannot spend twice', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const inputText = 'Turno antiguo reintentable.';
    const requestHash = canonicalContextHash({ expectedVersion: 0, inputText, answeredQuestionId: null });
    const initialClaim = await service.claimInference({
      sessionId, authenticatedUserId: userId, permissions,
      idempotencyKey: 'old-retry', requestHash, expectedVersion: 0,
      inputText, answeredQuestionId: null, leaseMs: 60_000,
    });
    const failed = await service.completeInference({
      ...command({
        idempotencyKey: 'old-retry', inputText, expectedVersion: initialClaim.result.state.version,
        status: 'failed_retryable', facts: [], hypotheses: [], dispositions: [], answeredGaps: [],
        emittedQuestion: null, convergence: { status: 'provider_retryable_failure', reason: 'Timeout previo.' },
        error: { code: 'provider_timeout', retryable: true },
      }),
      requestHash,
    });
    await (prisma as any).portfolioBootstrapSemanticTurn.update({
      where: { id: failed.turn.id },
      data: { createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    });
    const claimInput = {
      sessionId, authenticatedUserId: userId, permissions,
      idempotencyKey: 'old-retry', requestHash, expectedVersion: 0,
      inputText, answeredQuestionId: null, leaseMs: 60_000,
    };

    const first = await service.claimInference(claimInput);
    const whileDelayed = await service.claimInference(claimInput);

    expect(first.claimed).toBe(true);
    expect(whileDelayed).toMatchObject({ claimed: false, result: { turn: { error: { code: 'inference_pending' } } } });
    expect(await (prisma as any).portfolioBootstrapSemanticTurn.count()).toBe(1);
  });

  it('runs the cafeteria B2 path with one fake structured call and creates no canonical work objects', async () => {
    await seed();
    const store = new PortfolioBootstrapSemanticService(prisma);
    const generated = {
      facts: [fact('pilot_experience', 'nunca hemos probado pedidos a oficinas')],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Qué situación concreta queréis mejorar primero?',
        reasonToAsk: 'Permite iniciar E2 sin inventar una métrica ni un departamento.',
        resolves: ['situation'],
      },
      readyForHumanReview: false,
      reason: 'Falta una situación prioritaria concreta.',
    };
    const generate = vi.fn().mockResolvedValue({
      provider_raw: generated, parsed_output: generated, validated_output: generated, schema_errors: [],
      execution_metadata: {
        call_id: 'fake-call', purpose: 'bootstrap_semantic_turn', provider: 'fake-provider', model: 'fixture',
        seed_support: 'not_requested', duration_ms: 14, retry_count: 0,
        usage: { input_tokens: 30, output_tokens: 20, total_tokens: 50 }, fallback_used: false,
      },
    });
    const orchestrator = new PortfolioBootstrapSemanticOrchestratorService(store, { generate }, {
      maxInputTokens: 2_000, maxOutputTokens: 800, maxCallsPerTurn: 1, timeoutMs: 5_000,
      questionLimit: 3, circuitBreakerFailureThreshold: 3, circuitBreakerCooldownMs: 30_000,
    });
    const before = {
      projects: await prisma.project.count(),
      steps: await prisma.step.count(),
      assignments: await prisma.portfolioHandoffAssignment.count(),
    };

    const output = await orchestrator.processTurn({
      sessionId, authenticatedUserId: userId, permissions,
      idempotencyKey: 'cafeteria-b2', expectedVersion: 0,
      inputText: 'Somos una cafetería pequeña y nunca hemos probado pedidos a oficinas.',
      answeredQuestionId: null,
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][0]).toMatchObject({
      limits: { maxOutputTokens: 800 },
      userPayload: { confirmedContext: { version: 1, context: { legacy: true } } },
    });
    expect(output.result.state.answeredGaps).toContain('pilot_experience');
    expect(output.result.state.activeQuestion?.resolves).toEqual(['situation']);
    expect(output.result.state.activeQuestion?.resolves).not.toContain('pilot_experience');
    expect(output.result.turn.execution).toMatchObject({ inputTokens: 30, outputTokens: 20, totalTokens: 50 });
    expect({
      projects: await prisma.project.count(),
      steps: await prisma.step.count(),
      assignments: await prisma.portfolioHandoffAssignment.count(),
    }).toEqual(before);
  });

  it('hides foreign sessions and requires portfolio capability for read and write', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    await expect(service.appendTurn({ ...command(), authenticatedUserId: otherUserId }))
      .rejects.toMatchObject({ statusCode: 404, code: 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND' });
    await expect(service.appendTurn({ ...command(), permissions: permissionsForRoles(['viewer']) }))
      .rejects.toMatchObject({ statusCode: 403, code: 'PORTFOLIO_BOOTSTRAP_WRITE_REQUIRED' });
    await request(makeApp(otherUserId)).get(base).expect(404);
    await request(makeApp(userId, ['viewer'])).get(base).expect(403);
  });

  it('persists one retryable failure with usage/retry/fallback metrics and no invented semantic output', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const failure = command({
      status: 'failed_retryable', facts: [], hypotheses: [], answeredGaps: [], emittedQuestion: null,
      convergence: { status: 'provider_retryable_failure', reason: 'Provider timeout.' },
      error: { code: 'provider_timeout', retryable: true },
      execution: {
        provider: 'existing-provider', model: 'existing-model', durationMs: 30000,
        inputTokens: 120, outputTokens: 0, totalTokens: 120, retryCount: 1, fallbackUsed: true,
      },
    });
    const first = await service.appendTurn(failure);
    const replay = await service.appendTurn(failure);
    expect(replay).toEqual(first);
    expect(first.state).toMatchObject({ factLedger: [], hypotheses: [], answeredGaps: [] });
    expect(first.turn).toMatchObject({
      status: 'failed_retryable', error: { code: 'provider_timeout', retryable: true },
      execution: { durationMs: 30000, inputTokens: 120, totalTokens: 120, retryCount: 1, fallbackUsed: true },
    });
    expect(await (prisma as any).portfolioBootstrapSemanticTurn.count()).toBe(1);
  });

  it('retries a failed logical turn under the same identity without duplicating it', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const failure = command({
      idempotencyKey: 'logical-turn', status: 'failed_retryable', facts: [], hypotheses: [], answeredGaps: [],
      emittedQuestion: null, convergence: { status: 'provider_retryable_failure', reason: 'timeout' },
      error: { code: 'provider_timeout', retryable: true },
    });
    const failed = await service.appendTurn(failure);
    const retry = command({
      idempotencyKey: 'logical-turn', expectedVersion: failed.state.version,
      facts: [fact('pilot_experience', 'nunca hemos probado pedidos a oficinas')],
      answeredGaps: ['pilot_experience'], error: null,
    });
    const [recovered, concurrentReplay] = await Promise.all([
      service.appendTurn(retry), service.appendTurn(retry),
    ]);
    expect(concurrentReplay).toEqual(recovered);
    expect(recovered.turn.id).toBe(failed.turn.id);
    expect(recovered.turn).toMatchObject({ status: 'completed', attempt: 2 });
    expect(recovered.state.version).toBe(2);
    expect(await (prisma as any).portfolioBootstrapSemanticTurn.count()).toBe(1);
    expect((await (prisma as any).portfolioBootstrapSemanticTurn.findUnique({ where: { id: recovered.turn.id } })).attemptsJson)
      .toHaveLength(1);
    expect(await service.appendTurn(retry)).toEqual(recovered);
  });

  it('validates historical ContextReview and tenant-bound Company evidence before persistence', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    await prisma.portfolioBootstrapContextReviewVersion.update({
      where: { reviewId_version: {
        reviewId: (await prisma.portfolioBootstrapContextReview.findUniqueOrThrow({ where: { bootstrapSessionId: sessionId } })).id,
        version: 1,
      } },
      data: { snapshotJson: {
        context: { situation: { value: 'Cafetería local', provenance: 'user_declared' } },
        provenance: [], status: 'confirmed',
      } },
    });
    const contextFact = {
      conceptId: 'situation', value: 'Cafetería local', provenance: 'source_extracted',
      evidenceRefs: [{ kind: 'context_review_field', reviewVersion: 1, fieldPath: 'situation.value' }],
      confidence: 1, status: 'observed',
    };
    expect((await service.appendTurn(command({ facts: [contextFact], answeredGaps: ['situation'] }))).state.version).toBe(1);

    await expect(service.appendTurn(command({
      idempotencyKey: 'mismatched-context-value', expectedVersion: 1,
      facts: [{ ...contextFact, value: 'Valor inventado' }],
    }))).rejects.toMatchObject({ statusCode: 422, code: 'PORTFOLIO_SEMANTIC_EVIDENCE_INVALID' });

    await expect(service.appendTurn(command({
      idempotencyKey: 'stale-context-ref', expectedVersion: 1,
      facts: [{ ...contextFact, evidenceRefs: [{ kind: 'context_review_field', reviewVersion: 999, fieldPath: 'situation.value' }] }],
    }))).rejects.toMatchObject({ statusCode: 422, code: 'PORTFOLIO_SEMANTIC_EVIDENCE_INVALID' });

    const foreignOrg = await prisma.organization.create({ data: { id: 'kan244-foreign-org', name: 'Foreign', slug: 'kan244-foreign-org' } });
    const foreignCompany = await prisma.company.create({ data: {
      id: 'kan244-foreign-company', name: 'Foreign company', slug: 'kan244-foreign-company', sector: 'Other', country: 'ES',
      scope: 'ORGANIZATION', organizationId: foreignOrg.id,
    } });
    const entry = {
      dimension: 'IDENTITY', fieldKey: 'purpose', value: { text: 'Foreign' }, sourceType: 'USER_INPUT', sourceId: null,
      confidence: 1, verificationStatus: 'USER_CONFIRMED', updatedAt: '2026-11-08T00:00:00.000Z',
    };
    const version = await prisma.companyContextVersion.create({ data: {
      id: 'kan244-foreign-version', companyId: foreignCompany.id, versionNumber: 1, status: 'PUBLISHED',
      snapshotJson: { entries: [entry] }, createdByUserId: otherUserId, publishedByUserId: otherUserId, publishedAt: new Date(),
    } });
    await expect(service.appendTurn(command({
      idempotencyKey: 'foreign-company-ref', expectedVersion: 1,
      facts: [{
        conceptId: 'purpose', value: 'Foreign', provenance: 'source_extracted', confidence: 1, status: 'observed',
        evidenceRefs: [{ kind: 'company_context_entry', companyId: foreignCompany.id, versionId: version.id, entryFingerprint: companyEntryFingerprint(entry) }],
      }],
    }))).rejects.toMatchObject({ statusCode: 404, code: 'COMPANY_NOT_FOUND' });
  });
});

function command(overrides: Record<string, unknown> = {}) {
  const emitsQuestion = overrides.emittedQuestion !== undefined && overrides.emittedQuestion !== null;
  return {
    sessionId, authenticatedUserId: userId, permissions,
    idempotencyKey: 'turn-1', expectedVersion: 0,
    inputText: 'Somos una cafetería y nunca hemos probado pedidos a oficinas.',
    status: 'completed', facts: [], hypotheses: [], answeredGaps: [], answeredQuestionId: null,
    emittedQuestion: null,
    convergence: emitsQuestion
      ? { status: 'question_required', reason: 'Existe un gap material.' }
      : { status: 'ready_for_human_review', reason: 'Suficiente para revisar.' },
    questionBudget: { limit: null, used: emitsQuestion ? 1 : 0 }, error: null,
    execution: { provider: 'test-double', model: 'fixture', durationMs: 10, inputTokens: 5, outputTokens: 5, totalTokens: 10, retryCount: 0, fallbackUsed: false },
    ...overrides,
  } as any;
}

function fact(conceptId: string, quote: string) {
  return {
    conceptId, value: quote, provenance: 'user_declared',
    evidenceRefs: [{ kind: 'user_input', quote }], confidence: 1, status: 'observed',
  };
}

function hypothesis() {
  return {
    hypothesisId: 'hyp-demand', statement: 'Puede haber demanda recurrente.', provenance: 'copilot_inferred',
    supportConceptIds: ['pilot_experience'], confidence: 0.4, status: 'proposed',
  };
}

function question(resolve: string) {
  return {
    id: `question-${resolve}`, recap: 'Recap factual', question: `¿Qué sabemos de ${resolve}?`,
    reasonToAsk: 'Puede cambiar el framing de E2.', resolves: [resolve],
  };
}

function makeApp(actorId: string, roles: any[] = ['portfolio_lead']) {
  const app = express();
  app.use(express.json());
  const authenticate: RequestHandler = (req: any, _res, next) => {
    req.user = { id: actorId, email: `${actorId}@starteria.test`, role: roles[0], roles, permissions: permissionsForRoles(roles) };
    next();
  };
  app.use('/api/v1/portfolio-bootstrap', buildPortfolioBootstrapRouter({ authenticate }));
  app.use(errorHandler);
  return app;
}

async function seed() {
  await prisma.organization.create({ data: { id: organizationId, name: 'KAN-244 semantic org', slug: organizationId } });
  for (const id of [userId, otherUserId]) {
    await prisma.user.create({ data: {
      id, email: `${id}@starteria.test`, name: id, role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'PL', skills: [], organizationId,
    } });
  }
  await prisma.portfolioBootstrapSession.create({ data: { id: sessionId, userId, organizationId } });
  const review = await prisma.portfolioBootstrapContextReview.create({ data: {
    bootstrapSessionId: sessionId, status: 'confirmed', version: 1,
    draftJson: { legacy: true }, confirmedSnapshotJson: { legacy: true }, provenanceJson: [], confirmedProvenanceJson: [],
    confirmedBy: userId, confirmedAt: new Date(),
  } });
  await prisma.portfolioBootstrapContextReviewVersion.create({ data: {
    reviewId: review.id, version: 1, action: 'confirmed', actorUserId: userId,
    snapshotJson: { context: { legacy: true }, provenance: [], status: 'confirmed' },
  } });
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { resource: { in: ['PortfolioBootstrapSemanticState', 'PortfolioBootstrapSemanticTurn'] } } });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: sessionId } });
  await prisma.companyContextVersion.deleteMany({ where: { companyId: 'kan244-foreign-company' } });
  await prisma.company.deleteMany({ where: { id: 'kan244-foreign-company' } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.organization.deleteMany({ where: { id: 'kan244-foreign-org' } });
}
