import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSemantic, submitTurn, keys } = vi.hoisted(() => ({
  getSemantic: vi.fn(),
  submitTurn: vi.fn(),
  keys: ['semantic-key-1', 'semantic-key-2'],
}));

vi.mock('../../services/portfolioBootstrapSemanticClient', async () => {
  const actual = await vi.importActual<typeof import('../../services/portfolioBootstrapSemanticClient')>(
    '../../services/portfolioBootstrapSemanticClient',
  );
  return {
    ...actual,
    getPortfolioBootstrapSemanticContext: getSemantic,
    submitPortfolioBootstrapSemanticTurn: submitTurn,
  };
});

import { usePortfolioBootstrapSemantic } from '../usePortfolioBootstrapSemantic';

function state(version: number, activeQuestion: { id: string; recap: string; question: string; reasonToAsk: string; resolves: string[] } | null = null) {
  return {
    id: `state-${version}`,
    sessionId: 'session-1',
    version,
    factLedger: [], hypotheses: [], dispositions: [], answeredGaps: [], questionHistory: [], answeredQuestionIds: [],
    activeQuestion,
    convergence: { status: activeQuestion ? 'question_required' : 'ready_for_human_review', reason: 'test' },
    questionBudget: { limit: 3, used: activeQuestion ? 1 : 0 },
    createdAt: '2026-11-08T00:00:00.000Z', updatedAt: '2026-11-08T00:00:00.000Z',
  } as const;
}

function turn(id: string, semanticVersion: number, status: 'completed' | 'failed_retryable' = 'completed') {
  return {
    id, semanticVersion, organizationId: null, actorUserId: 'user-1', inputText: `turn ${semanticVersion}`,
    status, attempt: 1, attempts: [], facts: [], hypotheses: [], dispositions: [], answeredGaps: [],
    answeredQuestionId: null, emittedQuestion: null,
    convergence: { status: status === 'completed' ? 'ready_for_human_review' : 'provider_retryable_failure', reason: 'test' },
    questionBudget: { limit: 3, used: 0 },
    error: status === 'completed' ? null : { code: 'inference_pending', retryable: true },
    execution: { provider: null, model: null, durationMs: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, retryCount: 0, fallbackUsed: false },
    createdAt: '2026-11-08T00:00:00.000Z',
  } as const;
}

describe('usePortfolioBootstrapSemantic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let keyIndex = 0;
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => keys[keyIndex++] ?? `semantic-key-${keyIndex}`) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('KAN-246 S2 rehydrates and sorts the transcript by semanticVersion', async () => {
    getSemantic.mockResolvedValue({ enabled: true, state: state(2), turns: [turn('second', 2), turn('first', 1)] });
    const { result } = renderHook(() => usePortfolioBootstrapSemantic('session-1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.snapshot?.turns.map((item) => item.id)).toEqual(['first', 'second']);
  });

  it('KAN-246 S2 ignores an obsolete response after the session changes', async () => {
    let resolveOld!: (value: unknown) => void;
    getSemantic
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ enabled: true, state: { ...state(1), sessionId: 'session-2' }, turns: [turn('new', 1)] });
    const { result, rerender } = renderHook(({ sessionId }) => usePortfolioBootstrapSemantic(sessionId), {
      initialProps: { sessionId: 'session-1' as string | null },
    });

    rerender({ sessionId: 'session-2' });
    await waitFor(() => expect(result.current.snapshot?.state?.sessionId).toBe('session-2'));
    await act(async () => resolveOld({ enabled: true, state: state(9), turns: [turn('old', 9)] }));

    expect(result.current.snapshot?.turns.map((item) => item.id)).toEqual(['new']);
  });

  it('KAN-246 S2 retries a failed turn with the same key and preserves the input', async () => {
    const question = { id: 'question-1', recap: 'Entiendo el punto de partida.', question: '¿Qué cambiaría primero?', reasonToAsk: 'Para enfocar E2.', resolves: ['opportunity'] };
    getSemantic.mockResolvedValue({ enabled: true, state: state(1, question), turns: [] });
    submitTurn
      .mockRejectedValueOnce(new Error('Proveedor temporalmente no disponible'))
      .mockResolvedValueOnce({ processing: false, result: { state: state(2), turn: turn('done', 2) } });
    const { result } = renderHook(() => usePortfolioBootstrapSemantic('session-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => { await result.current.submit('No lo sabemos todavía').catch(() => undefined); });
    expect(result.current.pendingInputText).toBe('No lo sabemos todavía');
    await act(async () => { await result.current.retry(); });

    expect(submitTurn).toHaveBeenCalledTimes(2);
    expect(submitTurn.mock.calls[0]?.[2]).toBe(submitTurn.mock.calls[1]?.[2]);
    expect(submitTurn.mock.calls[1]?.[1]).toMatchObject({ expectedVersion: 1, answeredQuestionId: 'question-1' });
  });

  it('KAN-246 S2 polls a 202 response within the configured limit and settles from persisted state', async () => {
    vi.useFakeTimers();
    getSemantic
      .mockResolvedValueOnce({ enabled: true, state: state(0), turns: [] })
      .mockResolvedValueOnce({ enabled: true, state: state(1), turns: [turn('pending', 1, 'failed_retryable')] })
      .mockResolvedValueOnce({ enabled: true, state: state(1), turns: [turn('pending', 1, 'completed')] });
    submitTurn.mockResolvedValue({ processing: true, result: { state: state(1), turn: turn('pending', 1, 'failed_retryable') } });
    const { result } = renderHook(() => usePortfolioBootstrapSemantic('session-1'));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.status).toBe('ready');

    let operation!: Promise<unknown>;
    act(() => { operation = result.current.submit('Una respuesta'); });
    await act(async () => { await vi.runAllTimersAsync(); });
    await act(async () => { await operation; });

    expect(getSemantic).toHaveBeenCalledTimes(3);
    expect(result.current.snapshot?.turns[0]?.status).toBe('completed');
    expect(result.current.status).toBe('ready');
  });

  it('KAN-246 S2 collapses a double click into one logical POST', async () => {
    getSemantic.mockResolvedValue({ enabled: true, state: state(0), turns: [] });
    let resolveSubmit!: (value: unknown) => void;
    submitTurn.mockReturnValue(new Promise((resolve) => { resolveSubmit = resolve; }));
    const { result } = renderHook(() => usePortfolioBootstrapSemantic('session-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    act(() => {
      first = result.current.submit('Respuesta única');
      second = result.current.submit('Respuesta única');
    });
    expect(submitTurn).toHaveBeenCalledTimes(1);
    await act(async () => resolveSubmit({ processing: false, result: { state: state(1), turn: turn('one', 1) } }));
    await act(async () => { await Promise.all([first, second]); });
  });
});
