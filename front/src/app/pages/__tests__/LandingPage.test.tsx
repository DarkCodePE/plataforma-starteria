import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
        name: 'Más valor de tus iniciativas. Más capacidad para las siguientes.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Startería conecta objetivos medibles, equipos, iniciativas y evidencia/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Startería en acción' })).toHaveAttribute('href', '#en-accion');
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
    const solutions = screen.getByRole('region', { name: /Una plataforma de trabajo, con capacidad técnica cuando hace falta/i });
    expect(within(solutions).getByText('Starteria Platform')).toBeInTheDocument();
    expect(within(solutions).getByText('Starteria Fab')).toBeInTheDocument();
    expect(within(solutions).getByText('Servicio integrado')).toBeInTheDocument();
    expect(within(solutions).getByText(/La integración completa está en evolución/)).toBeInTheDocument();
  });


  it('offers a real, accessible three-stage walkthrough without a public AI form', () => {
    renderLanding();
    const tabs = screen.getByRole('tablist', { name: 'Etapas del trabajo con Startería' });
    const focusTab = within(tabs).getByRole('tab', { name: /Enfocar/ });
    const developTab = within(tabs).getByRole('tab', { name: /Desarrollar/ });
    const learnTab = within(tabs).getByRole('tab', { name: /Aprender/ });

    expect(focusTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Primero, saber qué resultado importa.');
    fireEvent.click(developTab);
    expect(developTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Después, convertir el foco en trabajo que avanza.');
    fireEvent.click(learnTab);
    expect(learnTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Por último, no empezar de cero en la siguiente iniciativa.');
    expect(screen.getByText(/Demostración conceptual: no utiliza datos reales/)).toBeInTheDocument();
    expect(document.querySelectorAll('a[href="/public/start"]')).toHaveLength(0);
  });

  it('explains business impact as measurable hypotheses, not invented outcomes', () => {
    renderLanding();
    const impact = screen.getByRole('region', {
      name: /Tu equipo ya desarrolla iniciativas. Ayúdale a aprovechar mejor cada una/i,
    });
    expect(within(impact).getByText('Eficiencia operativa')).toBeInTheDocument();
    expect(within(impact).getByText('Capacidad compartida')).toBeInTheDocument();
    expect(within(impact).getByText('Valor de negocio')).toBeInTheDocument();
    expect(within(impact).getByText(/hipótesis de impacto para validar/)).toBeInTheDocument();
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
    expect(within(hero).getByRole('link', { name: 'Explorar Startería para mi equipo' })).toHaveAttribute(
      'href',
      PUBLIC_LANDING_CONFIG.demoBookingUrl,
    );
    expect(screen.getByRole('heading', { name: 'IA contextual para el trabajo. Decisiones y control en tu organización.' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /early access/i })).not.toBeInTheDocument();
  });

  it('uses problem-to-solution narrative in the correct reading order', () => {
    renderLanding();
    const headings = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByRole('heading', { name: 'Así se convierte un objetivo en iniciativas que aprenden unas de otras.' }),
      screen.getByRole('heading', { name: 'Tu equipo ya desarrolla iniciativas. Ayúdale a aprovechar mejor cada una.' }),
      screen.getByRole('heading', { name: 'Los retos de tus equipos no terminan cuando surge una buena idea.' }),
      screen.getByRole('heading', { name: 'Una plataforma de trabajo, con capacidad técnica cuando hace falta.' }),
      screen.getByRole('heading', { name: 'Una forma de trabajar que se adapta a tus equipos.' }),
      screen.getByRole('heading', { name: 'Un punto de partida diferente. Una ruta adecuada a cada desafío.' }),
      screen.getByRole('heading', { name: 'IA contextual para el trabajo. Decisiones y control en tu organización.' }),
      screen.getByRole('heading', { name: '¿Qué podría mejorar en la forma de desarrollar iniciativas de tu empresa?' }),
    ];
    for (let index = 0; index < headings.length - 1; index += 1) {
      expect(headings[index].compareDocumentPosition(headings[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación del pie de página' })).toBeInTheDocument();
  });
});
