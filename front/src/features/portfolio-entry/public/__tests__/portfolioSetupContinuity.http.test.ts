import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../../app/services/api', () => ({ default: http }));

import { continuePortfolioSetup, getPortfolioSetupContinuity, PortfolioSetupInvalidResponseError } from '../portfolioSetupContinuity.client';

const source = {
  sessionId: 'session/1', contextRevision: 2, criticalHandoffId: 'critical-1', criticalHandoffVersion: 1,
  criticalHandoffSchemaVersion: 'critical-v1', confirmedAt: '2026-10-12T10:00:00.000Z',
};
const response = {
  dtoVersion: 'portfolio-setup-continuity-write-v0.1', snapshotId: 'snapshot-1', snapshotGeneration: 1,
  snapshotState: 'CURRENT', sessionRevision: 8, sourceBinding: source,
  continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 },
  organizationScopeId: 'org-1', nextAuthorizedSurface: 'PORTFOLIO_HOME_BOOTSTRAP',
  currentness: 'REVALIDATED_AT_WRITE', createdAt: '2026-10-12T10:01:00.000Z',
};

beforeEach(() => vi.resetAllMocks());

describe('114F HTTP boundary', () => {
  it('reads only the dedicated GET endpoint and rejects an invalid envelope', async () => {
    http.get.mockResolvedValueOnce({ data: { success: true, data: {
      dtoVersion: 'portfolio-setup-continuity-read-v0.1', status: 'READY_PROVISIONAL',
      sourceBinding: source,
      continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1, evidence: 'SERVER_OWNED_VERSIONED' },
      scopeState: 'NONE', portfolioAccess: { portfolioRead: false }, openItems: [],
    } } });
    expect((await getPortfolioSetupContinuity('session/1')).status).toBe('READY_PROVISIONAL');
    expect(http.get).toHaveBeenCalledWith('/public/portfolio-entry/sessions/session%2F1/portfolio-setup-continuity');
    http.get.mockResolvedValueOnce({ data: { success: true, data: { legacy: true } } });
    await expect(getPortfolioSetupContinuity('session/1')).rejects.toBeInstanceOf(PortfolioSetupInvalidResponseError);
  });

  it('sends only the authoritative request fields and one Idempotency-Key', async () => {
    http.post.mockResolvedValue({ data: { success: true, data: response } });
    const request = { expectedSessionRevision: 7, sourceBinding: source, organizationId: 'org-1' };
    await continuePortfolioSetup('session/1', request, 'portfolio-setup:key-1');
    expect(http.post).toHaveBeenCalledWith(
      '/public/portfolio-entry/sessions/session%2F1/portfolio-setup-continuity/continue',
      request, { headers: { 'Idempotency-Key': 'portfolio-setup:key-1' } },
    );
    expect(http.post.mock.calls[0][1]).not.toHaveProperty('continuationProfile');
    expect(http.post.mock.calls[0][1]).not.toHaveProperty('nextAuthorizedSurface');
  });

  it('rejects an invalid write response instead of declaring success', async () => {
    http.post.mockResolvedValue({ data: { success: true, data: { ...response, snapshotState: 'LEGACY' } } });
    await expect(continuePortfolioSetup('session/1', { expectedSessionRevision: 7, sourceBinding: source }, 'key-1'))
      .rejects.toBeInstanceOf(PortfolioSetupInvalidResponseError);
  });
});
