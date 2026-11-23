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

describe('public landing — KAN-258 V4.2', () => {
  it('presenta el hero editorial y la historia completa del sistema', () => {
    renderLanding();

    expect(screen.getByText('Plataforma para democratizar la innovación')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Convierte objetivos de negocio en iniciativas que avanzan y aprenden.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/conecta estrategia, personas y ejecución guiada/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Contexto, oportunidades e iniciativas existentes/i })).toBeInTheDocument();
    expect(screen.getByText('Claridad estratégica')).toBeInTheDocument();
    expect(screen.getByText('Ejecución acompañada')).toBeInTheDocument();
    expect(screen.getByText('Aprendizaje que permanece')).toBeInTheDocument();
  });

  it('sustituye las cuatro etapas por una única demo navegable de tres perspectivas', () => {
    renderLanding();

    const tabs = screen.getByRole('tablist', { name: 'Perspectivas del trabajo en Startería' });
    const strategy = within(tabs).getByRole('tab', { name: /Estrategia/ });
    const execution = within(tabs).getByRole('tab', { name: /Ejecución/ });
    const results = within(tabs).getByRole('tab', { name: /Resultados/ });

    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
    expect(strategy).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('De un objetivo a iniciativas con propósito.');

    fireEvent.keyDown(strategy, { key: 'ArrowRight' });
    expect(execution).toHaveAttribute('aria-selected', 'true');
    expect(execution).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Del encargo al trabajo guiado.');

    fireEvent.keyDown(execution, { key: 'End' });
    expect(results).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('La evidencia regresa a la estrategia.');

    fireEvent.keyDown(results, { key: 'Home' });
    expect(strategy).toHaveAttribute('aria-selected', 'true');
  });

  it('distingue objetivo, KPI de negocio e iniciativa en Estrategia', () => {
    renderLanding();

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Mejorar la experiencia de nuestros clientes')).toBeInTheDocument();
    expect(within(panel).getByText(/KPI de negocio: satisfacción del cliente/i)).toBeInTheDocument();
    expect(within(panel).getByText('Reducir las esperas')).toBeInTheDocument();
    expect(within(panel).getByText(/prepara el encargo para una persona responsable/i)).toBeInTheDocument();
  });

  it('muestra guía contextual, responsabilidad humana y las rutas Equipo/Fab en Ejecución', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('tab', { name: /Ejecución/ }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Guía de Startería en este momento')).toBeInTheDocument();
    expect(within(panel).getByText('Con el equipo')).toBeInTheDocument();
    expect(within(panel).getByText('Con Fab')).toBeInTheDocument();
    expect(within(panel).getByText(/sin reemplazar al equipo ejecutor ni aprobar automáticamente/i)).toBeInTheDocument();

    const fabLink = screen.getByRole('link', { name: /Explorar Startería Fab/ });
    expect(fabLink).toHaveAttribute('href', 'https://darkcodepe.github.io/sw-factory/');
    expect(fabLink).toHaveAttribute('target', '_blank');
    expect(fabLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText(/integración automática con Platform no se presenta como certificada/i)).toBeInTheDocument();
  });

  it('rotula las métricas como ficticias y devuelve evidencia a la decisión humana', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('tab', { name: /Resultados/ }));

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('48 h')).toBeInTheDocument();
    expect(within(panel).getByText('24 h')).toBeInTheDocument();
    expect(within(panel).getByText('30 h')).toBeInTheDocument();
    expect(within(panel).getByText(/caso ficticio/i)).toBeInTheDocument();
    expect(within(panel).getByText(/La decisión corresponde a quienes tienen autoridad/i)).toBeInTheDocument();
    expect(screen.getByText(/KPI estratégico.*métrica operativa.*son distintos/i)).toBeInTheDocument();
  });

  it('incluye públicos asimétricos, FAQ y propósito editorial', () => {
    renderLanding();

    expect(screen.getByRole('heading', { name: /Conecta más equipos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Una necesidad.*Una prueba concreta/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /De la mejora.*a una solución real/i })).toBeInTheDocument();
    expect(screen.getByText(/No son tres productos ni etapas obligatorias/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tu contexto. Tus decisiones. Tu control.' })).toBeInTheDocument();
    expect(screen.getByText('¿Puedo usar mis propios LLMs de confianza?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Que innovar no dependa de tener un gran equipo.' })).toBeInTheDocument();
    expect(screen.getByText('Democratizar la innovación desde el hacer.')).toBeInTheDocument();
  });

  it('conserva conversión configurada y cero caminos a Portfolio Entry', () => {
    renderLanding();

    expect(document.querySelectorAll('a[href="/public/start"]')).toHaveLength(0);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    for (const cta of screen.getAllByRole('link', { name: /Solicitar (una )?demo/ })) {
      expect(cta).toHaveAttribute('href', PUBLIC_LANDING_CONFIG.demoBookingUrl);
      expect(cta).toHaveAttribute('target', '_blank');
      expect(cta).toHaveAttribute('rel', 'noopener noreferrer');
    }

    expect(
      screen.getByRole('heading', { name: '¿Tienes una necesidad por resolver o una oportunidad por desarrollar?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Conversación inicial, no acceso o piloto automático/i)).toBeInTheDocument();
  });
});
