import { describe, expect, it } from 'vitest';
import { buildContextProjection } from '../portfolio-bootstrap-context-projection';

const review = (situation: string, pilotExperience: string | null = null, gaps: string[] = []) => ({
  id: 'review-a',
  sessionId: 'session-a',
  version: 3,
  draft: { situation: { value: situation, provenance: 'user_declared', sourceRef: { kind: 'user_input' } }, pilotExperience: { value: pilotExperience }, gaps },
});

describe('KAN-247 governed E1 context proposal projection', () => {
  it('proposes the cafeteria negative experience from the persisted narrative with an exact versioned quote', () => {
    const output = buildContextProjection({
      review: review('Somos una cafetería de 4 personas. Nunca hemos probado desayunos para llevar ni pedidos a oficinas.'),
    });
    expect(output.reviewVersion).toBe(3);
    expect(output.proposals).toHaveLength(1);
    expect(output.proposals[0]).toMatchObject({
      targetField: 'pilotExperience',
      value: 'Nunca hemos probado desayunos para llevar ni pedidos a oficinas.',
      status: 'UNREVIEWED',
      sourceKind: 'persisted_user_narrative',
      sourceRef: {
        kind: 'context_narrative_quote',
        reviewId: 'review-a',
        reviewVersion: 3,
        fieldPath: 'situation',
        quote: 'Nunca hemos probado desayunos para llevar ni pedidos a oficinas.',
      },
    });
  });

  it('never relabels an inferred situation as a persisted user declaration', () => {
    const data = review('Nunca hemos probado desayunos para llevar.');
    data.draft.situation.provenance = 'copilot_suggested';
    data.draft.situation.sourceRef = { kind: 'copilot_suggestion' };
    expect(buildContextProjection({ review: data }).proposals).toEqual([]);
  });

  it('does not treat unclear or contradictory statements as a resolved pilot history', () => {
    for (const narrative of [
      'Tal vez no hemos probado el servicio.',
      'Nunca hemos probado pedidos, pero sí hemos probado otro piloto.',
      'Creemos que hay una oportunidad, sin saber si hubo pruebas.',
      'No hemos probado que el sistema sea fiable.',
    ]) {
      expect(buildContextProjection({ review: review(narrative) }).proposals).toEqual([]);
    }
  });

  it('does not override an already populated or explicitly disposed pilot field', () => {
    const situation = 'Nunca hemos probado desayunos para llevar.';
    expect(buildContextProjection({ review: review(situation, 'Ya validamos una prueba') }).proposals).toEqual([]);
    expect(buildContextProjection({ review: review(situation, null, ['context-disposition:pilotExperience:unknown']) }).proposals).toEqual([]);
    expect(buildContextProjection({ review: review(situation, null, ['context-disposition:pilotExperience:not_applicable']) }).proposals).toEqual([]);
  });

  it('can propose a grounded semantic pilot fact only when its exact user quote belongs to the stored turn', () => {
    const result = buildContextProjection({
      review: review('Queremos entender oportunidades.'),
      semantic: {
        state: { factLedger: [{
          conceptId: 'pilot_experience',
          value: 'none',
          provenance: 'user_declared',
          evidenceRefs: [{ kind: 'user_input', quote: 'Nunca hemos probado una versión previa.' }],
          status: 'observed',
          turnId: 'turn-a',
          semanticVersion: 2,
        }] },
        turns: [{ id: 'turn-a', inputText: 'Nunca hemos probado una versión previa.' }],
      },
    });
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      sourceKind: 'semantic_fact',
      value: 'Nunca hemos probado una versión previa.',
      sourceRef: { kind: 'semantic_fact_quote', turnId: 'turn-a', semanticVersion: 2, quote: 'Nunca hemos probado una versión previa.' },
      status: 'UNREVIEWED',
    });
  });

  it('never trusts unsupported semantic evidence, withdrawn facts or ambiguous contradictory facts', () => {
    const base = {
      conceptId: 'pilot_experience', value: 'none', provenance: 'user_declared',
      evidenceRefs: [{ kind: 'user_input', quote: 'No hemos probado nada.' }],
      status: 'observed', turnId: 'turn-a', semanticVersion: 1,
    };
    const envelope = (factLedger: any[]) => ({
      review: review('Queremos aumentar nuestros pedidos.'),
      semantic: { state: { factLedger }, turns: [{ id: 'turn-a', inputText: 'Nunca hemos probado un piloto.' }] },
    });
    expect(buildContextProjection(envelope([base])).proposals).toEqual([]);
    expect(buildContextProjection(envelope([{ ...base, status: 'retracted' }])).proposals).toEqual([]);
    expect(buildContextProjection(envelope([{ ...base, evidenceRefs: [{ kind: 'user_input', quote: 'Nunca hemos probado un piloto.' }] },
      { ...base, turnId: 'turn-a', value: 'yes', evidenceRefs: [{ kind: 'user_input', quote: 'Nunca hemos probado un piloto.' }] }])).proposals).toEqual([]);
  });

  it('does not create a proposal without a versioned ContextReview', () => {
    expect(buildContextProjection({ review: null }).proposals).toEqual([]);
  });
});
