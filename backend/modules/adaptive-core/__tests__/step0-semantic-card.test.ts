import { describe, expect, it } from 'vitest';
import { applyStep0SemanticInput, createStep0SemanticCard } from '../step0-semantic-card';

const now = '2026-10-20T10:00:00.000Z';
const source = { id: 'source-1', reference: 'Entrevista con ventas', sourceType: 'USER_INPUT', validationStatus: 'unvalidated' as const };

function completeCard() {
  let card = createStep0SemanticCard('initiative-1', { challengeSnapshot: { id: 'challenge-1', title: 'Reducir retrabajo' }, handoffMandate: { constraints: ['No tocar datos personales'] } }, now);
  for (const [field, content] of [
    ['objective', 'Reducir retrabajo comercial.'],
    ['scope', 'Equipo comercial de Madrid; excluye pricing.'],
    ['owner', 'Ana, responsable comercial.'],
    ['priorityHypothesis', 'Si simplificamos el tablero, el uso crecerá.'],
    ['decisionCriteria', 'Tres entrevistas y la métrica base permitirán decidir.'],
  ] as const) card = applyStep0SemanticInput(card, { fieldHint: field, content, now }).card;
  return card;
}

describe('P7 Step 0 semantic Card', () => {
  it('recovers inherited context without promoting it to a user-confirmed claim', () => {
    const card = createStep0SemanticCard('initiative-a', { initiativeTitle: 'Reducir esperas', challengeSnapshot: { id: 'ch-1' }, constraints: ['Sin presupuesto adicional'] }, now);
    expect(card.inheritedContext.challengeSnapshot).toMatchObject({ id: 'ch-1' });
    expect(card.fields.objective).toMatchObject({ value: 'Reducir esperas', origin: 'inherited' });
    expect(card.claims).toHaveLength(0);
  });

  it('keeps No sé unknown and insufficient', () => {
    const result = applyStep0SemanticInput(createStep0SemanticCard('initiative-a', {}, now), { fieldHint: 'objective', content: 'No sé', now });
    expect(result.card.fields.objective).toBeUndefined();
    expect(result.card.unknowns).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'objective' })]));
    expect(result.card.sufficiency.sufficient).toBe(false);
    expect(result.card.lastDelta.operation).toBe('mark_unknown');
  });

  it('does not let irrelevant text fill a field or improve sufficiency', () => {
    const initial = createStep0SemanticCard('initiative-a', {}, now);
    const result = applyStep0SemanticInput(initial, { content: 'Me gusta la pizza y el fútbol.', now });
    expect(result.changed).toBe(false);
    expect(result.card.fields).toEqual(initial.fields);
    expect(result.card.sufficiency.sufficient).toBe(false);
  });

  it('does not duplicate an already-known current claim', () => {
    const first = applyStep0SemanticInput(createStep0SemanticCard('initiative-a', {}, now), { fieldHint: 'objective', content: 'Reducir esperas.', now }).card;
    const retry = applyStep0SemanticInput(first, { fieldHint: 'objective', content: 'Reducir esperas.', now });
    expect(retry.changed).toBe(false);
    expect(retry.card.claims).toHaveLength(1);
    expect(retry.card.lastDelta.operation).toBe('no_change');
  });

  it('records a contradiction and preserves prior history for review', () => {
    const first = applyStep0SemanticInput(createStep0SemanticCard('initiative-a', {}, now), { fieldHint: 'scope', content: 'Solo equipo comercial.', now }).card;
    const changed = applyStep0SemanticInput(first, { fieldHint: 'scope', content: 'Toda la compañía.', sourceRefs: [source], now }).card;
    expect(changed.contradictions).toEqual(expect.arrayContaining([expect.objectContaining({ previous: 'Solo equipo comercial.', proposed: 'Toda la compañía.', status: 'open' })]));
    expect(changed.requiresReview).toBe(true);
    expect(changed.hardGaps).toContain('review:scope');
    expect(changed.history).toEqual(expect.arrayContaining([expect.objectContaining({ event: 'contradiction', value: 'Toda la compañía.' })]));
  });

  it('links a new source without treating it as validated evidence', () => {
    const result = applyStep0SemanticInput(createStep0SemanticCard('initiative-a', {}, now), { fieldHint: 'objective', content: 'Reducir esperas.', sourceRefs: [source], now });
    expect(result.card.sources).toEqual([source]);
    expect(result.card.claims[0].sourceRefIds).toEqual(['source-1']);
    expect(result.card.sources[0].validationStatus).toBe('unvalidated');
  });

  it('preserves the prior Card when the optional interpreter is unavailable', () => {
    const prior = completeCard();
    const result = applyStep0SemanticInput(prior, { fieldHint: 'objective', content: 'Cambiar objetivo.', aiAvailable: false, now });
    expect(result.changed).toBe(false);
    expect(result.card.fields.objective?.value).toBe(prior.fields.objective?.value);
    expect(result.card.lastIntervention).toBe('unblock');
  });

  it('uses criteria rather than message count and builds a structured Step 1 handoff only when sufficient', () => {
    const incomplete = createStep0SemanticCard('initiative-a', {}, now);
    expect(incomplete.handoff).toBeNull();
    const complete = completeCard();
    expect(complete.sufficiency.sufficient).toBe(true);
    expect(complete.checkpoint.state).toBe('ready_for_human_confirmation');
    expect(complete.handoff).toMatchObject({ toStep: 1, structured: true });
    expect(complete.checkpoint.humanConfirmationRequired).toBe(true);
  });
});
