import { describe, expect, it } from 'vitest';
import { portfolioEntryBriefIdentityFromSession, portfolioEntryClaimIdentity } from '../continuationIdentity';
import type { PortfolioEntrySessionDto } from '../types';

const confirmedSession = (overrides: Partial<PortfolioEntrySessionDto> = {}) => ({
  id: 'session-1',
  revision: 19,
  lifecycleStatus: 'CONFIRMED',
  handoff: { id: 'handoff-1', version: 2 },
  confirmation: { id: 'confirmation-1', version: 3, status: 'CONFIRMED' },
  ...overrides,
} as PortfolioEntrySessionDto);

describe('Portfolio Entry confirmed Brief continuation identity', () => {
  it('uses the exact backend claim revision and preserves every other identity field', () => {
    const pending = {
      source: 'portfolio_entry' as const,
      sessionId: 'session-1',
      sessionRevision: 6,
      handoffId: 'handoff-1',
      handoffVersion: 2,
      confirmationId: 'confirmation-1',
      confirmationVersion: 3,
    };

    expect(portfolioEntryClaimIdentity(confirmedSession(), pending)).toEqual({
      ...pending,
      sessionRevision: 19,
    });
  });

  it('rejects a claim response that points at a different handoff or confirmation', () => {
    const pending = portfolioEntryBriefIdentityFromSession(confirmedSession())!;
    expect(portfolioEntryClaimIdentity(confirmedSession({ confirmation: {
      id: 'different-confirmation', version: 3, status: 'CONFIRMED', acceptedFields: [], correctedFields: {}, rejectedFields: [], createdAt: '',
    } }), pending)).toBeNull();
  });

  it('requires actual confirmed records instead of accepting a session-only source', () => {
    expect(portfolioEntryBriefIdentityFromSession(confirmedSession({ confirmation: undefined }))).toBeNull();
  });
});
