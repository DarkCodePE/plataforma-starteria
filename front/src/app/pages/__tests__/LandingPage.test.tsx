import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { PUBLIC_LANDING_CONFIG } from '../../config/publicLanding';
import { LandingPage } from '../LandingPage';

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ isAuthenticated: false }) }));

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('public landing — Platform + Fab without Portfolio Entry', () => {
  it('communicates the business need, the unified value and a direct next action', () => {
    renderLanding();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'De una necesidad de negocio a una solución que genera valor.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Combinamos estrategia, ejecución tecnológica e inteligencia artificial/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explorar soluciones' })).toHaveAttribute('href', '#soluciones');
  });

  it('contains zero paths to the nonworking public Portfolio Entry experience', () => {
    renderLanding();
    expect(document.querySelectorAll('a[href="/public/start"]')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: /Analizar mi situación/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Quiero alinear mi objetivo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('presents Platform, Fab and integrated service with claims bounded to current status', () => {
    renderLanding();
    const solutions = screen.getByRole('region', { name: /Lo que necesitas para pasar de la oportunidad a la ejecución/i });
    expect(within(solutions).getByText('Starteria Platform')).toBeInTheDocument();
    expect(within(solutions).getByText('Starteria Fab')).toBeInTheDocument();
    expect(within(solutions).getByText('Servicio integrado')).toBeInTheDocument();
    expect(within(solutions).getByText(/La integración completa está en evolución/)).toBeInTheDocument();
  });

  it('keeps the product illustration explicitly fictitious and static', () => {
    renderLanding();
    const preview = screen.getByRole('region', { name: 'Reducir 30% el tiempo operativo' });
    expect(within(preview).getByText('Caso ilustrativo')).toBeInTheDocument();
    expect(preview.querySelectorAll('button, a, input, textarea, select, [tabindex]')).toHaveLength(0);
    expect(screen.getByText('Caso ilustrativo con datos ficticios. La decisión sigue siendo de las personas.')).toBeInTheDocument();
  });

  it('keeps a direct commercial CTA and human authority, without inventing access', () => {
    renderLanding();
    const header = document.querySelector('header.sticky') as HTMLElement;
    const headerCta = within(header).getByRole('link', { name: 'Hablemos' });
    expect(headerCta).toHaveAttribute('href', PUBLIC_LANDING_CONFIG.demoBookingUrl);
    expect(headerCta).toHaveAttribute('target', '_blank');
    expect(headerCta).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(header).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/auth');

    const hero = screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement;
    expect(within(hero).getByRole('link', { name: 'Hablemos de tu desafío' })).toHaveAttribute(
      'href',
      PUBLIC_LANDING_CONFIG.demoBookingUrl,
    );
    expect(screen.getByRole('heading', { name: 'La IA ayuda a avanzar. La responsabilidad sigue siendo humana.' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /early access/i })).not.toBeInTheDocument();
  });

  it('uses problem-to-solution narrative in the correct reading order', () => {
    renderLanding();
    const headings = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByRole('heading', { name: 'Las oportunidades no se pierden por falta de ideas.' }),
      screen.getByRole('heading', { name: 'Lo que necesitas para pasar de la oportunidad a la ejecución.' }),
      screen.getByRole('heading', { name: 'De la primera conversación a una decisión sustentada.' }),
      screen.getByRole('heading', { name: 'Un punto de partida diferente. Una ruta adecuada a cada desafío.' }),
      screen.getByRole('heading', { name: 'La IA ayuda a avanzar. La responsabilidad sigue siendo humana.' }),
      screen.getByRole('heading', { name: '¿Qué necesita cambiar en tu negocio?' }),
    ];
    for (let index = 0; index < headings.length - 1; index += 1) {
      expect(headings[index].compareDocumentPosition(headings[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación del pie de página' })).toBeInTheDocument();
  });
});
