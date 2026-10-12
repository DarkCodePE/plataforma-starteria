import { describe, expect, it, vi } from 'vitest';
import { PortfolioSetupContinuityReadService, type PortfolioSetupReadDependencies,
  type PortfolioSetupReadView } from './portfolio-setup-continuity-read.service';
import { PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { CONTINUATION_114F_FORMAT, sourceBindingFingerprint } from './portfolio-entry-continuation.data-contract';
import type { ReadableScopeResolution } from '../../shared/authz/scoped-portfolio-access.service';

const now = new Date('2026-10-11T12:00:00.000Z');
const session = {
  id: 'session-1', ownerUserId: 'owner-1', ownershipState: 'CLAIMED', lifecycleStatus: 'HANDOFF_READY',
  expiresAt: new Date('2026-10-12T12:00:00.000Z'), expiredAt: null, contextRevision: 2,
  continuationProfile: 'PORTFOLIO_LEAD_ENTRY', continuationProfileVersion: 1,
  continuationProfileEvidenceRef: 'session-create-v1',
};
const handoff = {
  id: 'handoff-1', sessionId: 'session-1', artifactVersion: 1,
  schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, sourceContextRevision: 2,
  confirmationState: 'confirmed', confirmedAt: new Date('2026-10-11T11:00:00.000Z'),
  confirmedByUserId: 'owner-1', payload: {
    conclusionStatus: 'supported', finalReading: 'Lectura confirmada', decisionInView: 'Decidir alcance',
    usableNow: [], decisionChangingUnknowns: [{ uncertainty: 'Falta dato', whyItMatters: 'Cambia decisión' }],
    firstMovement: null,
  },
};
const scopeA = { organizationId: 'org-a', name: 'Espacio A' };
const scopeB = { organizationId: 'org-b', name: 'Espacio B' };
const refreshedSession = { ...session, contextRevision: 3 };
const refreshedHandoff = { ...handoff, id: 'handoff-2', artifactVersion: 2, sourceContextRevision: 3,
  confirmedAt: new Date('2026-10-11T11:30:00.000Z'), payload: { ...handoff.payload, finalReading: 'Lectura nueva' } };

function snapshot(overrides: Record<string, unknown> = {}, organizationScopeId = 'org-a') {
  const binding = {
    sessionId: session.id, ownerUserId: session.ownerUserId, sourceContextRevision: session.contextRevision,
    criticalHandoffId: handoff.id, criticalHandoffVersion: handoff.artifactVersion,
    criticalHandoffSchemaVersion: handoff.schemaVersion, criticalHandoffConfirmedAt: handoff.confirmedAt.toISOString(),
    starteriaPath: null, continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const,
    continuationProfileVersion: 1, profileEvidenceRef: 'session-create-v1',
    organizationScopeId, operation: 'continue_portfolio_setup',
  };
  return {
    id: 'snapshot-1', sessionId: session.id, continuedByUserId: session.ownerUserId,
    snapshotFormat: CONTINUATION_114F_FORMAT, snapshotGeneration: 1, snapshotState: 'CURRENT',
    sourceContextRevision: 2, criticalHandoffId: handoff.id, criticalHandoffVersion: 1,
    criticalHandoffSchemaVersion: handoff.schemaVersion, criticalHandoffConfirmedAt: handoff.confirmedAt,
    starteriaPathProjectionVersion: null, starteriaPathSchemaVersion: null, starteriaPathBoundaryVersion: null,
    continuationProfile: 'PORTFOLIO_LEAD_ENTRY', continuationProfileVersion: 1,
    profileEvidenceRef: 'session-create-v1', organizationScopeId,
    snapshotOperation: binding.operation, idempotencyKeyHash: 'key-hash', requestFingerprint: 'request-hash',
    sourceBindingHash: sourceBindingFingerprint(binding), supersededAt: null, supersededById: null,
    carriedProjection: { criticalReading: { text: 'Lectura guardada', sourceRef: handoff.id,
      origin: 'AI_INFERRED', truthClass: 'CONFIRMED_REPRESENTATION' } },
    openItems: [],
    sourceSnapshot: { rawEntry: 'must never leak', semanticState: { secret: true } },
    ...overrides,
  };
}

function setup(overrides: { session?: Record<string, unknown> | null; handoff?: Record<string, unknown> | null;
  snapshots?: Array<Record<string, unknown>>; scopes?: Array<{ organizationId: string; name: string }>;
  scopeResolution?: ReadableScopeResolution } = {}) {
  const scopes = [...new Map((overrides.scopes ?? []).map((scope) => [scope.organizationId, scope])).values()];
  const resolution: ReadableScopeResolution = overrides.scopeResolution ?? (scopes.length === 0
    ? { state: 'ZERO_SCOPES', scopes: [] }
    : scopes.length === 1 ? { state: 'ONE_SCOPE', scopes: [scopes[0]] }
      : { state: 'MULTIPLE_SCOPES', scopes: [scopes[0], scopes[1], ...scopes.slice(2)] });
  const view = {
    readSession: vi.fn().mockResolvedValue(overrides.session === undefined ? session : overrides.session),
    readLatestHandoff: vi.fn().mockResolvedValue(overrides.handoff === undefined ? handoff : overrides.handoff),
    readCurrentSnapshots: vi.fn().mockResolvedValue(overrides.snapshots ?? []),
    resolveReadableScopes: vi.fn().mockResolvedValue(resolution),
  } as unknown as PortfolioSetupReadView;
  const deps = { ...view, withReadView: vi.fn(async (_sessionId, run) => run(view)) } as unknown as PortfolioSetupReadDependencies & PortfolioSetupReadView;
  return { service: new PortfolioSetupContinuityReadService(deps, () => now), deps };
}

const read = (service: PortfolioSetupContinuityReadService) => service.read({ sessionId: session.id, ownerUserId: session.ownerUserId });

describe('114F read/status boundary', () => {
  it('returns READY_PROVISIONAL without a snapshot or scoped authority', async () => {
    const { service } = setup();
    const dto = await read(service);
    expect(dto.status).toBe('READY_PROVISIONAL');
    expect(dto.nextAuthorizedSurface).toBe('PROVISIONAL_CONTEXT_ESTABLISHMENT');
    expect(dto.snapshot).toBeUndefined();
  });

  it('returns READY_AUTHORIZED_SCOPE for one validated scope', async () => {
    const dto = await read(setup({ scopes: [scopeA] }).service);
    expect(dto.status).toBe('READY_AUTHORIZED_SCOPE');
    expect(dto.currentScope).toEqual(scopeA);
    expect(dto.nextAuthorizedSurface).toBe('PORTFOLIO_HOME_BOOTSTRAP');
  });

  it('returns SELECT_SCOPE with server-authorized options only', async () => {
    const dto = await read(setup({ scopes: [scopeA, scopeB] }).service);
    expect(dto.status).toBe('SELECT_SCOPE');
    expect(dto.authorizedScopes).toEqual([scopeA, scopeB]);
    expect(dto.currentScope).toBeUndefined();
  });

  it('counts duplicate membership rows as one readable organization', async () => {
    const dto = await read(setup({ scopes: [scopeA, scopeA] }).service);
    expect(dto.status).toBe('READY_AUTHORIZED_SCOPE');
    expect(dto.authorizedScopes).toEqual([scopeA]);
    expect(dto.currentScope).toEqual(scopeA);
  });

  it('uses one consistent read view when live source changes between awaited reads', async () => {
    const { service, deps } = setup({ scopes: [scopeA] });
    const live = { ...session };
    vi.mocked(deps.readSession).mockImplementation(async () => {
      live.contextRevision = 3;
      return { ...session };
    });
    const dto = await read(service);
    expect(dto.status).toBe('READY_AUTHORIZED_SCOPE');
    expect(dto.sourceBinding?.contextRevision).toBe(2);
    expect(live.contextRevision).toBe(3);
    expect(deps.withReadView).toHaveBeenCalledOnce();
  });

  it('returns NO_AUTHORIZED_SCOPE when an existing snapshot scope is revoked', async () => {
    const dto = await read(setup({ snapshots: [snapshot()] }).service);
    expect(dto.status).toBe('NO_AUTHORIZED_SCOPE');
    expect(dto.snapshot).toBeUndefined();
    expect(dto.nextAuthorizedSurface).toBe('PROVISIONAL_CONTEXT_ESTABLISHMENT');
  });

  it('does not convert a resolver failure into zero scopes', async () => {
    const { service, deps } = setup({ scopeResolution: { state: 'RESOLVER_FAILURE' } });
    const dto = await read(service);
    expect(dto.status).toBe('SCOPE_VALIDATION_FAILED');
    expect(dto.scopeState).toBe('VALIDATION_FAILED');
    expect(dto.authorizedScopes).toBeUndefined();
    expect(JSON.stringify(dto)).not.toContain('database');
    expect(deps.resolveReadableScopes).toHaveBeenCalledWith(session.ownerUserId);
  });

  it('returns ERROR when source storage fails', async () => {
    const { service, deps } = setup();
    vi.mocked(deps.readLatestHandoff).mockRejectedValue(new Error('database unavailable'));
    const dto = await read(service);
    expect(dto.status).toBe('ERROR');
    expect(dto.recovery?.code).toBe('RETRY_READ');
  });

  it.each([
    { sessionValue: { contextRevision: 3 }, handoffValue: handoff, reason: 'revision changed' },
    { sessionValue: session, handoffValue: { ...handoff, confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: null }, reason: 'not confirmed' },
    { sessionValue: session, handoffValue: { ...handoff, schemaVersion: 'unknown-version' }, reason: 'unsupported version' },
  ])('returns STALE_SOURCE when $reason', async ({ sessionValue, handoffValue }) => {
    const dto = await read(setup({ session: { ...session, ...sessionValue }, handoff: handoffValue }).service);
    expect(dto.status).toBe('STALE_SOURCE');
    expect(dto.snapshot).toBeUndefined();
  });

  it('keeps a truly stale or unconfirmed latest 114D fail closed even with a stored snapshot', async () => {
    for (const invalidHandoff of [
      { ...handoff, sourceContextRevision: 1 },
      { ...handoff, confirmationState: 'provisional', confirmedAt: null, confirmedByUserId: null },
    ]) {
      const { service, deps } = setup({ handoff: invalidHandoff, snapshots: [snapshot()], scopes: [scopeA] });
      const dto = await read(service);
      expect(dto.status).toBe('STALE_SOURCE');
      expect(dto.recovery?.code).toBe('REVIEW_CRITICAL_HANDOFF');
      expect(deps.readCurrentSnapshots).not.toHaveBeenCalled();
      expect(deps.resolveReadableScopes).not.toHaveBeenCalled();
    }
  });

  it('returns PROFILE_CONFLICT for absent profile evidence', async () => {
    const dto = await read(setup({ session: { ...session, continuationProfileEvidenceRef: null } }).service);
    expect(dto.status).toBe('PROFILE_CONFLICT');
  });

  it('keeps Initiative behind BLOCKED_AUTHORITY without external transition/assignment policy', async () => {
    const dto = await read(setup({ session: { ...session, continuationProfile: 'INITIATIVE_ENTRY' } }).service);
    expect(dto.status).toBe('BLOCKED_AUTHORITY');
    expect(dto).not.toHaveProperty('initiativeException');
  });

  it('blocks a confirmed Critical Handoff with insufficient basis', async () => {
    const dto = await read(setup({ handoff: { ...handoff, payload: { ...handoff.payload,
      conclusionStatus: 'insufficient_basis', finalReading: null, firstMovement: null } } }).service);
    expect(dto.status).toBe('BLOCKED_AUTHORITY');
    expect(dto.nextAuthorizedSurface).toBeUndefined();
  });

  it('masks missing, unclaimed and other-owner sessions', async () => {
    for (const value of [null, { ...session, ownershipState: 'ANONYMOUS' }, { ...session, ownerUserId: 'someone-else' }]) {
      await expect(read(setup({ session: value }).service)).rejects.toMatchObject({ statusCode: 404 });
    }
  });

  it('reads only a current 114F snapshot after source and grant revalidation', async () => {
    const dto = await read(setup({ snapshots: [snapshot()], scopes: [scopeA] }).service);
    expect(dto.status).toBe('READY_AUTHORIZED_SCOPE');
    expect(dto.snapshot).toEqual(expect.objectContaining({ id: 'snapshot-1', generation: 1, format: CONTINUATION_114F_FORMAT }));
    expect(JSON.stringify(dto)).not.toContain('must never leak');
  });

  it.each([
    { scopes: [scopeA], expectedStatus: 'READY_AUTHORIZED_SCOPE', expectedScope: scopeA },
    { scopes: [scopeA, scopeB], expectedStatus: 'SELECT_SCOPE', expectedScope: undefined },
    { scopes: [], expectedStatus: 'READY_PROVISIONAL', expectedScope: undefined },
  ])('ignores an intact old CURRENT snapshot with $expectedStatus after source refresh',
    async ({ scopes, expectedStatus, expectedScope }) => {
      const { service, deps } = setup({ session: refreshedSession, handoff: refreshedHandoff,
        snapshots: [snapshot()], scopes });
      const dto = await read(service);
      expect(dto.status).toBe(expectedStatus);
      expect(dto.snapshot).toBeUndefined();
      expect(dto.currentScope).toEqual(expectedScope);
      expect(dto.sourceBinding).toMatchObject({ sessionId: session.id, contextRevision: 3,
        criticalHandoffId: refreshedHandoff.id, criticalHandoffVersion: 2,
        criticalHandoffSchemaVersion: refreshedHandoff.schemaVersion,
        confirmedAt: refreshedHandoff.confirmedAt.toISOString() });
      expect(dto.sourceBinding?.starteriaPath).toBeUndefined();
      expect(dto.carriedContext?.criticalReading).toBe('Lectura nueva');
      expect(deps.resolveReadableScopes).toHaveBeenCalledOnce();
    });

  it('does not select the old snapshot scope when multiple current scopes exist', async () => {
    const dto = await read(setup({ session: refreshedSession, handoff: refreshedHandoff,
      snapshots: [snapshot()], scopes: [scopeA, scopeB] }).service);
    expect(dto.authorizedScopes).toEqual([scopeA, scopeB]);
    expect(dto.currentScope).toBeUndefined();
    expect(dto.portfolioAccess.portfolioRead).toBe(false);
  });

  it('reports resolver failure after ignoring an intact old snapshot', async () => {
    const dto = await read(setup({ session: refreshedSession, handoff: refreshedHandoff,
      snapshots: [snapshot()], scopeResolution: { state: 'RESOLVER_FAILURE' } }).service);
    expect(dto.status).toBe('SCOPE_VALIDATION_FAILED');
    expect(dto.recovery?.code).toBe('RETRY_SCOPE_VALIDATION');
    expect(dto.snapshot).toBeUndefined();
  });

  it('rejects an old snapshot with a broken binding hash before comparing source material', async () => {
    const dto = await read(setup({ session: refreshedSession, handoff: refreshedHandoff,
      snapshots: [snapshot({ sourceBindingHash: 'invalid' })], scopes: [scopeA] }).service);
    expect(dto.status).toBe('ERROR');
    expect(dto.recovery?.code).toBe('INVALID_114F_SNAPSHOT');
    expect(dto.snapshot).toBeUndefined();
  });

  it('never projects a LEGACY_UNBOUND row as 114F', async () => {
    const dto = await read(setup({ snapshots: [snapshot({ snapshotFormat: null })], scopes: [scopeA] }).service);
    expect(dto.snapshot).toBeUndefined();
  });

  it('fails closed on invalid snapshot shape and never leaks raw fields', async () => {
    const dto = await read(setup({ snapshots: [snapshot({ carriedProjection: { rawEntry: 'secret' } })], scopes: [scopeA] }).service);
    expect(dto.status).toBe('ERROR');
    expect(dto.recovery?.code).toBe('INVALID_114F_SNAPSHOT');
    expect(JSON.stringify(dto)).not.toContain('secret');
  });

  it('rejects snapshot material mutated without a matching binding hash', async () => {
    const stale = await read(setup({ snapshots: [snapshot({ criticalHandoffId: 'old-handoff' })], scopes: [scopeA] }).service);
    expect(stale.status).toBe('ERROR');
    expect(stale.recovery?.code).toBe('INVALID_114F_SNAPSHOT');
    const path = await read(setup({ snapshots: [snapshot({ starteriaPathProjectionVersion: 'unsupported', starteriaPathSchemaVersion: 'v1', starteriaPathBoundaryVersion: 'v1' })], scopes: [scopeA] }).service);
    expect(path.status).toBe('ERROR');
    expect(path.recovery?.code).toBe('INVALID_114F_SNAPSHOT');
  });

  it('does not expose a snapshot from another tenant even if the owner can read one scope', async () => {
    const dto = await read(setup({ snapshots: [snapshot({}, 'org-b')], scopes: [scopeA] }).service);
    expect(dto.status).toBe('READY_AUTHORIZED_SCOPE');
    expect(dto.currentScope).toEqual(scopeA);
    expect(dto.snapshot).toBeUndefined();
  });

  it('fails closed if two current 114F rows are found', async () => {
    const dto = await read(setup({ snapshots: [snapshot(), snapshot({ id: 'snapshot-2' })], scopes: [scopeA] }).service);
    expect(dto.status).toBe('ERROR');
    expect(dto.snapshot).toBeUndefined();
  });

  it('performs no write, Project or Steps operation', async () => {
    const { service, deps } = setup({ scopes: [scopeA] });
    await read(service);
    expect(deps.readSession).toHaveBeenCalledOnce();
    expect(deps.readLatestHandoff).toHaveBeenCalledOnce();
    expect(deps.readCurrentSnapshots).toHaveBeenCalledOnce();
    expect(deps.resolveReadableScopes).toHaveBeenCalledOnce();
    expect(Object.keys(deps).sort()).toEqual(['readCurrentSnapshots', 'readLatestHandoff', 'readSession', 'resolveReadableScopes', 'withReadView']);
  });
});
