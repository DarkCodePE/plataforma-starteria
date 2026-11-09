import { describe, expect, it } from 'vitest';
import { AttentionWorkflowError, planAttentionTransition, type AttentionWorkflowAction } from '../attention-workflow.policy';

const base = { status: 'open' as const, currentOwnerId: 'owner-a', actorId: 'lead-a' };

describe('G04 AttentionItem governed transition policy', () => {
  it('acknowledges without resolving or reassigning', () => {
    expect(planAttentionTransition({ ...base, action: 'acknowledge' })).toMatchObject({
      status: 'acknowledged', ownerId: 'owner-a',
      event: { actorId: 'lead-a', action: 'acknowledge' },
    });
  });
  it('assigns, responds and escalates with an auditable actor and distinct owner', () => {
    expect(planAttentionTransition({ ...base, action: 'assign', assigneeId: 'owner-b' }))
      .toMatchObject({ status: 'open', ownerId: 'owner-b', event: { action: 'assign', assigneeId: 'owner-b' } });
    expect(planAttentionTransition({ ...base, action: 'respond', note: 'Revisaré el coste de esta dependencia.' }))
      .toMatchObject({ status: 'open', ownerId: 'owner-a', event: { action: 'respond' } });
    expect(planAttentionTransition({ ...base, action: 'escalate', assigneeId: 'lead-b', note: 'Bloqueo requiere decisión del sponsor.' }))
      .toMatchObject({ status: 'acknowledged', ownerId: 'lead-b', event: { action: 'escalate', assigneeId: 'lead-b' } });
  });
  it('resolves only with a concrete explanation and preserves provenance', () => {
    const result = planAttentionTransition({ ...base, action: 'resolve', note: 'El sponsor autorizó usar el proveedor alternativo.' });
    expect(result.status).toBe('resolved');
    expect(result.resolutionNote).toContain('proveedor alternativo');
    expect(result.event.actorId).toBe('lead-a');
  });
  it('rejects commands on closed items unless explicitly reopened', () => {
    for (const action of ['respond', 'assign', 'resolve', 'escalate', 'cancel'] as AttentionWorkflowAction[]) {
      expect(() => planAttentionTransition({ ...base, status: 'resolved', action, assigneeId: 'owner-b', note: 'Justificación suficiente.' }))
        .toThrow(AttentionWorkflowError);
    }
    expect(planAttentionTransition({ ...base, status: 'resolved', action: 'reopen', note: 'Ha reaparecido la dependencia anterior.' }))
      .toMatchObject({ status: 'open', resolutionNote: null, event: { action: 'reopen' } });
  });
  it('prevents no-op escalation, invented assignees, short notes and empty actors', () => {
    expect(() => planAttentionTransition({ ...base, action: 'escalate', assigneeId: 'owner-a', note: 'Escalar esta incidencia.' }))
      .toThrowError('Escalar exige un responsable diferente.');
    expect(() => planAttentionTransition({ ...base, action: 'assign' })).toThrowError('Selecciona un responsable');
    expect(() => planAttentionTransition({ ...base, action: 'resolve', note: 'ok' })).toThrowError('La acción exige');
    expect(() => planAttentionTransition({ ...base, actorId: '', action: 'acknowledge' })).toThrowError('Falta el actor');
  });
});
