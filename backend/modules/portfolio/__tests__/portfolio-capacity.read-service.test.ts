import { describe, expect, it, vi } from 'vitest';
import { PortfolioCapacityReadService } from '../portfolio-capacity.read-service';

const meta = (status: string, requiresExternalCapability = false) => ({ status, requiresExternalCapability });

function front(id: string, priority: string, challenges: any[]) {
  return { id, name: `Frente ${id}`, priority, challenges };
}

function challenge(id: string, metas: any[], extra: any = {}) {
  return { id, title: `Reto ${id}`, status: 'publicado', coverageStatus: 'cobertura_parcial', activationInputs: null, initiativeMetas: metas, ...extra };
}

describe('PortfolioCapacityReadService (E2E Job-Driven §4/§24, Core §17)', () => {
  it('distribuye la capacidad por frente y emite señales para decidir', async () => {
    const fronts = [
      front('f-alta', 'Alta', [challenge('c1', [])]),
      front('f-baja', 'Baja', [
        challenge('c2', [meta('en_step_1'), meta('en_step_2'), meta('en_step_3')], { coverageStatus: 'cobertura_suficiente', activationInputs: { internalCapacity: 'alta' } }),
      ]),
      front('f-media', 'Media', [challenge('c3', [meta('bloqueada'), meta('en_step_1', true)])]),
    ];
    const service = new PortfolioCapacityReadService({ strategicFront: { findMany: vi.fn().mockResolvedValue(fronts) } } as any);
    const reading = await service.get();

    expect(reading.unit).toBe('active_initiatives');
    expect(reading.totalActiveInitiatives).toBe(4);
    expect(reading.fronts.map((f) => [f.frontId, f.activeInitiatives, f.share])).toEqual([['f-alta', 0, 0], ['f-baja', 3, 0.75], ['f-media', 1, 0.25]]);
    expect(reading.fronts[1].challenges[0]).toMatchObject({ declaredInternalCapacity: 'alta' });
    expect(reading.fronts[2].challenges[0]).toMatchObject({ blockedInitiatives: 1, requiresExternalCapability: true });
    expect(reading.signals.map((s) => s.kind)).toEqual(['uncovered_priority', 'concentration', 'oversupplied', 'blocked_capacity']);
  });

  it('sin iniciativas no hay señales de concentración ni reparto', async () => {
    const service = new PortfolioCapacityReadService({ strategicFront: { findMany: vi.fn().mockResolvedValue([front('f', 'Media', [])]) } } as any);
    const reading = await service.get();
    expect(reading.totalActiveInitiatives).toBe(0);
    expect(reading.signals).toEqual([]);
  });
});
