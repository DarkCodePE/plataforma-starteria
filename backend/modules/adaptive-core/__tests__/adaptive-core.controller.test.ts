import { describe, expect, it, vi } from 'vitest';
import { AdaptiveCoreController } from '../adaptive-core.controller';

describe('AdaptiveCoreController read boundary', () => {
  it('GET reads existing state and never initializes it', async () => {
    const state = { projectId: 'project-1' };
    const service = {
      getState: vi.fn().mockResolvedValue(state),
      ensureInitialized: vi.fn(),
    };
    const controller = new AdaptiveCoreController(service as any);
    const res = { json: vi.fn() };
    const next = vi.fn();

    await controller.get({
      params: { id: 'project-1' },
      user: { id: 'owner-1', role: 'participante' },
    } as any, res as any, next);

    expect(service.getState).toHaveBeenCalledWith('project-1', 'owner-1', 'participante');
    expect(service.ensureInitialized).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: state });
    expect(next).not.toHaveBeenCalled();
  });
});
