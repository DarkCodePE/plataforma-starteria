import { describe, expect, it } from 'vitest';
import type { CriticalSituationSynthesis } from '../domain/critical-situation-synthesis.schema';
import type { CriticalSituationSynthesisAuthorizedSnapshot } from '../synthesis/critical-situation-synthesis-input';
import { validateCriticalSituationSynthesisConformance } from '../synthesis/critical-situation-synthesis-conformance';

const sourceRef = 'source:session:1';

function validValue(): CriticalSituationSynthesis {
  const tension = {
    statement: 'La evidencia de resultado llega después del checkpoint.',
    status: 'supported' as const,
    support: [sourceRef],
    why_it_matters: 'Puede cambiar la evidencia que se prepara.',
    affected_decision: 'Qué preparar para el checkpoint.',
  };
  const provenance = [
    ['goal', 'situation_model.desired_change', 'USER_DECLARED'],
    ['insight', 'situation_insight.statement', 'AI_INFERRED'],
    ['tension', 'material_tensions[0].statement', 'AI_INFERRED'],
    ['decision', 'decision_frame.decision_to_prepare', 'AI_INFERRED'],
    ['authority', 'decision_frame.decision_authority', 'AI_INFERRED'],
    ['path', 'decision_frame.materially_distinct_paths[0]', 'AI_INFERRED'],
    ['condition', 'decision_frame.distinguishing_conditions[0]', 'AI_INFERRED'],
    ['timing', 'decision_frame.timing_or_constraints[0]', 'AI_INFERRED'],
    ['usable', 'usable_now[0]', 'USER_DECLARED'],
    ['unknown', 'decision_changing_unknowns[0].uncertainty', 'AI_INFERRED'],
    ['movement', 'candidate_first_movement.movement', 'AI_SUGGESTED'],
    ['why-now', 'candidate_first_movement.why_now', 'AI_SUGGESTED'],
    ['asset', 'candidate_first_movement.existing_assets_used[0]', 'AI_SUGGESTED'],
    ['clarify', 'candidate_first_movement.what_it_may_clarify', 'AI_SUGGESTED'],
    ['supported-decision', 'candidate_first_movement.decision_supported', 'AI_SUGGESTED'],
    ['boundary', 'candidate_first_movement.boundary', 'AI_SUGGESTED'],
  ] as const;

  return {
    basis_status: 'partial',
    situation_model: {
      desired_change: { statement: 'Mejorar el resultado este trimestre.', support: [sourceRef], epistemic_role: 'FACT' },
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
    reasoning_metadata: { selected_lenses: ['evidence / learning'] },
    situation_insight: {
      statement: 'El horizonte del checkpoint condiciona qué resultado puede orientar la decisión.',
      support: [sourceRef],
      novelty_type: 'relationship_made_explicit',
      epistemic_role: 'INTERPRETATION',
      status: 'supported',
    },
    material_tensions: [tension],
    decision_frame: {
      status: 'framed',
      decision_to_prepare: 'Qué preparar para el checkpoint.',
      decision_authority: 'unknown',
      materially_distinct_paths: ['Usar la evidencia que esté disponible.'],
      distinguishing_conditions: ['Qué evidencia esté disponible.'],
      timing_or_constraints: ['El checkpoint es este trimestre.'],
      unresolved_basis: [],
    },
    usable_now: [{
      item: 'El objetivo expresado en sesión.',
      how_it_can_help: 'Sirve de referencia para interpretar el resultado.',
      source_refs: [sourceRef],
      provenance_refs: ['prov-usable'],
    }],
    decision_changing_unknowns: [{
      uncertainty: 'Qué resultado estará disponible en el checkpoint.',
      why_it_matters: 'El resultado puede cambiar qué opción se prepara.',
      current_evidence: [sourceRef],
      resolution_mode: 'Reutilizar la evidencia del checkpoint.',
      related_decision: 'Qué preparar para el checkpoint.',
      impact_dimensions: ['decision_frame', 'first_movement'],
    }],
    candidate_first_movement: {
      movement: 'Preparar la lectura del resultado existente.',
      why_now: 'El checkpoint ya está previsto.',
      existing_assets_used: ['El resultado del checkpoint.'],
      what_it_may_clarify: 'Qué opciones quedan respaldadas.',
      decision_supported: 'Qué preparar para el checkpoint.',
      boundary: 'No demuestra causalidad ni decide por la persona.',
      epistemic_role: 'PROPOSAL',
    },
    uncertainty_statement: null,
    provenance: provenance.map(([id, claim_ref, origin]) => ({
      id: `prov-${id}`,
      claim_ref,
      origin,
      review_disposition: 'UNREVIEWED',
      source_refs: [sourceRef],
      source_path: null,
      source_text: null,
      recorded_at: null,
    })),
  };
}

function authorizedSnapshot(sourceRefs = [sourceRef]): CriticalSituationSynthesisAuthorizedSnapshot {
  return {
    snapshot_id: 'snapshot-1',
    captured_at: null,
    source_refs: sourceRefs,
    items: sourceRefs.includes(sourceRef) ? [{
      ref: sourceRef,
      kind: 'user_message',
      content: 'Mejorar el resultado este trimestre.',
      provenance: { origin: 'USER_DECLARED', review_disposition: 'UNREVIEWED' },
    }] : [],
    provisional_extracted_context: null,
  };
}

describe('critical situation synthesis deterministic conformance', () => {
  it('accepts a complete synthesis when all references and claim provenance exist', () => {
    const result = validateCriticalSituationSynthesisConformance(validValue(), authorizedSnapshot());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('accepts unresolved tensions with no support references', () => {
    const value = validValue();
    value.material_tensions[0].status = 'unresolved';
    value.material_tensions[0].support = [];
    value.situation_model.material_tensions = structuredClone(value.material_tensions);
    expect(validateCriticalSituationSynthesisConformance(value, authorizedSnapshot()).valid).toBe(true);
  });

  it('allows partial and insufficient basis with a null first movement', () => {
    const partial = validValue();
    partial.candidate_first_movement = null;
    partial.provenance = partial.provenance.filter((record) => !record.claim_ref.startsWith('candidate_first_movement.'));
    expect(validateCriticalSituationSynthesisConformance(partial, authorizedSnapshot()).valid).toBe(true);

    const insufficient = structuredClone(partial);
    insufficient.basis_status = 'insufficient_basis';
    expect(validateCriticalSituationSynthesisConformance(insufficient, authorizedSnapshot()).valid).toBe(true);
  });

  it('accepts a not_yet_identifiable decision frame without requiring a decision', () => {
    const value = validValue();
    value.decision_frame.status = 'not_yet_identifiable';
    value.decision_frame.decision_to_prepare = null;
    value.decision_frame.materially_distinct_paths = [];
    value.decision_frame.distinguishing_conditions = [];
    value.decision_frame.timing_or_constraints = [];
    value.provenance = value.provenance.filter((record) => ![
      'decision_frame.decision_to_prepare',
      'decision_frame.materially_distinct_paths[0]',
      'decision_frame.distinguishing_conditions[0]',
      'decision_frame.timing_or_constraints[0]',
    ].includes(record.claim_ref));
    expect(validateCriticalSituationSynthesisConformance(value, authorizedSnapshot()).valid).toBe(true);
  });

  it('accepts no_supported_insight with no statement or support', () => {
    const value = validValue();
    value.situation_insight = {
      statement: null,
      support: [],
      novelty_type: 'no_supported_insight',
      epistemic_role: 'INTERPRETATION',
      status: 'no_supported_insight',
    };
    value.provenance = value.provenance.filter((record) => record.claim_ref !== 'situation_insight.statement');
    const result = validateCriticalSituationSynthesisConformance(value, authorizedSnapshot());
    expect(result.valid).toBe(true);
  });

  it('rejects missing or unknown source references', () => {
    const value = validValue();
    value.usable_now[0].source_refs = ['source:not-in-snapshot'];
    const result = validateCriticalSituationSynthesisConformance(value, authorizedSnapshot());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'missing_reference')).toBe(true);
  });

  it.each(['AI_INFERRED', 'AI_SUGGESTED'] as const)('rejects an automatically promoted %s claim as FACT', (origin) => {
    const value = validValue();
    const factProvenance = value.provenance.find((record) => record.claim_ref === 'situation_model.desired_change');
    if (!factProvenance) throw new Error('Expected desired-change provenance in the test fixture.');
    factProvenance.origin = origin;
    factProvenance.review_disposition = 'UNREVIEWED';
    const result = validateCriticalSituationSynthesisConformance(value, authorizedSnapshot());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'invalid_fact_provenance')).toBe(true);
  });

  it('does not trust output provenance that relabels an AI-extracted source as user-declared', () => {
    const value = validValue();
    const extractedRef = 'provisional_extracted_context.goal';
    value.situation_model.desired_change!.support = [extractedRef];
    const factProvenance = value.provenance.find((record) => record.claim_ref === 'situation_model.desired_change');
    if (!factProvenance) throw new Error('Expected desired-change provenance in the test fixture.');
    factProvenance.source_refs = [extractedRef];
    factProvenance.origin = 'USER_DECLARED';

    const snapshot = authorizedSnapshot([sourceRef, extractedRef]);
    snapshot.items.push({
      ref: extractedRef,
      kind: 'provisional_extracted_context',
      content: 'An earlier model inference.',
      provenance: { origin: 'AI_INFERRED', review_disposition: 'UNREVIEWED' },
    });
    const result = validateCriticalSituationSynthesisConformance(value, snapshot);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'invalid_fact_provenance')).toBe(true);
  });

  it('requires SituationModel and output material tensions to remain one collection', () => {
    const value = validValue();
    value.situation_model.material_tensions = structuredClone(value.situation_model.material_tensions);
    value.situation_model.material_tensions[0].why_it_matters = 'Una versión divergente.';
    const result = validateCriticalSituationSynthesisConformance(value, authorizedSnapshot());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'tension_projection_mismatch')).toBe(true);
  });

  it('allows a null uncertainty statement with no unknowns and rejects an independent summary', () => {
    const noUnknowns = validValue();
    noUnknowns.decision_changing_unknowns = [];
    noUnknowns.uncertainty_statement = null;
    noUnknowns.provenance = noUnknowns.provenance.filter((record) => !record.claim_ref.startsWith('decision_changing_unknowns['));
    expect(validateCriticalSituationSynthesisConformance(noUnknowns, authorizedSnapshot()).valid).toBe(true);

    const independent = validValue();
    independent.uncertainty_statement = 'También falta presupuesto y un owner.';
    const result = validateCriticalSituationSynthesisConformance(independent, authorizedSnapshot());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'uncertainty_not_derived')).toBe(true);

    const derived = validValue();
    derived.uncertainty_statement = derived.decision_changing_unknowns.map((item) => item.uncertainty).join(' | ');
    expect(validateCriticalSituationSynthesisConformance(derived, authorizedSnapshot()).valid).toBe(true);
  });

  it('rejects observable canonical/product-boundary fields', () => {
    const value = { ...validValue(), challenge: { id: 'canonical' } };
    const result = validateCriticalSituationSynthesisConformance(value, authorizedSnapshot());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === 'product_boundary_violation')).toBe(true);
  });
});
