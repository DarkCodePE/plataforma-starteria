import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioCapacityPanel } from '../PortfolioCapacityPanel';

const getPortfolioCapacity = vi.fn();
vi.mock('../../../../../app/services/portfolioService', () => ({ getPortfolioCapacity: () => getPortfolioCapacity() }));

describe('PortfolioCapacityPanel (§4/§24)', () => {
  it('muestra el reparto por frente y las señales de reasignación', async () => {
    getPortfolioCapacity.mockResolvedValue({
      unit: 'active_initiatives',
      totalActiveInitiatives: 3,
      fronts: [{ frontId: 'f1', name: 'Adopción pyme', priority: 'Alta', activeInitiatives: 0, share: 0, challenges: [] }],
      signals: [{ kind: 'uncovered_priority', frontId: 'f1', message: '"Adopción pyme" es prioridad alta y no tiene iniciativas activas.' }],
      note: 'Starteria no reasigna personas ni presupuesto.',
    });
    render(<PortfolioCapacityPanel />);
    expect(await screen.findByText('Adopción pyme')).toBeInTheDocument();
    expect(screen.getByText('0 iniciativa(s) activa(s)')).toBeInTheDocument();
    expect(screen.getByTestId('capacity-signal')).toHaveTextContent('prioridad alta y no tiene iniciativas activas');
  });
});
