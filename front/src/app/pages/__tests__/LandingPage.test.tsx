import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LandingPage } from '../LandingPage';

vi.mock('../../context/AppContext', () => ({ useApp: () => ({ isAuthenticated: false }) }));

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('KAN-112 public landing visual preview', () => {
  it('preserves the frozen Hero copy exactly', () => {
    renderLanding();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Haz que la estrategia se haga realidad.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Alinea objetivos, conecta equipos y haz avanzar las iniciativas que realmente importan.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Starteria mantiene estrategia, ejecución y evidencia conectadas para que sepas qué mover, qué necesita atención y qué decisión preparar.',
      ),
    ).toBeInTheDocument();
  });

  it('preserves the L2 conceptual model and complete value flow', () => {
    renderLanding();

    const model = screen.getByRole('region', {
      name: 'Modelo conceptual de Starteria',
    });
    expect(
      within(model).getByText('Objetivos / Necesidades / Iniciativas / Equipos'),
    ).toBeInTheDocument();
    expect(within(model).getByText('Starteria')).toBeInTheDocument();
    expect(
      within(model).getByText('Contexto. Trabajo. Decisiones.'),
    ).toBeInTheDocument();
    expect(
      within(model).getByText('Foco / Coordinación / Evidencia / Decisión'),
    ).toBeInTheDocument();

    const valueFlow = screen.getByRole('group', { name: 'Flujo conceptual de valor' });
    for (const step of ['Define la meta', 'Alinea el trabajo', 'Hazlas realidad', 'Decide']) {
      expect(within(valueFlow).getByText(step)).toBeInTheDocument();
    }
    expect(within(model).queryByText(/Step 0|Step 1|Step 2|Step 3|Step 4/i)).not.toBeInTheDocument();
  });

  it('shows an explicitly illustrative product preview without commercial CTAs', () => {
    renderLanding();

    const preview = screen.getByRole('region', {
      name: 'Así puede verse el trabajo cuando está conectado',
    });
    expect(
      within(preview).getByText('Ejemplo ilustrativo · no es un análisis real'),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText('Contenido, nombres, relaciones y estados ficticios.'),
    ).toBeInTheDocument();
    expect(
      preview.querySelectorAll('.rounded-ds-md.border-border-default.bg-background-subtle'),
    ).toHaveLength(0);
    expect(preview.querySelectorAll('button, a, input, textarea')).toHaveLength(0);
    expect(preview.textContent).not.toMatch(/%|\bStep ?[0-4]\b|kanban|copilot|chatbot/i);
    for (const example of [
      'Mejorar adopción del canal digital',
      'Experiencia digital',
      'Facilitar la activación inicial',
      'Rediseño onboarding',
      'Automatización soporte',
      'Nuevo flujo de activación',
      'Señal a revisar:',
      'Evidencia pendiente:',
      'Bloqueo ilustrativo:',
      'Decisión a preparar',
    ]) {
      expect(within(preview).getByText(new RegExp(example))).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('link', { name: /early access|demo/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /early access|demo/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps the direct product route primary and Portfolio Entry optional', () => {
    renderLanding();

    expect(
      screen.getByRole('link', { name: /ya tengo claro qué quiero mover/i }),
    ).toHaveAttribute('href', '/auth');

    const entryHeading = screen.getByRole('heading', {
      name: 'Aclara qué quieres conseguir antes de decidir qué hacer.',
    });
    expect(entryHeading).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Quiero alinear mi objetivo primero' }),
    ).toHaveAttribute('href', '/public/start');

    const trustHeading = screen.getByRole('heading', {
      name: 'Starteria estructura tu contexto sin sustituir tu criterio.',
    });
    expect(
      trustHeading.compareDocumentPosition(entryHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole('form', { name: 'Portfolio Entry' }),
    ).not.toBeInTheDocument();
  });

  it('renders the target section order without a commercial placeholder control', () => {
    renderLanding();

    const headings = [
      screen.getByRole('heading', { level: 1, name: 'Haz que la estrategia se haga realidad.' }),
      screen.getByRole('heading', { name: 'De la meta a una decisión mejor preparada.' }),
      screen.getByRole('heading', { name: 'Así puede verse el trabajo cuando está conectado' }),
      screen.getByRole('heading', { name: 'El reto no es escribir más. Es entender qué merece atención.' }),
      screen.getByRole('heading', { name: 'Starteria estructura tu contexto sin sustituir tu criterio.' }),
      screen.getByRole('heading', { name: 'Aclara qué quieres conseguir antes de decidir qué hacer.' }),
    ];

    for (let index = 0; index < headings.length - 1; index += 1) {
      expect(
        headings[index].compareDocumentPosition(headings[index + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByRole('link', { name: /early access|demo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /early access|demo/i })).not.toBeInTheDocument();
  });

  it('provides semantic landmarks, headings, and a readable provenance note', () => {
    renderLanding();

    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.getByText(
        'La preview muestra cómo organizar la lectura. No sustituye la revisión ni la decisión de las personas.',
      ),
    ).toBeInTheDocument();
  });
});
