import { beforeEach, describe, expect, it, vi } from 'vitest';

const { http, parseApiError } = vi.hoisted(() => ({
  http: { get: vi.fn(), post: vi.fn() },
  parseApiError: vi.fn((error: unknown) => ({
    code: (error as { apiCode?: string })?.apiCode ?? 'NETWORK_ERROR',
    message: error instanceof Error ? error.message : 'Error de red',
  })),
}));

vi.mock('../../../../../app/services/api', () => ({
  default: http,
  parseApiError,
}));

import {
  PORTFOLIO_SEMANTIC_REQUEST_TIMEOUT_MS,
  PortfolioBootstrapSemanticClientError,
  getPortfolioBootstrapSemanticContext,
  submitPortfolioBootstrapSemanticTurn,
} from '../portfolioBootstrapSemanticClient';

const emptySnapshot = {
  enabled: true,
  state: null,
  turns: [],
};

describe('portfolioBootstrapSemanticClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('KAN-246 S1 reads the semantic state from the exact encoded session endpoint', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: emptySnapshot } });

    await expect(getPortfolioBootstrapSemanticContext('session/a')).resolves.toEqual(emptySnapshot);

    expect(http.get).toHaveBeenCalledWith(
      '/portfolio-bootstrap/sessions/session%2Fa/context/semantic',
      { timeout: PORTFOLIO_SEMANTIC_REQUEST_TIMEOUT_MS },
    );
  });

  it.each([200, 202])('KAN-246 S1 posts version, active question and a stable key for HTTP %s', async (status) => {
    const result = { state: { version: 4 }, turn: { id: 'turn-4' } };
    http.post.mockResolvedValue({ status, data: { success: true, data: result } });

    await expect(submitPortfolioBootstrapSemanticTurn('session-1', {
      expectedVersion: 3,
      inputText: 'Nunca hemos probado pedidos a oficinas.',
      answeredQuestionId: 'question-3',
    }, 'kan246-turn-stable')).resolves.toEqual({ processing: status === 202, result });

    expect(http.post).toHaveBeenCalledWith(
      '/portfolio-bootstrap/sessions/session-1/context/semantic/turns',
      {
        expectedVersion: 3,
        inputText: 'Nunca hemos probado pedidos a oficinas.',
        answeredQuestionId: 'question-3',
      },
      {
        headers: { 'Idempotency-Key': 'kan246-turn-stable' },
        timeout: PORTFOLIO_SEMANTIC_REQUEST_TIMEOUT_MS,
      },
    );
  });

  it.each([
    ['PORTFOLIO_SEMANTIC_VERSION_CONFLICT', 409],
    ['PORTFOLIO_SEMANTIC_DISABLED', 503],
  ])('KAN-246 S1 preserves typed API error %s from HTTP %s', async (apiCode) => {
    http.post.mockRejectedValue(Object.assign(new Error('Operación no disponible.'), { apiCode }));

    await expect(submitPortfolioBootstrapSemanticTurn('session-1', {
      expectedVersion: 1,
      inputText: 'Respuesta',
      answeredQuestionId: null,
    }, 'kan246-error-key')).rejects.toMatchObject({
      name: 'PortfolioBootstrapSemanticClientError',
      apiError: { code: apiCode },
    });
  });

  it('KAN-246 S1 maps timeout without losing retry ownership or its idempotency key', async () => {
    http.post.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));

    const error = await submitPortfolioBootstrapSemanticTurn('session-1', {
      expectedVersion: 1,
      inputText: 'Respuesta conservada',
      answeredQuestionId: null,
    }, 'kan246-timeout-key').catch((caught) => caught);

    expect(error).toBeInstanceOf(PortfolioBootstrapSemanticClientError);
    expect(error.apiError).toMatchObject({
      code: 'REQUEST_TIMEOUT',
      message: 'La interpretación está tardando más de lo previsto.',
    });
    expect(http.post.mock.calls[0]?.[2]?.headers).toEqual({ 'Idempotency-Key': 'kan246-timeout-key' });
  });
});
