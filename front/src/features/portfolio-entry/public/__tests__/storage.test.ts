import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingPortfolioEntryClaim,
  clearPortfolioEntryConversionState,
  clearPortfolioEntryAnonymousState,
  clearPortfolioEntryCurrentSession,
  clearCriticalHandoffReviewSession,
  hasCriticalHandoffReviewSession,
  markCriticalHandoffReviewSession,
  readClaimedPortfolioEntrySession,
  readClaimedPortfolioEntryBriefIdentity,
  readPendingPortfolioEntryClaim,
  readPortfolioEntryClaimedNotice,
  readPortfolioEntryCurrentSession,
  saveClaimedPortfolioEntrySession,
  savePendingPortfolioEntryClaim,
  savePortfolioEntryClaimedNotice,
  savePortfolioEntryCurrentSession,
} from '../storage';

describe('Portfolio Entry public storage', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('saves and restores the minimal anonymous session reference', () => {
    savePortfolioEntryCurrentSession({ sessionId: 'session-1', credential: 'secret-token' });

    expect(readPortfolioEntryCurrentSession()).toEqual({
      sessionId: 'session-1',
      credential: 'secret-token',
    });
  });

  it('stores pending claim separately and clears it after claim', () => {
    savePendingPortfolioEntryClaim({ sessionId: 'session-1', credential: 'secret-token' });

    expect(readPendingPortfolioEntryClaim()).toEqual({
      sessionId: 'session-1',
      credential: 'secret-token',
    });

    clearPendingPortfolioEntryClaim();
    expect(readPendingPortfolioEntryClaim()).toBeNull();
  });

  it('preserves the Critical Handoff presentation mode across the auth claim', () => {
    markCriticalHandoffReviewSession('session-critical');
    savePendingPortfolioEntryClaim({
      sessionId: 'session-critical',
      credential: 'secret-token',
      criticalHandoffReview: true,
    });

    expect(hasCriticalHandoffReviewSession('session-critical')).toBe(true);
    expect(hasCriticalHandoffReviewSession('different-session')).toBe(false);
    expect(window.sessionStorage.getItem('starteria.portfolioEntry.criticalHandoffReviewSession')).toBe('session-critical');
    expect(readPendingPortfolioEntryClaim()).toEqual({
      sessionId: 'session-critical',
      credential: 'secret-token',
      criticalHandoffReview: true,
    });
    expect(window.sessionStorage.getItem('starteria.portfolioEntry.current')).toBeNull();
    expect([...Array(window.sessionStorage.length)].map((_, index) => window.sessionStorage.getItem(window.sessionStorage.key(index) ?? '')).join('\n'))
      .not.toMatch(/finalReading|decisionInView|usableNow|decisionChangingUnknowns|firstMovement|selected_lenses|reasoning_metadata|provenance|source_refs/i);

    clearCriticalHandoffReviewSession();
    expect(hasCriticalHandoffReviewSession('session-critical')).toBe(false);
  });

  it('clears anonymous credentials after claim or expiry', () => {
    savePortfolioEntryCurrentSession({ sessionId: 'session-1', credential: 'secret-token' });
    savePendingPortfolioEntryClaim({ sessionId: 'session-1', credential: 'secret-token' });

    clearPortfolioEntryAnonymousState();

    expect(readPortfolioEntryCurrentSession()).toBeNull();
    expect(readPendingPortfolioEntryClaim()).toBeNull();
  });

  it('keeps claimed notice without storing the anonymous credential', () => {
    savePortfolioEntryClaimedNotice('session-1');

    expect(readPortfolioEntryClaimedNotice()).toMatchObject({ sessionId: 'session-1' });
    expect(JSON.stringify(window.sessionStorage)).not.toContain('secret-token');
    clearPortfolioEntryCurrentSession();
  });

  it('stores claimed session reference without the anonymous credential and clears it after conversion', () => {
    savePortfolioEntryCurrentSession({ sessionId: 'session-1', credential: 'secret-token' });
    savePendingPortfolioEntryClaim({ sessionId: 'session-1', credential: 'secret-token' });
    saveClaimedPortfolioEntrySession({ sessionId: 'session-1' });
    savePortfolioEntryClaimedNotice('session-1');

    expect(readClaimedPortfolioEntrySession()).toEqual({ sessionId: 'session-1' });
    expect(window.sessionStorage.getItem('starteria.portfolioEntry.claimedSession')).not.toContain('secret-token');

    clearPortfolioEntryConversionState();

    expect(readPortfolioEntryCurrentSession()).toBeNull();
    expect(readPendingPortfolioEntryClaim()).toBeNull();
    expect(readClaimedPortfolioEntrySession()).toBeNull();
    expect(readPortfolioEntryClaimedNotice()).toBeNull();
  });

  it('preserves a pending confirmed identity across the authentication handoff', () => {
    const identity = {
      source: 'portfolio_entry' as const,
      sessionId: 'session-1',
      sessionRevision: 9,
      handoffId: 'handoff-1',
      handoffVersion: 2,
      confirmationId: 'confirmation-1',
      confirmationVersion: 3,
    };
    savePendingPortfolioEntryClaim({ sessionId: 'session-1', credential: 'secret-token', identity });
    expect(readPendingPortfolioEntryClaim()).toEqual({ sessionId: 'session-1', credential: 'secret-token', identity });
  });

  it('round-trips the complete confirmed Brief continuation identity', () => {
    const identity = {
      source: 'portfolio_entry' as const,
      sessionId: 'session-1',
      sessionRevision: 12,
      handoffId: 'handoff-1',
      handoffVersion: 3,
      confirmationId: 'confirmation-1',
      confirmationVersion: 4,
    };
    saveClaimedPortfolioEntrySession(identity);
    expect(readClaimedPortfolioEntrySession()).toEqual(identity);
  });

  it('keeps legacy session-only continuity readable without fabricating a D1 identity', () => {
    window.sessionStorage.setItem('starteria.portfolioEntry.claimedSession', JSON.stringify({ sessionId: 'session-legacy' }));
    expect(readClaimedPortfolioEntrySession()).toEqual({ sessionId: 'session-legacy' });
    expect(readClaimedPortfolioEntryBriefIdentity()).toBeNull();
  });

  it('preserves a full identity through conversion cleanup for refresh recovery', () => {
    const identity = {
      source: 'portfolio_entry' as const,
      sessionId: 'session-1',
      sessionRevision: 12,
      handoffId: 'handoff-1',
      handoffVersion: 3,
      confirmationId: 'confirmation-1',
      confirmationVersion: 4,
    };
    saveClaimedPortfolioEntrySession(identity);
    clearPortfolioEntryConversionState();
    expect(readClaimedPortfolioEntryBriefIdentity()).toEqual(identity);
  });
});
