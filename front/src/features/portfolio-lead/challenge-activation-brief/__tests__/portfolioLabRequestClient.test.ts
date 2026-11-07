import { beforeEach, describe, expect, it, vi } from 'vitest';

const { http } = vi.hoisted(() => ({ http: { get: vi.fn(), post: vi.fn() } }));

vi.mock('../../../../app/services/api', () => ({
  default: http,
  parseApiError: (error: unknown) => error,
}));

import { createPortfolioLabRequest, listPortfolioLabRequests, retryPortfolioLabNotification } from '../portfolioLabRequestClient';

describe('KAN-227 portfolioLabRequestClient', () => {
  beforeEach(() => vi.clearAllMocks());

  it('LAB-UX03 conecta GET y POST al contrato KAN-226 con la key estable del caller', async () => {
    http.get.mockResolvedValue({ data: { success: true, data: [] } });
    http.post.mockResolvedValue({ data: { success: true, data: { request: { id: 'request-1' }, idempotent: false, deduplicated: false } } });
    const body = { challengeId: 'challenge/a', briefId: 'brief/a', briefVersionId: 'version/a', consentAccepted: true as const, consentPurpose: 'Finalidad explícita para solicitar apoyo de Lab.' };

    await listPortfolioLabRequests();
    await createPortfolioLabRequest(body, 'kan227-create-stable');

    expect(http.get).toHaveBeenCalledWith('/portfolio-lab/requests');
    expect(http.post).toHaveBeenCalledWith('/portfolio-lab/requests', body, { headers: { 'Idempotency-Key': 'kan227-create-stable' } });
  });

  it('LAB-UX06 conecta el retry exacto, codifica requestId y no genera otra key', async () => {
    http.post.mockResolvedValue({ data: { success: true, data: { request: { id: 'request/a' }, idempotent: true } } });

    await retryPortfolioLabNotification('request/a', 'kan227-retry-stable');

    expect(http.post).toHaveBeenCalledWith(
      '/portfolio-lab/requests/request%2Fa/notification-retry',
      {},
      { headers: { 'Idempotency-Key': 'kan227-retry-stable' } },
    );
  });
});
