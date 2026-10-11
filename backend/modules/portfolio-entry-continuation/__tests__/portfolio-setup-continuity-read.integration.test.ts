import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { PortfolioSetupContinuityReadService, createPortfolioSetupReadDependencies } from '../portfolio-setup-continuity-read.service';
import { CONTINUATION_114F_FORMAT, sourceBindingFingerprint } from '../portfolio-entry-continuation.data-contract';
import { PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { ScopedPortfolioAccessService } from '../../../shared/authz/scoped-portfolio-access.service';

const describeDatabase = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();

describeDatabase('114F read-only Prisma adapter', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('resolves zero/one/many and revalidates injected, revoked and other-tenant candidates on PostgreSQL', async () => {
    const userId = randomUUID();
    const otherUserId = randomUUID();
    const organizationIds = [randomUUID(), randomUUID(), randomUUID()];
    const [orgA, orgB, orgC] = organizationIds;
    await prisma.user.createMany({ data: [userId, otherUserId].map((id) => ({
      id, email: `${id}@starteria.test`, name: id, role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'SR', skills: [],
    })) });
    try {
      for (const id of organizationIds) {
        await prisma.organization.create({ data: { id, name: 'Same name', slug: `scope-${id}` } });
      }
      await prisma.organizationMember.createMany({ data: [
        { userId, organizationId: orgA }, { userId, organizationId: orgA },
        { userId, organizationId: orgB }, { userId, organizationId: orgC },
        { userId: otherUserId, organizationId: orgB },
      ] });
      const resolver = new ScopedPortfolioAccessService(prisma);
      const candidate = (organizationId: string) => resolver.revalidateReadableScope({ userId, organizationId });
      expect(await resolver.resolveReadableScopes(userId)).toEqual({ state: 'ZERO_SCOPES', scopes: [] });
      await prisma.organizationPortfolioAccessGrant.createMany({ data: [
        { userId, organizationId: orgC, capability: 'portfolio:write' },
        { userId: otherUserId, organizationId: orgB, capability: 'portfolio:read' },
      ] });
      expect(await candidate(orgC)).toEqual({ state: 'REJECTED' });
      expect(await candidate(orgB)).toEqual({ state: 'REJECTED' });
      expect(await candidate(randomUUID())).toEqual({ state: 'REJECTED' });
      await prisma.organizationPortfolioAccessGrant.create({ data: { userId, organizationId: orgA, capability: 'portfolio:read' } });
      expect(await resolver.resolveReadableScopes(userId)).toEqual({ state: 'ONE_SCOPE',
        scopes: [{ organizationId: orgA, name: 'Same name' }] });
      expect(await candidate(orgA)).toEqual({ state: 'AUTHORIZED', scope: { organizationId: orgA, name: 'Same name' } });
      await prisma.organizationPortfolioAccessGrant.create({ data: { userId, organizationId: orgB, capability: 'portfolio:read' } });
      const expectedIds = [orgA, orgB].sort();
      expect(await resolver.resolveReadableScopes(userId)).toEqual({ state: 'MULTIPLE_SCOPES',
        scopes: expectedIds.map((organizationId) => ({ organizationId, name: 'Same name' })) });
      await prisma.organizationPortfolioAccessGrant.delete({ where: {
        userId_organizationId_capability: { userId, organizationId: orgA, capability: 'portfolio:read' },
      } });
      expect(await candidate(orgA)).toEqual({ state: 'REJECTED' });
      await prisma.organizationMember.deleteMany({ where: { userId, organizationId: orgB } });
      expect(await candidate(orgB)).toEqual({ state: 'REJECTED' });
      await prisma.organization.delete({ where: { id: orgB } });
      expect(await candidate(orgB)).toEqual({ state: 'REJECTED' });
    } finally {
      await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
      await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    }
  });

  it('reads current 114F only, revalidates the grant, and does not write Project or Steps', async () => {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const organizationId = randomUUID();
    const now = new Date();
    const confirmedAt = new Date(now.getTime() - 1000);
    const expiresAt = new Date(now.getTime() + 60_000);
    const handoffId = randomUUID();
    const evidenceRef = `session-created:${sessionId}`;
    await prisma.user.create({ data: { id: userId, email: `${userId}@starteria.test`, name: '114F read owner',
      role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'FR', skills: [] } });
    await prisma.organization.create({ data: { id: organizationId, name: '114F readable organization', slug: `read-${organizationId}` } });
    await prisma.organizationMember.create({ data: { userId, organizationId } });
    await prisma.organizationPortfolioAccessGrant.create({ data: { userId, organizationId, capability: 'portfolio:read' } });
    await prisma.portfolioEntrySession.create({ data: { id: sessionId, ownerUserId: userId, ownershipState: 'CLAIMED',
      rawEntry: 'Private entry', entryOrigin: 'public_start', interactionMode: 'guided', semanticState: {}, questionBudget: {},
      lifecycleStatus: 'HANDOFF_READY', contextRevision: 1, continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
      continuationProfileVersion: 1, continuationProfileEvidenceRef: evidenceRef,
      contractVersion: 'portfolio-entry-contract-v0.1', runtimeVersion: 'portfolio-entry-runtime-v0.2',
      schemaVersion: 'portfolio-entry-schema-v0.2', lastActivityAt: now, expiresAt } });
    await prisma.portfolioEntryCriticalHandoff.create({ data: { id: handoffId, sessionId, artifactVersion: 1,
      schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 1,
      payload: { conclusionStatus: 'supported', finalReading: 'Reviewed reading', decisionInView: 'Decision',
        usableNow: [], decisionChangingUnknowns: [], firstMovement: null },
      confirmationState: 'confirmed', confirmedAt, confirmedByUserId: userId } });
    try {
      await prisma.portfolioEntryPortfolioContinuation.create({ data: { sessionId, continuedByUserId: userId,
        handoffId: 'legacy-handoff', confirmationId: 'legacy-confirmation', portfolioScope: { organizationId },
        sourceSnapshot: { rawEntry: 'Legacy private content' }, pendingItems: {},
        mappingVersion: 'legacy-v0.1', destinationRoute: '/portfolio/setup' } });
      const binding = { sessionId, ownerUserId: userId, sourceContextRevision: 1, criticalHandoffId: handoffId,
        criticalHandoffVersion: 1, criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
        criticalHandoffConfirmedAt: confirmedAt.toISOString(), starteriaPath: null,
        continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const, continuationProfileVersion: 1,
        profileEvidenceRef: evidenceRef, organizationScopeId: organizationId, operation: 'continue' };
      const current = await prisma.portfolioEntryPortfolioContinuation.create({ data: {
        sessionId, continuedByUserId: userId, snapshotFormat: CONTINUATION_114F_FORMAT,
        snapshotGeneration: 1, snapshotState: 'CURRENT', sourceContextRevision: 1,
        criticalHandoffId: handoffId, criticalHandoffVersion: 1,
        criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, criticalHandoffConfirmedAt: confirmedAt,
        continuationProfile: 'PORTFOLIO_LEAD_ENTRY', continuationProfileVersion: 1, profileEvidenceRef: evidenceRef,
        organizationScopeId: organizationId, snapshotOperation: 'continue', idempotencyKeyHash: 'key-read', requestFingerprint: 'request-read',
        sourceBindingHash: sourceBindingFingerprint(binding), carriedProjection: { criticalReading: {
          text: 'Safe reading', sourceRef: handoffId, origin: 'AI_INFERRED', truthClass: 'CONFIRMED_REPRESENTATION' } }, openItems: [],
      } });
      const service = new PortfolioSetupContinuityReadService(createPortfolioSetupReadDependencies(prisma));
      const before = { continuations: await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId } }),
        projects: await prisma.project.count(), steps: await prisma.step.count() };
      await expect(service.read({ sessionId, ownerUserId: 'wrong-owner' })).rejects.toMatchObject({ statusCode: 404 });
      const readable = await service.read({ sessionId, ownerUserId: userId });
      expect(readable.status).toBe('READY_AUTHORIZED_SCOPE');
      expect(readable.snapshot?.id).toBe(current.id);
      expect(JSON.stringify(readable)).not.toContain('Private');
      expect(JSON.stringify(readable)).not.toContain('/portfolio/setup');
      await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId, organizationId } });
      const revoked = await service.read({ sessionId, ownerUserId: userId });
      expect(revoked.status).toBe('NO_AUTHORIZED_SCOPE');
      expect(revoked.snapshot).toBeUndefined();
      expect({ continuations: await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId } }),
        projects: await prisma.project.count(), steps: await prisma.step.count() }).toEqual(before);

      // A source update cannot interleave with the read's session-row lock.
      const baseDeps = createPortfolioSetupReadDependencies(prisma);
      let entered!: () => void;
      let release!: () => void;
      const atSource = new Promise<void>((resolve) => { entered = resolve; });
      const resume = new Promise<void>((resolve) => { release = resolve; });
      const gated = new PortfolioSetupContinuityReadService({
        withReadView: (id, run) => baseDeps.withReadView(id, (view) => run({ ...view,
          readLatestHandoff: async (sourceId) => {
            entered();
            await resume;
            return view.readLatestHandoff(sourceId);
          },
        })),
      });
      const pendingRead = gated.read({ sessionId, ownerUserId: userId });
      await atSource;
      let sourceUpdateFinished = false;
      const sourceUpdate = prisma.portfolioEntrySession.update({ where: { id: sessionId },
        data: { contextRevision: { increment: 1 } } }).then(() => { sourceUpdateFinished = true; });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(sourceUpdateFinished).toBe(false);
      release();
      expect((await pendingRead).status).toBe('NO_AUTHORIZED_SCOPE');
      await sourceUpdate;
      expect((await service.read({ sessionId, ownerUserId: userId })).status).toBe('STALE_SOURCE');
    } finally {
      await prisma.portfolioEntryPortfolioContinuation.deleteMany({ where: { sessionId } });
      await prisma.portfolioEntryCriticalHandoff.deleteMany({ where: { sessionId } });
      await prisma.portfolioEntrySession.delete({ where: { id: sessionId } });
      await prisma.organizationPortfolioAccessGrant.deleteMany({ where: { userId, organizationId } });
      await prisma.organizationMember.deleteMany({ where: { userId, organizationId } });
      await prisma.organization.delete({ where: { id: organizationId } });
      await prisma.user.delete({ where: { id: userId } });
    }
  });
});
