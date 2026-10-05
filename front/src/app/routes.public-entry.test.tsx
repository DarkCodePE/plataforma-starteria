import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { appRoutes } from './routes';
import { MemoryRouter, useLocation } from 'react-router';
import { LandingPage } from './pages/LandingPage';

const serviceMocks = vi.hoisted(() => ({
  createPortfolioEntrySession: vi.fn(),
  submitPortfolioEntryMessage: vi.fn(),
  getPortfolioEntrySession: vi.fn(),
  getClaimedPortfolioEntrySession: vi.fn(),
  chooseGuidedExploration: vi.fn(),
  materializePortfolioEntryHandoff: vi.fn(),
  correctPortfolioEntryHandoff: vi.fn(),
  confirmPortfolioEntryHandoff: vi.fn(),
  continuePortfolioEntryToPortfolio: vi.fn(),
  normalizePortfolioEntryApiError: vi.fn((err: { kind?: string; status?: number }) => ({
    kind: err.kind ?? 'network',
    status: err.status,
  })),
}));

const entrySession = {
  id: '11111111-1111-4111-8111-111111111111',
  lifecycleStatus: 'ENTRY_CAPTURED',
  executionStatus: 'ACTIVE',
  revision: 0,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  ownership: { state: 'ANONYMOUS' },
  conversation: [],
  clarification: {
    interactionMode: 'quick_clarification',
    quickQuestionBudget: 3,
    quickQuestionsAsked: 0,
    explorationRound: 0,
    questionsAskedCurrentRound: 0,
    previousQuestions: [],
    answeredGaps: [],
  },
  semanticProjection: {},
  nextAction: 'submit_message',
};

vi.mock('./context/AppContext', () => ({
  useApp: () => ({
    isAuthenticated: false,
  }),
}));

vi.mock('./components/landing/HeroTunnel', () => ({
  HeroTunnel: () => null,
}));

vi.mock('../features/portfolio-entry/public/portfolioEntryPublicService', () => serviceMocks);

vi.mock('../features/portfolio-entry/public/analytics', () => ({
  trackPortfolioEntryEvent: vi.fn(),
}));

function CurrentPath() {
  const { pathname } = useLocation();
  return <output data-testid="current-path">{pathname}</output>;
}

describe('public entry routing', () => {
  beforeEach(() => {
    serviceMocks.createPortfolioEntrySession.mockResolvedValue({
      session: entrySession,
      publicAccessToken: 'public-token',
    });
    serviceMocks.submitPortfolioEntryMessage.mockResolvedValue({
      ...entrySession,
      revision: 1,
      nextAction: 'answer_clarification',
    });
  });

  it('mantiene / como landing publica fuera del guard autenticado', () => {
    const root = appRoutes[0];
    const indexRoute = root.children?.find(route => route.index === true);

    expect(indexRoute?.Component).toBe(LandingPage);
  });

  it('permite ir desde la landing al login real', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
        <CurrentPath />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole('link', { name: /iniciar sesi/i })[0]);

    expect(screen.getByTestId('current-path')).toHaveTextContent('/auth');
  });

  it('expone Portfolio Entry como camino opcional hacia /public/start', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
        <CurrentPath />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', {
      name: /Haz que la estrategia se haga realidad/i,
    })).toBeInTheDocument();
    const closingHeading = screen.getByRole('heading', {
      name: 'Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.',
    });
    expect(closingHeading).toBeInTheDocument();
    const closingSection = closingHeading.closest('section') as HTMLElement;
    const closingCta = within(closingSection).getByRole('link', { name: 'Analizar mi situación' });
    expect(closingCta).toHaveAttribute('href', '/public/start');
    expect(screen.queryByRole('textbox', { name: /necesitas conseguir o entender/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Crear pre proyecto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/proposal editor/i)).not.toBeInTheDocument();

    fireEvent.click(closingCta);

    expect(screen.getByTestId('current-path')).toHaveTextContent('/public/start');
  });
});
