import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { BUSINESS_CAPABILITY_BOUNDARY_VERSION, STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION } from '../../portfolio-entry/domain/starteria-path.types';
import { STARTERIA_PATH_DTO_SCHEMA_VERSION } from '../../portfolio-entry-starteria-path/presentation/starteria-path.dto';
import { PortfolioSetupContinuityWriteService, type PortfolioSetupContinueRequest } from '../portfolio-setup-continuity-write.service';
import { PortfolioSetupContinuityReadService, createPortfolioSetupReadDependencies } from '../portfolio-setup-continuity-read.service';
import { PortfolioEntryContinuationService } from '../portfolio-entry-continuation.service';
import type { PortfolioEntryIdempotencyRepository } from '../../portfolio-entry/application/portfolio-entry-idempotency.repository';

const describeDatabase = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function fixture() {
  const userId = randomUUID();
  const sessionId = randomUUID();
  const organizationIds = [randomUUID(), randomUUID()];
  const now = new Date();
  const handoffId = randomUUID();
  const confirmedAt = new Date(now.getTime() - 1000);
  await prisma.user.create({ data: { id: userId, email: `${userId}@starteria.test`, name: '114F write owner',
    role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'FW', skills: [] } });
  for (const id of organizationIds) await prisma.organization.create({ data: {
    id, name: `114F ${id}`, slug: `write-${id}`,
  } });
  await prisma.portfolioEntrySession.create({ data: { id: sessionId, ownerUserId: userId, ownershipState: 'CLAIMED',
    rawEntry: 'PRIVATE_RAW_ENTRY', entryOrigin: 'public_start', interactionMode: 'guided',
    semanticState: { secret: 'PRIVATE_SEMANTIC_STATE' }, questionBudget: {}, lifecycleStatus: 'HANDOFF_READY',
    revision: 3, contextRevision: 1, continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
    continuationProfileVersion: 1, continuationProfileEvidenceRef: `session-created:${sessionId}`,
    contractVersion: 'portfolio-entry-contract-v0.1', runtimeVersion: 'portfolio-entry-runtime-v0.2',
    schemaVersion: 'portfolio-entry-schema-v0.2', lastActivityAt: now, expiresAt: new Date(now.getTime() + 600_000) } });
  await prisma.portfolioEntryCriticalHandoff.create({ data: { id: handoffId, sessionId, artifactVersion: 1,
    schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 1,
    payload: { conclusionStatus: 'supported', finalReading: 'Reviewed reading', decisionInView: 'Decision',
      usableNow: [], decisionChangingUnknowns: [{ uncertainty: 'Unknown', whyItMatters: 'Changes decision' }],
      firstMovement: { movement: 'Explore', whyNow: 'Now', whatItMayClarify: 'Choice', boundary: 'Suggestion' } },
    confirmationState: 'confirmed', confirmedAt, confirmedByUserId: userId } });
  const binding = { sessionId, contextRevision: 1, criticalHandoffId: handoffId,
    criticalHandoffVersion: 1, criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
    confirmedAt: confirmedAt.toISOString() };
  const request = { expectedSessionRevision: 3, sourceBinding: binding };
  const cleanup = async () => {
    await prisma.portfolioEntryApiIdempotency.deleteMany({ where: { sessionId } });
    await prisma.portfolioEntryPortfolioContinuation.deleteMany({ where: { sessionId } });
    await prisma.portfolioEntryCriticalHandoff.deleteMany({ where: { sessionId } });
    await prisma.portfolioEntrySession.delete({ where: { id: sessionId } });
    await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId } });
    await prisma.organizationMember.deleteMany({ where: { userId } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.user.delete({ where: { id: userId } });
  };
  return { userId, sessionId, organizationIds, handoffId, binding, request, cleanup };
}

async function grant(f: Fixture, index = 0) {
  const organizationId = f.organizationIds[index];
  await prisma.organizationMember.create({ data: { userId: f.userId, organizationId } });
  await prisma.organizationPortfolioAccessGrant.create({ data: { userId: f.userId, organizationId,
    capability: 'portfolio:read' } });
  return organizationId;
}

function input(f: Fixture, key = 'idempotency-key-1', request: PortfolioSetupContinueRequest = f.request) {
  return { sessionId: f.sessionId, ownerUserId: f.userId, idempotencyKey: key, request };
}

describeDatabase('114F write/snapshot PostgreSQL boundary', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('masks ownership, rejects no scope, writes only a bounded 114F snapshot and revalidates replay', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      await expect(service.continue({ ...input(f), ownerUserId: randomUUID() })).rejects.toMatchObject({ statusCode: 404 });
      await expect(service.continue(input(f))).rejects.toMatchObject({ code: 'NO_AUTHORIZED_SCOPE' });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: f.sessionId } })).toBe(0);
      const organizationId = await grant(f);
      const before = { projects: await prisma.project.count({ where: { ownerId: f.userId } }),
        steps: await prisma.step.count(),
        grants: await prisma.organizationPortfolioAccessGrant.count({ where: { userId: f.userId } }),
        members: await prisma.organizationMember.count({ where: { userId: f.userId } }),
        bootstrap: await prisma.portfolioBootstrapSession.count({ where: { userId: f.userId } }),
        assignments: await prisma.portfolioHandoffAssignment.count({ where: { createdByActorId: f.userId } }),
        invitations: await prisma.portfolioHandoffInvitation.count() };
      const first = await service.continue(input(f));
      expect(first).toMatchObject({ snapshotGeneration: 1, snapshotState: 'CURRENT', organizationScopeId: organizationId,
        nextAuthorizedSurface: 'PORTFOLIO_HOME_BOOTSTRAP' });
      expect((await service.continue(input(f))).snapshotId).toBe(first.snapshotId);
      await expect(service.continue(input(f, 'new-key-stale-revision')))
        .rejects.toMatchObject({ code: 'STALE_SESSION_REVISION' });
      expect((await service.continue(input(f, 'other-key-same-material', {
        ...f.request, expectedSessionRevision: first.sessionRevision,
      }))).snapshotId).toBe(first.snapshotId);
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: f.sessionId } })).toBe(1);
      const row = await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({ where: { id: first.snapshotId } });
      expect(row.snapshotFormat).toBe('PORTFOLIO_SETUP_114F_V1');
      expect([row.handoffId, row.confirmationId, row.portfolioScope, row.sourceSnapshot, row.pendingItems,
        row.mappingVersion, row.destinationRoute]).toEqual([null, null, null, null, null, null, null]);
      expect(row.carriedProjection).toMatchObject({ criticalReading: { text: 'Reviewed reading' } });
      expect(row.openItems).toMatchObject([{ description: 'Unknown' }]);
      expect(JSON.stringify(row)).not.toMatch(/PRIVATE_RAW_ENTRY|PRIVATE_SEMANTIC_STATE/);
      expect({ projects: await prisma.project.count({ where: { ownerId: f.userId } }),
        steps: await prisma.step.count(),
        grants: await prisma.organizationPortfolioAccessGrant.count({ where: { userId: f.userId } }),
        members: await prisma.organizationMember.count({ where: { userId: f.userId } }),
        bootstrap: await prisma.portfolioBootstrapSession.count({ where: { userId: f.userId } }),
        assignments: await prisma.portfolioHandoffAssignment.count({ where: { createdByActorId: f.userId } }),
        invitations: await prisma.portfolioHandoffInvitation.count() }).toEqual(before);
      const read = new PortfolioSetupContinuityReadService(createPortfolioSetupReadDependencies(prisma));
      expect((await read.read({ sessionId: f.sessionId, ownerUserId: f.userId })).snapshot?.id).toBe(first.snapshotId);
      await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId: f.userId } });
      await expect(service.continue(input(f))).rejects.toMatchObject({ code: 'NO_AUTHORIZED_SCOPE' });
    } finally { await f.cleanup(); }
  });

  it('enforces CAS, source/profile versions, exact scope selection, and idempotency conflicts', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      const orgA = await grant(f);
      await grant(f, 1);
      await expect(service.continue(input(f))).rejects.toMatchObject({ code: 'SCOPE_SELECTION_REQUIRED' });
      await expect(service.continue(input(f, 'inject-key', { ...f.request, organizationId: randomUUID() })))
        .rejects.toMatchObject({ code: 'SCOPE_NOT_AUTHORIZED' });
      await expect(service.continue(input(f, 'stale-revision', { ...f.request, organizationId: orgA,
        expectedSessionRevision: 2 })))
        .rejects.toMatchObject({ code: 'STALE_SESSION_REVISION' });
      await expect(service.continue(input(f, 'stale-source', { ...f.request,
        sourceBinding: { ...f.binding, contextRevision: 0 } }))).rejects.toMatchObject({ code: 'STALE_SOURCE' });
      const chosen = { ...f.request, organizationId: orgA };
      const first = await service.continue(input(f, 'chosen-key', chosen));
      await expect(service.continue(input(f, 'chosen-key', { ...chosen, organizationId: f.organizationIds[1] })))
        .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      await prisma.organizationMember.deleteMany({ where: { userId: f.userId, organizationId: orgA } });
      await expect(service.continue(input(f, 'chosen-key', chosen))).rejects.toMatchObject({ code: 'SCOPE_NOT_AUTHORIZED' });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { id: first.snapshotId } })).toBe(1);
      await prisma.portfolioEntrySession.update({ where: { id: f.sessionId }, data: {
        continuationProfile: 'INITIATIVE_ENTRY',
      } });
      await expect(service.continue(input(f, 'profile-key', { ...f.request, organizationId: f.organizationIds[1] })))
        .rejects.toMatchObject({ code: 'PROFILE_CONFLICT' });
    } finally { await f.cleanup(); }
  });

  it('serializes identical writes and supersedes material changes while preserving legacy rows', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      await grant(f);
      const legacy = await prisma.portfolioEntryPortfolioContinuation.create({ data: {
        sessionId: f.sessionId, continuedByUserId: f.userId, handoffId: 'legacy', confirmationId: 'legacy',
        portfolioScope: { organizationId: f.organizationIds[0] }, sourceSnapshot: { rawEntry: 'legacy' },
        pendingItems: {}, mappingVersion: 'legacy-v0.1', destinationRoute: '/portfolio/setup',
      } });
      const [a, b] = await Promise.all([service.continue(input(f, 'parallel-one')),
        service.continue(input(f, 'parallel-one'))]);
      expect(a.snapshotId).toBe(b.snapshotId);
      const refreshed = { ...f.request, expectedSessionRevision: a.sessionRevision };
      const [c, d] = await Promise.all([service.continue(input(f, 'parallel-two', refreshed)),
        service.continue(input(f, 'parallel-three', refreshed))]);
      expect(c.snapshotId).toBe(a.snapshotId);
      expect(d.snapshotId).toBe(a.snapshotId);
      const confirmedAt = new Date();
      const nextHandoffId = randomUUID();
      await prisma.portfolioEntrySession.update({ where: { id: f.sessionId }, data: {
        revision: { increment: 1 }, contextRevision: { increment: 1 },
      } });
      await prisma.portfolioEntryCriticalHandoff.create({ data: { id: nextHandoffId, sessionId: f.sessionId,
        artifactVersion: 2, schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 2,
        payload: { conclusionStatus: 'supported', finalReading: 'Revised reading', decisionInView: 'Revised decision',
          usableNow: [], decisionChangingUnknowns: [], firstMovement: null }, confirmationState: 'confirmed',
        confirmedAt, confirmedByUserId: f.userId,
      } });
      await expect(service.continue(input(f, 'parallel-one'))).rejects.toMatchObject({ code: 'STALE_SOURCE' });
      const second = await service.continue(input(f, 'next-generation', { expectedSessionRevision: 5,
        sourceBinding: { sessionId: f.sessionId, contextRevision: 2, criticalHandoffId: nextHandoffId,
          criticalHandoffVersion: 2, criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
          confirmedAt: confirmedAt.toISOString() } }));
      expect(second.snapshotGeneration).toBe(2);
      await expect(service.continue(input(f, 'parallel-one', { expectedSessionRevision: 6,
        sourceBinding: second.sourceBinding }))).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      const previous = await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({ where: { id: a.snapshotId } });
      expect(previous.snapshotState).toBe('SUPERSEDED');
      expect(previous.supersededAt).not.toBeNull();
      expect(previous.supersededById).toBe(second.snapshotId);
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: {
        sessionId: f.sessionId, snapshotFormat: 'PORTFOLIO_SETUP_114F_V1', snapshotState: 'CURRENT',
      } })).toBe(1);
      expect(await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({ where: { id: legacy.id } }))
        .toMatchObject({ snapshotFormat: null, destinationRoute: '/portfolio/setup' });
      const legacyReader = new PortfolioEntryContinuationService(prisma, {} as PortfolioEntryIdempotencyRepository);
      await expect(legacyReader.readContinuation({ continuationId: second.snapshotId, authenticatedUserId: f.userId,
        permissions: new Set() })).rejects.toMatchObject({ statusCode: 404 });
    } finally { await f.cleanup(); }
  });

  it('fails closed on unsupported, unconfirmed, and incomplete profile evidence', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      await grant(f);
      await prisma.portfolioEntryCriticalHandoff.update({ where: { id: f.handoffId }, data: {
        confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: null,
      } });
      await expect(service.continue(input(f))).rejects.toMatchObject({ code: 'STALE_SOURCE' });
      await prisma.portfolioEntryCriticalHandoff.update({ where: { id: f.handoffId }, data: {
        confirmationState: 'confirmed', confirmedAt: new Date(f.binding.confirmedAt), confirmedByUserId: f.userId,
        schemaVersion: 'unknown-handoff-version',
      } });
      await expect(service.continue(input(f))).rejects.toMatchObject({ code: 'UNSUPPORTED_SOURCE_VERSION' });
      await prisma.portfolioEntryCriticalHandoff.update({ where: { id: f.handoffId }, data: {
        schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
      } });
      await prisma.portfolioEntrySession.update({ where: { id: f.sessionId }, data: {
        continuationProfileEvidenceRef: null,
      } });
      await expect(service.continue(input(f))).rejects.toMatchObject({ code: 'PROFILE_CONFLICT' });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: f.sessionId } })).toBe(0);
    } finally { await f.cleanup(); }
  });

  it('reprojects represented 114E from the current 114D source and persists only its versions', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      await grant(f);
      const pathVersions = { projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
        schemaVersion: STARTERIA_PATH_DTO_SCHEMA_VERSION, boundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
        criticalHandoffId: f.handoffId, criticalHandoffVersion: 1, sourceContextRevision: 1 };
      await expect(service.continue(input(f, 'bad-path-version', { ...f.request,
        sourceBinding: { ...f.binding, starteriaPath: { ...pathVersions, schemaVersion: 'unsupported' } },
      }))).rejects.toMatchObject({ code: 'UNSUPPORTED_SOURCE_VERSION' });
      await expect(service.continue(input(f, 'stale-path-reference', { ...f.request,
        sourceBinding: { ...f.binding, starteriaPath: { ...pathVersions, criticalHandoffId: randomUUID() } },
      }))).rejects.toMatchObject({ code: 'STALE_SOURCE' });
      const result = await service.continue(input(f, 'current-path-binding', { ...f.request,
        sourceBinding: { ...f.binding, starteriaPath: pathVersions },
      }));
      const row = await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({ where: { id: result.snapshotId } });
      expect(row).toMatchObject({ starteriaPathProjectionVersion: pathVersions.projectionVersion,
        starteriaPathSchemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
        starteriaPathBoundaryVersion: pathVersions.boundaryVersion });
      expect(result.sourceBinding.starteriaPath?.schemaVersion).toBe(STARTERIA_PATH_SCHEMA_VERSION);
      expect((await service.continue(input(f, 'canonical-path-binding', { ...f.request,
        expectedSessionRevision: result.sessionRevision,
        sourceBinding: { ...f.binding, starteriaPath: {
          ...pathVersions, schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
        } },
      }))).snapshotId).toBe(result.snapshotId);
      expect(JSON.stringify(row)).not.toContain('valueBridge');
    } finally { await f.cleanup(); }
  });

  it('rejects a scope held by another tenant principal and distinguishes resolver failure from zero', async () => {
    const f = await fixture();
    const otherUserId = randomUUID();
    try {
      await prisma.user.create({ data: { id: otherUserId, email: `${otherUserId}@starteria.test`,
        name: 'Other tenant', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'OT', skills: [] } });
      await prisma.organizationMember.create({ data: { userId: otherUserId, organizationId: f.organizationIds[1] } });
      await prisma.organizationPortfolioAccessGrant.create({ data: { userId: otherUserId,
        organizationId: f.organizationIds[1], capability: 'portfolio:read' } });
      await grant(f);
      const service = new PortfolioSetupContinuityWriteService(prisma);
      await expect(service.continue(input(f, 'other-tenant-key', {
        ...f.request, organizationId: f.organizationIds[1],
      }))).rejects.toMatchObject({ code: 'SCOPE_NOT_AUTHORIZED' });
      const failingDb = prisma.$extends({ query: { organizationMember: {
        async findMany() { throw new Error('injected-resolver-failure'); },
      } } });
      const failingService = new PortfolioSetupContinuityWriteService(failingDb as unknown as PrismaClient);
      await expect(failingService.continue(input(f, 'resolver-failure-key')))
        .rejects.toMatchObject({ code: 'SCOPE_VALIDATION_FAILED' });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: f.sessionId } })).toBe(0);
    } finally {
      await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId: otherUserId } });
      await prisma.organizationMember.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.deleteMany({ where: { id: otherUserId } });
      await f.cleanup();
    }
  });

  it('rejects concurrent scope choices at the session CAS boundary', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      const orgA = await grant(f);
      const orgB = await grant(f, 1);
      const outcomes = await Promise.allSettled([
        service.continue(input(f, 'scope-choice-a', { ...f.request, organizationId: orgA })),
        service.continue(input(f, 'scope-choice-b', { ...f.request, organizationId: orgB })),
      ]);
      expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
      const failure = outcomes.find((item) => item.status === 'rejected');
      expect(failure && failure.status === 'rejected' ? failure.reason.code : null).toBe('STALE_SESSION_REVISION');
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: {
        sessionId: f.sessionId, snapshotState: 'CURRENT', snapshotFormat: 'PORTFOLIO_SETUP_114F_V1',
      } })).toBe(1);
      const winner = outcomes.find((item) => item.status === 'fulfilled');
      const otherScope = winner && winner.status === 'fulfilled' && winner.value.organizationScopeId === orgA ? orgB : orgA;
      const changed = await service.continue(input(f, 'refreshed-scope-choice', {
        ...f.request, expectedSessionRevision: 4, organizationId: otherScope,
      }));
      expect(changed.snapshotGeneration).toBe(2);
      expect(changed.organizationScopeId).toBe(otherScope);
    } finally { await f.cleanup(); }
  });

  it('rejects a correction or grant revoke that commits before the waiting POST', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      const organizationId = await grant(f);
      let started!: () => void;
      const locked = new Promise<void>((resolve) => { started = resolve; });
      const correction = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "PortfolioEntrySession" WHERE "id" = ${f.sessionId} FOR UPDATE`;
        started();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await tx.portfolioEntrySession.update({ where: { id: f.sessionId }, data: {
          contextRevision: { increment: 1 }, revision: { increment: 1 },
        } });
      });
      await locked;
      const pending = service.continue(input(f, 'racing-correction'));
      await correction;
      await expect(pending).rejects.toMatchObject({ code: 'STALE_SOURCE' });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: f.sessionId } })).toBe(0);

      await prisma.portfolioEntrySession.update({ where: { id: f.sessionId }, data: {
        contextRevision: 1, revision: 3,
      } });
      let grantLocked!: () => void;
      const grantHeld = new Promise<void>((resolve) => { grantLocked = resolve; });
      const revoke = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "OrganizationPortfolioAccessGrant"
          WHERE "userId" = ${f.userId} AND "organizationId" = ${organizationId} FOR UPDATE`;
        grantLocked();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await tx.organizationPortfolioAccessGrant.deleteMany({ where: { userId: f.userId, organizationId } });
      });
      await grantHeld;
      const pendingRevoked = service.continue(input(f, 'racing-revoke'));
      await revoke;
      await expect(pendingRevoked).rejects.toMatchObject({ code: 'NO_AUTHORIZED_SCOPE' });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId: f.sessionId } })).toBe(0);
    } finally { await f.cleanup(); }
  });

  it('rolls back supersession and CAS when the new row cannot be inserted', async () => {
    const f = await fixture();
    const service = new PortfolioSetupContinuityWriteService(prisma);
    try {
      await grant(f);
      const first = await service.continue(input(f, 'rollback-first'));
      const confirmedAt = new Date();
      const nextId = randomUUID();
      await prisma.portfolioEntrySession.update({ where: { id: f.sessionId }, data: {
        contextRevision: { increment: 1 }, revision: { increment: 1 },
      } });
      await prisma.portfolioEntryCriticalHandoff.create({ data: { id: nextId, sessionId: f.sessionId,
        artifactVersion: 2, schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 2,
        payload: { conclusionStatus: 'supported', finalReading: 'Changed source', decisionInView: 'Decision',
          usableNow: [], decisionChangingUnknowns: [], firstMovement: null }, confirmationState: 'confirmed',
        confirmedAt, confirmedByUserId: f.userId,
      } });
      const failingDb = prisma.$extends({ query: { portfolioEntryPortfolioContinuation: {
        async create() { throw new Error('injected-create-failure'); },
      } } });
      const failingService = new PortfolioSetupContinuityWriteService(failingDb as unknown as PrismaClient);
      await expect(failingService.continue(input(f, 'rollback-second', { expectedSessionRevision: 5,
        sourceBinding: { sessionId: f.sessionId, contextRevision: 2, criticalHandoffId: nextId,
          criticalHandoffVersion: 2, criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
          confirmedAt: confirmedAt.toISOString() } }))).rejects.toMatchObject({ code: 'UNEXPECTED_ERROR' });
      expect(await prisma.portfolioEntrySession.findUniqueOrThrow({ where: { id: f.sessionId } }))
        .toMatchObject({ revision: 5 });
      expect(await prisma.portfolioEntryPortfolioContinuation.findUniqueOrThrow({ where: { id: first.snapshotId } }))
        .toMatchObject({ snapshotState: 'CURRENT', supersededAt: null, supersededById: null });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: {
        sessionId: f.sessionId, snapshotFormat: 'PORTFOLIO_SETUP_114F_V1',
      } })).toBe(1);
    } finally { await f.cleanup(); }
  });
});
