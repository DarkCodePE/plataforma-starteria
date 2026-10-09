import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CriticalHandoffReview } from '../CriticalHandoffReview';
import type { PortfolioEntryCriticalHandoffDto } from '../types';

function makeArtifact(
  conclusionStatus: PortfolioEntryCriticalHandoffDto['projection']['conclusionStatus'] = 'supported',
  overrides: Partial<PortfolioEntryCriticalHandoffDto['projection']> = {},
): PortfolioEntryCriticalHandoffDto {
  return {
    state: 'current',
    projection: {
      conclusionStatus,
      finalReading: 'El comité necesita comparar capacidad y urgencia antes de priorizar.',
      decisionInView: 'Qué iniciativas reciben capacidad durante este ciclo.',
      usableNow: [{ item: 'Datos de capacidad', howItCanHelp: 'Permiten acotar opciones.' }],
      decisionChangingUnknowns: [{ uncertainty: 'Falta confirmar una fecha.', whyItMatters: 'Puede cambiar la secuencia.' }],
      firstMovement: {
        movement: 'Revisar el corte de capacidad actual.',
        whyNow: 'Ese corte ya existe.',
        whatItMayClarify: 'Qué opciones caben en el ciclo.',
        boundary: 'No decide prioridades por sí solo.',
        existingAssetsUsed: ['Informe de capacidad'],
      },
      ...overrides,
    },
  };
}

function renderReview(overrides: Partial<React.ComponentProps<typeof CriticalHandoffReview>> = {}) {
  const props: React.ComponentProps<typeof CriticalHandoffReview> = {
    state: 'current',
    artifact: makeArtifact(),
    correctionOpen: false,
    correctionDraft: '',
    pending: false,
    canContinue: true,
    onCorrectionDraftChange: vi.fn(),
    onBeginCorrection: vi.fn(),
    onCancelCorrection: vi.fn(),
    onSubmitCorrection: vi.fn(),
    onContinue: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  return { ...render(<CriticalHandoffReview {...props} />), props };
}

describe('CriticalHandoffReview', () => {
  it('renders supported reading in the required information order', () => {
    const { container } = renderReview();

    expect(screen.getByRole('heading', { name: 'Lectura final' })).toBeInTheDocument();
    expect(screen.getByTestId('critical-handoff-final-reading')).toHaveTextContent('El comité necesita comparar capacidad');
    expect(screen.getByRole('heading', { name: 'La decisión que tienes delante' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lo que ya puedes usar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Qué podría cambiar la decisión' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Un posible primer movimiento' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con esta lectura' })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/selected_lenses|reasoning_metadata|provenance|source_refs|claim_ref|sourceTurnId|sourceContextRevision|prompt_metadata|model_metadata|provider_metadata|epistemic_roles|conformance_metadata|candidate_first_movement|raw_synthesis|route_ranking|starteria_path|recommended_approach|recommended_cta|portfolio setup preview/i);
    const orderedSections = [
      'critical-handoff-final-reading',
      'critical-handoff-decision',
      'critical-handoff-usable-now',
      'critical-handoff-unknowns',
      'critical-handoff-first-movement',
      'critical-handoff-review-actions',
    ].map((testId) => container.querySelector(`[data-testid="${testId}"]`));
    expect(orderedSections.every(Boolean)).toBe(true);
    for (let index = 0; index < orderedSections.length - 1; index += 1) {
      expect(orderedSections[index]!.compareDocumentPosition(orderedSections[index + 1]!))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it('visibly distinguishes a bounded conclusion and preserves its reading', () => {
    renderReview({ artifact: makeArtifact('bounded') });

    expect(screen.getByTestId('critical-handoff-bounded-notice')).toHaveTextContent('incertidumbre importante');
    expect(screen.getByTestId('critical-handoff-final-reading')).toHaveTextContent('El comité necesita comparar capacidad');
  });

  it('does not fabricate a reading, decision, or first movement when basis is insufficient', () => {
    renderReview({
      artifact: makeArtifact('insufficient_basis', {
        finalReading: null,
        decisionInView: null,
        firstMovement: null,
      }),
    });

    expect(screen.getByTestId('critical-handoff-insufficient-basis')).toHaveTextContent('Todavía no hay base suficiente');
    expect(screen.queryByTestId('critical-handoff-final-reading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('critical-handoff-decision')).not.toBeInTheDocument();
    expect(screen.queryByTestId('critical-handoff-first-movement')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar con esta lectura' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a aclarar' })).toBeInTheDocument();
  });

  it('shows a framed decision and hides it when no decision is present', () => {
    const view = renderReview();
    expect(screen.getByTestId('critical-handoff-decision')).toHaveTextContent('Qué iniciativas reciben capacidad');

    view.rerender(
      <CriticalHandoffReview
        {...view.props}
        artifact={makeArtifact('supported', { decisionInView: null })}
      />,
    );
    expect(screen.queryByTestId('critical-handoff-decision')).not.toBeInTheDocument();
  });

  it('renders multiple usable-now items and decision-changing unknowns', () => {
    renderReview({
      artifact: makeArtifact('supported', {
        usableNow: [
          { item: 'Primer activo', howItCanHelp: 'Aporta una referencia.' },
          { item: 'Segundo activo', howItCanHelp: 'Acota el alcance.' },
        ],
        decisionChangingUnknowns: [
          { uncertainty: 'Primera incógnita', whyItMatters: 'Puede cambiar el orden.' },
          { uncertainty: 'Segunda incógnita', whyItMatters: 'Puede cambiar el riesgo.' },
        ],
      }),
    });

    expect(within(screen.getByTestId('critical-handoff-usable-now')).getAllByRole('listitem')).toHaveLength(2);
    expect(within(screen.getByTestId('critical-handoff-unknowns')).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Segundo activo')).toBeInTheDocument();
    expect(screen.getByText('Segunda incógnita')).toBeInTheDocument();
  });

  it('frames an optional first movement as a possibility and omits it when absent', () => {
    const view = renderReview();
    const movement = screen.getByTestId('critical-handoff-first-movement');
    expect(movement).toHaveTextContent('Un posible primer movimiento');
    expect(movement).toHaveTextContent('Revisar el corte de capacidad actual.');
    expect(movement).toHaveTextContent('No decide prioridades por sí solo.');
    expect(movement).not.toHaveTextContent('Starteria recomienda');
    expect(movement).not.toHaveTextContent('Tu siguiente paso');

    view.rerender(
      <CriticalHandoffReview
        {...view.props}
        artifact={makeArtifact('supported', { firstMovement: null })}
      />,
    );
    expect(screen.queryByTestId('critical-handoff-first-movement')).not.toBeInTheDocument();
  });

  it('never renders stale artifact content as a current conclusion', () => {
    const artifact = { ...makeArtifact(), state: 'stale' as const };
    renderReview({ state: 'stale', artifact });

    expect(screen.getByTestId('critical-handoff-stale')).toHaveTextContent('Esta lectura ya no está vigente');
    expect(screen.queryByText('El comité necesita comparar capacidad y urgencia antes de priorizar.')).not.toBeInTheDocument();
  });

  it('shows bounded unavailable and fetch-failure states without legacy recommendation content', () => {
    const view = renderReview({ state: 'absent', artifact: undefined });
    expect(screen.getByTestId('critical-handoff-absent')).toHaveTextContent('No hay una lectura final disponible');
    expect(screen.queryByText(/Ruta sugerida|Cómo lo abordaría Starteria|Portfolio Setup/i)).not.toBeInTheDocument();

    view.rerender(
      <CriticalHandoffReview
        {...view.props}
        state="error"
        artifact={undefined}
      />,
    );
    expect(screen.getByTestId('critical-handoff-error')).toHaveTextContent('No pudimos cargar la lectura');
    fireEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(view.props.onRetry).toHaveBeenCalled();
  });

  it('exposes correction intent without direct semantic-field editing and focuses its text input', async () => {
    const view = renderReview({ correctionOpen: true });

    const correction = screen.getByRole('textbox', { name: '¿Qué deberíamos entender mejor?' });
    await waitFor(() => expect(correction).toHaveFocus());
    expect(screen.queryByRole('textbox', { name: /lectura final|decisión que tienes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /primer movimiento|puedes usar|cambiar la decisión/i })).not.toBeInTheDocument();
    fireEvent.change(correction, { target: { value: 'La capacidad disponible cambia en dos semanas.' } });
    expect(view.props.onCorrectionDraftChange).toHaveBeenCalledWith('La capacidad disponible cambia en dos semanas.');
    view.rerender(
      <CriticalHandoffReview
        {...view.props}
        correctionDraft="La capacidad disponible cambia en dos semanas."
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Volver a aclarar' }));
    expect(view.props.onSubmitCorrection).toHaveBeenCalled();
  });

  it('keeps continue as a presentation callback and does not confirm or select anything', () => {
    const { props } = renderReview();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con esta lectura' }));

    expect(props.onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /confirmar|seleccionar ruta|portfolio setup/i })).not.toBeInTheDocument();
  });

  it('provides accessible loading status and disables review actions for a claimed session', () => {
    const view = renderReview({ state: 'loading', artifact: undefined });
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Cargando la lectura final…')).toBeInTheDocument();

    view.rerender(
      <CriticalHandoffReview
        {...view.props}
        state="current"
        artifact={makeArtifact()}
        canContinue={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Continuar con esta lectura' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Esta lectura ya está vinculada a tu cuenta.');
    expect(screen.getByRole('status')).not.toHaveTextContent(/confirmar|confirmación|siguiente paso/i);
  });
});
