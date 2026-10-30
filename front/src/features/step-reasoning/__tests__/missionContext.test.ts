import { describe, expect, it } from 'vitest';
import { buildStep0MissionContext, countConfirmedCheckpoints } from '../domain/missionContext';

describe('Step 0 mission context', () => {
  it('keeps a project description as available context without implying confirmation', () => {
    const context = buildStep0MissionContext({
      projectName: 'Reducir retrabajo comercial',
      projectDescription: 'Contexto aportado al crear la iniciativa.',
      linkedToChallenge: false,
      stepMethodObjective: 'Convertir la intención inicial en una hipótesis delimitada.',
    });

    expect(context.contextLabel).toBe('Contexto inicial disponible');
    expect(context.missionSource).toBe('Descripción de la iniciativa');
    expect(context.missionSource.toLowerCase()).not.toContain('confirm');
    expect(context.missionSource.toLowerCase()).not.toContain('autoriz');
  });

  it('separates the Step 0 method from a cycle objective confirmed by the Core', () => {
    const withoutConfirmedObjective = buildStep0MissionContext({
      projectName: 'Reducir retrabajo comercial',
      linkedToChallenge: false,
      stepMethodObjective: 'Convertir la intención inicial en una hipótesis delimitada.',
      confirmedResponses: {},
    });

    expect(withoutConfirmedObjective.cycleObjective).toBeNull();
    expect(withoutConfirmedObjective.step0Method).toContain('Convertir la intención inicial');

    const withConfirmedObjective = buildStep0MissionContext({
      projectName: 'Reducir retrabajo comercial',
      linkedToChallenge: false,
      stepMethodObjective: 'Convertir la intención inicial en una hipótesis delimitada.',
      confirmedResponses: { objective: 'Reducir el retrabajo observable en el traspaso comercial.' },
    });

    expect(withConfirmedObjective.cycleObjective).toBe('Reducir el retrabajo observable en el traspaso comercial.');
    expect(withConfirmedObjective.cycleObjective).not.toBe(withConfirmedObjective.step0Method);
  });

  it('keeps linked Challenge provenance and business outcome separate from an undefined cycle objective', () => {
    const context = buildStep0MissionContext({
      projectName: 'Reducir retrabajo comercial',
      linkedToChallenge: true,
      masterContext: {
        challengeSnapshot: {
          title: 'Reducir fricción en el traspaso comercial',
          objective: 'Reducir el coste de retrabajo entre áreas.',
        },
      },
      confirmedResponses: {},
      stepMethodObjective: 'Delimitar una hipótesis y acordar cómo validarla.',
    });

    expect(context.missionSource).toBe('Reto vinculado en Adaptive Core');
    expect(context.businessOutcome).toBe('Reducir el coste de retrabajo entre áreas.');
    expect(context.cycleObjective).toBeNull();
    expect(context.step0Method).toBe('Delimitar una hipótesis y acordar cómo validarla.');
  });

  it('counts only checkpoint instances completed by the Adaptive Core', () => {
    expect(countConfirmedCheckpoints([
      { status: 'completed' },
      { status: 'ready' },
      { status: 'in_progress' },
    ])).toBe(1);
  });
});
