import { describe, expect, it } from 'vitest';
import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../domain/critical-situation-synthesis.schema';
import { criticalSituationSynthesisProviderSchema } from '../model/critical-situation-synthesis-provider-schema';
import { normalizeCriticalSituationSynthesisInput } from '../synthesis/critical-situation-synthesis-input';

const ref = 'source:session:1';

function objectSchemas(schema: unknown): Array<Record<string, unknown>> {
  if (!schema || typeof schema !== 'object') return [];
  if (Array.isArray(schema)) return schema.flatMap(objectSchemas);
  const record = schema as Record<string, unknown>;
  return [
    ...(record.type === 'object' ? [record] : []),
    ...Object.values(record).flatMap(objectSchemas),
  ];
}

function completeSynthesis(): CriticalSituationSynthesis {
  const tension = {
    statement: 'El checkpoint está próximo y la señal de resultado llega con retraso.',
    status: 'supported' as const,
    support: [ref],
    why_it_matters: 'Puede cambiar la evidencia disponible para preparar el checkpoint.',
    affected_decision: 'Qué preparar para el checkpoint existente.',
  };

  return {
    basis_status: 'partial',
    situation_model: {
      desired_change: {
        statement: 'Reducir cancelaciones durante el trimestre.',
        support: [ref],
        epistemic_role: 'FACT',
      },
      current_situation: [],
      existing_work_or_assets: [],
      known_evidence: [],
      constraints: [],
      actors_and_authority: [],
      dependencies: [],
      uncertainties: [],
      time_pressure: [],
      existing_alternatives: [],
      material_tensions: [tension],
    },
    reasoning_metadata: { selected_lenses: ['evidence / learning', 'sequencing'] },
    situation_insight: {
      statement: 'El horizonte del checkpoint y el retraso de la señal condicionan qué progreso se puede mostrar.',
      support: [ref],
      novelty_type: 'relationship_made_explicit',
      epistemic_role: 'INTERPRETATION',
      status: 'supported',
    },
    material_tensions: [tension],
    decision_frame: {
      status: 'framed',
      decision_to_prepare: 'Qué evidencia y opciones llevar al checkpoint.',
      decision_authority: 'unknown',
      materially_distinct_paths: ['Preparar el checkpoint con evidencia disponible.'],
      distinguishing_conditions: ['Qué evidencia estará disponible al checkpoint.'],
      timing_or_constraints: ['El checkpoint ocurre dentro del trimestre.'],
      unresolved_basis: [],
    },
    usable_now: [{
      item: 'La conversación de sesión sobre el objetivo.',
      how_it_can_help: 'Mantiene el objetivo declarado como referencia del análisis.',
      source_refs: [ref],
      provenance_refs: ['prov-usable'],
    }],
    decision_changing_unknowns: [{
      uncertainty: 'Qué resultado estará disponible al checkpoint.',
      why_it_matters: 'El resultado puede cambiar qué opción conviene preparar.',
      current_evidence: [ref],
      resolution_mode: 'Reutilizar el resultado del checkpoint existente.',
      related_decision: 'Qué evidencia y opciones llevar al checkpoint.',
      impact_dimensions: ['decision_frame', 'first_movement'],
    }],
    candidate_first_movement: {
      movement: 'Preparar una lectura del resultado existente para el checkpoint.',
      why_now: 'El checkpoint ya está previsto para este trimestre.',
      existing_assets_used: ['El resultado del checkpoint existente.'],
      what_it_may_clarify: 'Qué opciones quedan respaldadas por la evidencia disponible.',
      decision_supported: 'Qué llevar al checkpoint.',
      boundary: 'No demuestra causalidad ni toma la decisión por la persona.',
      epistemic_role: 'PROPOSAL',
    },
    uncertainty_statement: null,
    provenance: [
      {
        id: 'prov-goal', claim_ref: 'situation_model.desired_change', origin: 'USER_DECLARED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: 'user_message', source_text: null, recorded_at: null,
      },
      {
        id: 'prov-insight', claim_ref: 'situation_insight.statement', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-tension', claim_ref: 'material_tensions[0].statement', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-decision', claim_ref: 'decision_frame.decision_to_prepare', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-authority', claim_ref: 'decision_frame.decision_authority', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-path', claim_ref: 'decision_frame.materially_distinct_paths[0]', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-condition', claim_ref: 'decision_frame.distinguishing_conditions[0]', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-timing', claim_ref: 'decision_frame.timing_or_constraints[0]', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      {
        id: 'prov-usable', claim_ref: 'usable_now[0]', origin: 'USER_DECLARED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: 'user_message', source_text: null, recorded_at: null,
      },
      {
        id: 'prov-unknown', claim_ref: 'decision_changing_unknowns[0].uncertainty', origin: 'AI_INFERRED',
        review_disposition: 'UNREVIEWED', source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      },
      ...[
        ['movement', 'candidate_first_movement.movement'],
        ['why-now', 'candidate_first_movement.why_now'],
        ['asset', 'candidate_first_movement.existing_assets_used[0]'],
        ['clarify', 'candidate_first_movement.what_it_may_clarify'],
        ['supported-decision', 'candidate_first_movement.decision_supported'],
        ['boundary', 'candidate_first_movement.boundary'],
      ].map(([id, claim_ref]) => ({
        id: `prov-${id}`, claim_ref, origin: 'AI_SUGGESTED' as const,
        review_disposition: 'UNREVIEWED' as const, source_refs: [ref], source_path: null, source_text: null, recorded_at: null,
      })),
    ],
  };
}

describe('critical situation synthesis schema', () => {
  it('accepts a complete synthesis with claim-level provenance', () => {
    expect(criticalSituationSynthesisSchema.safeParse(completeSynthesis()).success).toBe(true);
  });

  it('allows partial and insufficient basis without requiring a first movement', () => {
    const partial = completeSynthesis();
    partial.candidate_first_movement = null;
    expect(criticalSituationSynthesisSchema.safeParse(partial).success).toBe(true);

    const insufficient = completeSynthesis();
    insufficient.basis_status = 'insufficient_basis';
    insufficient.candidate_first_movement = null;
    expect(criticalSituationSynthesisSchema.safeParse(insufficient).success).toBe(true);
  });

  it('allows no_supported_insight without inventing a statement', () => {
    const value = completeSynthesis();
    value.situation_insight = {
      statement: null,
      support: [],
      novelty_type: 'no_supported_insight',
      epistemic_role: 'INTERPRETATION',
      status: 'no_supported_insight',
    };
    value.provenance = value.provenance.filter((record) => record.claim_ref !== 'situation_insight.statement');
    expect(criticalSituationSynthesisSchema.safeParse(value).success).toBe(true);
  });

  it('rejects a supported material tension without support', () => {
    const value = completeSynthesis();
    value.material_tensions[0].support = [];
    value.situation_model.material_tensions[0].support = [];
    expect(criticalSituationSynthesisSchema.safeParse(value).success).toBe(false);
  });

  it('allows an unresolved tension with no support', () => {
    const value = completeSynthesis();
    value.material_tensions[0].status = 'unresolved';
    value.material_tensions[0].support = [];
    value.situation_model.material_tensions = structuredClone(value.material_tensions);
    expect(criticalSituationSynthesisSchema.safeParse(value).success).toBe(true);
  });

  it('rejects unknown impact dimensions', () => {
    const value = completeSynthesis();
    value.decision_changing_unknowns[0].impact_dimensions = ['budget_threshold'] as never;
    expect(criticalSituationSynthesisSchema.safeParse(value).success).toBe(false);
  });

  it('requires usable-now grounding references', () => {
    const value = completeSynthesis();
    value.usable_now[0].source_refs = [];
    expect(criticalSituationSynthesisSchema.safeParse(value).success).toBe(false);
  });

  it('keeps uncertainty nullable when there are no declared unknowns', () => {
    const value = completeSynthesis();
    value.decision_changing_unknowns = [];
    value.uncertainty_statement = null;
    value.provenance = value.provenance.filter((record) => record.claim_ref !== 'decision_changing_unknowns[0].uncertainty');
    expect(criticalSituationSynthesisSchema.safeParse(value).success).toBe(true);
  });

  it('keeps epistemic role separate from provenance origin and review disposition', () => {
    const value = completeSynthesis();
    const fact = value.provenance.find((record) => record.claim_ref === 'situation_model.desired_change');
    expect(fact?.origin).toBe('USER_DECLARED');
    expect(fact?.review_disposition).toBe('UNREVIEWED');
    expect(value.situation_model.desired_change?.epistemic_role).toBe('FACT');
    expect(criticalSituationSynthesisSchema.safeParse({
      ...value,
      provenance: value.provenance.map((record) => ({ ...record, epistemic_role: 'FACT' })),
    }).success).toBe(false);
  });

  it('does not add canonical entity fields to SituationModel', () => {
    const value = completeSynthesis();
    expect(Object.keys(value.situation_model)).not.toContain('organization');
    expect(Object.keys(value.situation_model)).not.toContain('strategic_front');
    expect(Object.keys(value.situation_model)).not.toContain('challenge');
    expect(Object.keys(value.situation_model)).not.toContain('initiative');
    expect(Object.keys(value.situation_model)).not.toContain('steps');
    expect(criticalSituationSynthesisSchema.safeParse({
      ...value,
      situation_model: { ...value.situation_model, challenge: {} },
    }).success).toBe(false);
  });

  it('exposes a strict dedicated provider schema without changing analysis_turn', () => {
    const providerSchema = criticalSituationSynthesisProviderSchema as { additionalProperties?: boolean; properties?: Record<string, unknown> };
    expect(providerSchema.additionalProperties).toBe(false);
    expect(providerSchema.properties).toHaveProperty('situation_model');
    expect(providerSchema.properties).not.toHaveProperty('analysis_turn');
    expect(objectSchemas(criticalSituationSynthesisProviderSchema).length).toBeGreaterThan(1);
    expect(objectSchemas(criticalSituationSynthesisProviderSchema).every((schema) => schema.additionalProperties === false)).toBe(true);
  });

  it('normalizes only allow-listed input and preserves broad extracted provenance verbatim', () => {
    const broadProvenance = { source: 'legacy', model: { arbitrary: true } };
    const normalized = normalizeCriticalSituationSynthesisInput({
      snapshot: { snapshot_id: 'snapshot-1', captured_at: '2026-10-06T10:00:00Z' },
      user_messages: [{ id: 'm1', text: 'Queremos mejorar el resultado.' }],
      user_corrections: [{ id: 'c1', text: 'El plazo correcto es diciembre.', corrects_ref: 'session.user_message:m1' }],
      explicitly_provided_context: [{ ref: 'document:1', value: 'Extracto aportado', provenance: { origin: 'USER_DECLARED' } }],
      provisional_extracted_context: { goal: 'Mejorar el resultado' },
      provisional_extracted_context_provenance: broadProvenance,
      source_refs: ['document:1'],
    });
    expect(normalized.provisional_extracted_context?.provenance).toEqual(broadProvenance);
    expect(normalized.source_refs).toContain('provisional_extracted_context.goal');
    expect(normalized.items.map((item) => item.kind)).toEqual([
      'user_message', 'user_correction', 'explicitly_provided_context', 'provisional_extracted_context',
    ]);
    expect(normalized.items[0].provenance).toEqual({ origin: 'USER_DECLARED', review_disposition: 'UNREVIEWED' });
    expect(normalized.items[3].provenance).toBeNull();
    expect(() => normalizeCriticalSituationSynthesisInput({
      question_plan: { questions: [] },
    } as never)).toThrow();
    for (const forbiddenInput of ['question_budget', 'controller_decisions', 'web', 'connected_systems', 'portfolio_setup', 'organizational_db']) {
      expect(() => normalizeCriticalSituationSynthesisInput({ [forbiddenInput]: {} } as never)).toThrow();
    }
  });
});
