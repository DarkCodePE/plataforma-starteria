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

describe('KAN-64 public landing L1 framing', () => {
  it('presents the approved Starteria product framing before orientation input', () => {
    renderLanding();
    const headline = screen.getByRole('heading', { level: 1, name: 'Convierte estrategia e iniciativas en decisiones sustentadas.' });
    const input = screen.getByRole('textbox', { name: '¿Qué necesitas?' });

    expect(headline.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Starteria ayuda a estructurar qué quieres mover, convertirlo en iniciativas accionables, seguir evidencia y bloqueos, y preparar mejores decisiones\./)).toBeInTheDocument();
  });

  it('shows the four connected parts of the platform before optional Portfolio Entry', () => {
    renderLanding();
    const model = screen.getByLabelText('Cómo Starteria conecta el trabajo');

    expect(within(model).getAllByRole('listitem').map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Estrategia / necesidad',
      'Iniciativas',
      'Evidencia + avance',
      'Decisiones',
    ]);
    expect(model.compareDocumentPosition(screen.getByRole('heading', { name: '¿Todavía no tienes claro por dónde empezar?' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps Portfolio Entry available as optional orientation without functional commercial destinations', () => {
    renderLanding();
    expect(screen.getByRole('form', { name: 'Portfolio Entry' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /early access|demo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /early access|demo/i })).not.toBeInTheDocument();
  });
});
