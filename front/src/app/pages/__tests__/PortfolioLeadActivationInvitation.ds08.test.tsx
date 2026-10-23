import { render, screen, within } from '@testing-library/react';
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

const navigateMock = vi.hoisted(() => vi.fn());
const usePortfolioLeadMock = vi.hoisted(() => vi.fn());
const updateChallengeMock = vi.hoisted(() => vi.fn());
const updateStakeholderStatusMock = vi.hoisted(() => vi.fn());
const listActivationBriefsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const listChallengeAssignmentsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

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

vi.mock('../../../features/portfolio-lead/challenge-activation-brief/challengeActivationBriefClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead/challenge-activation-brief/challengeActivationBriefClient')>();
  return {
    ...actual,
    listActivationBriefs: (...args: unknown[]) => listActivationBriefsMock(...args),
    listChallengeHandoffAssignments: (...args: unknown[]) => listChallengeAssignmentsMock(...args),
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

describe('DS-08 Challenge activation and invitation handoff pilot', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    updateChallengeMock.mockClear();
    updateStakeholderStatusMock.mockClear();
    listActivationBriefsMock.mockResolvedValue([]);
    listChallengeAssignmentsMock.mockResolvedValue([]);
    usePortfolioLeadMock.mockReturnValue(portfolioLeadContext());
  });

  it('renders supplied invitation state and activation recommendation without changing domain values', () => {
    render(
      <MemoryRouter initialEntries={['/portfolio/retos?challengeId=challenge-invite']}>
        <PortfolioLeadChallengesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Handoff del reto antes de crear iniciativas' })).toBeInTheDocument();
    expect(screen.getByText('Personas invitadas al reto')).toBeInTheDocument();
    expect(screen.getByText('participante@starteria.io')).toBeInTheDocument();
    expect(screen.getByText('sofia@empresa.com')).toBeInTheDocument();
    expect(screen.getAllByText('Notificado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Confirmado').length).toBeGreaterThan(0);
    expect(screen.getByText('Visible solo para las personas invitadas.')).toBeInTheDocument();
    expect(screen.getByText('Starteria recomienda una ruta de activacion')).toBeInTheDocument();
    expect(screen.getAllByText('Personas seleccionadas').length).toBeGreaterThan(0);
  });

  it('aclara que el squad es del reto y resume el equipo de sus iniciativas', () => {
    const base = DEFAULT_INITIATIVES[0];
    usePortfolioLeadMock.mockReturnValue({
      ...portfolioLeadContext(),
      initiatives: [
        ...DEFAULT_INITIATIVES.filter(item => item.challengeId !== 'challenge-invite'),
        { ...base, id: 'ini-team-a', challengeId: 'challenge-invite', teamMembers: ['Ana', 'Beto', 'Caro'] },
        { ...base, id: 'ini-team-b', challengeId: 'challenge-invite', teamMembers: ['Caro', 'Dani', 'Eva', 'Fito'] },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/portfolio/retos?challengeId=challenge-invite']}>
        <PortfolioLeadChallengesPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Squad asignado al reto')).toBeInTheDocument();
    expect(screen.getByTestId('challenge-initiative-teams-summary')).toHaveTextContent('6 personas en 2 iniciativas');
  });

  it('routes a Challenge through the governed Brief/Assignment boundary instead of creating an Initiative directly', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/portfolio/retos?challengeId=challenge-invite']}>
        <PortfolioLeadChallengesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Prepara el Brief que recibirá tu equipo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeInTheDocument();
    expect(screen.getByText('Confirmar este Brief todavía no asigna personas ni inicia trabajo.')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalledWith('/projects/new?challengeId=challenge-invite');

    await user.click(screen.getAllByRole('button', { name: 'Revisar activacion' })[0]);
    expect(screen.getByRole('heading', { name: 'Editar reto' })).toBeInTheDocument();
  });
});
