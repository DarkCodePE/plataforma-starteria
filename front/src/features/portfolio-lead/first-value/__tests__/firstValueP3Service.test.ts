import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../app/services/api';
import { analyzeFirstValueP3 } from '../firstValueP3Service';

vi.mock('../../../../app/services/api', () => ({ default: { post: vi.fn() } }));

describe('First Value P3 frontend integration boundary', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  it('invoca el endpoint dedicado por el cliente autenticado y devuelve su resultado provisional sin adaptarlo', async () => {
    const result = { sessionId: 'session', requestId: 'request', analysisId: 'analysis', resultState: 'PROVISIONAL' };
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: result } });
    const payload = {
      sessionId: 'session', requestId: 'request', p2Confirmed: true as const,
      goal: 'Aumentar ventas B2B', context: 'Q4',
      initiatives: [{ itemId: 'item-1', name: 'Pricing Pilot', description: 'Corrección confirmada' }],
      clarifications: [{ id: 'question-1', affectedItemIds: ['item-1'], answer: 'Apoya adquisición.' }],
    };

    await expect(analyzeFirstValueP3(payload)).resolves.toEqual(result);
    expect(api.post).toHaveBeenCalledWith('/first-value/p3/analyze', payload);
  });
});
