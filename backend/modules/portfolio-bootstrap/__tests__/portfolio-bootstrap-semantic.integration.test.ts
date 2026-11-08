import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioBootstrapRouter } from '../portfolio-bootstrap.router';
import { PortfolioBootstrapSemanticService } from '../portfolio-bootstrap-semantic.service';

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

  it('resolves multiple cross-field gaps, retires one question and converges on the next version', async () => {
    await seed();
    const service = new PortfolioBootstrapSemanticService(prisma);
    const first = await service.appendTurn(command({ emittedQuestion: question('situation') }));
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
    questionBudget: { limit: null, used: 0 }, error: null,
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
  await prisma.portfolioBootstrapContextReview.create({ data: {
    bootstrapSessionId: sessionId, status: 'confirmed', version: 1,
    draftJson: { legacy: true }, confirmedSnapshotJson: { legacy: true }, provenanceJson: [], confirmedProvenanceJson: [],
    confirmedBy: userId, confirmedAt: new Date(),
  } });
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { resource: { in: ['PortfolioBootstrapSemanticState', 'PortfolioBootstrapSemanticTurn'] } } });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: sessionId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}
