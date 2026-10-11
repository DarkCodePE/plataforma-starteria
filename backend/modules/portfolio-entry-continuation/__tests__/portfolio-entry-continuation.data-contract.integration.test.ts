import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { classifyContinuationRow, CONTINUATION_114F_FORMAT, sourceBindingFingerprint } from '../portfolio-entry-continuation.data-contract';

const describeDatabase = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();

describeDatabase('114F continuation persistence', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('preserves the legacy row while enforcing generation, currentness and operation uniqueness', async () => {
    const sessionId = randomUUID();
    const ownerUserId = randomUUID();
    const now = new Date();
    await prisma.user.create({ data: {
      id: ownerUserId, email: `${ownerUserId}@starteria.test`, name: '114F contract owner',
      role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'FC', skills: [],
    } });
    await prisma.portfolioEntrySession.create({ data: {
      id: sessionId, ownerUserId, ownershipState: 'CLAIMED', rawEntry: 'legacy session input',
      entryOrigin: 'public_start', interactionMode: 'guided', semanticState: {}, questionBudget: {},
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY', contractVersion: 'portfolio-entry-contract-v0.1',
      runtimeVersion: 'portfolio-entry-runtime-v0.2', schemaVersion: 'portfolio-entry-schema-v0.2',
      lastActivityAt: now, expiresAt: new Date(now.getTime() + 60_000),
    } });
    try {
      const legacy = await prisma.portfolioEntryPortfolioContinuation.create({ data: {
        sessionId, handoffId: 'legacy-handoff', confirmationId: 'legacy-confirmation',
        continuedByUserId: ownerUserId, portfolioScope: { organizationId: 'legacy-org' },
        sourceSnapshot: { session: { rawEntry: 'compatibility only' } }, pendingItems: {},
        mappingVersion: 'portfolio-entry-portfolio-continuation-v0.1', destinationRoute: '/portfolio/setup',
      } });
      expect(classifyContinuationRow(legacy).kind).toBe('LEGACY_UNBOUND');

      const binding = { sessionId, ownerUserId, sourceContextRevision: 1, criticalHandoffId: 'critical-1',
        criticalHandoffVersion: 1, criticalHandoffSchemaVersion: 'critical-handoff-v0.1',
        criticalHandoffConfirmedAt: now.toISOString(), starteriaPath: null,
        continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const, continuationProfileVersion: 1,
        profileEvidenceRef: `session-created:${sessionId}`, organizationScopeId: null, operation: 'continue' };
      const shared = {
        sessionId, continuedByUserId: ownerUserId, snapshotFormat: CONTINUATION_114F_FORMAT,
        sourceContextRevision: 1, criticalHandoffId: 'critical-1', criticalHandoffVersion: 1,
        criticalHandoffSchemaVersion: 'critical-handoff-v0.1',
        criticalHandoffConfirmedAt: now, continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const,
        continuationProfileVersion: 1, profileEvidenceRef: `session-created:${sessionId}`,
        snapshotOperation: 'continue', sourceBindingHash: sourceBindingFingerprint(binding),
        carriedProjection: { decisionFrame: { text: 'Confirmada por la persona', sourceRef: 'critical-1', origin: 'USER_DECLARED', truthClass: 'CONFIRMED_REPRESENTATION' } }, openItems: [],
      };
      const first = await prisma.portfolioEntryPortfolioContinuation.create({ data: {
        ...shared, snapshotGeneration: 1, snapshotState: 'CURRENT',
        idempotencyKeyHash: 'key-1', requestFingerprint: 'request-1',
      } });
      expect(classifyContinuationRow(first)).toMatchObject({ kind: '114F_SNAPSHOT', generation: 1, lifecycle: { state: 'CURRENT' } });
      expect(first.sourceSnapshot).toBeNull();
      await expect(prisma.portfolioEntryPortfolioContinuation.create({ data: {
        sessionId, handoffId: 'second-legacy', confirmationId: 'second-confirmation', continuedByUserId: ownerUserId,
        portfolioScope: {}, sourceSnapshot: {}, pendingItems: {}, mappingVersion: 'legacy', destinationRoute: '/portfolio/setup',
      } })).rejects.toMatchObject({ code: 'P2002' });
      await expect(prisma.portfolioEntryPortfolioContinuation.create({ data: {
        ...shared, snapshotGeneration: 2, snapshotState: 'CURRENT',
        idempotencyKeyHash: 'key-2', requestFingerprint: 'request-2',
      } })).rejects.toMatchObject({ code: 'P2002' });

      await prisma.portfolioEntryPortfolioContinuation.update({ where: { id: first.id }, data: {
        snapshotState: 'SUPERSEDED', supersededAt: now,
      } });
      const second = await prisma.portfolioEntryPortfolioContinuation.create({ data: {
        ...shared, sourceContextRevision: 2, sourceBindingHash: sourceBindingFingerprint({ ...binding, sourceContextRevision: 2 }),
        snapshotGeneration: 2, snapshotState: 'CURRENT', idempotencyKeyHash: 'key-2', requestFingerprint: 'request-2',
      } });
      await prisma.portfolioEntryPortfolioContinuation.update({ where: { id: first.id }, data: { supersededById: second.id } });
      expect(await prisma.portfolioEntryPortfolioContinuation.count({ where: { sessionId } })).toBe(3);
      expect((await prisma.portfolioEntryPortfolioContinuation.findFirst({ where: { sessionId, snapshotFormat: null } }))?.id).toBe(legacy.id);
      await expect(prisma.portfolioEntryPortfolioContinuation.create({ data: {
        ...shared, snapshotGeneration: 3, snapshotState: 'SUPERSEDED', supersededAt: now,
        idempotencyKeyHash: 'key-2', requestFingerprint: 'different-request',
      } })).rejects.toMatchObject({ code: 'P2002' });
      await expect(prisma.portfolioEntryPortfolioContinuation.create({ data: {
        ...shared, snapshotGeneration: 3, snapshotState: 'SUPERSEDED', supersededAt: now,
        profileEvidenceRef: null, idempotencyKeyHash: 'key-3', requestFingerprint: 'request-3',
      } })).rejects.toThrow();
      expect(await prisma.organizationPortfolioAccessGrant.count({ where: { userId: ownerUserId } })).toBe(0);
    } finally {
      await prisma.portfolioEntryPortfolioContinuation.deleteMany({ where: { sessionId } });
      await prisma.portfolioEntrySession.delete({ where: { id: sessionId } });
      await prisma.user.delete({ where: { id: ownerUserId } });
    }
  });
});
