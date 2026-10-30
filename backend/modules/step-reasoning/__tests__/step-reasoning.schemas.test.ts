import { describe, expect, it } from 'vitest';
import { stepReasoningAiResponseSchema, stepReasoningTurnSchema } from '../step-reasoning.schemas';

const validResponse = {
  message: 'Entiendo que quieres reducir el retrabajo sin asumir todavía la causa.',
  nextInteraction: { kind: 'ask', question: '¿Dónde se observa primero el retrabajo?' },
  known: ['El problema declarado es retrabajo.'],
  unknown: ['No hay una frecuencia confirmada.'],
  contradictions: [],
  suggestions: [{
    field: 'problemStatement',
    proposedValue: 'Retrabajo entre operaciones y ventas.',
    rationale: 'Resume únicamente lo dicho por la persona.',
    status: 'UNREVIEWED',
    sourceRefs: ['project.step0Data'],
  }],
  warnings: ['La causa todavía es una hipótesis.'],
  isReadyForHumanReview: false,
  model: 'openrouter:test/model',
  promptVersion: 'steps/reasoning/v0.1',
  promptHash: 'sha256:abc',
};

describe('Step Reasoning contracts', () => {
  it('accepts only an unreviewed, non-command reasoning response', () => {
    expect(stepReasoningAiResponseSchema.parse(validResponse)).toMatchObject({
      suggestions: [{ status: 'UNREVIEWED' }],
      isReadyForHumanReview: false,
    });
  });

  it('rejects model attempts to claim human confirmation', () => {
    expect(() => stepReasoningAiResponseSchema.parse({
      ...validResponse,
      suggestions: [{ ...validResponse.suggestions[0], status: 'USER_CONFIRMED' }],
    })).toThrow();
  });

  it('requires a UUID clientTurnId and a bounded Step 0 message', () => {
    expect(() => stepReasoningTurnSchema.parse({ clientTurnId: 'not-a-uuid', message: 'hola' })).toThrow();
    expect(stepReasoningTurnSchema.parse({
      clientTurnId: '2d034bae-50df-4e1c-823d-1f63d654a9e8',
      message: 'No lo sé aún; ayúdame a identificar qué dato buscar.',
      mode: 'work_with_me',
    }).mode).toBe('work_with_me');
  });
});
