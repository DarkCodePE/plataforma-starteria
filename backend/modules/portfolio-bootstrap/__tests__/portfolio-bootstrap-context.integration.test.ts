import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioBootstrapRouter } from '../portfolio-bootstrap.router';

const describeIntegration = process.env.PORTFOLIO_BOOTSTRAP_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const userId = 'kan221-context-owner';
const otherUserId = 'kan221-context-other';
const organizationId = 'kan221-context-org';
const sessionId = 'kan221-context-session';
const base = `/api/v1/portfolio-bootstrap/sessions/${sessionId}/context`;

const context = (situation: string) => ({
  situation: { value: situation, provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
  area: { value: null, provenance: 'unknown' },
  stakeholder: { value: 'Operations', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
  pilotExperience: { value: 'One pilot', provenance: 'user_declared', sourceRef: { kind: 'decision_brief' } },
  constraints: [], assumptions: [], gaps: [],
});

describeIntegration('KAN-221 Portfolio Bootstrap context persistence', () => {
  afterEach(cleanup);
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it('persists draft/confirm/correction snapshots with CAS, idempotency and reentry', async () => {
    await seed();
    const app = makeApp(userId);
    expect((await request(app).get(base).expect(200)).body.data).toBeNull();

    const first = await request(app).put(`${base}/draft`).set('Idempotency-Key', 'draft-1')
      .send({ expectedVersion: 0, context: context('Initial'), sourceCompanyContext: null }).expect(200);
    const replay = await request(app).put(`${base}/draft`).set('Idempotency-Key', 'draft-1')
      .send({ expectedVersion: 0, context: context('Initial'), sourceCompanyContext: null }).expect(200);
    expect(replay.body.data).toEqual(first.body.data);

    await request(app).put(`${base}/draft`).set('Idempotency-Key', 'draft-1')
      .send({ expectedVersion: 0, context: context('Changed'), sourceCompanyContext: null }).expect(409);
    await request(app).put(`${base}/draft`).set('Idempotency-Key', 'stale-cas')
      .send({ expectedVersion: 0, context: context('Changed'), sourceCompanyContext: null }).expect(409);

    const confirmed = await request(app).post(`${base}/confirm`).set('Idempotency-Key', 'confirm-1')
      .send({ expectedVersion: 1 }).expect(200);
    expect(confirmed.body.data).toMatchObject({ status: 'confirmed', version: 2, hasPendingCorrection: false });
    expect(confirmed.body.data.effectiveContext.situation.value).toBe('Initial');

    const correction = await request(app).put(`${base}/draft`).set('Idempotency-Key', 'draft-2')
      .send({ expectedVersion: 2, context: context('Corrected'), sourceCompanyContext: null }).expect(200);
    expect(correction.body.data).toMatchObject({ status: 'draft', version: 3, hasPendingCorrection: true });
    expect(correction.body.data.effectiveContext.situation.value).toBe('Initial');
    expect(correction.body.data.draft.situation.value).toBe('Corrected');

    const final = await request(app).post(`${base}/confirm`).set('Idempotency-Key', 'confirm-2')
      .send({ expectedVersion: 3 }).expect(200);
    expect(final.body.data.effectiveContext.situation.value).toBe('Corrected');
    expect(await (prisma as any).portfolioBootstrapContextReviewVersion.count()).toBe(4);
    expect(await (prisma as any).portfolioBootstrapContextOperation.count()).toBe(4);
  });

  it('returns 404 for a foreign owner and leaves no receipt', async () => {
    await seed();
    await request(makeApp(otherUserId)).put(`${base}/draft`).set('Idempotency-Key', 'foreign')
      .send({ expectedVersion: 0, context: context('Foreign'), sourceCompanyContext: null }).expect(404);
    expect(await (prisma as any).portfolioBootstrapContextOperation.count()).toBe(0);
  });
});

function makeApp(actorId: string) {
  const app = express();
  app.use(express.json());
  const authenticate: RequestHandler = (req: any, _res, next) => {
    req.user = { id: actorId, email: `${actorId}@starteria.test`, role: 'portfolio_lead', roles: ['portfolio_lead'], permissions: permissionsForRoles(['portfolio_lead']) };
    next();
  };
  app.use('/api/v1/portfolio-bootstrap', buildPortfolioBootstrapRouter({ authenticate }));
  app.use(errorHandler);
  return app;
}

async function seed() {
  await prisma.organization.create({ data: { id: organizationId, name: 'KAN-221 context org', slug: organizationId } });
  for (const id of [userId, otherUserId]) {
    await prisma.user.create({ data: {
      id, email: `${id}@starteria.test`, name: id, role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'PL', skills: [], organizationId,
    } });
  }
  await (prisma as any).portfolioBootstrapSession.create({ data: {
    id: sessionId, userId, organizationId, existingWorkStatus: 'no_existing_work',
  } });
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { resource: 'PortfolioBootstrapContextReview' } });
  await (prisma as any).portfolioBootstrapSession.deleteMany({ where: { id: sessionId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}
