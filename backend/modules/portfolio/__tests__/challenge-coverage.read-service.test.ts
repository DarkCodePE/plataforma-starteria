import { describe, expect, it, vi } from 'vitest';
import { ChallengeCoverageReadService, deriveChallengeCoverage } from '../challenge-coverage.read-service';

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

describe('cobertura efectiva: el mismo criterio que la tarjeta del reto', () => {
  it('con iniciativas en curso y sin_cobertura persistido devuelve cobertura_parcial', async () => {
    const reading = await service(
      challenge({ coverageStatus: 'sin_cobertura', initiativeMetas: [meta({ status: 'en_step_0', currentStep: 'Step 0' })] }),
    ).get('c1');
    expect(reading.hasWork).toBe(true);
    expect(reading.uncovered).toBeNull();
    expect(reading.coverageStatus).toBe('cobertura_parcial');
  });

  it('sin iniciativas es sin_cobertura aunque lo persistido diga otra cosa', async () => {
    const reading = await service(challenge({ coverageStatus: 'cobertura_parcial' })).get('c1');
    expect(reading.coverageStatus).toBe('sin_cobertura');
  });

  it('deriveChallengeCoverage: suficiente, bloqueo, no baja lo persistido y respeta decisiones', () => {
    expect(deriveChallengeCoverage('sin_cobertura', [{ status: 'lista_para_decision', readyForDecision: true, resolvedCorePart: true }])).toBe('cobertura_suficiente');
    expect(deriveChallengeCoverage('sin_cobertura', [{ status: 'bloqueada', resolvedCorePart: true }])).toBe('cobertura_parcial');
    expect(deriveChallengeCoverage('cobertura_suficiente', [{ status: 'en_step_1' }])).toBe('cobertura_suficiente');
    expect(deriveChallengeCoverage('reformular', [{ status: 'en_step_1' }])).toBe('reformular');
    expect(deriveChallengeCoverage('resuelto', [])).toBe('resuelto');
  });
});
