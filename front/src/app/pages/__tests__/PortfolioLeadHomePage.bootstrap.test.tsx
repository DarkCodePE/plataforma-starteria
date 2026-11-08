import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioLeadHomePage } from '../PortfolioLeadHomePage';
import { makeBootstrap } from '../../../features/portfolio-lead/bootstrap/testing/bootstrapFixtures';

const createOrReuse = vi.fn();
const createDirect = vi.fn();
const getCurrent = vi.fn();
const getResumable = vi.fn();
const getSession = vi.fn();
const getHome = vi.fn();
const openAdditional = vi.fn();

vi.mock('../../../features/portfolio-lead/bootstrap/state/usePortfolioBootstrapContext', () => ({
  usePortfolioBootstrapContext: () => ({
    review: null,
    status: 'idle',
    error: null,
    saveDraft: vi.fn(),
    confirm: vi.fn(),
    retry: vi.fn(),
  }),
}));

vi.mock('../../../features/portfolio-lead/bootstrap/state/usePortfolioBootstrapSemantic', () => ({
  usePortfolioBootstrapSemantic: () => ({
    snapshot: { enabled: false, state: null, turns: [] },
    status: 'ready',
    error: null,
    pendingInputText: null,
    submit: vi.fn(),
    retry: vi.fn(),
  }),
}));

vi.mock('../../../features/portfolio-lead/bootstrap/services/portfolioBootstrapClient', () => ({
  createOrReusePortfolioBootstrapSession: (...args: unknown[]) => createOrReuse(...args),
  createOrReuseDirectPortfolioBootstrapSession: (...args: unknown[]) => createDirect(...args),
  getCurrentPortfolioBootstrapSession: (...args: unknown[]) => getCurrent(...args),
  getResumablePortfolioBootstrapSessions: (...args: unknown[]) => getResumable(...args),
  getPortfolioBootstrapSession: (...args: unknown[]) => getSession(...args),
  getPortfolioOrganizationProposal: vi.fn().mockResolvedValue(null),
  createOrReusePortfolioSetupBootstrapSession: vi.fn(),
  completePortfolioSetup: vi.fn(),
  openAdditionalPortfolioFrontSetup: (...args: unknown[]) => openAdditional(...args),
  updatePortfolioBootstrapAnchor: vi.fn(),
  confirmPortfolioBootstrapAnchor: vi.fn(),
  pastePortfolioBootstrapWorkItems: vi.fn(),
  addManualPortfolioBootstrapWorkItem: vi.fn(),
  declareNoExistingPortfolioBootstrapWork: vi.fn(),
  updatePortfolioBootstrapWorkItem: vi.fn(),
  removePortfolioBootstrapWorkItem: vi.fn(),
  analyzePortfolioBootstrapWork: vi.fn(),
  confirmPortfolioBootstrapProposedMutation: vi.fn(),
  correctPortfolioBootstrapProposedMutation: vi.fn(),
  rejectPortfolioBootstrapProposedMutation: vi.fn(),
  leavePortfolioBootstrapProposedMutationPending: vi.fn(),
  publishPortfolioBootstrapFirstReading: vi.fn(),
  getLatestPortfolioBootstrapReading: vi.fn(),
  PortfolioBootstrapClientError: class PortfolioBootstrapClientError extends Error {
    apiError = { message: this.message };
  },
}));

vi.mock('../../services/portfolioService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/portfolioService')>();
  return { ...actual, getPortfolioHome: (...args: unknown[]) => getHome(...args) };
});

vi.mock('../../../features/portfolio-entry/home/usePortfolioHomeEntryContext', () => ({
  usePortfolioHomeEntryContext: () => ({
    data: {
      continuationId: 'cont-1',
      sessionId: 'session-1',
      organization: { id: 'org-1', name: 'Acme' },
      arrival: {
        understoodNeed: 'Ordenar las iniciativas',
        desiredOutcome: 'Decidir dónde concentrar atención',
        confirmedContext: ['El portfolio tiene varias iniciativas'],
        openItems: ['Falta validar el criterio de prioridad'],
        laterWork: ['Revisar el detalle de cada iniciativa'],
        organizationalUnknowns: ['La capacidad disponible aún debe confirmarse'],
        nextStep: 'Revisar este punto de partida y continuar estructurando el contexto del Portfolio.',
      },
    },
    status: 'ready',
    error: null,
  }),
}));

vi.mock('../../../features/portfolio-lead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead')>();
  return {
    ...actual,
    usePortfolioLead: () => ({
      strategicFronts: [],
      challenges: [],
      initiatives: [],
      initiativeOverlaps: [],
      portfolioDecisions: [],
      executiveOutputs: [],
      refreshPortfolioData: vi.fn(),
    }),
  };
});

vi.mock('../../services/featureFlags', () => ({
  isPortfolioCopilotEnabled: () => false,
}));

function renderPage(path = '/portfolio/inicio?portfolioEntryContinuationId=cont-1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PortfolioLeadHomePage />
    </MemoryRouter>,
  );
}

describe('PortfolioLeadHomePage Bootstrap integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOrReuse.mockResolvedValue(makeBootstrap('anchor_sufficient'));
    createDirect.mockResolvedValue(makeBootstrap('anchor_sufficient'));
    getCurrent.mockResolvedValue(null);
    getResumable.mockResolvedValue([]);
    getSession.mockResolvedValue(makeBootstrap('anchor_sufficient'));
    openAdditional.mockResolvedValue(makeBootstrap('anchor_insufficient'));
    getHome.mockResolvedValue({
      portfolioReading: { summary: null, strategicUnitCount: null, activeInitiativeCount: null, pendingActivationCount: null, blockerCount: null, pendingDecisionCount: null, coverageGapCount: null, evidenceGapCount: null, homeState: null, generatedAt: null, source: 'unavailable' },
      governance: {}, strategicUnits: [], attention: [], pendingDecisions: [], recommendations: [], handoffAssignments: [], generatedAt: '2026-10-24T00:00:00.000Z', learnings: [], learningsUnavailable: false,
    });
  });

  it('uses continuation query to create or reuse the persisted seven-step Bootstrap', async () => {
    renderPage();

    expect(await screen.findByTestId('portfolio-bootstrap-home-a')).toBeInTheDocument();
    expect(createOrReuse).toHaveBeenCalledWith('cont-1');
    expect(screen.getByText(/Configurar con Copilot/i)).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-entry-arrival-panel')).toBeInTheDocument();
    expect(screen.getByText('Ordenar las iniciativas')).toBeInTheDocument();
  });

  it('does not render object-first primary actions when continuation governs the page', async () => {
    renderPage();

    await waitFor(() => expect(createOrReuse).toHaveBeenCalled());
    expect(screen.queryByText(/Crear frente estrategico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Crear reto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Crear iniciativa individual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Step 0/i)).not.toBeInTheDocument();
  });

  it('KAN-250 always opens Inicio as Overview without creating a Bootstrap session', async () => {
    renderPage('/portfolio/inicio');
    expect(await screen.findByRole('heading', { name: /Qué necesita tu atención para mover el negocio/i })).toBeInTheDocument();
    expect(getResumable).toHaveBeenCalledOnce();
    expect(getCurrent).not.toHaveBeenCalled();
    expect(createDirect).not.toHaveBeenCalled();
    expect(createOrReuse).not.toHaveBeenCalled();
  });

  it('KAN-250 shows resumable preparation on Inicio and reopens its exact persisted session', async () => {
    getResumable.mockResolvedValue([{
      sessionId: 'existing-session', title: 'Mejorar atención en cafetería',
      bootstrapPhase: 'B1_ANCHOR', status: 'awaiting_anchor_review',
      source: 'direct', createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-08T10:00:00.000Z',
    }]);
    renderPage('/portfolio/inicio');
    expect(await screen.findByText('Mejorar atención en cafetería')).toBeInTheDocument();
    expect(createDirect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retomar este espacio' }));
    await waitFor(() => expect(getSession).toHaveBeenCalledWith('existing-session'));
    expect(createDirect).not.toHaveBeenCalled();
    expect(await screen.findByTestId('portfolio-bootstrap-home-a')).toBeInTheDocument();
  });

  it('KAN-250 opens a new workspace only when a human chooses to start', async () => {
    renderPage('/portfolio/inicio');
    const start = await screen.findByRole('button', { name: 'Preparar nueva oportunidad' });
    expect(createDirect).not.toHaveBeenCalled();
    fireEvent.click(start);
    await waitFor(() => expect(createDirect).toHaveBeenCalledOnce());
    expect(await screen.findByTestId('portfolio-bootstrap-home-a')).toBeInTheDocument();
  });
});
