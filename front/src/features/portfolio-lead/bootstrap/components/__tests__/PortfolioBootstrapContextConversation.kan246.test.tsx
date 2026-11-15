import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createEmptyPortfolioBootstrapContext,
  type PortfolioBootstrapContextReview,
} from '../../services/portfolioBootstrapContextClient';
import type { PortfolioBootstrapSemanticSnapshot } from '../../services/portfolioBootstrapSemanticClient';
import { PortfolioBootstrapContextConversation } from '../PortfolioBootstrapContextConversation';

function review(overrides: Partial<PortfolioBootstrapContextReview> = {}): PortfolioBootstrapContextReview {
  const draft = createEmptyPortfolioBootstrapContext();
  return {
    id: 'review-1', sessionId: 'session-1', status: 'draft', version: 1, draft,
    confirmedSnapshot: null, effectiveContext: null, hasPendingCorrection: false,
    sourceCompanyContext: null, draftSourceCompanyContext: null, confirmedSourceCompanyContext: null,
    effectiveSourceCompanyContext: null, draftProvenance: null, confirmedProvenance: null,
    effectiveProvenance: null, sourceOutdated: false, confirmedBy: null, confirmedAt: null,
    createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T00:00:00.000Z',
    ...overrides,
  };
}

function semantic(enabled = true): PortfolioBootstrapSemanticSnapshot {
  return {
    enabled,
    state: {
      id: 'semantic-1', sessionId: 'session-1', version: 1,
      factLedger: [{
        conceptId: 'business.situation', value: 'Clientes piden desayunos para llevar.', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'clientes piden desayunos para llevar' }],
        confidence: 1, status: 'observed', turnId: 'turn-1', semanticVersion: 1,
      }],
      hypotheses: [{
        hypothesisId: 'hypothesis-1', statement: 'Podría existir demanda recurrente.', provenance: 'copilot_inferred',
        supportConceptIds: ['business.situation'], confidence: 0.5, status: 'proposed', turnId: 'turn-1', semanticVersion: 1,
      }],
      dispositions: [], answeredGaps: ['business.situation'], questionHistory: [], answeredQuestionIds: [], activeQuestion: null,
      convergence: { status: 'ready_for_human_review', reason: 'Hay claridad suficiente para revisar.', synthesis: {
        summary: 'La cafetería valora desayunos para responder a una oportunidad sin ampliar el local.',
        situation: 'Clientes piden desayunos para llevar.',
        intention: 'Validar una oportunidad de crecimiento.',
        mainUncertainty: 'No se conoce todavía la demanda recurrente.',
        directionForE2: 'Definir qué objetivo permitiría validar la oportunidad.',
        evidenceConceptIds: ['business.situation'],
      } },
      questionBudget: { limit: 3, used: 0 },
      createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T00:00:00.000Z',
    },
    turns: [],
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    operationScope: 'session-1', review: review(), status: 'ready' as const, error: null,
    onSaveDraft: vi.fn().mockResolvedValue(null), onConfirm: vi.fn().mockResolvedValue(null),
    onRetry: vi.fn().mockResolvedValue(null), onContinue: vi.fn(),
    semantic: {
      snapshot: semantic(), status: 'ready' as const, error: null, pendingInputText: null,
      submit: vi.fn().mockResolvedValue(null), retry: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

describe('PortfolioBootstrapContextConversation KAN-246 integration', () => {
  it('S4 presents a grounded landing synthesis that can be corrected and confirmed', async () => {
    const user = userEvent.setup();
    const saved = review({ version: 2 });
    const onSaveDraft = vi.fn().mockResolvedValue(saved);
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<PortfolioBootstrapContextConversation {...props({ onSaveDraft, onConfirm }) as any} />);

    const card = screen.getByRole('region', { name: 'Tu punto de partida' });
    expect(card).toHaveTextContent('La cafetería valora desayunos');
    expect(card).toHaveTextContent('No se conoce todavía la demanda recurrente');
    expect(screen.getByLabelText('Procedencia del análisis')).toHaveTextContent('Hechos con evidencia: 1');
    expect(screen.getByLabelText('Procedencia del análisis')).toHaveTextContent('Inferencias propuestas: 1');
    await user.click(screen.getByRole('button', { name: 'Corregir interpretación' }));
    const correction = screen.getByRole('textbox', { name: /Corrige la interpretación/ });
    expect(correction).toHaveFocus();
    await user.clear(correction);
    await user.type(correction, 'La persona corrige la interpretación de contexto.');
    await user.click(screen.getByRole('button', { name: 'Confirmar mi punto de partida' }));
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ situation: expect.objectContaining({ value: 'La persona corrige la interpretación de contexto.', provenance: 'user_declared' }) }),
      null,
    ));
    expect(onConfirm).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('button', { name: 'Definir mi objetivo' })).not.toBeInTheDocument();
  });

  it('S4 unlocks E2 only from the persisted effective ContextReview', async () => {
    const user = userEvent.setup();
    const effective = createEmptyPortfolioBootstrapContext();
    effective.situation = { value: 'Contexto confirmado por la persona.', provenance: 'user_declared' };
    const onContinue = vi.fn();
    render(<PortfolioBootstrapContextConversation {...props({
      review: review({ status: 'confirmed', confirmedSnapshot: effective, effectiveContext: effective }),
      onContinue,
    }) as any} />);

    await user.click(screen.getByRole('button', { name: 'Definir mi objetivo' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('allows a confirmed context to be corrected and reconfirmed with the saved CAS version', async () => {
    const user = userEvent.setup();
    const effective = createEmptyPortfolioBootstrapContext();
    effective.situation = { value: 'Contexto confirmado inicialmente.', provenance: 'user_declared' };
    const saved = review({ version: 4, status: 'draft' });
    const onSaveDraft = vi.fn().mockResolvedValue(saved);
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<PortfolioBootstrapContextConversation {...props({
      review: review({ version: 3, status: 'confirmed', confirmedSnapshot: effective, effectiveContext: effective }),
      onSaveDraft,
      onConfirm,
    }) as any} />);

    await user.click(screen.getByRole('button', { name: 'Corregir contexto confirmado' }));
    const correction = screen.getByRole('textbox', { name: /Corrige la interpretación/ });
    expect(correction).toHaveFocus();
    await user.clear(correction);
    await user.type(correction, 'Contexto corregido después de la reentrada.');
    await user.click(screen.getByRole('button', { name: 'Guardar corrección y reconfirmar' }));

    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ situation: expect.objectContaining({ value: 'Contexto corregido después de la reentrada.', provenance: 'user_declared' }) }),
      null,
    ));
    expect(onConfirm).toHaveBeenCalledWith(4);
  });

  it('S3 keeps the KAN-241 guided sequence exclusively as the flag-OFF fallback', () => {
    render(<PortfolioBootstrapContextConversation {...props({
      semantic: { snapshot: semantic(false), status: 'ready', error: null, pendingInputText: null, submit: vi.fn(), retry: vi.fn() },
    }) as any} />);

    expect(screen.getByText('Cuéntame qué está ocurriendo')).toBeVisible();
    expect(screen.queryByTestId('portfolio-semantic-conversation')).not.toBeInTheDocument();
  });
});
