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
      dimension: 'IDENTITY', fieldKey: 'purpose', valueJson: { b: 2, a: 1 },
      sourceType: 'USER_INPUT', sourceId: null, confidence: null, verificationStatus: 'USER_CONFIRMED',
    })).toBe(companyEntryFingerprint({
      verificationStatus: 'USER_CONFIRMED', confidence: null, sourceId: null,
      sourceType: 'USER_INPUT', valueJson: { a: 1, b: 2 }, fieldKey: 'purpose', dimension: 'IDENTITY',
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
});
