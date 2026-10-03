import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { requestId } from '../../../shared/middleware/request-id';
import { buildPortfolioEntryRouter } from '../../portfolio-entry/portfolio-entry.router';
import { InMemoryPortfolioEntryIdempotencyRepository } from '../../portfolio-entry/infrastructure/in-memory-portfolio-entry-idempotency.repository';
import { PrismaPortfolioEntryIdempotencyRepository } from '../../portfolio-entry/infrastructure/prisma-portfolio-entry-idempotency.repository';
import type { PortfolioEntryHandoffV2 } from '../../portfolio-entry-runtime/domain/handoff.schema';
import { PortfolioEntryConversionService } from '../portfolio-entry-conversion.service';
import { PortfolioEntrySessionService } from '../../portfolio-entry-sessions/application/portfolio-entry-session.service';
import { PrismaPortfolioEntrySessionRepository } from '../../portfolio-entry-sessions/infrastructure/prisma-portfolio-entry-session.repository';

const describeIntegration = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const base = '/api/v1/public/portfolio-entry';
const ownerId = 'user-pe-conversion-owner';
const otherUserId = 'user-pe-conversion-other';
const portfolioLeadId = 'user-pe-continuation-portfolio-lead';
const touchedProjectIds = new Set<string>();
const touchedSessionIds = new Set<string>();
const touchedOrganizationIds = new Set<string>();

const versioning = {
  contractVersion: 'portfolio-entry-contract-v0.1',
  runtimeVersion: 'portfolio-entry-runtime-v0.2',
  schemaVersion: 'portfolio-entry-schema-v0.2',
  promptManifestId: 'portfolio-entry-prompts-v0.2',
};

describeIntegration('Portfolio Entry Conversion Boundary', () => {
  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('converts a claimed confirmed session into one canonical Project with traceability and safe idempotency', async () => {
    const app = makeApp();
    const seeded = await seedConfirmedClaimedSession();
    const forbiddenBefore = {
      challenges: await prisma.challenge.count(),
      strategicFronts: await prisma.strategicFront.count(),
    };

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Idempotency-Key', 'convert-no-auth')
      .send({ expectedRevision: seeded.revision })
      .expect(401);

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('X-Starteria-Entry-Token', 'anonymous-is-not-enough')
      .set('Idempotency-Key', 'convert-anonymous-only')
      .send({ expectedRevision: seeded.revision })
      .expect(401);

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${otherUserId}`)
      .set('Idempotency-Key', 'convert-wrong-owner')
      .send({ expectedRevision: seeded.revision })
      .expect(403);

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-stale')
      .send({ expectedRevision: seeded.revision - 1 })
      .expect(409);

    const first = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-ok')
      .send({ expectedRevision: seeded.revision })
      .expect(200);

    expect(first.body.data).toMatchObject({
      sessionId: seeded.sessionId,
      status: 'CONVERTED',
    });
    expect(first.body.data.projectId).toBeTruthy();
    expect(first.body.data.destinationRoute).toBe(`/initiatives/${first.body.data.projectId}/overview`);
    expect(JSON.stringify(first.body.data)).not.toContain('sourceSnapshot');
    expect(JSON.stringify(first.body.data)).not.toContain('token');
    touchedProjectIds.add(first.body.data.projectId);

    const replay = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-ok')
      .send({ expectedRevision: seeded.revision })
      .expect(200);
    expect(replay.body).toEqual(first.body);

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-ok')
      .send({ expectedRevision: seeded.revision + 1 })
      .expect(409);

    const differentKey = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-safe-existing')
      .send({ expectedRevision: seeded.revision })
      .expect(200);
    expect(differentKey.body.data.projectId).toBe(first.body.data.projectId);

    const [project, teamMembers, steps, conversion, session, portfolioMeta, challenges, strategicFronts] = await Promise.all([
      prisma.project.findUnique({ where: { id: first.body.data.projectId } }),
      prisma.teamMember.findMany({ where: { projectId: first.body.data.projectId } }),
      prisma.step.findMany({ where: { projectId: first.body.data.projectId }, include: { modules: true }, orderBy: { number: 'asc' } }),
      prisma.portfolioEntryConversion.findUnique({ where: { sessionId: seeded.sessionId } }),
      prisma.portfolioEntrySession.findUnique({ where: { id: seeded.sessionId } }),
      prisma.initiativePortfolioMeta.count({ where: { projectId: first.body.data.projectId } }),
      prisma.challenge.count(),
      prisma.strategicFront.count(),
    ]);

    expect(project).toMatchObject({
      ownerId,
      currentStep: 0,
      step0Status: 'IN_PROGRESS',
      origin: 'from_portfolio_entry',
      status: 'DRAFT',
    });
    expect(project?.step0Data).toMatchObject({
      source: 'portfolio_entry',
      portfolioEntrySessionId: seeded.sessionId,
      portfolioEntryHandoffId: seeded.handoffId,
      portfolioEntryConfirmationId: seeded.confirmationId,
      quePasaQueQuieres: 'Correccion humana confirmada para ordenar iniciativas comerciales',
    });
    expect(JSON.stringify(project?.step0Data)).toContain('AI_SUGGESTED');
    expect(JSON.stringify(project?.step0Data)).toContain('brecha de decision');
    expect(teamMembers).toHaveLength(1);
    expect(teamMembers[0]).toMatchObject({ userId: ownerId, role: 'OWNER', status: 'ACTIVE' });
    expect(steps.map((step) => step.number)).toEqual([1, 2, 3, 4]);
    expect(steps.every((step) => step.status === 'BLOCKED')).toBe(true);
    expect(steps.flatMap((step) => step.modules)).not.toHaveLength(0);
    expect(conversion).toMatchObject({
      projectId: first.body.data.projectId,
      handoffId: seeded.handoffId,
      confirmationId: seeded.confirmationId,
      convertedByUserId: ownerId,
      mappingVersion: 'portfolio-entry-conversion-v0.1',
      adaptiveCoreInitializationStatus: 'INITIALIZED',
    });
    expect(JSON.stringify(conversion?.sourceSnapshot)).not.toContain('publicAccessToken');
    expect(JSON.stringify(conversion?.sourceSnapshot)).not.toContain('publicAccessTokenHash');
    expect(session?.lifecycleStatus).toBe('CONVERTED');
    expect(portfolioMeta).toBe(0);
    expect(challenges).toBe(forbiddenBefore.challenges);
    expect(strategicFronts).toBe(forbiddenBefore.strategicFronts);
    expect(await prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } })).toBe(1);
    expect(await prisma.project.count({ where: { id: first.body.data.projectId } })).toBe(1);
    expect(await prisma.adaptiveStepConfiguration.count({ where: { projectId: first.body.data.projectId, stepNumber: 0 } })).toBe(1);
    expect(await prisma.initiativeCycle.count({ where: { projectId: first.body.data.projectId } })).toBe(1);

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/messages`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'post-converted-message')
      .send({ expectedRevision: session!.revision, message: 'Intento posterior' })
      .expect(409);
    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/handoff`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'post-converted-handoff')
      .send({ expectedRevision: session!.revision })
      .expect(409);
    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/handoff/confirmation`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'post-converted-confirm')
      .send({ expectedRevision: session!.revision, action: 'confirm' })
      .expect(409);
    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/guided-exploration`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'post-converted-guided')
      .send({ expectedRevision: session!.revision, choice: 'accept' })
      .expect(409);
  });

  it('continues a confirmed claimed Portfolio session without creating Project, Steps, Adaptive Core or Initiative Owner assignment', async () => {
    const app = makeApp();
    const seeded = await seedConfirmedClaimedSession({
      ownerUserId: portfolioLeadId,
      ownerRole: 'portfolio_lead',
      profile: 'PORTFOLIO_LEAD_ENTRY',
    });
    const before = await canonicalCounts();
    const grantsBeforeContinuation = await prisma.organizationPortfolioAccessGrant.count();

    const first = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'continue-portfolio-ok')
      .send({ expectedRevision: seeded.revision })
      .expect(200);

    expect(first.body.data).toMatchObject({
      sessionId: seeded.sessionId,
      status: 'CONTINUED',
      portfolioAccessGranted: true,
    });
    expect(first.body.data.continuationId).toBeTruthy();
    expect(first.body.data.destinationRoute).toBe(`/portfolio/inicio?portfolioEntryContinuationId=${encodeURIComponent(first.body.data.continuationId)}`);
    expect(first.body.data.context.understanding).toMatchObject({
      value: 'Starteria entendio que hay que ordenar iniciativas comerciales',
    });
    expect(first.body.data.context.provenanceSummary).toEqual([{ origin: 'AI_INFERRED', source_path: 'analysis' }]);
    expect(await prisma.organizationPortfolioAccessGrant.count()).toBe(grantsBeforeContinuation);

    const replay = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'continue-portfolio-ok')
      .send({ expectedRevision: seeded.revision })
      .expect(200);
    expect(replay.body).toEqual(first.body);

    const retry = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'continue-portfolio-same-session-retry')
      .send({ expectedRevision: seeded.revision })
      .expect(200);
    expect(retry.body.data.continuationId).toBe(first.body.data.continuationId);

    const confirmedBrief = await request(app)
      .get(`${base}/sessions/${seeded.sessionId}/confirmed-brief?${new URLSearchParams({
        source: 'portfolio_entry',
        sessionRevision: String(seeded.revision),
        handoffId: seeded.handoffId,
        handoffVersion: '1',
        confirmationId: seeded.confirmationId,
        confirmationVersion: '1',
      })}`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .expect(200);
    expect(confirmedBrief.body.data).toMatchObject({
      sessionId: seeded.sessionId,
      revision: seeded.revision,
      handoffId: seeded.handoffId,
      confirmationId: seeded.confirmationId,
    });

    const read = await request(app)
      .get(`${base}/continuations/${first.body.data.continuationId}`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .expect(200);
    expect(read.body.data.context.unresolvedContext).toEqual([
      { gap_id: 'capacity', description: 'Capacidad disponible por equipo', provenance: { origin: 'AI_INFERRED' } },
    ]);

    const [continuation, session, after] = await Promise.all([
      prisma.portfolioEntryPortfolioContinuation.findUnique({ where: { sessionId: seeded.sessionId } }),
      prisma.portfolioEntrySession.findUnique({ where: { id: seeded.sessionId } }),
      canonicalCounts(),
    ]);

    expect(continuation).toMatchObject({
      handoffId: seeded.handoffId,
      confirmationId: seeded.confirmationId,
      continuedByUserId: portfolioLeadId,
      mappingVersion: 'portfolio-entry-portfolio-continuation-v0.1',
      status: 'CONTINUED',
    });
    expect(continuation?.sourceSnapshot).toMatchObject({
      session: { id: seeded.sessionId, revision: seeded.revision },
      handoffRef: { id: seeded.handoffId, version: 1 },
      confirmation: { id: seeded.confirmationId, version: 1, status: 'CONFIRMED' },
    });
    expect(JSON.stringify(continuation?.sourceSnapshot)).toContain('AI_SUGGESTED');
    expect(JSON.stringify(continuation?.sourceSnapshot)).toContain('brecha de decision');
    expect(session?.lifecycleStatus).toBe('CONFIRMED');
    expect(session?.revision).toBe(seeded.revision);
    expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: seeded.sessionId } })).toBe(1);
    expect(await prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } })).toBe(0);
    expect(after).toEqual(before);
  });

  it('rejects Project conversion for a Portfolio session without canonical side effects', async () => {
    const app = makeApp();
    const seeded = await seedConfirmedClaimedSession({
      ownerUserId: portfolioLeadId,
      ownerRole: 'portfolio_lead',
      profile: 'PORTFOLIO_LEAD_ENTRY',
    });
    const before = await canonicalCounts();

    await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'convert-portfolio-forbidden')
      .send({ expectedRevision: seeded.revision })
      .expect(409);

    expect(await prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } })).toBe(0);
    expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: seeded.sessionId } })).toBe(0);
    expect(await canonicalCounts()).toEqual(before);
  });

  it('requires a pre-existing scoped grant and never escalates a participant during continuation', async () => {
    const app = makeApp();
    const unauthorized = await seedConfirmedClaimedSession({
      ownerUserId: ownerId,
      ownerRole: 'participante',
      profile: 'PORTFOLIO_LEAD_ENTRY',
    });
    const before = await canonicalCounts();
    const grantsBeforeUnauthorizedContinuation = await prisma.organizationPortfolioAccessGrant.count();
    const noAuthorizedContext = await request(app)
      .post(`${base}/sessions/${unauthorized.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'continue-without-scoped-grant')
      .send({ expectedRevision: unauthorized.revision })
      .expect(403);
    expect(noAuthorizedContext.body.error.code).toBe('PORTFOLIO_ENTRY_CONTINUATION_NO_AUTHORIZED_CONTEXT');
    expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: unauthorized.sessionId } })).toBe(0);
    expect(await prisma.organizationPortfolioAccessGrant.count()).toBe(grantsBeforeUnauthorizedContinuation);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { role: true, roles: true } }))
      .toEqual({ role: 'participante', roles: ['participante'] });

    const ownerOrganizationId = `org-${ownerId}`;
    await prisma.organizationPortfolioAccessGrant.create({
      data: {
        id: `grant-${ownerId}-read`,
        userId: ownerId,
        organizationId: ownerOrganizationId,
        capability: 'portfolio:read',
      },
    });
    const secondOrganizationId = `org-${ownerId}-second`;
    await prisma.organization.create({
      data: { id: secondOrganizationId, name: 'Second authorized organization', slug: secondOrganizationId },
    });
    touchedOrganizationIds.add(secondOrganizationId);
    await prisma.organizationMember.create({
      data: { id: `membership-${ownerId}-second`, userId: ownerId, organizationId: secondOrganizationId, role: 'member' },
    });
    await prisma.organizationPortfolioAccessGrant.create({
      data: {
        id: `grant-${ownerId}-second-read`,
        userId: ownerId,
        organizationId: secondOrganizationId,
        capability: 'portfolio:read',
      },
    });
    const multipleContexts = await request(app)
      .post(`${base}/sessions/${unauthorized.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'continue-requires-context-selection')
      .send({ expectedRevision: unauthorized.revision })
      .expect(409);
    expect(multipleContexts.body.error.code).toBe('PORTFOLIO_ENTRY_CONTINUATION_CONTEXT_SELECTION_REQUIRED');

    const grantsBeforeAuthorizedContinuation = await prisma.organizationPortfolioAccessGrant.count();
    const granted = await request(app)
      .post(`${base}/sessions/${unauthorized.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'continue-with-explicit-organization')
      .send({ expectedRevision: unauthorized.revision, organizationId: ownerOrganizationId })
      .expect(200);
    expect(granted.body.data.portfolioAccessGranted).toBe(true);
    expect(granted.body.data.portfolioScope.organizationId).toBe(ownerOrganizationId);
    expect(await prisma.organizationPortfolioAccessGrant.count()).toBe(grantsBeforeAuthorizedContinuation);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { role: true, roles: true } }))
      .toEqual({ role: 'participante', roles: ['participante'] });

    const stale = await seedConfirmedClaimedSession({
      ownerUserId: portfolioLeadId,
      ownerRole: 'portfolio_lead',
      profile: 'PORTFOLIO_LEAD_ENTRY',
    });
    await prisma.portfolioEntryHandoff.create({
      data: {
        sessionId: stale.sessionId,
        version: 2,
        handoffPayload: makeHandoff(),
        handoffStatus: 'ready_with_uncertainty',
        schemaVersion: versioning.schemaVersion,
        runtimeVersion: versioning.runtimeVersion,
        promptManifestId: versioning.promptManifestId,
      },
    });

    await request(app)
      .post(`${base}/sessions/${stale.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'continue-stale-session-revision')
      .send({ expectedRevision: stale.revision - 1 })
      .expect(409);

    await request(app)
      .post(`${base}/sessions/${stale.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'continue-stale-confirmation')
      .send({ expectedRevision: stale.revision })
      .expect(409);
    expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: stale.sessionId } })).toBe(0);
    expect(await canonicalCounts()).toEqual(before);

    await request(app)
      .post(`${base}/sessions/${stale.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${otherUserId}`)
      .set('Idempotency-Key', 'continue-foreign-owner')
      .send({ expectedRevision: stale.revision, organizationId: `org-${portfolioLeadId}` })
      .expect(403);

    const expired = await seedConfirmedClaimedSession({
      ownerUserId: portfolioLeadId,
      ownerRole: 'portfolio_lead',
      profile: 'PORTFOLIO_LEAD_ENTRY',
    });
    await prisma.portfolioEntrySession.update({
      where: { id: expired.sessionId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await request(app)
      .post(`${base}/sessions/${expired.sessionId}/continue-portfolio`)
      .set('Authorization', `Bearer ${portfolioLeadId}`)
      .set('Idempotency-Key', 'continue-expired-session')
      .send({ expectedRevision: expired.revision })
      .expect(410);
  });

  it('rejects unclaimed, unconfirmed and expired sessions without canonical writes', async () => {
    const app = makeApp();
    const service = makeSessionService();
    const { session } = await service.createAnonymousSession({ entryOrigin: 'public_start', rawEntry: 'Entrada sin reclamar' });
    touchedSessionIds.add(session.id);

    await request(app)
      .post(`${base}/sessions/${session.id}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-unclaimed')
      .send({ expectedRevision: 0 })
      .expect(409);

    const claimed = await seedConfirmedClaimedSession({ skipConfirmation: true });
    await request(app)
      .post(`${base}/sessions/${claimed.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-unconfirmed')
      .send({ expectedRevision: claimed.revision })
      .expect(409);

    const expired = await seedConfirmedClaimedSession();
    await prisma.portfolioEntrySession.update({
      where: { id: expired.sessionId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await request(app)
      .post(`${base}/sessions/${expired.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-expired')
      .send({ expectedRevision: expired.revision })
      .expect(410);

    expect(await prisma.project.count({ where: { ownerId } })).toBe(0);
    expect(await prisma.portfolioEntryConversion.count({ where: { convertedByUserId: ownerId } })).toBe(0);
  });

  it('converts a pre-existing CONVERSION_ELIGIBLE session without forcing it back to CONFIRMED', async () => {
    const app = makeApp();
    const seeded = await seedConfirmedClaimedSession({ markEligible: true });

    const response = await request(app)
      .post(`${base}/sessions/${seeded.sessionId}/convert`)
      .set('Authorization', `Bearer ${ownerId}`)
      .set('Idempotency-Key', 'convert-pre-existing-eligible')
      .send({ expectedRevision: seeded.revision })
      .expect(200);
    touchedProjectIds.add(response.body.data.projectId);

    const [session, conversion, projectCount] = await Promise.all([
      prisma.portfolioEntrySession.findUnique({ where: { id: seeded.sessionId } }),
      prisma.portfolioEntryConversion.findUnique({ where: { sessionId: seeded.sessionId } }),
      prisma.project.count({ where: { id: response.body.data.projectId } }),
    ]);

    expect(response.body.data.status).toBe('CONVERTED');
    expect(session?.lifecycleStatus).toBe('CONVERTED');
    expect(conversion?.projectId).toBe(response.body.data.projectId);
    expect(projectCount).toBe(1);
  });

  it('allows only one canonical conversion under concurrent requests for the same session', async () => {
    const app = makeApp();
    const seeded = await seedConfirmedClaimedSession();

    const [first, second] = await Promise.all([
      request(app)
        .post(`${base}/sessions/${seeded.sessionId}/convert`)
        .set('Authorization', `Bearer ${ownerId}`)
        .set('Idempotency-Key', 'convert-race-a')
        .send({ expectedRevision: seeded.revision }),
      request(app)
        .post(`${base}/sessions/${seeded.sessionId}/convert`)
        .set('Authorization', `Bearer ${ownerId}`)
        .set('Idempotency-Key', 'convert-race-b')
        .send({ expectedRevision: seeded.revision }),
    ]);

    expect([200, 409]).toContain(first.status);
    expect([200, 409]).toContain(second.status);

    const conversion = await prisma.portfolioEntryConversion.findUniqueOrThrow({ where: { sessionId: seeded.sessionId } });
    touchedProjectIds.add(conversion.projectId);
    const [projectCount, conversionCount, ownerCount, steps, modules] = await Promise.all([
      prisma.project.count({ where: { id: conversion.projectId } }),
      prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } }),
      prisma.teamMember.count({ where: { projectId: conversion.projectId, role: 'OWNER', status: 'ACTIVE' } }),
      prisma.step.findMany({ where: { projectId: conversion.projectId } }),
      prisma.module.findMany({ where: { step: { projectId: conversion.projectId } } }),
    ]);

    expect(projectCount).toBe(1);
    expect(conversionCount).toBe(1);
    expect(ownerCount).toBe(1);
    expect(steps).toHaveLength(4);
    expect(modules).toHaveLength(14);
  });

  it('rolls back canonical records if conversion fails after Project creation but before conversion trace', async () => {
    const seeded = await seedConfirmedClaimedSession();
    const service = new PortfolioEntryConversionService(
      prisma,
      new PrismaPortfolioEntryIdempotencyRepository(prisma),
      () => new Date(),
      {
        afterProjectCreated: () => {
          throw new Error('simulated failure after project creation');
        },
      },
    );

    await expect(service.convert({
      sessionId: seeded.sessionId,
      expectedRevision: seeded.revision,
      authenticatedUserId: ownerId,
      idempotencyKey: 'convert-rollback',
    })).rejects.toThrow('simulated failure after project creation');

    const [projects, teamMembers, steps, modules, conversions, session] = await Promise.all([
      prisma.project.count({ where: { ownerId, origin: 'from_portfolio_entry' } }),
      prisma.teamMember.count({ where: { userId: ownerId } }),
      prisma.step.count({ where: { project: { ownerId, origin: 'from_portfolio_entry' } } }),
      prisma.module.count({ where: { step: { project: { ownerId, origin: 'from_portfolio_entry' } } } }),
      prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } }),
      prisma.portfolioEntrySession.findUnique({ where: { id: seeded.sessionId } }),
    ]);

    expect(projects).toBe(0);
    expect(teamMembers).toBe(0);
    expect(steps).toBe(0);
    expect(modules).toBe(0);
    expect(conversions).toBe(0);
    expect(session?.lifecycleStatus).not.toBe('CONVERTED');
  });

  it('keeps canonical conversion committed and marks Adaptive Core failure retryable', async () => {
    const seeded = await seedConfirmedClaimedSession();
    const service = new PortfolioEntryConversionService(
      prisma,
      new PrismaPortfolioEntryIdempotencyRepository(prisma),
      () => new Date(),
      {
        adaptiveCoreFactory: () => ({
          ensureInitialized: vi.fn().mockRejectedValue(new Error('adaptive core unavailable')),
        }),
      },
    );

    await expect(service.convert({
      sessionId: seeded.sessionId,
      expectedRevision: seeded.revision,
      authenticatedUserId: ownerId,
      idempotencyKey: 'convert-adaptive-fail',
    })).rejects.toThrow('No pudimos inicializar el core adaptativo');

    const conversion = await prisma.portfolioEntryConversion.findUniqueOrThrow({ where: { sessionId: seeded.sessionId } });
    touchedProjectIds.add(conversion.projectId);
    const [projectCount, conversionCount, session] = await Promise.all([
      prisma.project.count({ where: { id: conversion.projectId } }),
      prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } }),
      prisma.portfolioEntrySession.findUnique({ where: { id: seeded.sessionId } }),
    ]);

    expect(projectCount).toBe(1);
    expect(conversionCount).toBe(1);
    expect(conversion.adaptiveCoreInitializationStatus).toBe('FAILED_RETRYABLE');
    expect(session?.lifecycleStatus).toBe('CONVERTED');
  });

  it('retries FAILED_RETRYABLE Adaptive Core initialization without duplicate canonical records', async () => {
    const seeded = await seedConfirmedClaimedSession();
    const failing = new PortfolioEntryConversionService(
      prisma,
      new PrismaPortfolioEntryIdempotencyRepository(prisma),
      () => new Date(),
      {
        adaptiveCoreFactory: () => ({
          ensureInitialized: vi.fn().mockRejectedValue(new Error('adaptive core unavailable')),
        }),
      },
    );
    await expect(failing.convert({
      sessionId: seeded.sessionId,
      expectedRevision: seeded.revision,
      authenticatedUserId: ownerId,
      idempotencyKey: 'convert-adaptive-retry-first',
    })).rejects.toThrow('No pudimos inicializar el core adaptativo');

    const ensureInitialized = vi.fn().mockResolvedValue({});
    const retrying = new PortfolioEntryConversionService(
      prisma,
      new PrismaPortfolioEntryIdempotencyRepository(prisma),
      () => new Date(),
      { adaptiveCoreFactory: () => ({ ensureInitialized }) },
    );
    const result = await retrying.convert({
      sessionId: seeded.sessionId,
      expectedRevision: seeded.revision,
      authenticatedUserId: ownerId,
      idempotencyKey: 'convert-adaptive-retry-second',
    });
    touchedProjectIds.add(result.projectId);

    const [conversion, projectCount, conversionCount] = await Promise.all([
      prisma.portfolioEntryConversion.findUniqueOrThrow({ where: { sessionId: seeded.sessionId } }),
      prisma.project.count({ where: { id: result.projectId } }),
      prisma.portfolioEntryConversion.count({ where: { sessionId: seeded.sessionId } }),
    ]);

    expect(ensureInitialized).toHaveBeenCalledTimes(1);
    expect(projectCount).toBe(1);
    expect(conversionCount).toBe(1);
    expect(conversion.adaptiveCoreInitializationStatus).toBe('INITIALIZED');
    expect(result.status).toBe('CONVERTED');
  });
});

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use(base, buildPortfolioEntryRouter(
    { maxCreateRequests: 100, maxSubmitRequests: 100, maxHandoffRequests: 100 },
    {
      authenticate: fakeAuthenticate,
      optionalAuthenticate: fakeOptionalAuthenticate,
      agentAdapter: {} as never,
      idempotencyRepository: new InMemoryPortfolioEntryIdempotencyRepository(),
      sessionTtlMs: 60 * 60_000,
      idempotencyTtlMs: 60 * 60_000,
    },
  ));
  app.use(errorHandler);
  return app;
}

function makeSessionService() {
  return new PortfolioEntrySessionService(
    new PrismaPortfolioEntrySessionRepository(prisma),
    { ttlMs: 60 * 60_000, versioning },
  );
}

async function seedConfirmedClaimedSession(options: {
  skipConfirmation?: boolean;
  markEligible?: boolean;
  ownerUserId?: string;
  ownerRole?: 'participante' | 'portfolio_lead';
  profile?: 'PORTFOLIO_LEAD_ENTRY' | 'INITIATIVE_ENTRY';
} = {}) {
  const userId = options.ownerUserId ?? ownerId;
  const role = options.ownerRole ?? 'participante';
  const organizationId = `org-${userId}`;
  await prisma.organization.upsert({
    where: { id: organizationId },
    create: { id: organizationId, name: `Organization ${userId}`, slug: organizationId },
    update: {},
  });
  touchedOrganizationIds.add(organizationId);
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: `${userId}@starteria.test`,
      name: 'PE Owner',
      role,
      roles: [role],
      initials: 'PE',
      skills: [],
      organizationId,
    },
    update: { organizationId },
  });
  const existingMembership = await prisma.organizationMember.findFirst({ where: { userId, organizationId } });
  if (!existingMembership) {
    await prisma.organizationMember.create({
      data: { id: `membership-${userId}`, userId, organizationId, role: 'member' },
    });
  }
  if (options.profile === 'PORTFOLIO_LEAD_ENTRY' && options.ownerUserId === portfolioLeadId) {
    await prisma.organizationPortfolioAccessGrant.upsert({
      where: { userId_organizationId_capability: { userId, organizationId, capability: 'portfolio:read' } },
      create: { id: `grant-${userId}-read`, userId, organizationId, capability: 'portfolio:read' },
      update: {},
    });
  }
  await prisma.user.upsert({
    where: { id: otherUserId },
    create: { id: otherUserId, email: 'pe-conversion-other@starteria.test', name: 'PE Other', role: 'participante', roles: ['participante'], initials: 'PO', skills: [] },
    update: {},
  });
  const service = makeSessionService();
  const created = await service.createAnonymousSession({ entryOrigin: 'public_start', rawEntry: 'Entrada Portfolio Entry' });
  touchedSessionIds.add(created.session.id);
  await prisma.portfolioEntrySession.update({
    where: { id: created.session.id },
    data: { continuationProfile: options.profile ?? 'INITIATIVE_ENTRY' },
  });
  const grantsBeforeClaim = await prisma.organizationPortfolioAccessGrant.count();
  await service.claimOwnership(created.session.id, userId, new Date(), 0);
  expect(await prisma.organizationPortfolioAccessGrant.count()).toBe(grantsBeforeClaim);
  await service.transitionLifecycle(created.session.id, 'ANALYZING');
  await service.transitionLifecycle(created.session.id, 'HANDOFF_ELIGIBLE');
  const handoff = await service.saveHandoff({ sessionId: created.session.id, handoff: makeHandoff() });
  await service.transitionLifecycle(created.session.id, 'AWAITING_CONFIRMATION');
  if (options.skipConfirmation) {
    const current = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: created.session.id } });
    return { sessionId: created.session.id, revision: current.revision, handoffId: handoff.id, confirmationId: '' };
  }
  const confirmation = await service.saveConfirmation({
    sessionId: created.session.id,
    handoffId: handoff.id,
    status: 'CONFIRMED',
    acceptedFields: ['desired_outcome'],
    correctedFields: {
      understanding: { value: 'Correccion humana confirmada para ordenar iniciativas comerciales', origin: 'USER_CONFIRMED' },
    },
    rejectedFields: [],
    confirmedByUserId: userId,
  });
  expect(await prisma.organizationPortfolioAccessGrant.count()).toBe(grantsBeforeClaim);
  const current = await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: created.session.id } });
  if (options.markEligible) {
    const eligible = await service.markConversionEligible(created.session.id);
    return {
      sessionId: created.session.id,
      revision: eligible.revision,
      handoffId: handoff.id,
      confirmationId: confirmation.id,
    };
  }
  return {
    sessionId: created.session.id,
    revision: current.revision,
    handoffId: handoff.id,
    confirmationId: confirmation.id,
  };
}

function makeHandoff(): PortfolioEntryHandoffV2 {
  return {
    understanding: {
      value: 'Starteria entendio que hay que ordenar iniciativas comerciales',
      provenance: { origin: 'AI_INFERRED', source_path: 'latestAnalysis.current_frame' },
    },
    desired_outcome: {
      value: 'Decidir que iniciativas financiar primero',
      provenance: { origin: 'USER_DECLARED', source_text: 'decidir inversion' },
    },
    decision_to_enable: {
      value: 'Comite decide foco trimestral',
      provenance: { origin: 'USER_DECLARED' },
    },
    recommended_approach: {
      description: 'Comparar iniciativas por impacto, urgencia, evidencia y capacidad',
      origin: 'AI_SUGGESTED',
      review_disposition: 'UNREVIEWED',
      provenance: [{ origin: 'AI_SUGGESTED', source_path: 'handoff.recommended_approach' }],
    },
    alternative_approaches: [],
    known_context: [{ key: 'senal', value: 'brecha de decision', provenance: { origin: 'AI_INFERRED' } }],
    unresolved_context: [{ gap_id: 'capacity', description: 'Capacidad disponible por equipo', provenance: { origin: 'AI_INFERRED' } }],
    gap_resolution_map: [],
    evidence_or_clarity_needed: [{ value: 'Confirmar capacidad disponible', provenance: { origin: 'AI_SUGGESTED' } }],
    starteria_path: [{ action: 'prepare_decision', description: 'Preparar decision de foco' }],
    recommended_cta: 'Revisar y completar Step 0',
    provenance_summary: [{ origin: 'AI_INFERRED', source_path: 'analysis' }],
    handoff_status: 'ready_with_uncertainty',
  };
}

const fakeAuthenticate: RequestHandler = (req, _res, next) => {
  const auth = req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    next(AppError.unauthorized('Autenticacion requerida'));
    return;
  }
  const id = auth.slice('Bearer '.length);
  const role = id === portfolioLeadId ? 'portfolio_lead' as const : 'participante' as const;
  req.user = {
    id,
    email: `${id}@starteria.test`,
    role,
    roles: [role],
    permissions: permissionsForRoles([role]),
  };
  next();
};

const fakeOptionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!req.header('Authorization')) {
    next();
    return;
  }
  fakeAuthenticate(req, res, next);
};

async function cleanup() {
  const projectIds = [...touchedProjectIds];
  const sessionIds = [...touchedSessionIds];
  if (sessionIds.length > 0) {
    await prisma.portfolioEntryApiIdempotency.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.portfolioEntryPortfolioContinuation.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.portfolioEntryConversion.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await prisma.portfolioEntrySession.deleteMany({ where: { id: { in: sessionIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.adaptiveAdaptationEvent.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.adaptiveProgressSignal.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.adaptiveCheckpointResponse.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.adaptiveCheckpointInstance.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.adaptiveStepConfiguration.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.cycleStepState.deleteMany({ where: { cycle: { projectId: { in: projectIds } } } });
    await prisma.initiativeCycle.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.teamMember.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.step.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (touchedOrganizationIds.size > 0) {
    const organizationIds = [...touchedOrganizationIds];
    await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherUserId, portfolioLeadId] } } });
  touchedProjectIds.clear();
  touchedSessionIds.clear();
  touchedOrganizationIds.clear();
}

async function canonicalCounts() {
  const [
    strategicFronts,
    challenges,
    projects,
    initiativePortfolioMetas,
    steps,
    adaptiveStepConfigurations,
    adaptiveCheckpointInstances,
    adaptiveCheckpointResponses,
    adaptiveStepOutputs,
    adaptiveProgressSignals,
    adaptiveEvents,
    initiativeCycles,
    ownerAssignments,
  ] = await Promise.all([
    prisma.strategicFront.count(),
    prisma.challenge.count(),
    prisma.project.count({ where: { origin: 'from_portfolio_entry' } }),
    prisma.initiativePortfolioMeta.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.step.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.adaptiveStepConfiguration.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.adaptiveCheckpointInstance.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.adaptiveCheckpointResponse.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.adaptiveStepOutput.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.adaptiveProgressSignal.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.adaptiveAdaptationEvent.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.initiativeCycle.count({ where: { project: { origin: 'from_portfolio_entry' } } }),
    prisma.teamMember.count({ where: { project: { origin: 'from_portfolio_entry' }, role: 'OWNER' } }),
  ]);
  return {
    strategicFronts,
    challenges,
    projects,
    initiativePortfolioMetas,
    steps,
    adaptiveStepConfigurations,
    adaptiveCheckpointInstances,
    adaptiveCheckpointResponses,
    adaptiveStepOutputs,
    adaptiveProgressSignals,
    adaptiveEvents,
    initiativeCycles,
    ownerAssignments,
  };
}
