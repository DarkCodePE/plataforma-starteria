import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyPortfolioBootstrapContext,
  type PortfolioBootstrapContextReview,
} from '../../services/portfolioBootstrapContextClient';
import { PortfolioBootstrapContextConversation } from '../PortfolioBootstrapContextConversation';

const fetchProposals = vi.hoisted(() => vi.fn());
vi.mock('../../services/portfolioBootstrapContextClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/portfolioBootstrapContextClient')>()),
  getPortfolioBootstrapContextProposals: fetchProposals,
}));

const quote = 'Nunca hemos probado desayunos para llevar ni pedidos a oficinas.';
const sourceRef = {
  kind: 'context_narrative_quote' as const,
  reviewId: 'cafeteria-context',
  reviewVersion: 3,
  fieldPath: 'situation' as const,
  quote,
};

function review(): PortfolioBootstrapContextReview {
  return {
    id: 'cafeteria-context',
    sessionId: 'cafeteria-session',
    status: 'draft',
    version: 3,
    draft: {
      ...createEmptyPortfolioBootstrapContext(),
      situation: {
        value: 'Somos una cafetería de 4 personas. ' + quote,
        provenance: 'user_declared',
        sourceRef: { kind: 'user_input' },
      },
      stakeholder: { value: 'La dueña y los clientes de oficinas', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
      gaps: ['context-disposition:area:not_applicable'],
    },
    confirmedSnapshot: null,
    effectiveContext: null,
    hasPendingCorrection: false,
    sourceCompanyContext: null,
    draftSourceCompanyContext: null,
    confirmedSourceCompanyContext: null,
    effectiveSourceCompanyContext: null,
    draftProvenance: [],
    confirmedProvenance: null,
    effectiveProvenance: null,
    sourceOutdated: false,
    confirmedBy: null,
    confirmedAt: null,
    createdAt: '2026-11-08T00:00:00.000Z',
    updatedAt: '2026-11-08T00:00:00.000Z',
  };
}

describe('KAN-247 E1 review of grounded provisional proposals', () => {
  beforeEach(() => {
    fetchProposals.mockReset().mockResolvedValue({
      reviewVersion: 3,
      proposals: [{
        id: 'candidate-1', targetField: 'pilotExperience', value: quote,
        status: 'UNREVIEWED', sourceKind: 'persisted_user_narrative', sourceRef,
      }],
    });
  });

  it('does not re-ask the cafe pilot after showing its sourced quote; saves only on explicit acceptance', async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioBootstrapContextConversation
      operationScope="cafeteria-session"
      review={review()}
      status="ready"
      error={null}
      onSaveDraft={save}
      onConfirm={vi.fn()}
      onRetry={vi.fn()}
      onContinue={vi.fn()}
      enableContextProjection
    />);
    expect(await screen.findByText('Esto ya aparece en lo que contaste')).toBeInTheDocument();
    expect(screen.queryByText(/¿Habéis probado algo parecido\?/i)).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sí, conservar esta información' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      pilotExperience: { value: quote, provenance: 'user_declared', sourceRef },
    }), null));
  });
});
