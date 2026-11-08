import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PortfolioBootstrapSemanticSnapshot } from '../../services/portfolioBootstrapSemanticClient';
import { PortfolioBootstrapSemanticConversation } from '../PortfolioBootstrapSemanticConversation';

function snapshot(): PortfolioBootstrapSemanticSnapshot {
  const question = {
    id: 'question-opportunity',
    recap: 'Entiendo que sois una cafetería pequeña y nunca habéis probado pedidos a oficinas.',
    question: '¿Qué situación concreta os gustaría mejorar primero?',
    reasonToAsk: 'Me ayuda a preparar el objetivo sin asumir áreas ni métricas.',
    resolves: ['opportunity'],
  };
  return {
    enabled: true,
    state: {
      id: 'state-2', sessionId: 'session-1', version: 2,
      factLedger: [{
        conceptId: 'pilot_experience', value: 'none', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'nunca hemos probado pedidos a oficinas' }],
        confidence: 1, status: 'observed', turnId: 'turn-1', semanticVersion: 1,
      }],
      hypotheses: [],
      dispositions: [{
        conceptId: 'formal_area', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'no lo sé' }], turnId: 'turn-2', semanticVersion: 2,
      }],
      answeredGaps: ['pilot_experience'], questionHistory: [{ ...question, turnId: 'turn-2', semanticVersion: 2 }],
      answeredQuestionIds: ['question-pilot'], activeQuestion: question,
      convergence: { status: 'question_required', reason: 'Falta concretar la oportunidad.' },
      questionBudget: { limit: 3, used: 1 },
      createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T00:00:00.000Z',
    },
    turns: [
      {
        id: 'turn-1', semanticVersion: 1, organizationId: null, actorUserId: 'user-1',
        inputText: 'Somos una cafetería y nunca hemos probado pedidos a oficinas.', status: 'completed',
        attempt: 1, attempts: [], facts: [], hypotheses: [], dispositions: [], answeredGaps: ['pilot_experience'],
        answeredQuestionId: null, emittedQuestion: null,
        convergence: { status: 'ready_for_human_review', reason: 'Narrativa recibida.' },
        questionBudget: { limit: 3, used: 0 }, error: null,
        execution: { provider: 'fake', model: 'fixture', durationMs: 4, inputTokens: 10, outputTokens: 5, totalTokens: 15, retryCount: 0, fallbackUsed: false },
        createdAt: '2026-11-08T00:00:00.000Z',
      },
      {
        id: 'turn-2', semanticVersion: 2, organizationId: null, actorUserId: 'user-1',
        inputText: 'No lo sé todavía.', status: 'completed', attempt: 1, attempts: [], facts: [], hypotheses: [],
        dispositions: [{ conceptId: 'formal_area', disposition: 'unknown', provenance: 'user_declared', evidenceRefs: [{ kind: 'user_input', quote: 'No lo sé todavía.' }] }],
        answeredGaps: [], answeredQuestionId: 'question-pilot', emittedQuestion: question,
        convergence: { status: 'question_required', reason: 'Falta concretar la oportunidad.' },
        questionBudget: { limit: 3, used: 1 }, error: null,
        execution: { provider: 'fake', model: 'fixture', durationMs: 4, inputTokens: 8, outputTokens: 5, totalTokens: 13, retryCount: 0, fallbackUsed: false },
        createdAt: '2026-11-08T00:01:00.000Z',
      },
    ],
  };
}

function props(overrides: Partial<React.ComponentProps<typeof PortfolioBootstrapSemanticConversation>> = {}) {
  return {
    snapshot: snapshot(),
    status: 'ready' as const,
    error: null,
    pendingInputText: null,
    onSubmit: vi.fn().mockResolvedValue(null),
    onRetry: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('PortfolioBootstrapSemanticConversation', () => {
  it('KAN-246 S3 shows one backend-driven question with recap, reason and readable history', () => {
    render(<PortfolioBootstrapSemanticConversation {...props()} />);

    expect(screen.getAllByText('¿Qué situación concreta os gustaría mejorar primero?')).toHaveLength(1);
    expect(screen.getByText(/Entiendo que sois una cafetería pequeña/)).toBeVisible();
    expect(screen.getByText(/Me ayuda a preparar el objetivo/)).toBeVisible();
    expect(screen.getByText('Somos una cafetería y nunca hemos probado pedidos a oficinas.')).toBeVisible();
    expect(screen.getAllByText('Fuente: declarado por la persona').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/Área o proceso/i)).not.toBeInTheDocument();
  });

  it('KAN-246 S3 submits free narrative and never turns unknown into a fact', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<PortfolioBootstrapSemanticConversation {...props({ onSubmit })} />);

    expect(screen.getByText('Todavía no conocido: formal area')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Hechos observados' })).not.toHaveTextContent('formal area');
    await user.type(screen.getByLabelText('Tu respuesta'), 'Queremos validar demanda sin ampliar el local.');
    await user.click(screen.getByRole('button', { name: 'Enviar respuesta' }));

    expect(onSubmit).toHaveBeenCalledWith('Queremos validar demanda sin ampliar el local.');
  });

  it('KAN-246 S3 exposes processing and error states without losing the input', async () => {
    const { rerender } = render(<PortfolioBootstrapSemanticConversation {...props({
      status: 'processing', pendingInputText: 'Respuesta conservada',
    })} />);

    expect(screen.getByRole('status')).toHaveTextContent('procesando');
    expect(screen.getByLabelText('Tu respuesta')).toHaveValue('Respuesta conservada');
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled();

    rerender(<PortfolioBootstrapSemanticConversation {...props({
      status: 'error', error: 'El proveedor no está disponible.', pendingInputText: 'Respuesta conservada',
    })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('El proveedor no está disponible.');
    expect(screen.getByRole('button', { name: 'Reintentar el mismo turno' })).toBeEnabled();
  });

  it('KAN-246 S3 guards empty and oversized input at the interaction boundary', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(<PortfolioBootstrapSemanticConversation {...props({ onSubmit })} />);

    const input = screen.getByLabelText('Tu respuesta');
    expect(input).toHaveAttribute('maxLength', '20000');
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled();
    await user.type(input, '   ');
    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
