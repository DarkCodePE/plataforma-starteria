/**
 * doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §23–§24: el portfolio aprende.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioLearningsPanel } from '../PortfolioLearningsPanel';

const listPortfolioLearnings = vi.fn();
vi.mock('../../../../../app/services/portfolioService', () => ({
  listPortfolioLearnings: () => listPortfolioLearnings(),
}));

describe('PortfolioLearningsPanel', () => {
  it('muestra la decisión, el cambio de cobertura, el aprendizaje y la siguiente acción', async () => {
    listPortfolioLearnings.mockResolvedValue([{
      decisionId: 'd1', projectId: 'p1', initiativeName: 'Tablero comercial', challengeId: 'c1', challengeTitle: 'Reducir retrabajo',
      strategicFrontId: 'f1', outcome: 'close_with_learning', learning: 'El tablero no cambia hábitos sin incentivo.',
      nextAction: 'Revisar si el Reto necesita reformularse.', coverageBefore: 'sin_cobertura', coverageAfter: 'reformular',
      suggestedReformulation: 'Revisar si el Reto debe reformularse.', decidedAt: '2026-10-04T12:00:00.000Z',
    }]);
    render(<PortfolioLearningsPanel />);
    expect(await screen.findByText(/Cerrar con aprendizaje · Tablero comercial/)).toBeInTheDocument();
    expect(screen.getByText('Cobertura del reto: sin cobertura → a reformular')).toBeInTheDocument();
    expect(screen.getByText('El tablero no cambia hábitos sin incentivo.')).toBeInTheDocument();
    expect(screen.getByText('Siguiente: Revisar si el Reto necesita reformularse.')).toBeInTheDocument();
    expect(screen.getByText('Revisar si el Reto debe reformularse.')).toBeInTheDocument();
  });

  it('dice cuando todavía no hay decisiones', async () => {
    listPortfolioLearnings.mockResolvedValue([]);
    render(<PortfolioLearningsPanel />);
    expect(await screen.findByText('Todavía no hay decisiones organizacionales registradas.')).toBeInTheDocument();
  });
});
