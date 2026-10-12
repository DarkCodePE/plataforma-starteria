import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { sourceBindingFingerprint } from '../portfolio-entry-continuation.data-contract';
import { PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { PortfolioSetupHomeArrivalService } from '../portfolio-setup-home-arrival.service';
import { PortfolioBootstrapService } from '../../portfolio-bootstrap/portfolio-bootstrap.service';
import type { Permission } from '../../../shared/authz/permissions';
import { permissionsForRoles } from '../../../shared/authz/permissions';

const describeDatabase = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
const db = new PrismaClient();

describeDatabase('114F Home consumer gate on PostgreSQL', () => {
  afterAll(async () => db.$disconnect());

  it('returns only safe context and rejects owner, stale source, removed membership and revoked scoped B', async () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    const sessionId = randomUUID();
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const handoffId = randomUUID();
    const confirmedAt = new Date(Date.now() - 1000);
    const evidenceRef = `session-created:${sessionId}`;
    const sourceBinding = { sessionId, ownerUserId: userId, sourceContextRevision: 1,
      criticalHandoffId: handoffId, criticalHandoffVersion: 1,
      criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
      criticalHandoffConfirmedAt: confirmedAt.toISOString(), starteriaPath: null,
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const, continuationProfileVersion: 1,
      profileEvidenceRef: evidenceRef, organizationScopeId: organizationId,
      operation: 'PORTFOLIO_SETUP_CONTINUE_V1' };
    await db.user.createMany({ data: [userId, otherId].map((id) => ({ id,
      email: `${id}@starteria.test`, name: id, role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'HA', skills: [] })) });
    await db.organization.create({ data: { id: organizationId, name: 'Safe tenant', slug: `home-${organizationId}` } });
    await db.organization.create({ data: { id: otherOrganizationId, name: 'Other tenant', slug: `home-${otherOrganizationId}` } });
    await db.organizationMember.create({ data: { userId, organizationId } });
    await db.organizationPortfolioAccessGrant.create({ data: { userId, organizationId, capability: 'portfolio:read' } });
    await db.organizationMember.create({ data: { userId: otherId, organizationId: otherOrganizationId } });
    await db.organizationPortfolioAccessGrant.create({ data: {
      userId: otherId, organizationId: otherOrganizationId, capability: 'portfolio:read',
    } });
    await db.portfolioEntrySession.create({ data: { id: sessionId, ownerUserId: userId, ownershipState: 'CLAIMED',
      rawEntry: 'PRIVATE_RAW_ENTRY', entryOrigin: 'public_start', interactionMode: 'guided',
      semanticState: {}, questionBudget: {}, lifecycleStatus: 'HANDOFF_READY', contextRevision: 1,
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY', continuationProfileVersion: 1,
      continuationProfileEvidenceRef: evidenceRef, contractVersion: 'portfolio-entry-contract-v0.1',
      runtimeVersion: 'portfolio-entry-runtime-v0.2', schemaVersion: 'portfolio-entry-schema-v0.2',
      lastActivityAt: new Date(), expiresAt: new Date(Date.now() + 60_000) } });
    await db.portfolioEntryCriticalHandoff.create({ data: { id: handoffId, sessionId, artifactVersion: 1,
      schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 1,
      payload: { conclusionStatus: 'supported', finalReading: 'Reading', decisionInView: 'Decision',
        usableNow: [], decisionChangingUnknowns: [], firstMovement: null },
      confirmationState: 'confirmed', confirmedAt, confirmedByUserId: userId } });
    const snapshot = await db.portfolioEntryPortfolioContinuation.create({ data: {
      sessionId, continuedByUserId: userId, snapshotFormat: 'PORTFOLIO_SETUP_114F_V1',
      snapshotGeneration: 1, snapshotState: 'CURRENT', sourceContextRevision: 1,
      criticalHandoffId: handoffId, criticalHandoffVersion: 1,
      criticalHandoffSchemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
      criticalHandoffConfirmedAt: confirmedAt, continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
      continuationProfileVersion: 1, profileEvidenceRef: evidenceRef, organizationScopeId: organizationId,
      snapshotOperation: 'PORTFOLIO_SETUP_CONTINUE_V1', idempotencyKeyHash: 'PRIVATE_KEY_HASH',
      requestFingerprint: 'PRIVATE_FINGERPRINT', sourceBindingHash: sourceBindingFingerprint(sourceBinding),
      carriedProjection: { criticalReading: { text: 'Working reading', sourceRef: handoffId,
        origin: 'AI_INFERRED', truthClass: 'CONFIRMED_REPRESENTATION' } }, openItems: [],
    } });
    const arrival = new PortfolioSetupHomeArrivalService(db);
    const bootstrap = new PortfolioBootstrapService(db);
    const read = () => arrival.read({ snapshotId: snapshot.id, userId });
    const createOrReuse = () => bootstrap.createOrReuseFromPortfolioSetup({ snapshotId: snapshot.id, authenticatedUserId: userId });
    try {
      const dto = await read();
      expect(dto).toMatchObject({ snapshotId: snapshot.id, organization: { id: organizationId, name: 'Safe tenant' },
        currentness: 'REVALIDATED_AT_HOME_ARRIVAL', bootstrapEligible: true });
      expect(JSON.stringify(dto)).not.toMatch(/PRIVATE_|sourceBindingHash|profileEvidenceRef|rawEntry|semanticState/);
      await expect(arrival.read({ snapshotId: snapshot.id, userId: otherId })).rejects.toMatchObject({ statusCode: 404 });
      await expect(arrival.read({ snapshotId: randomUUID(), userId })).rejects.toMatchObject({ statusCode: 404 });
      const legacy = await db.portfolioEntryPortfolioContinuation.create({ data: { sessionId,
        continuedByUserId: userId, handoffId: 'legacy-handoff', confirmationId: 'legacy-confirmation',
        portfolioScope: { organizationId }, sourceSnapshot: {}, pendingItems: {},
        mappingVersion: 'legacy-v0.1', destinationRoute: '/portfolio/setup' } });
      await expect(arrival.read({ snapshotId: legacy.id, userId })).rejects.toMatchObject({ statusCode: 404 });
      await db.portfolioEntryPortfolioContinuation.delete({ where: { id: legacy.id } });
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: { sourceBindingHash: 'INVALID_HASH' } });
      await expect(read()).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_ARRIVAL_INVALID_SNAPSHOT' });
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: { sourceBindingHash: sourceBindingFingerprint(sourceBinding),
        carriedProjection: { rawEntry: 'INVALID_SHAPE' } } });
      await expect(read()).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_ARRIVAL_INVALID_SNAPSHOT' });
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: { carriedProjection: snapshot.carriedProjection ?? {} } });
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: { snapshotState: 'SUPERSEDED', supersededAt: new Date() } });
      await expect(read()).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_ARRIVAL_STALE_SOURCE' });
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: { snapshotState: 'CURRENT', supersededAt: null } });
      await db.portfolioEntrySession.update({ where: { id: sessionId }, data: { continuationProfileVersion: 2 } });
      await expect(read()).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_ARRIVAL_PROFILE_CONFLICT' });
      await db.portfolioEntrySession.update({ where: { id: sessionId }, data: { continuationProfileVersion: 1 } });
      const nextHandoff = await db.portfolioEntryCriticalHandoff.create({ data: { sessionId, artifactVersion: 2,
        schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 1,
        payload: { conclusionStatus: 'supported', finalReading: 'New reading', decisionInView: 'New decision',
          usableNow: [], decisionChangingUnknowns: [], firstMovement: null },
        confirmationState: 'confirmed', confirmedAt: new Date(), confirmedByUserId: userId } });
      await expect(read()).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_ARRIVAL_STALE_SOURCE' });
      await db.portfolioEntryCriticalHandoff.delete({ where: { id: nextHandoff.id } });
      const nonexistentScope = randomUUID();
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: {
        organizationScopeId: nonexistentScope,
        sourceBindingHash: sourceBindingFingerprint({ ...sourceBinding, organizationScopeId: nonexistentScope }),
      } });
      await expect(read()).rejects.toMatchObject({ statusCode: 403 });
      await db.portfolioEntryPortfolioContinuation.update({ where: { id: snapshot.id }, data: {
        organizationScopeId: organizationId, sourceBindingHash: sourceBindingFingerprint(sourceBinding),
      } });
      const canonicalBefore = { projects: await db.project.count(), steps: await db.step.count(),
        grants: await db.organizationPortfolioAccessGrant.count({ where: { userId, organizationId } }) };
      const firstBootstrap = await createOrReuse();
      expect(firstBootstrap.bootstrapSession).toMatchObject({ organizationId, sourceContinuationId: snapshot.id });
      expect(firstBootstrap.anchor).toMatchObject({ status: 'anchor_provisional', businessSignalStatus: 'unknown' });
      expect((await createOrReuse()).bootstrapSession.id).toBe(firstBootstrap.bootstrapSession.id);
      expect(await db.portfolioBootstrapSession.count({ where: { sourceContinuationId: snapshot.id } })).toBe(1);
      expect({ projects: await db.project.count(), steps: await db.step.count(),
        grants: await db.organizationPortfolioAccessGrant.count({ where: { userId, organizationId } }) }).toEqual(canonicalBefore);
      await db.organizationPortfolioAccessGrant.deleteMany({ where: { userId, organizationId } });
      expect(permissionsForRoles(['portfolio_lead']).has('portfolio:read')).toBe(true);
      await expect(read()).rejects.toMatchObject({ statusCode: 403 });
      await expect(createOrReuse()).rejects.toMatchObject({ statusCode: 403 });
      await expect(bootstrap.getSession({ sessionId: firstBootstrap.bootstrapSession.id, authenticatedUserId: userId,
        permissions: new Set<Permission>(['portfolio:read']) })).rejects.toMatchObject({ statusCode: 403 });
      await db.organizationPortfolioAccessGrant.create({ data: { userId, organizationId, capability: 'portfolio:read' } });
      await db.organizationMember.deleteMany({ where: { userId, organizationId } });
      await expect(read()).rejects.toMatchObject({ statusCode: 403 });
      await db.organizationMember.create({ data: { userId, organizationId } });
      await db.portfolioEntrySession.update({ where: { id: sessionId }, data: { contextRevision: 2 } });
      await expect(read()).rejects.toMatchObject({ statusCode: 409 });
      await expect(createOrReuse()).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      await db.auditLog.deleteMany({ where: { userId, resource: 'PortfolioBootstrap' } });
      const sessions = await db.portfolioBootstrapSession.findMany({ where: { sourceContinuationId: snapshot.id }, select: { id: true } });
      await db.portfolioAnchor.deleteMany({ where: { bootstrapSessionId: { in: sessions.map((item) => item.id) } } });
      await db.portfolioBootstrapSession.deleteMany({ where: { sourceContinuationId: snapshot.id } });
      await db.portfolioEntryPortfolioContinuation.deleteMany({ where: { sessionId } });
      await db.portfolioEntryCriticalHandoff.deleteMany({ where: { sessionId } });
      await db.portfolioEntrySession.delete({ where: { id: sessionId } });
      await db.organizationPortfolioAccessGrant.deleteMany({ where: { userId, organizationId } });
      await db.organizationMember.deleteMany({ where: { userId, organizationId } });
      await db.organizationPortfolioAccessGrant.deleteMany({ where: { userId: otherId, organizationId: otherOrganizationId } });
      await db.organizationMember.deleteMany({ where: { userId: otherId, organizationId: otherOrganizationId } });
      await db.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
      await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    }
  });
});
