import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioBootstrapRouter } from '../portfolio-bootstrap.router';
import { companyEntryFingerprint } from '../portfolio-bootstrap-context.service';

const describeIntegration = process.env.PORTFOLIO_BOOTSTRAP_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const userId = 'kan221-context-owner';
const otherUserId = 'kan221-context-other';
const organizationId = 'kan221-context-org';
const sessionId = 'kan221-context-session';
const companyId = 'kan221-context-company';
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
    expect(await (prisma as any).portfolioBootstrapSession.findUnique({ where: { id: sessionId }, select: {
      status: true, bootstrapPhase: true, existingWorkStatus: true, anchor: true, workItems: true, analysisRuns: true,
    } })).toMatchObject({ status: 'active', bootstrapPhase: 'B0_CONTINUE', existingWorkStatus: 'no_existing_work', anchor: null, workItems: [], analysisRuns: [] });
  });

  it('returns 404 for a foreign owner and leaves no receipt', async () => {
    await seed();
    await request(makeApp(otherUserId)).put(`${base}/draft`).set('Idempotency-Key', 'foreign')
      .send({ expectedVersion: 0, context: context('Foreign'), sourceCompanyContext: null }).expect(404);
    expect(await (prisma as any).portfolioBootstrapContextOperation.count()).toBe(0);
  });

  it('reconciles concurrent identical save and confirm requests to one exact response', async () => {
    await seed();
    const app = makeApp(userId);
    const saves = await Promise.all([1, 2].map(() => request(app).put(`${base}/draft`).set('Idempotency-Key', 'race-save')
      .send({ expectedVersion: 0, context: context('Concurrent'), sourceCompanyContext: null })));
    expect(saves.map((response) => response.status)).toEqual([200, 200]);
    expect(saves[0].body.data).toEqual(saves[1].body.data);
    const confirms = await Promise.all([1, 2].map(() => request(app).post(`${base}/confirm`).set('Idempotency-Key', 'race-confirm')
      .send({ expectedVersion: 1 })));
    expect(confirms.map((response) => response.status)).toEqual([200, 200]);
    expect(confirms[0].body.data).toEqual(confirms[1].body.data);
    expect(await (prisma as any).portfolioBootstrapContextReviewVersion.count()).toBe(2);
    expect(await (prisma as any).portfolioBootstrapContextOperation.count()).toBe(2);
  });

  it('validates provenance against the immutable Company snapshot and keeps it frozen during correction', async () => {
    await seed();
    const entry = {
      dimension: 'IDENTITY', fieldKey: 'purpose', value: { text: 'Grow' }, sourceType: 'USER_INPUT', sourceId: null,
      confidence: 1, verificationStatus: 'USER_CONFIRMED', updatedAt: '2026-11-06T00:00:00.000Z',
    };
    await (prisma as any).company.create({ data: {
      id: companyId, name: 'KAN-221 Company', slug: companyId, sector: 'Technology', country: 'ES',
      scope: 'ORGANIZATION', organizationId,
    } });
    await (prisma as any).companyMembership.create({ data: { companyId, userId, role: 'VIEWER', status: 'APPROVED' } });
    await (prisma as any).companyContextVersion.create({ data: {
      id: `${companyId}-v1`, companyId, versionNumber: 1, status: 'PUBLISHED', snapshotJson: { entries: [entry] },
      createdByUserId: userId, publishedByUserId: userId, publishedAt: new Date(),
    } });
    const companyContext = {
      ...context('From snapshot'),
      situation: { value: 'From snapshot', provenance: 'source_extracted', sourceRef: {
        kind: 'company_context_entry', dimension: 'IDENTITY', fieldKey: 'purpose', sourceId: null,
        entryFingerprint: companyEntryFingerprint(entry),
      } },
    };
    const app = makeApp(userId);
    await request(app).put(`${base}/draft`).set('Idempotency-Key', 'company-draft')
      .send({ expectedVersion: 0, context: companyContext, sourceCompanyContext: { companyId, versionId: `${companyId}-v1`, versionNumber: 1 } }).expect(200);
    await request(app).post(`${base}/confirm`).set('Idempotency-Key', 'company-confirm').send({ expectedVersion: 1 }).expect(200);
    await (prisma as any).companyContextVersion.create({ data: {
      id: `${companyId}-v2`, companyId, versionNumber: 2, status: 'PUBLISHED', snapshotJson: { entries: [] },
      createdByUserId: userId, publishedByUserId: userId, publishedAt: new Date(),
    } });
    expect((await request(app).get(base).expect(200)).body.data.sourceOutdated).toBe(true);
    const correction = await request(app).put(`${base}/draft`).set('Idempotency-Key', 'company-correction')
      .send({ expectedVersion: 2, context: context('Human correction'), sourceCompanyContext: null }).expect(200);
    expect(correction.body.data.effectiveSourceCompanyContext).toEqual({ companyId, versionId: `${companyId}-v1`, versionNumber: 1 });
    expect(correction.body.data.draftSourceCompanyContext).toBeNull();
  });

  it('requires Portfolio capability even for the owner', async () => {
    await seed();
    await request(makeApp(userId, ['viewer'])).get(base).expect(403);
    await request(makeApp(userId, ['viewer'])).put(`${base}/draft`).set('Idempotency-Key', 'no-capability')
      .send({ expectedVersion: 0, context: context('Denied'), sourceCompanyContext: null }).expect(403);
  });
});

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
  await (prisma as any).companyContextVersion.deleteMany({ where: { companyId } });
  await (prisma as any).company.deleteMany({ where: { id: companyId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}
