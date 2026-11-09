import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortfolioBootstrapHome } from '../PortfolioBootstrapHome';
import { makeBootstrap } from '../../testing/bootstrapFixtures';

vi.mock('../PortfolioGoalLedgerConversation', () => ({
  PortfolioGoalLedgerConversation: ({ onUseGuided }: { onUseGuided: () => void }) => (
    <section data-testid="e2-ledger-opt-in-mock">
      <button type="button" onClick={onUseGuided}>Usar preparación guiada</button>
    </section>
  ),
}));

function setup() {
  const data = makeBootstrap('anchor_sufficient');
  const onUpdateAnchor = vi.fn().mockResolvedValue(undefined);
  const onConfirmAnchor = vi.fn().mockResolvedValue(undefined);
  return {
    data,
    status: 'ready' as const, error: null,
    onRetry: vi.fn(),
    onUpdateAnchor, onConfirmAnchor,
    onPasteWorkItems: vi.fn(),
    onAddManualWorkItem: vi.fn(),
    onDeclareNoExistingWork: vi.fn(),
    onUpdateWorkItem: vi.fn(),
    onRemoveWorkItem: vi.fn(),
    onAnalyzeWorkItems: vi.fn(),
    onConfirmProposedMutation: vi.fn(),
    onCorrectProposedMutation: vi.fn(),
    onRejectProposedMutation: vi.fn(),
    onLeaveProposedMutationPending: vi.fn(),
    onPublishFirstReading: vi.fn(),
    contextReview: {
      id: 'review-1', sessionId: data.bootstrapSession.id, status: 'confirmed' as const,
      version: 2, draft: {}, confirmedSnapshot: {}, effectiveContext: {},
      hasPendingCorrection: false, sourceCompanyContext: null, draftSourceCompanyContext: null,
      confirmedSourceCompanyContext: null, effectiveSourceCompanyContext: null,
      draftProvenance: [], confirmedProvenance: [], effectiveProvenance: [], sourceOutdated: false,
      confirmedBy: 'lead-1', confirmedAt: '2026-11-08T12:00:00Z',
      createdAt: '2026-11-08T12:00:00Z', updatedAt: '2026-11-08T12:00:00Z',
    },
    contextStatus: 'ready' as const,
  } as unknown as React.ComponentProps<typeof PortfolioBootstrapHome>;
}
afterEach(() => { vi.unstubAllEnvs(); });

describe('KAN-253 B3 E2 UI rollout gate', () => {
  it('keeps the existing E2 guided journey when the UI flag is OFF by default', () => {
    vi.stubEnv('VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED', 'false');
    render(<PortfolioBootstrapHome {...setup()} />);
    expect(screen.queryByTestId('e2-ledger-opt-in-mock')).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-objective-conversation')).toBeVisible();
  });

  it('mounts the governed ledger only after explicit flag opt-in, with a guided fallback', () => {
    vi.stubEnv('VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED', 'true');
    render(<PortfolioBootstrapHome {...setup()} />);
    expect(screen.getByTestId('e2-ledger-opt-in-mock')).toBeVisible();
    expect(screen.queryByTestId('portfolio-objective-conversation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar preparación guiada' }));
    expect(screen.getByTestId('portfolio-objective-conversation')).toBeVisible();
  });
});
