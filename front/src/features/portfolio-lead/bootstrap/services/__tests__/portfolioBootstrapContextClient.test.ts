import { beforeEach, describe, expect, it, vi } from 'vitest';

const { http } = vi.hoisted(() => ({
  http: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../../../app/services/api', () => ({
  default: http,
  parseApiError: (error: unknown) => ({
    code: (error as { code?: string })?.code ?? 'NETWORK_ERROR',
    message: error instanceof Error ? error.message : 'Error de red',
  }),
}));

import {
  confirmPortfolioBootstrapContext,
  getPortfolioBootstrapContext,
  savePortfolioBootstrapContextDraft,
  type PortfolioBootstrapContextPayload,
} from '../portfolioBootstrapContextClient';

const context: PortfolioBootstrapContextPayload = {
  situation: { value: 'Necesitamos reducir el abandono.', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
  area: { value: 'Operaciones', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
  stakeholder: { value: null, provenance: 'unknown' },
  pilotExperience: { value: null, provenance: 'unknown' },
  constraints: [],
  assumptions: [],
  gaps: ['Falta confirmar la señal de negocio.'],
};

describe('portfolioBootstrapContextClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CA03 reads the E1 review from the exact session endpoint', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: null } });

    await expect(getPortfolioBootstrapContext('session/a')).resolves.toBeNull();

    expect(http.get).toHaveBeenCalledWith('/portfolio-bootstrap/sessions/session%2Fa/context');
  });

  it('CA03 saves a draft with expectedVersion and the caller stable Idempotency-Key', async () => {
    const review = { id: 'review-1', sessionId: 'session-1', version: 1, status: 'draft', draft: context };
    http.put.mockResolvedValue({ data: { success: true, data: review } });

    await savePortfolioBootstrapContextDraft('session-1', {
      expectedVersion: 0,
      context,
      sourceCompanyContext: null,
    }, 'kan222-draft-stable');
    await savePortfolioBootstrapContextDraft('session-1', {
      expectedVersion: 0,
      context,
      sourceCompanyContext: null,
    }, 'kan222-draft-stable');

    expect(http.put).toHaveBeenNthCalledWith(1,
      '/portfolio-bootstrap/sessions/session-1/context/draft',
      { expectedVersion: 0, context, sourceCompanyContext: null },
      { headers: { 'Idempotency-Key': 'kan222-draft-stable' } },
    );
    expect(http.put.mock.calls[1]?.[2]).toEqual({ headers: { 'Idempotency-Key': 'kan222-draft-stable' } });
  });

  it('CA03 confirms the current version without sending or replacing a snapshot', async () => {
    const review = { id: 'review-1', sessionId: 'session-1', version: 2, status: 'confirmed', draft: context };
    http.post.mockResolvedValue({ data: { success: true, data: review } });

    await confirmPortfolioBootstrapContext('session-1', 1, 'kan222-confirm-stable');

    expect(http.post).toHaveBeenCalledWith(
      '/portfolio-bootstrap/sessions/session-1/context/confirm',
      { expectedVersion: 1 },
      { headers: { 'Idempotency-Key': 'kan222-confirm-stable' } },
    );
  });
});
