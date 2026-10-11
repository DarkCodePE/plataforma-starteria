import { describe, expect, it } from 'vitest';
import { portfolioSetupContinueRequestSchema } from './portfolio-setup-continuity-write.service';

describe('114F write request boundary', () => {
  const sourceBinding = {
    sessionId: 'session-1', contextRevision: 2, criticalHandoffId: 'handoff-1',
    criticalHandoffVersion: 1, criticalHandoffSchemaVersion: 'critical-handoff-projection-v0.1',
    confirmedAt: '2026-10-11T00:00:00.000Z',
  };

  it('accepts only the server-owned continuation request fields', () => {
    expect(portfolioSetupContinueRequestSchema.safeParse({ expectedSessionRevision: 3, sourceBinding }).success).toBe(true);
    expect(portfolioSetupContinueRequestSchema.safeParse({ expectedSessionRevision: 3, sourceBinding, rawEntry: 'private' }).success).toBe(false);
    expect(portfolioSetupContinueRequestSchema.safeParse({ expectedSessionRevision: 3, sourceBinding, continuationProfile: 'PORTFOLIO_LEAD_ENTRY' }).success).toBe(false);
    expect(portfolioSetupContinueRequestSchema.safeParse({ expectedSessionRevision: 3, sourceBinding: { ...sourceBinding, ownerUserId: 'forged' } }).success).toBe(false);
  });
});
