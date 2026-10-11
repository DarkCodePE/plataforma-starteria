import { describe, expect, it, vi } from 'vitest';
import { PortfolioSetupContinuityReadService, type PortfolioSetupReadDependencies,
  type PortfolioSetupReadView } from './portfolio-setup-continuity-read.service';
import { PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { CONTINUATION_114F_FORMAT, sourceBindingFingerprint } from './portfolio-entry-continuation.data-contract';

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
  snapshots?: Array<Record<string, unknown>>; scopes?: Array<{ organizationId: string; name: string }> } = {}) {
  const view = {
    readSession: vi.fn().mockResolvedValue(overrides.session === undefined ? session : overrides.session),
    readLatestHandoff: vi.fn().mockResolvedValue(overrides.handoff === undefined ? handoff : overrides.handoff),
    readCurrentSnapshots: vi.fn().mockResolvedValue(overrides.snapshots ?? []),
    listReadableScopes: vi.fn().mockResolvedValue(overrides.scopes ?? []),
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
    const { service, deps } = setup();
    vi.mocked(deps.listReadableScopes).mockRejectedValue(new Error('database unavailable'));
    const dto = await read(service);
    expect(dto.status).toBe('SCOPE_VALIDATION_FAILED');
    expect(dto.authorizedScopes).toBeUndefined();
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

  it('rejects stale 114D and incompatible 114E binding in a snapshot', async () => {
    const stale = await read(setup({ snapshots: [snapshot({ criticalHandoffId: 'old-handoff' })], scopes: [scopeA] }).service);
    expect(stale.status).toBe('STALE_SOURCE');
    const path = await read(setup({ snapshots: [snapshot({ starteriaPathProjectionVersion: 'unsupported', starteriaPathSchemaVersion: 'v1', starteriaPathBoundaryVersion: 'v1' })], scopes: [scopeA] }).service);
    expect(path.status).toBe('STALE_SOURCE');
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
    expect(deps.listReadableScopes).toHaveBeenCalledOnce();
    expect(Object.keys(deps).sort()).toEqual(['listReadableScopes', 'readCurrentSnapshots', 'readLatestHandoff', 'readSession', 'withReadView']);
  });
});
