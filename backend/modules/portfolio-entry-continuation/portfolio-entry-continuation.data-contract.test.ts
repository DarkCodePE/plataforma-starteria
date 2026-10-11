import { describe, expect, it } from 'vitest';
import { classifyContinuationRow, sourceBindingFingerprint } from './portfolio-entry-continuation.data-contract';

const legacy = {
  id: 'legacy-1', sessionId: 'session-1', continuedByUserId: 'owner-1',
  snapshotFormat: null, snapshotGeneration: null, snapshotState: null,
  sourceContextRevision: null, criticalHandoffId: null, criticalHandoffVersion: null,
  criticalHandoffSchemaVersion: null, starteriaPathProjectionVersion: null,
  starteriaPathSchemaVersion: null, starteriaPathBoundaryVersion: null,
  criticalHandoffConfirmedAt: null, continuationProfile: null, continuationProfileVersion: null,
  profileEvidenceRef: null, organizationScopeId: null, snapshotOperation: null,
  idempotencyKeyHash: null, requestFingerprint: null, sourceBindingHash: null,
  supersededAt: null, supersededById: null, carriedProjection: null, openItems: null,
  sourceSnapshot: { session: { rawEntry: 'old text' } },
  portfolioScope: { organizationId: 'org-1' },
};

const snapshot = {
  ...legacy,
  id: 'snapshot-1', snapshotFormat: 'PORTFOLIO_SETUP_114F_V1', snapshotGeneration: 1,
  snapshotState: 'CURRENT', sourceContextRevision: 3,
  criticalHandoffId: 'critical-1', criticalHandoffVersion: 2,
  criticalHandoffSchemaVersion: 'critical-handoff-v0.1',
  criticalHandoffConfirmedAt: new Date('2026-10-11T10:00:00.000Z'),
  continuationProfile: 'PORTFOLIO_LEAD_ENTRY', continuationProfileVersion: 1,
  profileEvidenceRef: 'session-created:session-1', organizationScopeId: 'org-1',
  snapshotOperation: 'portfolio-setup-continuity', idempotencyKeyHash: 'key-hash',
  requestFingerprint: 'request-hash', sourceBindingHash: 'source-hash',
  sourceSnapshot: null, portfolioScope: null,
  carriedProjection: { decisionFrame: { text: 'A bounded confirmed representation', sourceRef: 'critical-1', origin: 'USER_DECLARED', truthClass: 'CONFIRMED_REPRESENTATION' } },
  openItems: [{ sourceRef: 'critical-1', kind: 'DOWNSTREAM_NON_BLOCKING', description: 'Review later' }],
};

describe('114F continuation data contract', () => {
  it('keeps an unbound legacy row readable but never 114F current', () => {
    expect(classifyContinuationRow(legacy)).toMatchObject({ kind: 'LEGACY_UNBOUND', id: 'legacy-1' });
  });

  it('represents source, owner, profile evidence, scope, and operation without raw context', () => {
    const result = classifyContinuationRow(snapshot);
    expect(result).toMatchObject({
      kind: '114F_SNAPSHOT', id: 'snapshot-1', ownerUserId: 'owner-1',
      source: { contextRevision: 3, criticalHandoffId: 'critical-1', criticalHandoffVersion: 2 },
      profile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1, evidenceRef: 'session-created:session-1' },
      scope: { organizationId: 'org-1', accessAuthority: 'REVALIDATE_SCOPED_ACCESS' },
      operation: { name: 'portfolio-setup-continuity', keyHash: 'key-hash', requestFingerprint: 'request-hash' },
    });
    expect(JSON.stringify(result)).not.toContain('rawEntry');
  });

  it('refuses to promote a profile value without versioned evidence', () => {
    expect(classifyContinuationRow({ ...snapshot, profileEvidenceRef: null })).toMatchObject({ kind: 'INVALID_114F_SNAPSHOT' });
  });

  it('rejects raw or nested unallowlisted fields in carried context and open items', () => {
    expect(classifyContinuationRow({ ...snapshot, carriedProjection: { decisionFrame: { ...(snapshot.carriedProjection.decisionFrame), rawEntry: 'private conversation' } } }))
      .toMatchObject({ kind: 'INVALID_114F_SNAPSHOT', reason: 'invalid_carried_projection' });
    expect(classifyContinuationRow({ ...snapshot, carriedProjection: { decisionFrame: { ...snapshot.carriedProjection.decisionFrame, text: 'x'.repeat(501) } } }))
      .toMatchObject({ kind: 'INVALID_114F_SNAPSHOT', reason: 'invalid_carried_projection' });
    expect(classifyContinuationRow({ ...snapshot, openItems: [{ sourceRef: 'critical-1', kind: 'DOWNSTREAM_NON_BLOCKING', description: 'Later', rawEntry: 'private' }] }))
      .toMatchObject({ kind: 'INVALID_114F_SNAPSHOT', reason: 'invalid_open_items' });
  });

  it('requires every 114E version when a Path binding is carried', () => {
    expect(classifyContinuationRow({ ...snapshot, starteriaPathProjectionVersion: 'path-v1' })).toMatchObject({ kind: 'INVALID_114F_SNAPSHOT' });
    expect(classifyContinuationRow({ ...snapshot, starteriaPathProjectionVersion: 'path-v1', starteriaPathSchemaVersion: 'dto-v1', starteriaPathBoundaryVersion: 'boundary-v1' }))
      .toMatchObject({ kind: '114F_SNAPSHOT', source: { starteriaPath: { projectionVersion: 'path-v1' } } });
  });

  it('allows nullable scope for a provisional representation without declaring access', () => {
    expect(classifyContinuationRow({ ...snapshot, organizationScopeId: null })).toMatchObject({
      kind: '114F_SNAPSHOT', scope: { organizationId: null, accessAuthority: 'REVALIDATE_SCOPED_ACCESS' },
    });
  });

  it('represents generations and supersession independently of the session identity', () => {
    const older = classifyContinuationRow({ ...snapshot, snapshotState: 'SUPERSEDED', supersededAt: new Date(), supersededById: 'snapshot-2' });
    const newer = classifyContinuationRow({ ...snapshot, id: 'snapshot-2', snapshotGeneration: 2 });
    expect(older).toMatchObject({ kind: '114F_SNAPSHOT', generation: 1, lifecycle: { state: 'SUPERSEDED', supersededById: 'snapshot-2' } });
    expect(newer).toMatchObject({ kind: '114F_SNAPSHOT', generation: 2, lifecycle: { state: 'CURRENT' } });
  });

  it('hashes the material source/profile/scope/operation deterministically', () => {
    const a = { sessionId: 'session-1', ownerUserId: 'owner-1', sourceContextRevision: 3,
      criticalHandoffId: 'critical-1', criticalHandoffVersion: 2, criticalHandoffSchemaVersion: 'critical-v1',
      criticalHandoffConfirmedAt: '2026-10-11T10:00:00.000Z', starteriaPath: null,
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const, continuationProfileVersion: 1,
      profileEvidenceRef: 'session-created:session-1', organizationScopeId: 'org-1', operation: 'continue' };
    const b = { operation: 'continue', organizationScopeId: 'org-1', profileEvidenceRef: 'session-created:session-1',
      continuationProfileVersion: 1, continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const, starteriaPath: null,
      criticalHandoffConfirmedAt: '2026-10-11T10:00:00.000Z', criticalHandoffSchemaVersion: 'critical-v1',
      criticalHandoffVersion: 2, criticalHandoffId: 'critical-1', sourceContextRevision: 3,
      ownerUserId: 'owner-1', sessionId: 'session-1' };
    expect(sourceBindingFingerprint(a)).toBe(sourceBindingFingerprint(b));
    expect(sourceBindingFingerprint({ ...a, sourceContextRevision: 4 })).not.toBe(sourceBindingFingerprint(a));
  });
});
