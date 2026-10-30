/**
 * Copilot del portafolio apagado en prod (VITE_PORTFOLIO_COPILOT_ENABLED): el Home del lead no
 * debe nombrarlo, ni en la tarjeta "Starteria" ni con el launcher. Encendido, ambos aparecen.
 */
import { render, screen } from '@testing-library/react';
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
import { PortfolioLeadHomePage } from '../PortfolioLeadHomePage';

const copilotEnabled = vi.hoisted(() => vi.fn(() => false));

vi.mock('../../services/featureFlags', () => ({
  isPortfolioCopilotEnabled: () => copilotEnabled(),
}));

vi.mock('../../../features/portfolio-entry/home/usePortfolioHomeEntryContext', () => ({
  usePortfolioHomeEntryContext: () => ({ data: null, status: 'idle', error: null }),
}));

vi.mock('../../../features/portfolio-lead/bootstrap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead/bootstrap')>();
  return {
    ...actual,
    usePortfolioBootstrap: () => ({
      data: { bootstrapSession: { id: 'session-completed', setupCompletedAt: '2026-10-24T08:00:00.000Z' } },
      status: 'ready',
      error: null,
      retry: vi.fn(),
    }),
  };
});

vi.mock('../../services/portfolioService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/portfolioService')>();
  return {
    ...actual,
    getPortfolioHome: vi.fn().mockResolvedValue({
      portfolioReading: { summary: 'Lectura ejecutiva', source: 'bootstrap' },
      governance: {}, strategicUnits: [], attention: [], pendingDecisions: [], recommendations: [],
      handoffAssignments: [], generatedAt: '2026-10-24T08:00:00.000Z', learnings: [], learningsUnavailable: false,
      availability: { strategicUnits: 'available', handoffAssignments: 'available', learnings: 'available', capacity: 'available' },
      capacity: { totalActiveInitiatives: 0, signals: [], note: 'Sin iniciativas activas.' },
    }),
  };
});

vi.mock('../../../features/portfolio-lead', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/portfolio-lead')>();
  return {
    ...actual,
    usePortfolioLead: () => ({
      strategicFronts: DEFAULT_STRATEGIC_FRONTS,
      challenges: DEFAULT_CHALLENGES,
      initiatives: DEFAULT_INITIATIVES,
      initiativeOverlaps: DEFAULT_INITIATIVE_OVERLAPS,
      portfolioDecisions: DEFAULT_PORTFOLIO_DECISIONS,
      executiveOutputs: DEFAULT_EXECUTIVE_OUTPUTS,
      refreshPortfolioData: vi.fn(),
    }),
  };
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/portfolio/inicio']}>
      <PortfolioLeadHomePage />
    </MemoryRouter>,
  );
}

describe('PortfolioLeadHomePage — menciones a Copilot según el flag', () => {
  beforeEach(() => {
    copilotEnabled.mockReset();
  });

  it('con el flag apagado no menciona Copilot en ninguna parte', async () => {
    copilotEnabled.mockReturnValue(false);
    const { container } = renderHome();

    expect(await screen.findByRole('heading', { name: /Qué necesita tu atención para mover el negocio/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Copilot/i);
  });

  it('con el flag encendido muestra la mención y el launcher', async () => {
    copilotEnabled.mockReturnValue(true);
    renderHome();

    expect(await screen.findByRole('button', { name: /Abrir Copilot de portafolio/i })).toBeInTheDocument();
  });
});
