import { describe, expect, it } from 'vitest';
import { applySemanticStepInput, createSemanticStepCard } from '../step-semantic-engine';

const source = { id: 'src-1', reference: 'Medicion piloto' };

function fill(step: 1 | 2 | 3 | 4, entries: Array<[string, string]>) {
  return entries.reduce((card, [field, content]) => applySemanticStepInput(card, { field, content, sourceRefs: [source] }), createSemanticStepCard(step, { mandate: { id: 'm-1' } }));
}

describe('P8 shared governed semantic engine', () => {
  it('specializes Step 1 without collapsing fact, hypothesis, evidence and unknown', () => {
    const unknown = applySemanticStepInput(createSemanticStepCard(1, { step0SemanticHandoff: { version: 2 } }), { field: 'focus', content: 'No se' });
    expect(unknown.unknowns).toContain('focus');
    expect(unknown.sufficiency.sufficient).toBe(false);
    const card = fill(1, [['focus', 'Reducir retrabajo'], ['fact', 'El equipo registra 12 casos'], ['hypothesis', 'Una plantilla reducira casos'], ['evidence', 'Entrevista validada por humano']]);
    expect(card.sufficiency.sufficient).toBe(true);
    expect(card.handoff).toMatchObject({ toStep: 2, values: { focus: 'Reducir retrabajo' } });
    expect(card.values.fact.kind).toBe('fact');
    expect(card.values.hypothesis.kind).toBe('hypothesis');
    expect(card.values.evidence.kind).toBe('evidence');
    expect(card.sources).toEqual([expect.objectContaining({ validationStatus: 'unvalidated' })]);
  });

  it('uses Step 2 criteria rather than turn count and produces a bounded Step 3 handoff', () => {
    let card = createSemanticStepCard(2, {});
    for (let i = 0; i < 5; i++) card = applySemanticStepInput(card, { field: 'comment', content: `comentario ${i}` });
    expect(card.sufficiency.sufficient).toBe(false);
    card = fill(2, [['selectedWork', 'Piloto de plantilla'], ['measurementPlan', 'Medir casos semanales'], ['capacityBoundary', 'Equipo comercial opera el piloto']]);
    expect(card.handoff).toMatchObject({ toStep: 3, values: { selectedWork: 'Piloto de plantilla' } });
    expect(card.handoff?.values).not.toHaveProperty('transcript');
  });

  it('keeps Step 3 execution, observation, interpretation and recommendation distinct', () => {
    const card = fill(3, [
      ['execution', 'Ejecutamos el piloto durante dos semanas'],
      ['observation', '7 usuarios utilizaron la plantilla'],
      ['interpretation', 'La adopcion inicial es prometedora'],
    ]);
    expect(card.values.execution.kind).toBe('fact');
    expect(card.values.observation.kind).toBe('observation');
    expect(card.values.interpretation.kind).toBe('interpretation');
    expect(card.handoff).toMatchObject({ toStep: 4 });
  });

  it('preserves contradiction history and marks review without resetting the Card', () => {
    const prior = fill(3, [['execution', 'Ejecutamos piloto A'], ['observation', '7 usuarios'], ['interpretation', 'Senal positiva']]);
    const changed = applySemanticStepInput(prior, { field: 'observation', content: 'Solo 2 usuarios utilizaron la plantilla', sourceRefs: [source] });
    expect(changed.requiresReview).toBe(true);
    expect(changed.contradictions).toEqual([expect.objectContaining({ previous: '7 usuarios', proposed: 'Solo 2 usuarios utilizaron la plantilla' })]);
    expect(changed.values.execution.value).toBe('Ejecutamos piloto A');
    expect(changed.version).toBeGreaterThan(prior.version);
  });

  it('prepares Step 4 Decision handoff without creating an organizational decision', () => {
    const card = fill(4, [['learning', 'El onboarding requiere acompanamiento'], ['recommendation', 'Iterar con soporte'], ['decisionRequest', 'Sponsor debe decidir siguiente horizonte']]);
    expect(card.handoff).toMatchObject({ toStep: 'Decision' });
    expect(card.values.recommendation.kind).toBe('recommendation');
    expect(card.values).not.toHaveProperty('organizationalDecision');
  });

  it('is idempotent for an identical request and preserves state when interpreter is unavailable', () => {
    const first = applySemanticStepInput(createSemanticStepCard(1, {}), { field: 'focus', content: 'Reducir retrabajo' });
    const retry = applySemanticStepInput(first, { field: 'focus', content: 'Reducir retrabajo' });
    const unavailable = applySemanticStepInput(first, { field: 'focus', content: 'Cambiar foco', unavailable: true });
    expect(retry.version).toBe(first.version);
    expect(unavailable.values.focus.value).toBe('Reducir retrabajo');
    expect(unavailable.lastOperation).toBe('unavailable');
  });
});
