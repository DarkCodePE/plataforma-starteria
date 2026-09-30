import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { appRoutes } from './routes';
import { LandingPage } from './pages/LandingPage';

const navigate = vi.hoisted(() => vi.fn());
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

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

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

describe('public entry routing', () => {
  beforeEach(() => {
    navigate.mockReset();
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
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('button', { name: /iniciar sesi/i }));

    expect(navigate).toHaveBeenCalledWith('/auth');
  });

  it('expone Portfolio Entry desde la landing sin CTA legacy de preproyecto', async () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', {
      name: /Convierte estrategia e iniciativas en decisiones sustentadas/i,
    })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Todavía no tienes claro por dónde empezar/i })).toBeInTheDocument();
    expect(screen.getByText('Cómo Starteria conecta el trabajo')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Analizar mi situaci[oó]n/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Crear pre proyecto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/proposal editor/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /necesitas conseguir o entender/i }), {
      target: { value: 'Necesito ordenar mis iniciativas antes del comite de direccion.' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Analizar mi situaci[oó]n/i })[0]);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/public/start'));
  });
});
