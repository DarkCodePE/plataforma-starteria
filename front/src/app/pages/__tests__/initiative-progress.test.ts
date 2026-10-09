import { describe, expect, it } from 'vitest';
import { getInitiativeProgress } from '../PortfolioLeadInitiativesPage';

const item = (currentStep: string, extra: Record<string, unknown> = {}) => ({ currentStep, status: 'en_curso', ...extra }) as any;

describe('Avance de la iniciativa en el listado del Portfolio Lead', () => {
  it('en Step 2 lleva 2/5 Steps completos (40%)', () => {
    expect(getInitiativeProgress(item('Step 2'))).toEqual({ completed: 2, percent: 40 });
  });

  it('en Step 4 sin terminar es 4/5 (80%), no 90%', () => {
    expect(getInitiativeProgress(item('Step 4'))).toEqual({ completed: 4, percent: 80 });
  });

  it('con Step 4 confirmado y lista para decisión es 5/5 (100%)', () => {
    expect(getInitiativeProgress(item('Step 4', { progressSignal: { health: 'ready_for_decision' } }))).toEqual({ completed: 5, percent: 100 });
  });

  it('lista para decisión por estado de portafolio es 100% aunque no venga progressSignal', () => {
    expect(getInitiativeProgress(item('Step 4', { status: 'lista_para_decision' }))).toEqual({ completed: 5, percent: 100 });
    expect(getInitiativeProgress(item('Step 4', { status: 'ready_for_decision' }))).toEqual({ completed: 5, percent: 100 });
  });

  it('cerrada es 100%', () => {
    expect(getInitiativeProgress(item('Step 3', { status: 'cerrada' }))).toEqual({ completed: 5, percent: 100 });
  });
});

describe('Avance de una iniciativa decidida', () => {
  it('closed (deletreo canónico del backend) es 100%', () => {
    expect(getInitiativeProgress(item('Step 4', { status: 'closed' }))).toEqual({ completed: 5, percent: 100 });
  });
});
