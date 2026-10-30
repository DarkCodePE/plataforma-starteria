import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CHALLENGES,
  DEFAULT_EXECUTIVE_OUTPUTS,
  DEFAULT_INITIATIVE_OVERLAPS,
  DEFAULT_INITIATIVES,
  DEFAULT_PORTFOLIO_DECISIONS,
  DEFAULT_STRATEGIC_FRONTS,
} from '../../../features/portfolio-lead';
import { PortfolioLeadChallengesPage } from '../PortfolioLeadChallengesPage';
import { PortfolioLeadStrategicFrontsPage } from '../PortfolioLeadStrategicFrontsPage';

const navigateMock = vi.hoisted(() => vi.fn());
const usePortfolioLeadMock = vi.hoisted(() => vi.fn());
const updateChallengeMock = vi.hoisted(() => vi.fn());
const updateStakeholderStatusMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../features/portfolio-lead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead')>();
  return {
    ...actual,
    usePortfolioLead: () => usePortfolioLeadMock(),
  };
});

function portfolioLeadContext() {
  return {
    strategicFronts: DEFAULT_STRATEGIC_FRONTS,
    challenges: DEFAULT_CHALLENGES,
    initiatives: DEFAULT_INITIATIVES,
    initiativeOverlaps: DEFAULT_INITIATIVE_OVERLAPS,
    portfolioDecisions: DEFAULT_PORTFOLIO_DECISIONS,
    executiveOutputs: DEFAULT_EXECUTIVE_OUTPUTS,
    createStrategicFront: vi.fn(),
    updateStrategicFront: vi.fn(),
    updateStrategicFrontStatus: vi.fn(),
    createChallenge: vi.fn(),
    updateChallenge: updateChallengeMock,
    updateChallengeStakeholderStatus: updateStakeholderStatusMock,
  };
}

describe('DS-07 Strategic Front and Challenge summary pilot', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    updateChallengeMock.mockClear();
    updateStakeholderStatusMock.mockClear();
    usePortfolioLeadMock.mockReturnValue(portfolioLeadContext());
  });

  it('renders Strategic Front context through DS page patterns without changing supplied values', () => {
    render(
      <MemoryRouter initialEntries={['/portfolio/frentes-estrategicos']}>
        <PortfolioLeadStrategicFrontsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Frentes estrategicos' })).toBeInTheDocument();
    expect(screen.getByText('Excelencia operativa')).toBeInTheDocument();
    expect(screen.getByText('Tiempo de ciclo operativo')).toBeInTheDocument();
    expect(screen.getByText('Roberto Jimenez')).toBeInTheDocument();
    expect(screen.getAllByText('Contexto del frente')).toHaveLength(2);
    expect(screen.getAllByText(/Starteria: seguimiento sugerido/i)).toHaveLength(2);
  });

  it('renders Challenge data, preserves coverage semantics, and opens the canonical Brief + Assignment flow', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/portfolio/retos']}>
        <PortfolioLeadChallengesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Retos' })).toBeInTheDocument();
    expect(screen.getByText('Reducir friccion en onboarding interno')).toBeInTheDocument();
    expect(screen.getAllByText('Cobertura parcial').length).toBeGreaterThan(0);
    expect(screen.getByText('3 iniciativas asociadas · 2 activas · 1 bloqueadas')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Ver iniciativas/i })[0]);
    expect(navigateMock).toHaveBeenCalledWith('/portfolio/iniciativas?challengeId=challenge-open');

    expect(screen.getAllByRole('button', { name: /Preparar Brief y Assignment/i }).length).toBeGreaterThan(0);
    expect(navigateMock).not.toHaveBeenCalledWith('/projects/new?challengeId=challenge-open');
  });
});
