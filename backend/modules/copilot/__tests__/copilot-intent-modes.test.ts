import { describe, expect, it } from 'vitest';
import { resolveCopilotMode } from '../application/copilot-intent-modes';

const state = {
  activeCheckpoint: {
    step: 1,
    checkpointKey: 'CP-1.1',
    title: 'Hipótesis y supuesto crítico',
    questions: [
      { prompt: '¿Cuál es la hipótesis principal?', clarifiesVariable: 'mainHypothesis', required: true },
      { prompt: '¿Cuál es el supuesto crítico?', clarifiesVariable: 'criticalAssumption', required: true },
      { prompt: 'Opcional', clarifiesVariable: 'notes', required: false },
    ],
    responses: { mainHypothesis: 'Usuarios adoptan si reduce retrabajo' },
  },
  progressSignal: { step: 1, nextAction: 'Confirmar CP-1.1', blockers: ['Falta acceso al CRM'] },
  masterContext: { missingCriticalInformation: ['Baseline de retrabajo'] },
};

describe('resolveCopilotMode (E2E Job-Driven §20)', () => {
  it('Orientarme: dice dónde estás con la pregunta de progreso y qué sigue', () => {
    const r = resolveCopilotMode('p1', 'orient', state);
    expect(r.answer).toBe('Estás en el Step 1: ¿Qué sabemos realmente? Lo siguiente: Confirmar CP-1.1');
    expect(r.actions).toEqual([{ label: 'Ir al Step 1', target: '/projects/p1/step/1' }]);
  });

  it('Trabajar conmigo: lista sólo las preguntas obligatorias sin responder', () => {
    const r = resolveCopilotMode('p1', 'work_with_me', state);
    expect(r.title).toBe('Trabajemos CP-1.1: Hipótesis y supuesto crítico');
    expect(r.answer).toBe('Para cerrar este punto falta responder: ¿Cuál es el supuesto crítico?');
  });

  it('Desbloquearme: muestra bloqueos e información crítica faltante y ofrece al mentor', () => {
    const r = resolveCopilotMode('p1', 'unblock', state);
    expect(r.answer).toContain('Falta acceso al CRM · Baseline de retrabajo');
    expect(r.actions).toEqual([
      { label: 'Pedir ayuda al mentor', target: 'help_request' },
      { label: 'Volver al Step 1', target: '/projects/p1/step/1' },
    ]);
  });

  it('sin estado no inventa', () => {
    expect(resolveCopilotMode('p1', 'unblock', {}).answer).toMatch(/No aparece un bloqueo registrado/);
    expect(resolveCopilotMode('p1', 'work_with_me', {}).answer).toMatch(/no tiene preguntas obligatorias pendientes/);
  });
});
