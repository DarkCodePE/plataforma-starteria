/**
 * Datos que se contradecían entre pantallas del portafolio (swarm en prod, 2026-10-10):
 * cobertura del reto, avance de la iniciativa y contadores del Home.
 */
import { describe, expect, it } from 'vitest';
import { deriveChallengeCoverageStatus } from '../actions';
import { getInitiativeStepProgress } from '../rules';
import { getPendingDecisions, getPortfolioSummary } from '../selectors';
import { getAdaptiveCardState, getAdaptiveProgress } from '../../../../app/pages/dashboard-initiative-state';

const challenge = (overrides: Record<string, unknown> = {}) =>
  ({ id: 'c1', strategicFrontId: 'f1', coverageStatus: 'sin_cobertura', visibleToParticipants: false, status: 'draft', challengeOwner: '', ...overrides }) as any;

const initiative = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'i1',
    challengeId: 'c1',
    strategicFrontId: 'f1',
    status: 'en_step_0',
    currentStep: 'Step 0',
    readyForDecision: false,
    resolvedCorePart: false,
    ...overrides,
  }) as any;

describe('cobertura del reto: un solo criterio', () => {
  it('con una iniciativa en curso no dice "sin cobertura" aunque lo persistido sea sin_cobertura', () => {
    expect(deriveChallengeCoverageStatus(challenge(), [initiative()])).toBe('cobertura_parcial');
  });

  it('sin iniciativas es sin_cobertura', () => {
    expect(deriveChallengeCoverageStatus(challenge({ coverageStatus: 'cobertura_parcial' }), [])).toBe('sin_cobertura');
  });

  it('suficiente sólo si una iniciativa llegó a decisión y resolvió la parte central; un bloqueo no cuenta', () => {
    expect(deriveChallengeCoverageStatus(challenge(), [initiative({ readyForDecision: true, resolvedCorePart: true })])).toBe('cobertura_suficiente');
    expect(deriveChallengeCoverageStatus(challenge(), [initiative({ status: 'bloqueada', resolvedCorePart: true })])).toBe('cobertura_parcial');
  });

  it('no baja lo que Step 4 o la decisión ya persistieron', () => {
    expect(deriveChallengeCoverageStatus(challenge({ coverageStatus: 'cobertura_suficiente' }), [initiative()])).toBe('cobertura_suficiente');
  });

  it('respeta las decisiones explícitas sobre el reto', () => {
    expect(deriveChallengeCoverageStatus(challenge({ coverageStatus: 'reformular' }), [initiative()])).toBe('reformular');
    expect(deriveChallengeCoverageStatus(challenge({ coverageStatus: 'resuelto' }), [])).toBe('resuelto');
  });
});

describe('avance de la iniciativa: el mismo en el reto, el listado y "Mis iniciativas"', () => {
  it('Step 0 es 0%, no 15%', () => {
    expect(getInitiativeStepProgress(initiative()).percent).toBe(0);
  });

  it.each([
    [{ status: 'en_step_0', currentStep: 'Step 0' }, 0],
    [{ status: 'en_step_2', currentStep: 'Step 2' }, 40],
    [{ status: 'en_step_4', currentStep: 'Step 4' }, 80],
    [{ status: 'lista_para_decision', currentStep: 'Step 4', readyForDecision: true }, 100],
    [{ status: 'closed', currentStep: 'Step 4' }, 100],
  ])('%o coincide con getAdaptiveProgress (%i%%)', (meta, expected) => {
    const portfolio = getInitiativeStepProgress(initiative(meta)).percent;
    const dashboard = getAdaptiveProgress(getAdaptiveCardState({ portfolioMeta: [meta] })!);
    expect(portfolio).toBe(expected);
    expect(dashboard).toBe(expected);
  });
});

describe('contadores del Home', () => {
  const state = {
    strategicFronts: [{ id: 'f1', status: 'draft' }, { id: 'f2', status: 'draft' }],
    challenges: [challenge(), challenge({ id: 'c2', strategicFrontId: 'f2' }), challenge({ id: 'c3', strategicFrontId: 'f2' })],
    initiatives: [
      initiative(),
      initiative({ id: 'i2', challengeId: 'c2', strategicFrontId: 'f2', status: 'bloqueada' }),
      initiative({ id: 'i3', challengeId: 'c2', strategicFrontId: 'f2', readyForDecision: true, currentStep: 'Step 4', status: 'en_step_4' }),
      initiative({ id: 'i4', challengeId: 'c3', strategicFrontId: 'f2', status: 'closed' }),
    ],
    executiveOutputs: [],
  } as any;

  it('cuenta retos y frentes con iniciativas en curso aunque estén en borrador', () => {
    const summary = getPortfolioSummary(state);
    expect(summary.activeInitiatives).toBe(3);
    expect(summary.activeChallenges).toBe(0);
    expect(summary.challengesWithActiveInitiatives).toBe(2);
    expect(summary.activeFronts).toBe(0);
    expect(summary.frontsWithActiveInitiatives).toBe(2);
  });

  it('el badge de "Reportes y decisiones" y la tarjeta "Decisiones pendientes" cuentan lo mismo', () => {
    expect(getPortfolioSummary(state).pendingDecisions).toBe(getPendingDecisions(state.initiatives).length);
    // Step 4 cuenta como listo para decisión aunque readyForDecision venga en false: el filtro
    // propio del badge del layout lo dejaba afuera y contaba una menos.
    const step4 = [initiative({ currentStep: 'Step 4', status: 'en_step_4' })];
    expect(getPendingDecisions(step4)).toHaveLength(1);
  });
});
