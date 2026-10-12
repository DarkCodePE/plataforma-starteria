import { describe, expect, it } from 'vitest';
import { parsePortfolioSetupRead, PortfolioSetupInvalidResponseError } from '../portfolioSetupContinuity.client';

const base = {
  dtoVersion: 'portfolio-setup-continuity-read-v0.1', status: 'READY_PROVISIONAL',
  sourceBinding: { sessionId: 'session-1', contextRevision: 2, criticalHandoffId: 'critical-1',
    criticalHandoffVersion: 1, criticalHandoffSchemaVersion: 'critical-v1', confirmedAt: '2026-10-12T10:00:00.000Z' },
  continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1, evidence: 'SERVER_OWNED_VERSIONED' },
  scopeState: 'NONE', portfolioAccess: { portfolioRead: false }, openItems: [],
};

describe('strict 114F read DTO', () => {
  it('accepts a bounded provisional DTO', () => {
    expect(parsePortfolioSetupRead(base).status).toBe('READY_PROVISIONAL');
  });

  it.each([
    { ...base, dtoVersion: 'legacy-continuation-v1' },
    { ...base, authorizedScopes: [{ organizationId: 'forged', name: 'Unverified' }] },
    { ...base, portfolioAccess: { portfolioRead: true } },
    { ...base, rawConversation: 'private' },
    { ...base, status: 'READY_AUTHORIZED_SCOPE' },
    { ...base, status: 'SELECT_SCOPE', authorizedScopes: [] },
  ])('fails closed for invalid or inconsistent payloads', (payload) => {
    expect(() => parsePortfolioSetupRead(payload)).toThrow(PortfolioSetupInvalidResponseError);
  });
});
