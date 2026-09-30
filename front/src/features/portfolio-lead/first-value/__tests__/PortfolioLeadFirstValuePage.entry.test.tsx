import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioLeadFirstValuePage } from '../PortfolioLeadFirstValuePage';

vi.mock('../../../portfolio-entry/home/usePortfolioHomeEntryContext', () => ({
  usePortfolioHomeEntryContext: () => ({
    status: 'ready',
    error: null,
    data: {
      continuationId: 'continuation-1',
      sessionId: 'session-1',
      organization: { id: 'org-1', name: 'Organización' },
      arrival: {
        understoodNeed: 'Ordenar las iniciativas',
        desiredOutcome: 'Llegar con una decisión clara',
        confirmedContext: ['Hay trabajo existente'],
        openItems: [],
        laterWork: [],
        organizationalUnknowns: [],
        nextStep: 'Preparar el espacio',
      },
    },
  }),
}));

describe('PortfolioLeadFirstValuePage — Entry continuation', () => {
  it('muestra el contexto preservado sin pedir repetirlo', () => {
    render(<PortfolioLeadFirstValuePage continuationId="continuation-1" firstName="Valeria" />);

    expect(screen.getByTestId('portfolio-entry-setup-context')).toHaveTextContent('Trajimos el contexto que compartiste al entrar.');
    expect(screen.getByText('Ordenar las iniciativas')).toBeInTheDocument();
    expect(screen.getByText(/información compartida anteriormente/i)).toBeInTheDocument();
  });
});
