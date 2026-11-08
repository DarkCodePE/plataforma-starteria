import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPortfolioBootstrapSemanticContext,
  PortfolioBootstrapSemanticClientError,
  submitPortfolioBootstrapSemanticTurn,
  type PortfolioBootstrapSemanticSnapshot,
  type PortfolioBootstrapSemanticTurnResult,
  type SubmitPortfolioBootstrapSemanticTurnInput,
} from '../services/portfolioBootstrapSemanticClient';

export type PortfolioBootstrapSemanticStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'submitting'
  | 'processing'
  | 'error';

export const PORTFOLIO_SEMANTIC_POLL_INTERVAL_MS = 400;
export const PORTFOLIO_SEMANTIC_POLL_LIMIT = 5;
const RECONCILABLE_SEMANTIC_CONFLICTS = new Set([
  'PORTFOLIO_SEMANTIC_VERSION_CONFLICT',
  'PORTFOLIO_SEMANTIC_QUESTION_ACTIVE',
  'PORTFOLIO_SEMANTIC_QUESTION_STALE',
]);

type PendingTurn = {
  sessionId: string;
  input: SubmitPortfolioBootstrapSemanticTurnInput;
  idempotencyKey: string;
};

function operationKey(sessionId: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `portfolio-semantic-turn:${sessionId}:${suffix}`;
}

function ordered(snapshot: PortfolioBootstrapSemanticSnapshot): PortfolioBootstrapSemanticSnapshot {
  return { ...snapshot, turns: [...snapshot.turns].sort((left, right) => left.semanticVersion - right.semanticVersion) };
}

function mergeTurn(
  snapshot: PortfolioBootstrapSemanticSnapshot | null,
  result: PortfolioBootstrapSemanticTurnResult,
): PortfolioBootstrapSemanticSnapshot {
  const turns = snapshot?.turns.filter((turn) => turn.id !== result.turn.id) ?? [];
  return ordered({ enabled: snapshot?.enabled ?? true, state: result.state, turns: [...turns, result.turn] });
}

function message(error: unknown): string {
  if (error instanceof PortfolioBootstrapSemanticClientError) {
    return [error.apiError.message, error.apiError.hint].filter(Boolean).join(' ');
  }
  return error instanceof Error ? error.message : 'No pudimos completar el turno semántico.';
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function usePortfolioBootstrapSemantic(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<PortfolioBootstrapSemanticSnapshot | null>(null);
  const [status, setStatus] = useState<PortfolioBootstrapSemanticStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingInputText, setPendingInputText] = useState<string | null>(null);
  const sessionEpoch = useRef(0);
  const sessionRef = useRef(sessionId);
  const pendingTurn = useRef<PendingTurn | null>(null);
  const inFlight = useRef<Promise<PortfolioBootstrapSemanticSnapshot | null> | null>(null);
  sessionRef.current = sessionId;

  const applySnapshot = useCallback((next: PortfolioBootstrapSemanticSnapshot) => {
    const normalized = ordered(next);
    setSnapshot(normalized);
    return normalized;
  }, []);

  const load = useCallback(async (): Promise<PortfolioBootstrapSemanticSnapshot | null> => {
    const targetSession = sessionRef.current;
    if (!targetSession) {
      setSnapshot(null);
      setStatus('idle');
      setError(null);
      return null;
    }
    const epoch = sessionEpoch.current;
    setStatus('loading');
    setError(null);
    try {
      const next = await getPortfolioBootstrapSemanticContext(targetSession);
      if (epoch !== sessionEpoch.current || targetSession !== sessionRef.current) return next;
      applySnapshot(next);
      setStatus('ready');
      return next;
    } catch (caught) {
      if (epoch !== sessionEpoch.current || targetSession !== sessionRef.current) return null;
      setStatus('error');
      setError(message(caught));
      throw caught;
    }
  }, [applySnapshot]);

  useEffect(() => {
    sessionEpoch.current += 1;
    pendingTurn.current = null;
    inFlight.current = null;
    setPendingInputText(null);
    setSnapshot(null);
    setError(null);
    if (!sessionId) {
      setStatus('idle');
      return;
    }
    void load().catch(() => undefined);
  }, [load, sessionId]);

  const poll = useCallback(async (
    targetSession: string,
    turnId: string,
    epoch: number,
  ): Promise<PortfolioBootstrapSemanticSnapshot | null> => {
    for (let attempt = 0; attempt < PORTFOLIO_SEMANTIC_POLL_LIMIT; attempt += 1) {
      if (attempt > 0) await wait(PORTFOLIO_SEMANTIC_POLL_INTERVAL_MS);
      const next = await getPortfolioBootstrapSemanticContext(targetSession);
      if (epoch !== sessionEpoch.current || targetSession !== sessionRef.current) return next;
      const normalized = applySnapshot(next);
      const persisted = normalized.turns.find((turn) => turn.id === turnId);
      const stillPending = persisted?.status === 'failed_retryable' && persisted.error?.code === 'inference_pending';
      if (!persisted || stillPending) continue;
      if (persisted.status !== 'completed') {
        const failureMessage = persisted.convergence.reason
          || 'No pudimos completar la interpretación semántica.';
        if (!persisted.error?.retryable) pendingTurn.current = null;
        setPendingInputText(pendingTurn.current?.input.inputText ?? persisted.inputText);
        setStatus('error');
        setError(failureMessage);
        throw new Error(failureMessage);
      }
      if (persisted.status === 'completed') {
        pendingTurn.current = null;
        setPendingInputText(null);
        setStatus('ready');
        setError(null);
        return normalized;
      }
    }
    if (epoch === sessionEpoch.current && targetSession === sessionRef.current) {
      const pollingMessage = 'Starteria sigue procesando la respuesta. Reintenta para consultar el mismo turno sin volver a crearlo.';
      setStatus('error');
      setError(pollingMessage);
      throw new Error(pollingMessage);
    }
    return null;
  }, [applySnapshot]);

  const perform = useCallback((pending: PendingTurn): Promise<PortfolioBootstrapSemanticSnapshot | null> => {
    if (inFlight.current) return inFlight.current;
    const epoch = sessionEpoch.current;
    const operation = (async () => {
      setStatus('submitting');
      setError(null);
      setPendingInputText(pending.input.inputText);
      pendingTurn.current = pending;
      try {
        const response = await submitPortfolioBootstrapSemanticTurn(
          pending.sessionId,
          pending.input,
          pending.idempotencyKey,
        );
        if (epoch !== sessionEpoch.current || pending.sessionId !== sessionRef.current) return null;
        const merged = mergeTurn(snapshot, response.result);
        setSnapshot((current) => mergeTurn(current, response.result));
        if (response.processing) {
          setStatus('processing');
          return poll(pending.sessionId, response.result.turn.id, epoch);
        }
        if (response.result.turn.status !== 'completed') {
          const failureMessage = response.result.turn.convergence.reason
            || 'No pudimos completar la interpretación semántica.';
          pendingTurn.current = response.result.turn.error?.retryable ? pending : null;
          setPendingInputText(pending.input.inputText);
          setStatus('error');
          setError(failureMessage);
          throw new Error(failureMessage);
        }
        pendingTurn.current = null;
        setPendingInputText(null);
        setStatus('ready');
        return merged;
      } catch (caught) {
        if (epoch !== sessionEpoch.current || pending.sessionId !== sessionRef.current) return null;
        if (caught instanceof PortfolioBootstrapSemanticClientError
          && RECONCILABLE_SEMANTIC_CONFLICTS.has(caught.apiError.code)) {
          let latest: PortfolioBootstrapSemanticSnapshot;
          try {
            latest = await getPortfolioBootstrapSemanticContext(pending.sessionId);
          } catch (reconciliationError) {
            setStatus('error');
            setError(message(reconciliationError));
            throw reconciliationError;
          }
          if (epoch !== sessionEpoch.current || pending.sessionId !== sessionRef.current) return null;
          const normalized = applySnapshot(latest);
          const reconciled: PendingTurn = {
            ...pending,
            input: {
              ...pending.input,
              expectedVersion: normalized.state?.version ?? 0,
              answeredQuestionId: normalized.state?.activeQuestion?.id ?? null,
            },
          };
          pendingTurn.current = reconciled;
          setPendingInputText(reconciled.input.inputText);
          const conflictMessage = 'La conversación cambió mientras respondías. Hemos recuperado la versión actual; reintenta el mismo turno.';
          setStatus('error');
          setError(conflictMessage);
          throw new Error(conflictMessage);
        }
        setStatus('error');
        setError(message(caught));
        throw caught;
      } finally {
        if (epoch === sessionEpoch.current) inFlight.current = null;
      }
    })();
    inFlight.current = operation;
    return operation;
  }, [applySnapshot, poll, snapshot]);

  const submit = useCallback((inputText: string) => {
    if (inFlight.current) return inFlight.current;
    if (pendingTurn.current) return perform(pendingTurn.current);
    if (!sessionId) return Promise.reject(new Error('Bootstrap session unavailable'));
    const trimmed = inputText.trim();
    if (!trimmed) return Promise.reject(new Error('Escribe una respuesta antes de enviarla.'));
    const pending: PendingTurn = {
      sessionId,
      idempotencyKey: operationKey(sessionId),
      input: {
        expectedVersion: snapshot?.state?.version ?? 0,
        inputText: trimmed,
        answeredQuestionId: snapshot?.state?.activeQuestion?.id ?? null,
      },
    };
    return perform(pending);
  }, [perform, sessionId, snapshot?.state?.activeQuestion?.id, snapshot?.state?.version]);

  const retry = useCallback(() => {
    if (pendingTurn.current) return perform(pendingTurn.current);
    return load();
  }, [load, perform]);

  return { snapshot, status, error, pendingInputText, load, retry, submit };
}
