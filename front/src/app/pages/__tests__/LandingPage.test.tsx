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

describe('KAN-113 public landing commercial alignment', () => {
  it('preserves the headline and current supporting copy', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Haz que la estrategia se haga realidad.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('De la estrategia al impacto real')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Conecta lo que tu empresa quiere mover con el trabajo, las personas y la evidencia necesarias para lograrlo.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Starteria reduce silos, mantiene contexto y convierte avance en decisiones más claras.',
      ),
    ).toBeInTheDocument();
  });

  it('integrates the named conceptual model into the Hero and shows the four value stages', () => {
    renderLanding();

    const hero = screen.getByRole('heading', {
      level: 1,
      name: 'Haz que la estrategia se haga realidad.',
    }).closest('section');
    const model = screen.getByRole('region', { name: 'Modelo conceptual de Starteria' });
    expect(hero?.contains(model)).toBe(true);

    for (const item of [
      'Objetivos',
      'Necesidades',
      'Iniciativas',
      'Equipos',
      'Starteria',
      'Foco',
      'Coordinación',
      'Evidencia',
      'Decisión',
      'Contexto. Trabajo. Decisiones.',
    ]) {
      expect(within(model).getByText(item)).toBeInTheDocument();
    }

    const valueFlow = screen.getByRole('group', { name: 'Flujo conceptual de valor' });
    for (const [index, step] of ['Define la meta', 'Alinea el trabajo', 'Hazlas realidad', 'Decide'].entries()) {
      expect(within(valueFlow).getByText(step)).toBeInTheDocument();
      expect(within(valueFlow).getByText(String(index + 1).padStart(2, '0'))).toBeInTheDocument();
    }
    expect(within(valueFlow).queryByText(/Step 0|Step 1|Step 2|Step 3|Step 4/i)).not.toBeInTheDocument();
  });

  it('shows the three qualitative benefits without metrics', () => {
    renderLanding();

    const benefits = screen.getByRole('region', { name: 'Beneficios rápidos' });
    for (const benefit of [
      'Más claridad en menos tiempo',
      'Equipos alineados de verdad',
      'Decisiones con evidencia',
    ]) {
      expect(within(benefits).getByText(benefit)).toBeInTheDocument();
    }
    expect(benefits.textContent).not.toMatch(/\d|%/);
  });

  it('presents the illustrative case from the comp as a static, labelled example', () => {
    renderLanding();

    const preview = screen.getByRole('region', { name: 'Reducir 30% el tiempo operativo' });
    for (const label of ['Meta', 'Alineación', 'Ejecución', 'Decisión']) {
      expect(within(preview).getByRole('heading', { name: label, level: 4 })).toBeInTheDocument();
    }
    expect(within(preview).getByText('Caso ilustrativo')).toBeInTheDocument();
    expect(within(preview).getByText('Ejemplo de cómo se vería en Starteria')).toBeInTheDocument();
    for (const example of [
      '“Reducir 30% el tiempo operativo en 6 meses”',
      '5 iniciativas conectadas, equipos y dependencias.',
      '12 tareas en curso',
      '3 bloqueos',
      'Documentos compartidos',
      'Brief de decisión listo.',
      'Invertir',
      'Iterar',
      'Pivotar',
      'Cerrar',
    ]) {
      expect(within(preview).getByText(example)).toBeInTheDocument();
    }
    expect(preview.querySelectorAll('button, a, input, textarea, select, [tabindex]')).toHaveLength(0);
    expect(preview.querySelector('[aria-live]')).toBeNull();
    expect(
      screen.getByText('Caso ilustrativo con datos ficticios. La decisión sigue siendo de las personas.'),
    ).toBeInTheDocument();
  });

  it('keeps demo primary, routes the optional actions, and preserves trust semantics', () => {
    renderLanding();

    const header = document.querySelector('header.sticky') as HTMLElement;
    expect(header).not.toBeNull();
    const headerDemoLink = within(header).getByRole('link', { name: 'Reservar demo' });
    expect(headerDemoLink).toHaveAttribute('href', PUBLIC_LANDING_CONFIG.demoBookingUrl);
    expect(headerDemoLink).toHaveAttribute('target', '_blank');
    expect(headerDemoLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(headerDemoLink).toHaveClass(/bg-brand-primary/);
    expect(within(header).getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/auth');

    const hero = screen
      .getByRole('heading', { level: 1, name: 'Haz que la estrategia se haga realidad.' })
      .closest('section') as HTMLElement;
    const heroContent = within(hero);
    const heroDemoLink = heroContent.getByRole('link', { name: 'Reservar demo' });
    expect(heroDemoLink).toHaveAttribute('href', PUBLIC_LANDING_CONFIG.demoBookingUrl);
    expect(heroDemoLink).toHaveAttribute('target', '_blank');
    expect(heroDemoLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(heroDemoLink).toHaveClass(/bg-brand-primary/);
    expect(
      heroContent.getByRole('link', { name: 'Quiero alinear mi objetivo primero' }),
    ).toHaveAttribute('href', '/public/start');

    const closing = screen.getByRole('region', {
      name: 'Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.',
    });
    expect(within(closing).getByRole('link', { name: 'Analizar mi situación' })).toHaveAttribute(
      'href',
      '/public/start',
    );
    expect(within(closing).queryByRole('link', { name: 'Reservar demo' })).not.toBeInTheDocument();

    const trust = screen.getByRole('region', {
      name: 'Starteria estructura tu contexto sin sustituir tu criterio.',
    });
    for (const principle of [
      'Puedes empezar con contexto incompleto.',
      'Nada se convierte en trabajo formal sin revisión.',
      'La IA estructura y propone; las decisiones siguen siendo humanas.',
      'Tu entrada pública no crea iniciativas automáticamente.',
    ]) {
      expect(within(trust).getByText(principle)).toBeInTheDocument();
    }
    expect(screen.queryByRole('form', { name: 'Portfolio Entry' })).not.toBeInTheDocument();
  });

  it('orders the visual story before the closing action and keeps useful footer navigation', () => {
    renderLanding();

    const headings = [
      screen.getByRole('heading', { level: 1, name: 'Haz que la estrategia se haga realidad.' }),
      screen.getByRole('heading', { name: 'Cómo te ayuda Starteria' }),
      screen.getByRole('heading', { name: 'Reducir 30% el tiempo operativo' }),
      screen.getByRole('heading', { name: 'Entre la estrategia y la ejecución se pierde demasiado.' }),
      screen.getByRole('heading', { name: 'Empiezas con lo que sabes y avanzas cuando decides.' }),
      screen.getByRole('heading', { name: 'Starteria estructura tu contexto sin sustituir tu criterio.' }),
      screen.getByRole('heading', { name: 'Empieza con lo que sabes. Starteria te ayuda a ordenar lo que falta.' }),
    ];
    for (let index = 0; index < headings.length - 1; index += 1) {
      expect(
        headings[index].compareDocumentPosition(headings[index + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    expect(screen.queryByRole('link', { name: /early access/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /early access/i })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación del pie de página' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Caso ilustrativo con datos ficticios. La decisión sigue siendo de las personas.',
      ),
    ).toBeInTheDocument();
  });
});
