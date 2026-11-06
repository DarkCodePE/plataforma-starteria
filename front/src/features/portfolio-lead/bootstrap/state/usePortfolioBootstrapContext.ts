import { useCallback, useEffect, useRef, useState } from 'react';
import {
  confirmPortfolioBootstrapContext,
  getPortfolioBootstrapContext,
  PortfolioBootstrapContextClientError,
  savePortfolioBootstrapContextDraft,
  type PortfolioBootstrapCompanyContextSource,
  type PortfolioBootstrapContextPayload,
  type PortfolioBootstrapContextReview,
} from '../services/portfolioBootstrapContextClient';

export type PortfolioBootstrapContextStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'confirming' | 'error';

function operationKey(kind: 'draft' | 'confirm', sessionId: string): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `portfolio-context-${kind}:${sessionId}:${suffix}`;
}

function errorMessage(error: unknown): string {
  return error instanceof PortfolioBootstrapContextClientError
    ? error.apiError.message
    : error instanceof Error
      ? error.message
      : 'No pudimos completar la operación de contexto.';
}

export function usePortfolioBootstrapContext(sessionId: string | null) {
  const [review, setReview] = useState<PortfolioBootstrapContextReview | null>(null);
  const [status, setStatus] = useState<PortfolioBootstrapContextStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pendingOperation = useRef<(() => Promise<PortfolioBootstrapContextReview | null>) | null>(null);
  const sessionEpoch = useRef(0);

  const complete = useCallback(async (
    operation: () => Promise<PortfolioBootstrapContextReview | null>,
    activeStatus: Extract<PortfolioBootstrapContextStatus, 'loading' | 'saving' | 'confirming'>,
    keepForRetry: boolean,
  ) => {
    const operationEpoch = sessionEpoch.current;
    setStatus(activeStatus);
    setError(null);
    try {
      const result = await operation();
      if (operationEpoch !== sessionEpoch.current) return result;
      setReview(result);
      setStatus('ready');
      pendingOperation.current = null;
      return result;
    } catch (caught) {
      if (operationEpoch !== sessionEpoch.current) throw caught;
      if (keepForRetry) pendingOperation.current = () => complete(operation, activeStatus, true);
      setStatus('error');
      setError(errorMessage(caught));
      throw caught;
    }
  }, []);

  const load = useCallback(async () => {
    if (!sessionId) {
      setReview(null);
      setStatus('idle');
      setError(null);
      pendingOperation.current = null;
      return null;
    }
    return complete(() => getPortfolioBootstrapContext(sessionId), 'loading', false);
  }, [complete, sessionId]);

  useEffect(() => {
    sessionEpoch.current += 1;
    pendingOperation.current = null;
    void load().catch(() => undefined);
  }, [load]);

  const saveDraft = useCallback(async (
    context: PortfolioBootstrapContextPayload,
    sourceCompanyContext: PortfolioBootstrapCompanyContextSource | null = review?.draftSourceCompanyContext ?? null,
  ) => {
    if (!sessionId) throw new Error('Bootstrap session unavailable');
    const expectedVersion = review?.version ?? 0;
    const idempotencyKey = operationKey('draft', sessionId);
    const operation = () => savePortfolioBootstrapContextDraft(sessionId, {
      expectedVersion,
      context,
      sourceCompanyContext,
    }, idempotencyKey);
    pendingOperation.current = () => complete(operation, 'saving', true);
    return complete(operation, 'saving', true);
  }, [complete, review?.draftSourceCompanyContext, review?.version, sessionId]);

  const confirm = useCallback(async () => {
    if (!sessionId) throw new Error('Bootstrap session unavailable');
    if (!review) throw new Error('Guarda primero una síntesis de contexto.');
    const expectedVersion = review.version;
    const idempotencyKey = operationKey('confirm', sessionId);
    const operation = () => confirmPortfolioBootstrapContext(sessionId, expectedVersion, idempotencyKey);
    pendingOperation.current = () => complete(operation, 'confirming', true);
    return complete(operation, 'confirming', true);
  }, [complete, review, sessionId]);

  const retry = useCallback(async () => {
    if (pendingOperation.current) return pendingOperation.current();
    return load();
  }, [load]);

  return { review, status, error, load, retry, saveDraft, confirm };
}
