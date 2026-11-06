import { describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import {
  PortfolioBootstrapContextService,
  canonicalContextHash,
  companyEntryFingerprint,
  isRetryableContextWriteConflict,
} from '../portfolio-bootstrap-context.service';

const permissions = permissionsForRoles(['portfolio_lead']);

describe('PortfolioBootstrapContextService', () => {
  it('uses an owner-scoped lookup and returns 404 without leaking a foreign session', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new PortfolioBootstrapContextService({ portfolioBootstrapSession: { findFirst } } as any);

    await expect(service.getContext({ sessionId: 'foreign', authenticatedUserId: 'actor', permissions }))
      .rejects.toMatchObject({ statusCode: 404, code: 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', userId: 'actor' } }));
  });

  it('canonicalizes hashes and Company entry fingerprints independent of key order', () => {
    expect(canonicalContextHash({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(canonicalContextHash({ a: { c: 3, d: 4 }, b: 2 }));
    expect(companyEntryFingerprint({
      dimension: 'IDENTITY', fieldKey: 'purpose', value: { b: 2, a: 1 }, updatedAt: '2026-11-06T00:00:00.000Z',
      sourceType: 'USER_INPUT', sourceId: null, confidence: null, verificationStatus: 'USER_CONFIRMED',
    })).toBe(companyEntryFingerprint({
      verificationStatus: 'USER_CONFIRMED', confidence: null, sourceId: null,
      sourceType: 'USER_INPUT', value: { a: 1, b: 2 }, fieldKey: 'purpose', dimension: 'IDENTITY',
      updatedAt: '2026-11-06T00:00:00.000Z',
    }));
  });

  it('only retries serialization/deadlock conflicts, never arbitrary unique violations', () => {
    expect(isRetryableContextWriteConflict({ code: 'P2034' })).toBe(true);
    expect(isRetryableContextWriteConflict({ code: 'P2010', meta: { code: '40001' } })).toBe(true);
    expect(isRetryableContextWriteConflict({ code: 'P2002' })).toBe(false);
  });

  it('retries a Serializable write once and preserves the exact successful response', async () => {
    const expected = { id: 'review-1', version: 1, status: 'draft' };
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValueOnce(expected);
    const service = new PortfolioBootstrapContextService({} as any);
    await expect((service as any).withSerializableRetry(operation)).resolves.toBe(expected);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('enforces dual Company scope, approved membership, latest published version and fingerprint', async () => {
    const entry = {
      dimension: 'IDENTITY', fieldKey: 'purpose', value: { value: 'Grow' }, updatedAt: '2026-11-06T00:00:00.000Z',
      sourceType: 'USER_INPUT', sourceId: null, confidence: 1, verificationStatus: 'USER_CONFIRMED',
    };
    const olderDuplicate = { ...entry, value: { value: 'Old' }, updatedAt: '2026-11-05T00:00:00.000Z' };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) },
      company: { findUnique: vi.fn().mockResolvedValue({ id: 'company-1', scope: 'ORGANIZATION', organizationId: 'org-1', status: 'ACTIVE', deletedAt: null }) },
      companyMembership: { findFirst: vi.fn().mockResolvedValue({ status: 'APPROVED' }) },
      companyContextVersion: { findFirst: vi.fn()
        .mockResolvedValueOnce({ id: 'version-1', companyId: 'company-1', versionNumber: 1, status: 'PUBLISHED', snapshotJson: { entries: [olderDuplicate, entry] } })
        .mockResolvedValueOnce({ id: 'version-1' }) },
    };
    const context = {
      situation: { value: 'Grow', provenance: 'source_extracted', sourceRef: {
        kind: 'company_context_entry', dimension: 'IDENTITY', fieldKey: 'purpose', sourceId: null,
        entryId: 'live-entry-id-not-carried-by-snapshot',
        entryFingerprint: companyEntryFingerprint(entry),
      } },
      area: { value: null, provenance: 'unknown' }, stakeholder: { value: null, provenance: 'unknown' },
      pilotExperience: { value: null, provenance: 'unknown' }, constraints: [], assumptions: [], gaps: [],
    };
    const service = new PortfolioBootstrapContextService({} as any);
    await expect((service as any).validateSource(db, { organizationId: 'org-1' }, 'actor', {
      companyId: 'company-1', versionId: 'version-1', versionNumber: 1,
    }, context, true)).resolves.toEqual({ companyId: 'company-1', versionId: 'version-1', versionNumber: 1 });
    expect(db.companyContextVersion.findFirst).toHaveBeenCalledTimes(2);
  });

  it('hides cross-tenant Company sources and distinguishes same-tenant missing read access', async () => {
    const service = new PortfolioBootstrapContextService({} as any);
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) },
      company: { findUnique: vi.fn().mockResolvedValue({ id: 'company-1', scope: 'ORGANIZATION', organizationId: 'org-2', status: 'ACTIVE', deletedAt: null }) },
      companyMembership: { findFirst: vi.fn() },
    };
    await expect((service as any).validateSource(db, { organizationId: 'org-1' }, 'actor', {
      companyId: 'company-1', versionId: 'version-1', versionNumber: 1,
    }, { situation: { provenance: 'unknown' } }, true)).rejects.toMatchObject({ statusCode: 404, code: 'COMPANY_NOT_FOUND' });

    db.company.findUnique.mockResolvedValue({ id: 'company-1', scope: 'ORGANIZATION', organizationId: 'org-1', status: 'ACTIVE', deletedAt: null });
    db.companyMembership.findFirst.mockResolvedValue(null);
    await expect((service as any).validateSource(db, { organizationId: 'org-1' }, 'actor', {
      companyId: 'company-1', versionId: 'version-1', versionNumber: 1,
    }, { situation: { provenance: 'unknown' } }, true)).rejects.toMatchObject({ statusCode: 403, code: 'COMPANY_ACCESS_DENIED' });
  });

  it('returns 422 for visible but semantically invalid Company provenance', async () => {
    const service = new PortfolioBootstrapContextService({} as any);
    await expect((service as any).validateSource({}, { organizationId: 'org-1' }, 'actor', null, {
      situation: { value: 'Claim', provenance: 'source_extracted', sourceRef: { kind: 'company_context_entry' } },
      constraints: [], assumptions: [],
    }, true)).rejects.toMatchObject({ statusCode: 422, code: 'COMPANY_CONTEXT_SOURCE_REQUIRED' });
  });

  it('returns the persisted response for an authorized replay and rejects key reuse with another payload', async () => {
    const stored = { id: 'review-1', sessionId: 'session-1', status: 'draft', version: 1 };
    const db = { portfolioBootstrapContextOperation: { findUnique: vi.fn().mockResolvedValue({ payloadHash: 'payload-1', responseJson: stored }) } };
    const service = new PortfolioBootstrapContextService({} as any);
    await expect((service as any).replay(db, 'session-1', 'save_draft', 'same-key', 'payload-1')).resolves.toBe(stored);
    await expect((service as any).replay(db, 'session-1', 'save_draft', 'same-key', 'payload-2'))
      .rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_CONTEXT_IDEMPOTENCY_CONFLICT' });
  });

  it('marks a frozen confirmed snapshot outdated without replacing it', async () => {
    const service = new PortfolioBootstrapContextService({} as any);
    const snapshot = { situation: { value: 'Frozen', provenance: 'user_declared' } };
    const dto = await (service as any).toDto({
      company: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', deletedAt: null }) },
      companyContextVersion: { findFirst: vi.fn().mockResolvedValue({ id: 'new-version' }) },
    }, {
      id: 'review-1', bootstrapSessionId: 'session-1', status: 'confirmed', version: 2,
      draftJson: snapshot, confirmedSnapshotJson: snapshot,
      sourceCompanyId: 'company-1', sourceCompanyContextVersionId: 'old-version', sourceCompanyContextVersionNumber: 1,
      confirmedSourceCompanyId: 'company-1', confirmedSourceCompanyContextVersionId: 'old-version', confirmedSourceCompanyContextVersionNumber: 1,
      provenanceJson: [], confirmedProvenanceJson: [],
      confirmedBy: 'actor', confirmedAt: new Date('2026-11-06T00:00:00.000Z'),
      createdAt: new Date('2026-11-06T00:00:00.000Z'), updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    });
    expect(dto.sourceOutdated).toBe(true);
    expect(dto.effectiveContext).toEqual(snapshot);
  });

  it('keeps confirmed source/provenance effective while a correction points to another source', async () => {
    const service = new PortfolioBootstrapContextService({} as any);
    const dto = await (service as any).toDto({}, {
      id: 'review-1', bootstrapSessionId: 'session-1', status: 'draft', version: 3,
      draftJson: { situation: { value: 'Correction' } }, confirmedSnapshotJson: { situation: { value: 'Frozen' } },
      sourceCompanyId: 'company-b', sourceCompanyContextVersionId: 'version-b', sourceCompanyContextVersionNumber: 2,
      confirmedSourceCompanyId: 'company-a', confirmedSourceCompanyContextVersionId: 'version-a', confirmedSourceCompanyContextVersionNumber: 1,
      provenanceJson: [{ provenance: 'user_declared' }], confirmedProvenanceJson: [{ provenance: 'source_extracted' }],
      confirmedBy: 'actor', confirmedAt: new Date('2026-11-06T00:00:00.000Z'),
      createdAt: new Date('2026-11-06T00:00:00.000Z'), updatedAt: new Date('2026-11-06T00:00:00.000Z'),
    }, false);
    expect(dto.draftSourceCompanyContext.companyId).toBe('company-b');
    expect(dto.effectiveSourceCompanyContext.companyId).toBe('company-a');
    expect(dto.effectiveProvenance).toEqual([{ provenance: 'source_extracted' }]);
    expect(dto.effectiveContext.situation.value).toBe('Frozen');
  });

  it('reconciles a same-key race only after owner authorization and returns the durable receipt', async () => {
    const stored = { id: 'review-1', sessionId: 'session-1', status: 'draft', version: 1 };
    const db = {
      portfolioBootstrapSession: { findFirst: vi.fn().mockResolvedValue({ id: 'session-1', userId: 'actor', organizationId: null }) },
      portfolioBootstrapContextOperation: { findUnique: vi.fn().mockResolvedValue({ payloadHash: 'payload-1', responseJson: stored }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: any) => callback(db)) };
    const service = new PortfolioBootstrapContextService(prisma as any);
    await expect((service as any).reconcileWriteConflict({
      sessionId: 'session-1', authenticatedUserId: 'actor', permissions, idempotencyKey: 'same-key',
    }, 'save_draft', 'payload-1', { code: 'P2002' })).resolves.toBe(stored);
    expect(db.portfolioBootstrapSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'session-1', userId: 'actor' } }));
  });
});
