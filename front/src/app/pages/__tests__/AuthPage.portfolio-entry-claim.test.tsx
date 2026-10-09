import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthPage } from '../AuthPage';
import type { PendingPortfolioEntryClaim } from '../../../features/portfolio-entry/public/types';

const navigateSpy = vi.hoisted(() => vi.fn());
const appMocks = vi.hoisted(() => ({
  createProjectFromPublicDraft: vi.fn(),
}));
const portfolioEntryMocks = vi.hoisted(() => ({
  readPendingPortfolioEntryClaim: vi.fn((): PendingPortfolioEntryClaim => ({
    sessionId: 'session-1', credential: 'entry-token',
    identity: { source: 'portfolio_entry', sessionId: 'session-1', sessionRevision: 6, handoffId: 'handoff-1', handoffVersion: 2, confirmationId: 'confirmation-1', confirmationVersion: 3 },
    criticalHandoffReview: false,
  })),
  clearPendingPortfolioEntryClaim: vi.fn(),
  clearPortfolioEntryCurrentSession: vi.fn(),
  getPortfolioEntrySession: vi.fn(() => Promise.resolve({ revision: 7 })),
  claimPortfolioEntrySession: vi.fn(() => Promise.resolve({
    id: 'session-1', revision: 19, lifecycleStatus: 'CONFIRMED',
    handoff: { id: 'handoff-1', version: 2 },
    confirmation: { id: 'confirmation-1', version: 3, status: 'CONFIRMED' },
  })),
  saveClaimedPortfolioEntrySession: vi.fn(),
  savePortfolioEntryClaimedNotice: vi.fn(),
  portfolioEntryClaimIdentity: vi.fn((response: { id: string; revision: number }) => ({
    source: 'portfolio_entry', sessionId: response.id, sessionRevision: response.revision,
    handoffId: 'handoff-1', handoffVersion: 2, confirmationId: 'confirmation-1', confirmationVersion: 3,
  })),
  trackPortfolioEntryEvent: vi.fn(),
}));

vi.mock('react-router', () => ({
  useNavigate: () => navigateSpy,
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    login: vi.fn(),
    register: vi.fn(),
    googleSignIn: vi.fn(),
    isAuthenticated: true,
    user: { id: 'user-1', role: 'participante' },
    createProjectFromPublicDraft: appMocks.createProjectFromPublicDraft,
  }),
}));

vi.mock('../../components/auth/GoogleSignInButton', () => ({
  GoogleSignInButton: () => null,
}));

vi.mock('../../../features/public-start/services/publicPilotLeadService', () => ({
  getPendingPilotClaim: () => ({ claimToken: 'pilot-token' }),
}));

vi.mock('../../../features/portfolio-entry/public', () => portfolioEntryMocks);

vi.mock('../../../features/portfolio-entry/public/idempotency', () => ({
  createIdempotencyKey: () => 'claim-key',
}));

describe('AuthPage Portfolio Entry claim continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portfolioEntryMocks.readPendingPortfolioEntryClaim.mockReturnValue({
      sessionId: 'session-1',
      credential: 'entry-token',
      identity: { source: 'portfolio_entry', sessionId: 'session-1', sessionRevision: 6, handoffId: 'handoff-1', handoffVersion: 2, confirmationId: 'confirmation-1', confirmationVersion: 3 },
      criticalHandoffReview: false,
    });
  });

  it('claims pending Portfolio Entry before any pilot/PublicDraft conversion path', async () => {
    render(<AuthPage />);

    await waitFor(() => {
      expect(portfolioEntryMocks.claimPortfolioEntrySession).toHaveBeenCalledWith(
        'session-1',
        'entry-token',
        { expectedRevision: 7, idempotencyKey: 'claim-key' },
      );
    });

    expect(portfolioEntryMocks.clearPendingPortfolioEntryClaim).toHaveBeenCalled();
    expect(portfolioEntryMocks.clearPortfolioEntryCurrentSession).toHaveBeenCalled();
    expect(portfolioEntryMocks.saveClaimedPortfolioEntrySession).toHaveBeenCalledWith({
      source: 'portfolio_entry', sessionId: 'session-1', sessionRevision: 19,
      handoffId: 'handoff-1', handoffVersion: 2, confirmationId: 'confirmation-1', confirmationVersion: 3,
    });
    expect(portfolioEntryMocks.savePortfolioEntryClaimedNotice).toHaveBeenCalledWith('session-1');
    expect(appMocks.createProjectFromPublicDraft).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/public/provisional-continuation', { replace: true });
    expect(navigateSpy).not.toHaveBeenCalledWith('/continuar-piloto', expect.anything());
  });

  it('returns Critical Handoff identity claims to the artifact review, without entering legacy confirmation', async () => {
    portfolioEntryMocks.readPendingPortfolioEntryClaim.mockReturnValue({
      sessionId: 'session-1',
      credential: 'entry-token',
      criticalHandoffReview: true,
    });

    render(<AuthPage />);

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/public/start', { replace: true }));
    expect(portfolioEntryMocks.claimPortfolioEntrySession).toHaveBeenCalledTimes(1);
    expect(portfolioEntryMocks.portfolioEntryClaimIdentity).not.toHaveBeenCalled();
    expect(portfolioEntryMocks.saveClaimedPortfolioEntrySession).toHaveBeenCalledWith({ sessionId: 'session-1' });
    expect(navigateSpy).not.toHaveBeenCalledWith('/public/provisional-continuation', { replace: true });
  });
});
