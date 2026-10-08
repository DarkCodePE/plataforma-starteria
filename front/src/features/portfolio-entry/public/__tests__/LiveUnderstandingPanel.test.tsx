import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveUnderstandingPanel } from '../LiveUnderstandingPanel';
import type { PortfolioEntryLiveUnderstanding } from '../types';

function supportedReading(overrides: Partial<PortfolioEntryLiveUnderstanding> = {}): PortfolioEntryLiveUnderstanding {
  return {
    state: 'supported_reading',
    reading: 'La capacidad compartida y el plazo del comité compiten por la atención disponible.',
    tensions: [{
      statement: 'El comité pide foco mientras varias iniciativas necesitan la misma capacidad.',
      whyItMatters: 'El equipo no puede preparar todas las decisiones con el mismo nivel de detalle.',
    }],
    decision: { decisionToPrepare: 'Qué iniciativas deben recibir seguimiento este trimestre.' },
    decisionChangingUnknowns: [{
      uncertainty: 'Aún falta confirmar cuánta capacidad puede reservar el equipo.',
      whyItMatters: 'Ese dato puede cambiar qué iniciativas llegan preparadas al comité.',
    }],
    ...overrides,
  };
}

function renderPanel(
  viewModel: PortfolioEntryLiveUnderstanding | undefined,
  props: Partial<React.ComponentProps<typeof LiveUnderstandingPanel>> = {},
) {
  return render(
    <LiveUnderstandingPanel
      viewModel={viewModel}
      onBeginCorrection={vi.fn()}
      onCorrectionDraftChange={vi.fn()}
      onCancelCorrection={vi.fn()}
      onSubmitCorrection={vi.fn()}
      {...props}
    />,
  );
}

describe('LiveUnderstandingPanel', () => {
  it('shows a supported portfolio tradeoff, framed decision, and relevant unknowns', () => {
    renderPanel(supportedReading());

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent('Esto es lo que Starteria está entendiendo hasta ahora');
    expect(panel).toHaveTextContent('La capacidad compartida y el plazo del comité compiten por la atención disponible.');
    expect(panel).toHaveTextContent('El equipo no puede preparar todas las decisiones con el mismo nivel de detalle.');
    expect(panel).toHaveTextContent('Qué iniciativas deben recibir seguimiento este trimestre.');
    expect(panel).toHaveTextContent('Aún falta confirmar cuánta capacidad puede reservar el equipo.');
    expect(panel).toHaveTextContent('Ese dato puede cambiar qué iniciativas llegan preparadas al comité.');
    expect(panel).toHaveTextContent(/lectura provisional/i);
    expect(panel).toHaveTextContent(/no es una conclusión ni una recomendación/i);
  });

  it('does not invent a reading, tension, or decision for no supported insight', () => {
    renderPanel({
      state: 'no_supported_insight',
      reading: 'No debe aparecer como insight.',
      tensions: [{ statement: 'Tensión inventada.', whyItMatters: 'Motivo inventado.' }],
      decision: { decisionToPrepare: 'Decisión inventada.' },
      decisionChangingUnknowns: [],
    });

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent(/todavía no tiene suficiente base para compartir una lectura útil/i);
    expect(panel).not.toHaveTextContent('No debe aparecer como insight.');
    expect(panel).not.toHaveTextContent('Tensión inventada.');
    expect(panel).not.toHaveTextContent('Decisión inventada.');
  });

  it('keeps insufficient basis minimal and does not show interpretation or decision', () => {
    renderPanel({
      state: 'insufficient_basis',
      reading: 'Lectura oculta.',
      tensions: [{ statement: 'Tensión oculta.', whyItMatters: 'Motivo oculto.' }],
      decision: { decisionToPrepare: 'Decisión oculta.' },
      decisionChangingUnknowns: [{ uncertainty: 'Desconocido oculto.', whyItMatters: 'Motivo oculto.' }],
    });

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent('Todavía falta contexto para ofrecer una lectura útil.');
    expect(panel).not.toHaveTextContent('Lectura oculta.');
    expect(panel).not.toHaveTextContent('Tensión oculta.');
    expect(panel).not.toHaveTextContent('Decisión oculta.');
    expect(panel).not.toHaveTextContent('Desconocido oculto.');
  });

  it('keeps a single initiative reading local without adding portfolio framing', () => {
    renderPanel(supportedReading({
      reading: 'En esta iniciativa, la validación del prototipo depende del permiso para usar datos reales.',
      tensions: [],
      decision: { decisionToPrepare: 'Si la iniciativa puede validar el prototipo con datos reales.' },
      decisionChangingUnknowns: [],
    }));

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent('En esta iniciativa, la validación del prototipo depende del permiso para usar datos reales.');
    expect(panel).toHaveTextContent('Si la iniciativa puede validar el prototipo con datos reales.');
    expect(panel.textContent?.toLowerCase()).not.toMatch(/portfolio|portafolio|cartera/);
    expect(panel).not.toHaveTextContent(/lo que puede estar en juego/i);
  });

  it('shows a non-fatal synthesis fallback without provider details', () => {
    renderPanel({
      state: 'synthesis_unavailable',
      decisionChangingUnknowns: [],
      provider: 'provider-secret',
      model: 'model-secret',
      error: 'private-error-secret',
    } as unknown as PortfolioEntryLiveUnderstanding);

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent('Tu mensaje se recibió. La aclaración puede continuar.');
    expect(panel).not.toHaveTextContent(/provider-secret|model-secret|private-error-secret/i);
    expect(panel).not.toHaveTextContent(/reintentar/i);
  });

  it('replaces the old reading with an accessible updating state while a turn is processing', () => {
    renderPanel(supportedReading(), { updating: true });

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Estamos actualizando esta lectura con tu mensaje.');
    expect(panel).not.toHaveTextContent('La capacidad compartida y el plazo del comité compiten por la atención disponible.');
  });

  it('keeps the prior reading visibly marked as being corrected and focuses the correction input', () => {
    renderPanel(supportedReading(), { correctionOpen: true });

    const input = screen.getByRole('textbox', { name: /tu corrección/i });
    expect(input).toHaveFocus();
    expect(screen.getByTestId('portfolio-entry-live-understanding-correction-reference'))
      .toHaveTextContent('Lectura que estás corrigiendo');
    expect(screen.getByText('Este texto es tuyo y se usará para corregir la lectura.')).toBeInTheDocument();
  });

  it('submits the inline correction with Enter and keeps Shift+Enter available for new lines', () => {
    const onSubmitCorrection = vi.fn();
    renderPanel(supportedReading(), { correctionOpen: true, onSubmitCorrection });

    const input = screen.getByRole('textbox', { name: /tu corrección/i });
    fireEvent.change(input, { target: { value: 'Quise decir otra cosa.' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: false });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

    expect(onSubmitCorrection).toHaveBeenCalledOnce();
  });

  it('renders only the safe presentation fields and never internal metadata', () => {
    const payload = {
      ...supportedReading(),
      selected_lenses: ['selected_lenses-secret'],
      provenance: ['provenance-secret'],
      sourceRefs: ['source-ref-secret'],
      claimRefs: ['claim-ref-secret'],
      epistemicRole: 'FACT-secret',
      reasoningMetadata: 'reasoning-secret',
      candidate_first_movement: 'candidate-first-movement-secret',
      prompt: 'prompt-secret',
      model: 'model-secret',
      provider: 'provider-secret',
      rawProviderOutput: 'raw-provider-output-secret',
    } as unknown as PortfolioEntryLiveUnderstanding;
    renderPanel(payload);

    const panel = screen.getByTestId('portfolio-entry-live-understanding');
    expect(panel).toHaveTextContent('La capacidad compartida y el plazo del comité compiten por la atención disponible.');
    expect(panel.textContent).not.toMatch(/selected_lenses-secret|provenance-secret|source-ref-secret|claim-ref-secret|FACT-secret|reasoning-secret|candidate-first-movement-secret|prompt-secret|model-secret|provider-secret|raw-provider-output-secret/);
    expect(panel.outerHTML).not.toMatch(/selected[_-]?lenses|provenance|source[_-]?refs|claim[_-]?refs|epistemic[_-]?role|reasoning[_-]?metadata|candidate[_-]?first[_-]?movement|prompt|model|provider|raw[_-]?provider[_-]?output/i);
    expect(panel.querySelector('[data-live-understanding-payload]')).toBeNull();
  });

  it('keeps the panel hidden when there is no result and no update in progress', () => {
    renderPanel(undefined);

    expect(screen.queryByTestId('portfolio-entry-live-understanding')).not.toBeInTheDocument();
  });
});
