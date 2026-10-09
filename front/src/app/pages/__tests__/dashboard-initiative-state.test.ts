import { describe, it, expect } from 'vitest';
import {
  getAdaptiveCardState,
  getAdaptiveProgress,
  getAdaptiveSegmentStatus,
  getAdaptiveStatusLabel,
  getAdaptiveStepLabel,
} from '../dashboard-initiative-state';

describe('getAdaptiveCardState', () => {
  it('sin meta de portafolio deja el cálculo legacy', () => {
    expect(getAdaptiveCardState({})).toBeNull();
    expect(getAdaptiveCardState({ portfolioMeta: [] })).toBeNull();
  });

  it.each(['closed', 'cerrada'])('meta %s → cerrada al 100%%, sin bloqueo', (status) => {
    const state = getAdaptiveCardState({ portfolioMeta: [{ status, currentStep: 'Step 4', mainBlocker: 'viejo' }] })!;
    expect(state).toEqual({ kind: 'closed', step: 4 });
    expect(getAdaptiveProgress(state)).toBe(100);
    expect(getAdaptiveStatusLabel(state)).toBe('Cerrada');
    expect(getAdaptiveStepLabel(state)).toBe('Decisión registrada');
    expect(getAdaptiveSegmentStatus(state, 4)).toBe('Aprobado');
  });

  it('lista para decisión → 100% y Steps 0–4 completos', () => {
    const state = getAdaptiveCardState({ portfolioMeta: [{ status: 'en_step_4', readyForDecision: true }] })!;
    expect(state.kind).toBe('ready_for_decision');
    expect(getAdaptiveProgress(state)).toBe(100);
    expect(getAdaptiveStatusLabel(state)).toBe('Lista para decisión');
    expect(getAdaptiveStepLabel(state)).toBe('Steps 0–4 completos');
  });

  it('en un Step toma el paso del meta, no de la tabla legacy', () => {
    const state = getAdaptiveCardState({ portfolioMeta: [{ status: 'en_step_2', currentStep: 'Step 2', mainBlocker: '' }] })!;
    expect(state).toEqual({ kind: 'in_step', step: 2, blocker: null });
    expect(getAdaptiveProgress(state)).toBe(40);
    expect(getAdaptiveStepLabel(state)).toBe('Step 2 en progreso');
    expect([1, 2, 3, 4].map((n) => getAdaptiveSegmentStatus(state, n))).toEqual(['Aprobado', 'En progreso', 'No iniciado', 'No iniciado']);
  });

  it('sin currentStep usa el status en_step_N y conserva el bloqueo real', () => {
    expect(getAdaptiveCardState({ portfolioMeta: [{ status: 'en_step_3', mainBlocker: ' Falta acceso a datos ' }] }))
      .toEqual({ kind: 'in_step', step: 3, blocker: 'Falta acceso a datos' });
  });
});
