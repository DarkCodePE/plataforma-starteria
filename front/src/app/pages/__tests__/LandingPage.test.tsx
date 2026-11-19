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

describe('public landing — KAN-255 Platform + Fab', () => {
  it('comunica categoría, valor y siguiente acción en la primera lectura', () => {
    renderLanding();

    expect(screen.getByText('Plataforma de inteligencia y desarrollo de iniciativas')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Haz que cada iniciativa aporte más.' })).toBeInTheDocument();
    expect(screen.getByText(/Conecta objetivos, equipos y conocimiento para desarrollar iniciativas/)).toBeInTheDocument();
    expect(screen.getByText(/plataforma, asistencia de IA y capacidad tecnológica de Fab/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute('href', '#en-accion');
  });

  it('presenta una única demostración navegable con cuatro etapas', () => {
    renderLanding();

    const tabs = screen.getByRole('tablist', { name: 'Etapas del desarrollo de una iniciativa' });
    const clarify = within(tabs).getByRole('tab', { name: /Clarificar/ });
    const connect = within(tabs).getByRole('tab', { name: /Conectar/ });
    const execute = within(tabs).getByRole('tab', { name: /Ejecutar/ });
    const learn = within(tabs).getByRole('tab', { name: /Aprender/ });

    expect(within(tabs).getAllByRole('tab')).toHaveLength(4);
    expect(clarify).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Convertir una necesidad en un objetivo observable.');

    fireEvent.keyDown(clarify, { key: 'ArrowRight' });
    expect(connect).toHaveAttribute('aria-selected', 'true');
    expect(connect).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Comparar iniciativas y hacer explícitas las prioridades.');

    fireEvent.click(execute);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Elegir cómo desarrollar la iniciativa sin perder continuidad.');
    fireEvent.click(learn);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Lo aprendido vuelve a orientar nuevas iniciativas.');
    expect(screen.getByText(/Demostración conceptual con información ficticia/)).toBeInTheDocument();
  });

  it('integra las rutas Equipo y Fab dentro de ejecución y las reconecta con evidencia', () => {
    renderLanding();

    fireEvent.click(screen.getByRole('tab', { name: /Ejecutar/ }));
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Con el equipo')).toBeInTheDocument();
    expect(within(panel).getByText('Con Startería Fab')).toBeInTheDocument();
    expect(within(panel).getByText(/Evidencia, resultado y continuidad/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Conocer Startería Fab' })).toHaveAttribute(
      'href',
      'https://darkcodepe.github.io/sw-factory/',
    );
    expect(within(panel).getByRole('link', { name: 'Conocer Startería Fab' })).toHaveAttribute('target', '_blank');
    expect(within(panel).getByText(/No implica una integración automática certificada/)).toBeInTheDocument();
  });

  it('resume impacto y fricciones sin repetir el recorrido ni inventar métricas', () => {
    renderLanding();

    const impact = screen.getByRole('region', { name: 'Impacto empresarial' });
    expect(within(impact).getByText('Menos esfuerzo de coordinación')).toBeInTheDocument();
    expect(within(impact).getByText('Mayor aprovechamiento del equipo')).toBeInTheDocument();
    expect(within(impact).getByText('Conocimiento reutilizable')).toBeInTheDocument();
    expect(within(impact).getByText('Decisiones con evidencia')).toBeInTheDocument();

    const comparison = screen.getByRole('region', { name: 'Fricciones que Startería ayuda a reducir' });
    expect(within(comparison).getByText('Hoy')).toBeInTheDocument();
    expect(within(comparison).getByText('Con Startería')).toBeInTheDocument();
    expect(comparison.querySelectorAll('article')).toHaveLength(0);
    expect(document.body).not.toHaveTextContent('30%');
  });

  it('conserva conversión comercial verificable y cero caminos a Portfolio Entry', () => {
    renderLanding();

    expect(document.querySelectorAll('a[href="/public/start"]')).toHaveLength(0);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();

    for (const cta of screen.getAllByRole('link', { name: /Explorar Startería para mi equipo|Hablemos de tu iniciativa/ })) {
      expect(cta).toHaveAttribute('href', PUBLIC_LANDING_CONFIG.demoBookingUrl);
      expect(cta).toHaveAttribute('target', '_blank');
      expect(cta).toHaveAttribute('rel', 'noopener noreferrer');
    }

    expect(
      screen.getByRole('heading', { name: '¿Tienes una iniciativa que necesita ser escuchada o avanzar?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/explorar si conviene una demostración contextualizada o un piloto acordado/)).toBeInTheDocument();
  });

  it('mantiene navegación y jerarquía en el orden aprobado', () => {
    renderLanding();

    const headings = [
      screen.getByRole('heading', { level: 1 }),
      screen.getByRole('heading', { name: 'Una iniciativa. Cuatro momentos para hacerla avanzar.' }),
      screen.getByRole('heading', { name: 'Más capacidad no significa más complejidad.' }),
      screen.getByRole('heading', { name: 'Cuando el trabajo se desconecta, el valor se diluye.' }),
      screen.getByRole('heading', { name: '¿Tienes una iniciativa que necesita ser escuchada o avanzar?' }),
    ];

    for (let index = 0; index < headings.length - 1; index += 1) {
      expect(headings[index].compareDocumentPosition(headings[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navegación del pie de página' })).toBeInTheDocument();
  });
});

