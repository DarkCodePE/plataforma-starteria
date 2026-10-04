import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LandingPage } from '../LandingPage';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ isAuthenticated: false }) }));

vi.mock('../../../features/portfolio-entry/public', () => ({
  PortfolioEntryExperience: () => <form aria-label="Portfolio Entry"><label htmlFor="entry-input">¿Qué necesitas?</label><textarea id="entry-input" /></form>,
}));

function renderLanding() {
  return render(<MemoryRouter><LandingPage /></MemoryRouter>);
}

describe('KAN-102 public landing and Portfolio Entry convergence', () => {
  it('preserves the frozen hero framing before any optional entry path', () => {
    renderLanding();
    const headline = screen.getByRole('heading', { level: 1, name: 'Haz que la estrategia se haga realidad.' });

    expect(headline).toBeInTheDocument();
    expect(screen.getByText('Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.')).toBeInTheDocument();
    expect(screen.getByText('Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.')).toBeInTheDocument();
  });

  it('shows the illustrative L2 product model and conceptual value flow', () => {
    renderLanding();
    const model = screen.getByLabelText('Modelo conceptual de Starteria');

    for (const label of ['Objetivos', 'Necesidades', 'Iniciativas', 'Equipos', 'Contexto. Trabajo. Decisiones.', 'Foco', 'Coordinación', 'Evidencia', 'Decisión']) {
      expect(within(model).getByText(label)).toBeInTheDocument();
    }
    for (const step of ['Define la meta', 'Alinea el trabajo', 'Hazlas realidad', 'Decide']) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Step 0|Step 1|Step 2|Step 3|Step 4/i)).not.toBeInTheDocument();
  });

  it('prioritizes the existing Starteria entry and offers Portfolio Entry as a secondary route', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: /ya tengo claro qué quiero mover/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aclara qué quieres conseguir antes de decidir qué hacer.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quiero alinear mi objetivo primero/i })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Portfolio Entry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /early access|demo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /early access|demo/i })).not.toBeInTheDocument();
  });
});
