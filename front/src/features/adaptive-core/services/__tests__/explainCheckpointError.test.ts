// Swarm de roles (2026-10-10): dos miembros editaban el mismo checkpoint; al segundo le llegaba un
// 409 CHECKPOINT_NOT_ACTIVE crudo y se quedaba con un checkpoint que ya no existía.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
let apiDown = false;
vi.mock('../../../../app/services/api', () => ({
  default: { get: (...args: unknown[]) => (apiDown ? Promise.reject(new Error('down')) : get(...args)) },
}));

import { CHECKPOINT_TAKEN_MESSAGE, explainCheckpointError } from '../adaptiveCoreService';

const httpError = (code: string, message: string) => ({ response: { data: { error: { code, message } } } });

describe('explainCheckpointError', () => {
  beforeEach(() => {
    get.mockReset();
    apiDown = false;
  });

  it('si otro miembro ya lo confirmó, lo explica y trae el estado vigente', async () => {
    get.mockResolvedValue({ data: { data: { activeCheckpoint: { checkpointKey: 'CP-0.3' } } } });
    const result = await explainCheckpointError('p1', httpError('CHECKPOINT_NOT_ACTIVE', 'El checkpoint no esta activo'), 'fallback');
    expect(result.message).toBe(CHECKPOINT_TAKEN_MESSAGE);
    expect(result.core).toMatchObject({ activeCheckpoint: { checkpointKey: 'CP-0.3' } });
  });

  it('si no puede recargar, igual explica el conflicto', async () => {
    apiDown = true;
    const result = await explainCheckpointError('p1', httpError('CHECKPOINT_NOT_ACTIVE', 'x'), 'fallback');
    expect(result).toEqual({ message: CHECKPOINT_TAKEN_MESSAGE, core: null });
  });

  it('otros errores conservan el mensaje del servidor y no recargan', async () => {
    const result = await explainCheckpointError('p1', httpError('PROJECT_TEAM_ROLE_REQUIRED', 'Tu rol en el equipo es de sólo lectura.'), 'fallback');
    expect(result).toEqual({ message: 'Tu rol en el equipo es de sólo lectura.', core: null });
    expect(get).not.toHaveBeenCalled();
  });

  it('sin mensaje usa el de respaldo', async () => {
    expect((await explainCheckpointError('p1', {}, 'fallback')).message).toBe('fallback');
  });
});
