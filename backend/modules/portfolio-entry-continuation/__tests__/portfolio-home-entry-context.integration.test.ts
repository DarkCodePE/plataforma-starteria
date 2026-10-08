import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { buildRequestUser } from '../../auth/auth.middleware';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioEntryRouter } from '../../portfolio-entry/portfolio-entry.router';

const describeIntegration = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1'
  ? describe
  : describe.skip;

const prisma = new PrismaClient();
const base = '/api/v1/public/portfolio-entry';
const ownerId = 'user-portfolio-home-integration-owner';
const otherUserId = 'user-portfolio-home-integration-other';
const organizationId = 'org-portfolio-home-integration-authorized';
const unauthorizedOrganizationId = 'org-portfolio-home-integration-unauthorized';
const touchedSessionIds = new Set<string>();
const touchedOrganizationIds = new Set([organizationId, unauthorizedOrganizationId]);
const touchedUserIds = new Set([ownerId, otherUserId]);

describeIntegration('Portfolio Home entry context DB integration', () => {
  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('preserves authorized continuity, denies revoked access, and remains read-only', async () => {
    const app = makeApp();
    const seeded = await seedAuthorizedState();
    const before = await readCounts();
    const continuationBefore = await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({
      where: { id: seeded.continuationId },
      select: { sessionId: true, handoffId: true, confirmationId: true, portfolioScope: true },
    });

    const authorized = await request(app)
      .get(`${base}/continuations/${seeded.continuationId}/home-context`)
      .set('Authorization', `Bearer ${ownerId}`)
      .expect(200);

    expect(authorized.body).toMatchObject({
      success: true,
      data: {
        continuationId: seeded.continuationId,
        sessionId: seeded.sessionId,
        organization: { id: organizationId, name: 'Authorized Portfolio Org' },
        arrival: {
          understoodNeed: 'Ordenar las iniciativas',
          desiredOutcome: 'Decidir dónde concentrar atención',
          confirmedContext: ['La capacidad debe confirmarse'],
          openItems: ['Falta validar prioridad'],
          laterWork: ['Revisar el detalle después'],
          organizationalUnknowns: ['La capacidad debe confirmarse'],
        },
      },
    });
    expect(authorized.body.data.sessionId).toBe(continuationBefore.sessionId);

    const afterAuthorized = await readCounts();
    expect(afterAuthorized).toEqual(before);
    expect(await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({
      where: { id: seeded.continuationId },
      select: { sessionId: true, handoffId: true, confirmationId: true, portfolioScope: true },
    })).toEqual(continuationBefore);

    await expect(request(app)
      .get(`${base}/continuations/${seeded.continuationId}/home-context`)
      .expect(401)).resolves.toBeDefined();
    await request(app)
      .get(`${base}/continuations/${seeded.continuationId}/home-context`)
      .set('Authorization', `Bearer ${otherUserId}`)
      .expect(403);
    await request(app)
      .get(`${base}/continuations/${seeded.continuationId}/home-context?organizationId=${unauthorizedOrganizationId}`)
      .set('Authorization', `Bearer ${ownerId}`)
      .expect(200)
      .then((response) => expect(response.body.data.organization.id).toBe(organizationId));

    await prisma.organizationPortfolioAccessGrant.deleteMany({
      where: { userId: ownerId, organizationId, capability: 'portfolio:read' },
    });

    const revoked = await request(app)
      .get(`${base}/continuations/${seeded.continuationId}/home-context`)
      .set('Authorization', `Bearer ${ownerId}`)
      .expect(403);
    expect(revoked.body.error.code).toBe('PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED');
    expect((await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({
      where: { id: seeded.continuationId },
      select: { portfolioScope: true },
    })).portfolioScope).toEqual(continuationBefore.portfolioScope);
    expect(await readCounts()).toEqual({ ...before, scopedGrants: before.scopedGrants - 1 });
  });
});

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(base, buildPortfolioEntryRouter({}, {
    authenticate: testAuthenticate,
    liveUnderstandingSynthesizer: { synthesize: async () => null },
  }));
  app.use(errorHandler);
  return app;
}

const testAuthenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    next(AppError.unauthorized('No autorizado.'));
    return;
  }
  const id = authorization.slice('Bearer '.length);
  req.user = buildRequestUser({
    id,
    email: `${id}@starteria.test`,
    role: 'portfolio_lead',
    roles: ['portfolio_lead'],
  });
  next();
};

async function seedAuthorizedState() {
  const now = new Date();
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: `${ownerId}@starteria.test`, name: 'Portfolio Home Owner', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'PH', skills: [], organizationId },
      { id: otherUserId, email: `${otherUserId}@starteria.test`, name: 'Other Portfolio Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'OP', skills: [] },
    ],
  });
  await prisma.organization.createMany({
    data: [
      { id: organizationId, name: 'Authorized Portfolio Org', slug: organizationId },
      { id: unauthorizedOrganizationId, name: 'Unauthorized Portfolio Org', slug: unauthorizedOrganizationId },
    ],
  });
  await prisma.organizationMember.create({ data: { organizationId, userId: ownerId, role: 'member' } });
  await prisma.organizationPortfolioAccessGrant.create({
    data: { userId: ownerId, organizationId, capability: 'portfolio:read' },
  });

  const sessionId = `portfolio-home-entry-session-${Date.now()}`;
  const handoffId = `portfolio-home-entry-handoff-${Date.now()}`;
  const confirmationId = `portfolio-home-entry-confirmation-${Date.now()}`;
  const continuationId = `portfolio-home-entry-continuation-${Date.now()}`;
  touchedSessionIds.add(sessionId);

  await prisma.portfolioEntrySession.create({
    data: {
      id: sessionId,
      ownerUserId: ownerId,
      ownershipState: 'CLAIMED',
      rawEntry: 'Queremos ordenar las iniciativas',
      entryOrigin: 'public_start',
      lifecycleStatus: 'CONFIRMED',
      executionStatus: 'SUCCEEDED',
      interactionMode: 'guided',
      semanticState: {},
      questionBudget: {},
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
      contractVersion: 'portfolio-entry-contract-v0.1',
      runtimeVersion: 'portfolio-entry-runtime-v0.2',
      schemaVersion: 'portfolio-entry-schema-v0.2',
      revision: 3,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    },
  });
  await prisma.portfolioEntryHandoff.create({
    data: {
      id: handoffId,
      sessionId,
      version: 1,
      handoffPayload: {
        understanding: { value: 'Ordenar las iniciativas' },
        desired_outcome: { value: 'Decidir dónde concentrar atención' },
        known_context: [{ value: 'Hay varias iniciativas' }],
        unresolved_context: [{ description: 'Falta validar prioridad' }],
        later_work: [{ value: 'Revisar el detalle después' }],
        organizational_unknowns: [{ value: 'La capacidad debe confirmarse' }],
      },
      handoffStatus: 'CONFIRMED',
      schemaVersion: 'portfolio-entry-schema-v0.2',
      runtimeVersion: 'portfolio-entry-runtime-v0.2',
    },
  });
  await prisma.portfolioEntryConfirmation.create({
    data: {
      id: confirmationId,
      sessionId,
      handoffId,
      version: 1,
      status: 'CONFIRMED',
      acceptedFields: { context: { value: 'La capacidad debe confirmarse' } },
      correctedFields: {},
      rejectedFields: {},
      confirmedByUserId: ownerId,
      confirmedAt: now,
    },
  });
  await prisma.portfolioEntryPortfolioContinuation.create({
    data: {
      id: continuationId,
      sessionId,
      handoffId,
      confirmationId,
      continuedByUserId: ownerId,
      portfolioScope: { kind: 'scoped_portfolio_grant', userId: ownerId, organizationId },
      sourceSnapshot: {
        handoff: {
          understanding: { value: 'Ordenar las iniciativas' },
          desired_outcome: { value: 'Decidir dónde concentrar atención' },
          known_context: [{ value: 'Hay varias iniciativas' }],
          unresolved_context: [{ description: 'Falta validar prioridad' }],
          later_work: [{ value: 'Revisar el detalle después' }],
          organizational_unknowns: [{ value: 'La capacidad debe confirmarse' }],
        },
        confirmation: {
          status: 'CONFIRMED',
          acceptedFields: { context: { value: 'La capacidad debe confirmarse' } },
        },
      },
      pendingItems: { unresolved_context: [], evidence_or_clarity_needed: [] },
      mappingVersion: 'portfolio-entry-portfolio-continuation-v0.1',
      destinationRoute: '/portfolio/setup',
    },
  });
  return { sessionId, continuationId };
}

async function readCounts() {
  const [strategicFronts, challenges, projects, portfolioEntrySessions, portfolioEntryContinuations, portfolioEntryModelExecutions, scopedGrants, organizationMembers] = await Promise.all([
    prisma.strategicFront.count(),
    prisma.challenge.count(),
    prisma.project.count(),
    prisma.portfolioEntrySession.count(),
    prisma.portfolioEntryPortfolioContinuation.count(),
    prisma.portfolioEntryModelExecution.count(),
    prisma.organizationPortfolioAccessGrant.count({ where: { userId: ownerId, organizationId } }),
    prisma.organizationMember.count({ where: { userId: ownerId, organizationId } }),
  ]);
  return { strategicFronts, challenges, projects, portfolioEntrySessions, portfolioEntryContinuations, portfolioEntryModelExecutions, scopedGrants, organizationMembers };
}

async function cleanup() {
  if (touchedSessionIds.size) {
    await prisma.portfolioEntryPortfolioContinuation.deleteMany({ where: { sessionId: { in: [...touchedSessionIds] } } });
    await prisma.portfolioEntryConfirmation.deleteMany({ where: { sessionId: { in: [...touchedSessionIds] } } });
    await prisma.portfolioEntryHandoff.deleteMany({ where: { sessionId: { in: [...touchedSessionIds] } } });
    await prisma.portfolioEntrySession.deleteMany({ where: { id: { in: [...touchedSessionIds] } } });
  }
  await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId: { in: [...touchedUserIds] } } });
  await prisma.organizationMember.deleteMany({ where: { userId: { in: [...touchedUserIds] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [...touchedOrganizationIds] } } });
  await prisma.user.deleteMany({ where: { id: { in: [...touchedUserIds] } } });
}
