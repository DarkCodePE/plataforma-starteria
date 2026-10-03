import { describe, expect, it } from 'vitest';
import { projectStrategicIntent, serializeStrategicContext, type ConfirmedBrief } from '../strategicIntentProjection';

const fixture = (overrides: Partial<ConfirmedBrief['brief']> = {}): ConfirmedBrief => ({
  source: 'portfolio_entry', sessionId: 's1', revision: 7, handoffId: 'h1', handoffVersion: 2, confirmationId: 'c1', confirmationVersion: 3,
  brief: { rawEntry: 'NEVER USE', handoff: { desired_outcome: 'Goal', understanding: 'Situation', decision_to_enable: 'Decision', known_context: 'Known', unresolved_context: ['Question'], evidence_or_clarity_needed: ['Evidence'], recommended_approach: 'Approach' }, confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome','understanding','decision_to_enable','known_context','unresolved_context','evidence_or_clarity_needed','recommended_approach'], correctedFields: {}, rejectedFields: [] }, ...overrides },
});

describe('Strategic Intent projection', () => {
  it('maps confirmed fields and serializes in stable order without provenance/rawEntry', () => {
    const projection = projectStrategicIntent(fixture());
    expect(projection.goal).toBe('Goal');
    expect(projection.openQuestions).toEqual(['Question', 'Evidence']);
    expect(serializeStrategicContext(projection)).toBe('Situación actual:\nSituation\n\nDecisión que quiero preparar:\nDecision\n\nContexto conocido:\nKnown\n\nUna vía que merece explorar:\nApproach\n\nTodavía necesito aclarar:\n- Question\n- Evidence');
    expect(serializeStrategicContext(projection)).not.toContain('s1');
    expect(serializeStrategicContext(projection)).not.toContain('NEVER USE');
  });

  it('prefers corrections and omits rejected or unconfirmed values', () => {
    const result = projectStrategicIntent(fixture({ confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome'], correctedFields: { desired_outcome: 'Corrected' }, rejectedFields: ['understanding'] } }));
    expect(result.goal).toBe('Corrected');
    expect(result.situation).toBeUndefined();
    expect(result.approachHypothesis).toBeUndefined();
  });

  it('projects confirmed D1 value objects without using rawEntry', () => {
    const result = projectStrategicIntent(fixture({
      handoff: { desired_outcome: { value: 'Goal from D1' }, understanding: { value: 'Context from D1' } },
      confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome', 'understanding'], correctedFields: {}, rejectedFields: [] },
    }));
    expect(result.goal).toBe('Goal from D1');
    expect(result.situation).toBe('Context from D1');
  });

  it('rejects contradictory terminal confirmation', () => {
    expect(() => projectStrategicIntent(fixture({ confirmation: { status: 'CONFIRMED', acceptedFields: ['desired_outcome'], correctedFields: {}, rejectedFields: ['desired_outcome'] } }))).toThrow('INVALID_CONFIRMATION_FOR_D2');
  });
});
