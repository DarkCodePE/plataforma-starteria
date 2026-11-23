import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('mantiene la navegación editorial de la landing dentro de la ruta pública', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
        <CurrentPath />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })
      .querySelector('a[href="#como-funciona"]')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
  });

  it('no expone Portfolio Entry desde la landing, pero preserva la ruta legacy en el router', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
        <CurrentPath />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', {
      name: /Convierte objetivos de negocio en iniciativas que avanzan y aprenden/i,
    })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute('href', '#como-funciona');
    expect(document.querySelectorAll('a[href="/public/start"]')).toHaveLength(0);

    const publicRoute = appRoutes[0].children?.find(route => route.path === '/public');
    expect(publicRoute?.children?.some(route => route.path === 'start')).toBe(true);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
  });
});
