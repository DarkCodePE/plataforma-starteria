import { describe, expect, it, vi } from 'vitest';
import { ChallengeCoverageReadService } from '../challenge-coverage.read-service';

function service(challenge: any) {
  return new ChallengeCoverageReadService({ challenge: { findUnique: vi.fn().mockResolvedValue(challenge) } } as any);
}

function meta(overrides: any = {}) {
  return {
    projectId: 'p1',
    project: { id: 'p1', name: 'Iniciativa 1' },
    status: 'en_step_2',
    currentStep: 'Step 2',
    readyForDecision: false,
    estimatedContribution: 'medio',
    mainBlocker: null,
    partialSignal: false,
    requiresExternalCapability: false,
    executiveSummary: null,
    ...overrides,
  };
}

function challenge(overrides: any = {}) {
  return {
    id: 'c1',
    title: 'Reducir abandono en onboarding',
    whatWeWantToMove: 'Bajar el abandono del 40% al 25%',
    coverageStatus: 'cobertura_parcial',
    dependencies: null,
    activationInputs: null,
    initiativeMetas: [],
    overlaps: [],
    ...overrides,
  };
}

describe('ChallengeCoverageReadService (§13)', () => {
  it('sin trabajo: nada cubierto, falta capacidad y no está listo para decidir', async () => {
    const reading = await service(challenge()).get('c1');
    expect(reading.hasWork).toBe(false);
    expect(reading.uncovered).toBe('Bajar el abandono del 40% al 25%');
    expect(reading.needsMoreCapacity).toEqual({ value: true, reasons: ['Ninguna iniciativa está abordando este reto.'] });
    expect(reading.readyToDecide.value).toBe(false);
  });

  it('lee el conjunto: evidencia agregada, solapamientos, dependencia común y decisión', async () => {
    const reading = await service(
      challenge({
        dependencies: 'Integración CRM',
        initiativeMetas: [
          meta({ projectId: 'p1', estimatedContribution: 'alto', readyForDecision: true, mainBlocker: 'Acceso a datos', executiveSummary: 'Escalar' }),
          meta({ projectId: 'p2', project: { id: 'p2', name: 'Iniciativa 2' }, partialSignal: true, mainBlocker: 'acceso a datos ' }),
          meta({ projectId: 'p3', project: { id: 'p3', name: 'Iniciativa 3' }, status: 'bloqueada', requiresExternalCapability: true }),
        ],
        overlaps: [{ initiativeAId: 'p1', initiativeBId: 'p2', level: 'alto', recommendation: 'fusionar' }],
      }),
    ).get('c1');

    expect(reading.hasWork).toBe(true);
    expect(reading.initiatives).toHaveLength(3);
    expect(reading.aggregateEvidence).toEqual({ contributionByLevel: { bajo: 0, medio: 2, alto: 1 }, partialSignals: 1, withRecommendation: 1 });
    expect(reading.overlaps).toEqual([{ initiativeAId: 'p1', initiativeBId: 'p2', level: 'alto', recommendation: 'fusionar' }]);
    expect(reading.commonDependencies).toEqual(['Integración CRM', 'Acceso a datos']);
    expect(reading.needsMoreCapacity.reasons).toContain('Hay iniciativas que requieren capacidad externa.');
    expect(reading.readyToDecide).toEqual({ value: true, reasons: ['1 iniciativa(s) lista(s) para decisión.'] });
    expect(reading.uncovered).toBeNull();
  });

  it('404 si el reto no existe', async () => {
    await expect(service(null).get('nope')).rejects.toMatchObject({ code: 'CHALLENGE_NOT_FOUND' });
  });
});
