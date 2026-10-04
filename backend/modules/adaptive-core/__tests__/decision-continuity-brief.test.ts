/**
 * E2E Job-Driven Ola 2 (G5): rutas de continuidad del Core §25–§26 y Decision Brief §21.
 * Ejercita los builders puros de AdaptiveCoreService; no toca la base.
 */
import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';

const service = new AdaptiveCoreService({} as any) as any;

describe('rutas de continuidad (Core §26, E2E §22)', () => {
  it.each([
    ['pivot', 'pivoted'],
    ['seek_capability', 'seeking_capability'],
    ['seek_external_capability_or_partner', 'seeking_capability'],
    ['benefit_tracking', 'benefit_tracking'],
    ['iterate', 'new_iteration_required'],
    ['scale_pilot', 'scaled'],
    ['algo_desconocido', 'closed_with_learning'],
  ])('%s → %s', (decision, finalState) => {
    expect(service.normalizeFinalState(decision)).toBe(finalState);
  });

  it('pivotear vuelve a iterar el ciclo; buscar capacidad lo deja abierto', () => {
    expect(service.projectStatusForFinalState('pivoted')).toBe('ITERATION');
    expect(service.projectStatusForFinalState('seeking_capability')).toBe('IN_PROGRESS');
    expect(service.projectStatusForFinalState('benefit_tracking')).toBe('COMPLETED');
  });

  it('benefit tracking necesita un owner receptor que siga midiendo (INV-12)', () => {
    const closure = service.buildTransferOrClosure({ finalState: 'benefit_tracking', transferOrClosure: {} }, 'benefit_tracking', {}, {});
    expect(closure.mode).toBe('transfer_or_operation');
    expect(closure.status).toBe('blocked');
  });

  it('la cobertura del Reto refleja la ruta', () => {
    const contribution = { challengeId: 'c1', evidenceStrength: 'strong', result: 'supported' };
    expect(service.buildChallengeCoverage({}, contribution, 'pivoted').status).toBe('needs_reformulation');
    expect(service.buildChallengeCoverage({}, contribution, 'seeking_capability').status).toBe('partial');
    expect(service.buildChallengeCoverage({}, contribution, 'benefit_tracking').status).toBe('ready_for_decision');
  });
});

describe('Decision Brief (E2E §21)', () => {
  it('trae las alternativas de Step 2 con su rol', () => {
    const alternatives = service.buildBriefAlternatives(
      {
        alternativeSet: {
          alternatives: [
            { name: 'Prototipo manual', mode: 'experiment', evidenceRefs: ['crm-report'] },
            { name: 'Comprar herramienta', mode: 'buy' },
            { name: 'No hacer nada', mode: 'do_nothing' },
          ],
        },
        selectedBet: { primary: 'Prototipo manual', backup: 'No hacer nada' },
      },
      {},
    );
    expect(alternatives).toEqual([
      { name: 'Prototipo manual', mode: 'experiment', role: 'selected', evidenceRefs: ['crm-report'] },
      { name: 'Comprar herramienta', mode: 'buy', role: 'considered', evidenceRefs: [] },
      { name: 'No hacer nada', mode: 'do_nothing', role: 'backup', evidenceRefs: [] },
    ]);
  });

  it('sin Step 2 no inventa alternativas', () => {
    expect(service.buildBriefAlternatives(undefined, {})).toEqual([]);
  });

  it('qué podemos sostener: claims con evidencia, excluyendo lo marcado como no afirmable', () => {
    const narrative = {
      results: { text: 'El retrabajo bajó 30%' },
      hypothesis: { text: 'La visibilidad reduce retrabajo' },
      context: { text: '' },
      recommendation: 'Escalar al equipo comercial',
      criticalClaims: [
        { key: 'results', evidenceRefs: ['r1'], confidence: 'medium' },
        { key: 'hypothesis', evidenceRefs: ['r1'], confidence: 'medium' },
        { key: 'context', evidenceRefs: ['r1'], confidence: 'medium' },
        { key: 'recommendation', evidenceRefs: [], confidence: 'low' },
      ],
    };
    const claims = service.buildSustainableClaims(narrative, ['La visibilidad reduce retrabajo']);
    expect(claims).toEqual([{ key: 'results', text: 'El retrabajo bajó 30%', evidenceRefs: ['r1'], confidence: 'medium' }]);
  });
});
