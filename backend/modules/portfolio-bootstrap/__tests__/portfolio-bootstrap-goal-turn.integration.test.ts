import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioBootstrapRouter } from '../portfolio-bootstrap.router';

const describeDb = process.env.PORTFOLIO_GOAL_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const organizationId = 'kan253-goal-org';
const userId = 'kan253-goal-owner';
const otherUserId = 'kan253-goal-other';
const sessionId = 'kan253-goal-session';
const anchorId = 'kan253-goal-anchor';
const base = `/api/v1/portfolio-bootstrap/sessions/${sessionId}/objective/turns`;

function app(actor: string) {
  const expressApp = express();
  expressApp.use(express.json());
  const auth: RequestHandler = (req: any, _res, next) => {
    req.user = {
      id: actor, email: `${actor}@starteria.test`, role: 'portfolio_lead',
      roles: ['portfolio_lead'], permissions: permissionsForRoles(['portfolio_lead']),
    };
    next();
  };
  expressApp.use('/api/v1/portfolio-bootstrap', buildPortfolioBootstrapRouter({ authenticate: auth }));
  expressApp.use(errorHandler);
  return expressApp;
}

function command() {
  return {
    expectedVersion: 0,
    expectedAnchorVersion: 1,
    expectedContextReviewVersion: 1,
    questionId: `goal-preview-${anchorId}-v1-outcomeStatement`,
    inputText: 'Validar si existe demanda de desayunos para oficinas.',
    disposition: 'user_declared',
    supersedesTurnId: null,
  };
}

async function seed() {
  await prisma.organization.create({
    data: { id: organizationId, slug: organizationId, name: 'KAN-253 test organization' },
  });
  for (const id of [userId, otherUserId]) {
    await prisma.user.create({ data: {
      id, email: `${id}@starteria.test`, name: id, role: 'portfolio_lead',
      roles: ['portfolio_lead'], initials: 'PL', skills: [], organizationId,
    } });
  }
  await prisma.portfolioBootstrapSession.create({
    data: { id: sessionId, userId, organizationId },
  });
  await prisma.portfolioAnchor.create({ data: {
    id: anchorId, bootstrapSessionId: sessionId,
    outcomeStatement: 'Resultado de negocio por definir', contextSummary: null,
    decisionToEnable: null, businessSignalStatus: 'unknown', businessSignalValue: null,
    status: 'anchor_insufficient', sourceRefs: [], provenanceStatus: 'raw_entry',
    version: 1,
  } });
  await prisma.portfolioBootstrapContextReview.create({ data: {
    bootstrapSessionId: sessionId, status: 'confirmed', version: 1,
    draftJson: { situation: { value: 'Somos una cafetería, no hemos probado desayunos para oficinas.' } },
    confirmedSnapshotJson: { situation: { value: 'Somos una cafetería, no hemos probado desayunos para oficinas.' } },
    provenanceJson: [], confirmedProvenanceJson: [],
    confirmedBy: userId, confirmedAt: new Date(),
  } });
}
async function cleanup() {
  const recorded = await prisma.portfolioBootstrapGoalTurn.findMany({
    where: { bootstrapSessionId: sessionId }, select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: { resource: 'PortfolioBootstrapGoalTurn', resourceId: { in: recorded.map((turn) => turn.id) } },
  });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: sessionId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}

describeDb('KAN-253 B2 goal turn ledger with disposable PostgreSQL', () => {
  if (process.env.PORTFOLIO_GOAL_DB_INTEGRATION === '1') {
    process.env.PORTFOLIO_GOAL_E2_LEDGER_ENABLED = 'true';
  }
  afterEach(cleanup);
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('allows two provisional questions without incorporating the first when opt-in is enabled', async () => {
    process.env.PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED = 'true';
    try {
      await seed();
      const before = await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } });
      const client = app(userId);
      const firstPlan = await request(client)
        .get(base.replace('/turns', '/plan')).expect(200);
      expect(firstPlan.body.data.activeQuestion.id).toContain('-ledger0');
      const first = await request(client).post(base)
        .set('Idempotency-Key', 'multi-turn-first')
        .send({ ...command(), questionId: firstPlan.body.data.activeQuestion.id })
        .expect(200);
      expect(first.body.data).toMatchObject({ version: 1, turn: { field: 'outcomeStatement' } });

      const next = await request(client).get(base.replace('/turns', '/plan')).expect(200);
      expect(next.body.data.activeQuestion).toMatchObject({
        field: 'decisionToEnable',
        id: `goal-preview-${anchorId}-v1-decisionToEnable-ledger1`,
      });
      // A stale question and ledger version may not write the second turn.
      await request(client).post(base).set('Idempotency-Key', 'multi-turn-stale')
        .send({ ...command(), expectedVersion: 1, questionId: firstPlan.body.data.activeQuestion.id })
        .expect(409);
      const second = await request(client).post(base)
        .set('Idempotency-Key', 'multi-turn-second')
        .send({
          ...command(), expectedVersion: 1, questionId: next.body.data.activeQuestion.id,
          inputText: 'Decidir si conviene ofrecer desayunos a oficinas.',
        }).expect(200);
      expect(second.body.data).toMatchObject({ version: 2, turn: { field: 'decisionToEnable' } });
      expect(await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } })).toEqual(before);
    } finally {
      delete process.env.PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED;
    }
  });

  it('commits one human E2 checkpoint atomically after two provisional turns', async () => {
    process.env.PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED = 'true';
    process.env.PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED = 'true';
    try {
      await seed();
      const client = app(userId);
      const firstPlan = await request(client).get(base.replace('/turns', '/plan')).expect(200);
      const first = await request(client).post(base).set('Idempotency-Key', 'checkpoint-first')
        .send({ ...command(), questionId: firstPlan.body.data.activeQuestion.id }).expect(200);
      const secondPlan = await request(client).get(base.replace('/turns', '/plan')).expect(200);
      const second = await request(client).post(base).set('Idempotency-Key', 'checkpoint-second')
        .send({
          ...command(), expectedVersion: 1,
          questionId: secondPlan.body.data.activeQuestion.id,
          inputText: 'Decidir si merece la pena una prueba controlada.',
        }).expect(200);
      const checkpointPath = base.replace('/turns', '/checkpoint');
      const body = {
        expectedAnchorVersion: 1, expectedLedgerVersion: 2, expectedContextReviewVersion: 1,
        decisions: [
          { turnId: first.body.data.turn.id, action: 'accept' },
          { turnId: second.body.data.turn.id, action: 'reject' },
        ],
      };
      const before = await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } });
      expect(before?.version).toBe(1);
      const incomplete = await request(client).post(checkpointPath)
        .send({ ...body, decisions: [body.decisions[0]] }).expect(409);
      expect(incomplete.body.success).toBe(false);
      // Existing Bootstrap ownership contract returns 403 for a known session
      // owned by another authenticated user; the command must remain write-denied.
      const forbidden = await request(app(otherUserId))
        .post(checkpointPath).send(body).expect(403);
      expect(forbidden.body.success).toBe(false);
      expect((await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } }))?.version).toBe(1);

      const result = await request(client).post(checkpointPath).send(body).expect(200);
      expect(result.body.data.anchor).toMatchObject({
        version: 2, outcomeStatement: command().inputText, decisionToEnable: null,
      });
      const after = await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } });
      const refs = after?.sourceRefs as { objectiveConversation?: {
        goalLedgerAcceptedTurnIds?: string[]; goalLedgerRejectedTurnIds?: string[];
      } };
      expect(refs.objectiveConversation?.goalLedgerAcceptedTurnIds).toEqual([first.body.data.turn.id]);
      expect(refs.objectiveConversation?.goalLedgerRejectedTurnIds).toEqual([second.body.data.turn.id]);
      expect(after?.confirmedBy).toBeNull();
      expect(after?.version).toBe(2);
      // The accepted and rejected decisions were one CAS write, not a chain of PATCHes.
      await request(client).post(checkpointPath).send(body).expect(409);
      expect((await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } }))?.version).toBe(2);
      const fakePatch = await request(client).patch(base.replace('/objective/turns', '/anchor')).send({
        expectedVersion: 2,
        sourceRefs: { objectiveConversation: {
          goalLedgerAcceptedTurnIds: [first.body.data.turn.id],
          goalLedgerRejectedTurnIds: [second.body.data.turn.id, 'forged'],
        } },
      }).expect(409);
      expect(fakePatch.body.success).toBe(false);
    } finally {
      delete process.env.PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED;
      delete process.env.PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED;
    }
  });

  it('persists one provisional turn and returns it on reentry without changing Anchor', async () => {
    await seed();
    const before = await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } });
    const first = await request(app(userId)).post(base)
      .set('Idempotency-Key', 'kan253-db-first').send(command()).expect(200);
    expect(first.body.data).toMatchObject({
      version: 1, turn: { disposition: 'user_declared', field: 'outcomeStatement', contextReviewVersion: 1 },
    });
    const read = await request(app(userId)).get(base).expect(200);
    expect(read.body.data).toMatchObject({ version: 1, turns: [{ id: first.body.data.turn.id }] });
    expect(await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } })).toEqual(before);
    expect(await prisma.portfolioBootstrapGoalTurn.count()).toBe(1);
  });

  it('returns one receipt for same-key concurrent replay and rejects stale different-key writes', async () => {
    await seed();
    const client = app(userId);
    const [left, right] = await Promise.all([
      request(client).post(base).set('Idempotency-Key', 'kan253-concurrent').send(command()),
      request(client).post(base).set('Idempotency-Key', 'kan253-concurrent').send(command()),
    ]);
    expect([left.status, right.status]).toEqual([200, 200]);
    expect(left.body.data.turn.id).toBe(right.body.data.turn.id);
    expect(await prisma.portfolioBootstrapGoalTurn.count()).toBe(1);
    const collision = await request(client).post(base).set('Idempotency-Key', 'kan253-concurrent')
      .send({ ...command(), inputText: 'Otro texto' }).expect(409);
    expect(collision.body.error.code).toBe('PORTFOLIO_GOAL_IDEMPOTENCY_CONFLICT');
    await request(client).post(base).set('Idempotency-Key', 'new-intent')
      .send(command()).expect(409);
    expect(await prisma.portfolioBootstrapGoalTurn.count()).toBe(1);
  });

  it('KAN-253 B3 accepts only a real E2 receipt matching the literal proposed value', async () => {
    await seed();
    const client = app(userId);
    const saved = await request(client).post(base)
      .set('Idempotency-Key', 'b3-verified-receipt')
      .send(command()).expect(200);
    const turn = saved.body.data.turn;
    const sourceRefs = {
      priorSourceRefs: [],
      objectiveConversation: {
        field: turn.field,
        value: turn.inputText,
        disposition: 'user_declared',
        origin: 'PortfolioLead',
        recordedAt: turn.createdAt,
        unknownFields: [],
        pendingClarification: null,
        turns: [{
          field: turn.field, value: turn.inputText,
          disposition: 'user_declared', origin: 'PortfolioLead',
          recordedAt: turn.createdAt, ledgerTurnId: turn.id,
          ledgerVersion: turn.version, semanticDisposition: 'user_declared',
        }],
        goalLedgerAcceptedTurnIds: [turn.id],
      },
    };
    const forged = await request(client)
      .patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`)
      .send({
        expectedVersion: 1, outcomeStatement: 'Un KPI que nadie dijo.',
        sourceRefs,
      }).expect(409);
    expect(forged.body.error.code).toBe('PORTFOLIO_GOAL_RECEIPT_INVALID');
    const unverified = await request(client)
      .patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`)
      .send({
        expectedVersion: 1, outcomeStatement: turn.inputText,
        sourceRefs: { ...sourceRefs, objectiveConversation: {
          ...sourceRefs.objectiveConversation, goalLedgerAcceptedTurnIds: ['other-tenant-turn'],
        } },
      }).expect(409);
    expect(unverified.body.error.code).toBe('PORTFOLIO_GOAL_RECEIPT_INVALID');

    const accepted = await request(client)
      .patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`)
      .send({ expectedVersion: 1, outcomeStatement: turn.inputText, sourceRefs }).expect(200);
    expect(accepted.body.data.anchor).toMatchObject({
      outcomeStatement: turn.inputText, version: 2,
      sourceRefs: { objectiveConversation: { goalLedgerAcceptedTurnIds: [turn.id] } },
    });
    const again = await request(client)
      .patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`)
      .send({ expectedVersion: 1, outcomeStatement: turn.inputText, sourceRefs }).expect(409);
    expect(again.body.error.code).toBe('PORTFOLIO_ANCHOR_VERSION_CONFLICT');
  });

  it('KAN-253 B3 atomically accepts a specific Anchor version and rejects stale review', async () => {
    await seed();
    const client = app(userId);
    const first = await request(client)
      .patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`)
      .send({ expectedVersion: 1, outcomeStatement: 'Validar desayunos para oficinas.' })
      .expect(200);
    expect(first.body.data.anchor).toMatchObject({
      outcomeStatement: 'Validar desayunos para oficinas.', version: 2,
    });

    const stale = await request(client)
      .patch(`/api/v1/portfolio-bootstrap/sessions/${sessionId}/anchor`)
      .send({ expectedVersion: 1, outcomeStatement: 'Sobrescritura desde otra pestaña.' })
      .expect(409);
    expect(stale.body.error.code).toBe('PORTFOLIO_ANCHOR_VERSION_CONFLICT');
    const latest = await prisma.portfolioAnchor.findUnique({ where: { id: anchorId } });
    expect(latest?.outcomeStatement).toBe('Validar desayunos para oficinas.');
    expect(latest?.version).toBe(2);
  });

  it('rejects cross-owner reads/writes with no data leak', async () => {
    await seed();
    await request(app(userId)).post(base).set('Idempotency-Key', 'original')
      .send(command()).expect(200);
    const read = await request(app(otherUserId)).get(base).expect(404);
    expect(JSON.stringify(read.body)).not.toContain('desayunos');
    await request(app(otherUserId)).post(base).set('Idempotency-Key', 'other')
      .send(command()).expect(404);
    expect(await prisma.portfolioBootstrapGoalTurn.count()).toBe(1);
  });
});
