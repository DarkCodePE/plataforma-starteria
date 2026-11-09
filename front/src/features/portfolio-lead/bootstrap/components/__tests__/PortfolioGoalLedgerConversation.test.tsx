import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortfolioGoalLedgerConversation } from '../PortfolioGoalLedgerConversation';
import type { PortfolioBootstrapAnchor, PortfolioGoalQuestionPlan, PortfolioGoalTurnSnapshot } from '../../services/portfolioBootstrapClient';

const getPlan = vi.hoisted(() => vi.fn());
const getTurns = vi.hoisted(() => vi.fn());
const submit = vi.hoisted(() => vi.fn());

vi.mock('../../services/portfolioBootstrapClient', () => ({
  getPortfolioBootstrapGoalQuestionPlan: (...args: unknown[]) => getPlan(...args),
  getPortfolioBootstrapGoalTurns: (...args: unknown[]) => getTurns(...args),
  submitPortfolioBootstrapGoalTurn: (...args: unknown[]) => submit(...args),
}));

const anchor: PortfolioBootstrapAnchor = {
  id: 'anchor-1', bootstrapSessionId: 'session-1', version: 2,
  outcomeStatement: 'Resultado de negocio por definir',
  contextSummary: 'Cafetería', decisionToEnable: null,
  businessSignalStatus: 'unknown', businessSignalValue: null,
  status: 'anchor_insufficient', sourceRefs: [],
  provenanceStatus: 'raw_entry', confirmedBy: null, confirmedAt: null,
  createdAt: '2026-11-08T12:00:00.000Z', updatedAt: '2026-11-08T12:00:00.000Z',
};
const plan: PortfolioGoalQuestionPlan = {
  mode: 'deterministic_preview',
  sessionId: 'session-1', anchorVersion: 2, contextReviewVersion: 4,
  status: 'question_required', unknownFields: [], reason: 'Un resultado sin KPI inventado.',
  activeQuestion: {
    id: 'q-1', field: 'outcomeStatement',
    recap: 'Cafetería pequeña, no se ha probado desayuno a oficinas.',
    question: '¿Qué cambio quieres validar?',
    reasonToAsk: 'Es necesario concretar un resultado antes de probar.',
    resolves: ['business_outcome'], provenance: [{
      kind: 'confirmed_context', reviewId: 'review-1', reviewVersion: 4,
      fieldPath: 'situation', quote: 'Cafetería pequeña.',
    }],
  },
};
const firstTurn = {
  id: 'turn-1', sessionId: 'session-1', version: 1, actorUserId: 'actor-1',
  anchorVersion: 2, contextReviewVersion: 4,
  questionId: 'q-1', field: 'outcomeStatement',
  inputText: 'Validar pedidos a oficinas cercanas.',
  disposition: 'user_declared' as const, supersedesTurnId: null,
  evidence: [{ kind: 'user_input' as const, quote: 'Validar pedidos a oficinas cercanas.', status: 'provisional' as const }],
  createdAt: '2026-11-09T11:00:00.000Z',
};

const props = (overrides: Partial<React.ComponentProps<typeof PortfolioGoalLedgerConversation>> = {}) => ({
  anchor, canConfirm: false,
  onSave: vi.fn().mockResolvedValue(undefined),
  onConfirm: vi.fn().mockResolvedValue(undefined),
  onUseGuided: vi.fn(), ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getPlan.mockResolvedValue(plan);
  getTurns.mockResolvedValue({ version: 0, turns: [] } satisfies PortfolioGoalTurnSnapshot);
  submit.mockResolvedValue({ version: 1, turn: firstTurn });
});

describe('KAN-253 B3 user-governed E2 ledger experience', () => {
  it('rehydrates the server question and explains its reason without making writes', async () => {
    const p = props();
    render(<PortfolioGoalLedgerConversation {...p} />);
    expect(await screen.findByText('¿Qué cambio quieres validar?')).toBeVisible();
    expect(screen.getByText(/Cafetería pequeña, no se ha probado/)).toBeVisible();
    expect(screen.getByText(/Es necesario concretar un resultado antes de probar/)).toBeVisible();
    expect(getPlan).toHaveBeenCalledWith('session-1');
    expect(getTurns).toHaveBeenCalledWith('session-1');
    expect(submit).not.toHaveBeenCalled();
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it('persists a provisional answer only and requires a separate explicit human incorporation', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioGoalLedgerConversation {...props({ onSave })} />);
    await screen.findByText('¿Qué cambio quieres validar?');
    await user.type(screen.getByLabelText('Tu respuesta de Objetivo'), firstTurn.inputText);
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta provisional' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toBe('session-1');
    expect(submit.mock.calls[0][1]).toMatchObject({
      expectedVersion: 0, expectedAnchorVersion: 2, expectedContextReviewVersion: 4,
      questionId: 'q-1', inputText: firstTurn.inputText, disposition: 'user_declared',
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Incorporar al borrador' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Incorporar al borrador' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      outcomeStatement: firstTurn.inputText,
      sourceRefs: expect.objectContaining({ objectiveConversation: expect.objectContaining({
        goalLedgerAcceptedTurnIds: ['turn-1'],
      }) }),
    }));
  });

  it('previews before and after without writing, and allows canceling a correction', async () => {
    const user = userEvent.setup();
    getTurns.mockResolvedValue({ version: 1, turns: [firstTurn] });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PortfolioGoalLedgerConversation {...props({ onSave })} />);
    const preview = await screen.findByLabelText('Vista previa de cambios al objetivo');
    expect(within(preview).getByText('Resultado de negocio por definir')).toBeVisible();
    expect(within(preview).getByText('Validar pedidos a oficinas cercanas.')).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Corregir respuesta' }));
    expect(screen.getByRole('button', { name: 'Cancelar corrección' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancelar corrección' }));
    expect(screen.getByRole('button', { name: 'Incorporar al borrador' })).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('shows unknown as pending rather than overwriting the outcome', async () => {
    getTurns.mockResolvedValue({ version: 1, turns: [{
      ...firstTurn, inputText: 'No lo sé todavía.', disposition: 'unknown',
    }] });
    render(<PortfolioGoalLedgerConversation {...props()} />);
    const preview = await screen.findByLabelText('Vista previa de cambios al objetivo');
    expect(within(preview).getAllByText('Resultado de negocio por definir')).toHaveLength(2);
    expect(within(preview).getByText(/conserva explícitamente la incertidumbre/)).toBeVisible();
  });

  it('converts an unknown suggestion to a declared answer when the user edits it', async () => {
    const user = userEvent.setup();
    render(<PortfolioGoalLedgerConversation {...props()} />);
    await screen.findByText('¿Qué cambio quieres validar?');
    await user.click(screen.getByRole('button', { name: 'No lo sé todavía' }));
    const field = screen.getByLabelText('Tu respuesta de Objetivo');
    await user.clear(field);
    await user.type(field, 'Quiero probar desayunos a oficinas cercanas.');
    expect(screen.getByText(/Se guardará como tu respuesta declarada/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Guardar respuesta provisional' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][1]).toMatchObject({
      disposition: 'user_declared', inputText: 'Quiero probar desayunos a oficinas cercanas.',
    });
  });

  it('offers recovery and guided fallback for a stale pending turn without writing', async () => {
    getTurns.mockResolvedValue({ version: 1, turns: [{ ...firstTurn, anchorVersion: 1 }] });
    const onUseGuided = vi.fn();
    const onSave = vi.fn();
    render(<PortfolioGoalLedgerConversation {...props({ onUseGuided, onSave })} />);
    expect(await screen.findByText(/Una respuesta pendiente pertenece a una versión anterior/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recuperar estado actual' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Usar preparación guiada' }));
    expect(onUseGuided).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('focuses the current conversation and lets the user inspect corrected history', async () => {
    const user = userEvent.setup();
    getTurns.mockResolvedValue({ version: 2, turns: [
      firstTurn,
      { ...firstTurn, id: 'turn-2', version: 2, inputText: 'Revisar pedidos a oficinas con menos alcance.',
        supersedesTurnId: 'turn-1' },
    ] });
    render(<PortfolioGoalLedgerConversation {...props()} />);
    const history = await screen.findByRole('region', { name: 'Historial de respuestas E2' });
    expect(within(history).getByText('Revisar pedidos a oficinas con menos alcance.')).toBeVisible();
    expect(within(history).queryByText('Validar pedidos a oficinas cercanas.')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Ver historial completo' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(within(history).getByText('Validar pedidos a oficinas cercanas.')).toBeVisible();
    expect(within(history).getByText('Versión corregida · solo historial')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ver conversación actual' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Ver conversación actual' }));
    expect(within(history).queryByText('Validar pedidos a oficinas cercanas.')).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps legacy and retracted turns traceable without treating them as current answers', async () => {
    getTurns.mockResolvedValue({ version: 2, turns: [
      { ...firstTurn, disposition: 'retracted' },
      { ...firstTurn, id: 'turn-2', version: 2, inputText: 'Respuesta vigente', supersedesTurnId: 'turn-1' },
    ] });
    render(<PortfolioGoalLedgerConversation {...props()} />);
    const history = await screen.findByRole('region', { name: 'Historial de respuestas E2' });
    // The pending-review preview repeats the answer by design; assert inside the conversation only.
    expect(within(history).getByText('Respuesta vigente')).toBeVisible();
    expect(within(history).queryByText(firstTurn.inputText)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial completo' }));
    expect(within(history).getByText(firstTurn.inputText)).toBeInTheDocument();
    expect(within(history).getByText('Versión corregida · solo historial')).toBeInTheDocument();
  });

  it('opens the full objective review with current and proposed values without writing', async () => {
    const user = userEvent.setup();
    getTurns.mockResolvedValue({ version: 1, turns: [firstTurn] });
    const onSave = vi.fn();
    const onConfirm = vi.fn();
    render(<PortfolioGoalLedgerConversation {...props({ onSave, onConfirm })} />);
    await screen.findByText('Respuesta guardada, pendiente de revisión');
    const expand = screen.getByRole('button', { name: /Revisar objetivo completo/ });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await user.click(expand);
    const review = screen.getByRole('region', { name: 'Revisión completa del objetivo' });
    expect(within(review).getByText('Resultado esperado')).toBeVisible();
    expect(within(review).getByText(/Validar pedidos a oficinas cercanas/)).toBeVisible();
    expect(within(review).getByText('Decisión que queremos habilitar')).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Ocultar revisión completa/ }));
    expect(screen.queryByRole('region', { name: 'Revisión completa del objetivo' })).not.toBeInTheDocument();
  });

  it('adopts only the explicitly selected current proposal from consolidated review', async () => {
    const user = userEvent.setup();
    getTurns.mockResolvedValue({ version: 1, turns: [firstTurn] });
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onConfirm = vi.fn();
    render(<PortfolioGoalLedgerConversation {...props({ onSave, onConfirm })} />);
    await screen.findByText('Respuesta guardada, pendiente de revisión');
    await user.click(screen.getByRole('button', { name: /Revisar objetivo completo/ }));
    const review = screen.getByRole('region', { name: 'Revisión completa del objetivo' });
    expect(within(review).getByRole('button', { name: 'Incorporar este cambio' })).toBeEnabled();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(within(review).getByRole('button', { name: 'Incorporar este cambio' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: anchor.version,
      outcomeStatement: firstTurn.inputText,
    }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('lets the user correct a pending proposal from consolidated review without writing immediately', async () => {
    const user = userEvent.setup();
    getTurns.mockResolvedValue({ version: 1, turns: [firstTurn] });
    const onSave = vi.fn();
    render(<PortfolioGoalLedgerConversation {...props({ onSave })} />);
    await screen.findByText('Respuesta guardada, pendiente de revisión');
    await user.click(screen.getByRole('button', { name: /Revisar objetivo completo/ }));
    await user.click(screen.getByRole('button', { name: 'Corregir propuesta' }));
    expect(screen.getByRole('button', { name: 'Cancelar corrección' })).toBeVisible();
    expect(screen.getByLabelText('Tu respuesta de Objetivo')).toHaveValue(firstTurn.inputText);
    expect(screen.queryByRole('region', { name: 'Revisión completa del objetivo' })).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('reenters with an unincorporated turn and does not repeat the question or write', async () => {
    getTurns.mockResolvedValue({ version: 1, turns: [firstTurn] });
    render(<PortfolioGoalLedgerConversation {...props()} />);
    expect(await screen.findByText('Respuesta guardada, pendiente de revisión')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Incorporar al borrador' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Guardar respuesta provisional' })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('never re-incorporates an accepted receipt after refresh', async () => {
    getTurns.mockResolvedValue({ version: 1, turns: [firstTurn] });
    const accepted = {
      ...anchor,
      sourceRefs: { objectiveConversation: { goalLedgerAcceptedTurnIds: ['turn-1'] } },
    };
    render(<PortfolioGoalLedgerConversation {...props({ anchor: accepted })} />);
    expect(await screen.findByText('Respuesta ya incorporada')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Incorporar al borrador' })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('fails closed on an unavailable backend ledger and offers the existing guided path', async () => {
    getTurns.mockRejectedValue(new Error('El ledger E2 no está habilitado.'));
    const onUseGuided = vi.fn();
    render(<PortfolioGoalLedgerConversation {...props({ onUseGuided })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('El ledger E2 no está habilitado.');
    fireEvent.click(screen.getByRole('button', { name: 'Usar preparación guiada' }));
    expect(onUseGuided).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it('preserves legacy answers separately and does not pretend they belong to the new ledger', async () => {
    const prior = {
      ...anchor, sourceRefs: { objectiveConversation: { turns: [
        { field: 'contextSummary', value: 'Información antigua', recordedAt: '2026-11-01T00:00:00Z' },
      ] } },
    };
    render(<PortfolioGoalLedgerConversation {...props({ anchor: prior })} />);
    await screen.findByText('¿Qué cambio quieres validar?');
    const legacy = screen.getByText('Respuestas anteriores a este modo');
    fireEvent.click(legacy);
    expect(screen.getByText('Información antigua')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Historial de respuestas E2' })).queryByText('Información antigua')).not.toBeInTheDocument();
  });
});
