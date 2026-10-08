import { describe, expect, it } from 'vitest';
import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import { toLiveUnderstandingViewModel } from '../presentation/live-understanding-view-model';

type SynthesisOptions = {
  basisStatus?: CriticalSituationSynthesis['basis_status'];
  insight?: CriticalSituationSynthesis['situation_insight'];
  tensions?: CriticalSituationSynthesis['material_tensions'];
  decisionFrame?: CriticalSituationSynthesis['decision_frame'];
  unknowns?: CriticalSituationSynthesis['decision_changing_unknowns'];
  usableNow?: CriticalSituationSynthesis['usable_now'];
  candidateFirstMovement?: CriticalSituationSynthesis['candidate_first_movement'];
};

function makeSynthesis(options: SynthesisOptions = {}): CriticalSituationSynthesis {
  const tensions = options.tensions ?? [];
  return criticalSituationSynthesisSchema.parse({
    basis_status: options.basisStatus ?? 'partial',
    situation_model: {
      desired_change: null,
      current_situation: [],
      existing_work_or_assets: [],
      decision_to_enable: null,
      known_evidence: [],
      constraints: [],
      actors_and_authority: [],
      dependencies: [],
      uncertainties: [],
      time_pressure: [],
      existing_alternatives: [],
      material_tensions: tensions,
    },
    reasoning_metadata: { selected_lenses: ['priority / allocation'] },
    situation_insight: options.insight ?? {
      statement: 'Las señales llegan después del horizonte de revisión.',
      support: ['source:reading'],
      novelty_type: 'sequence_dependency_exposed',
      epistemic_role: 'INTERPRETATION',
      status: 'supported',
    },
    material_tensions: tensions,
    decision_frame: options.decisionFrame ?? {
      status: 'not_yet_identifiable',
      decision_to_prepare: null,
      decision_authority: 'internal decision authority',
      materially_distinct_paths: [],
      distinguishing_conditions: [],
      timing_or_constraints: [],
      unresolved_basis: [],
    },
    usable_now: options.usableNow ?? [],
    decision_changing_unknowns: options.unknowns ?? [],
    candidate_first_movement: options.candidateFirstMovement ?? null,
    uncertainty_statement: null,
    provenance: [{
      id: 'internal-provenance-id',
      claim_ref: 'situation_insight.statement',
      origin: 'AI_INFERRED',
      review_disposition: 'UNREVIEWED',
      source_refs: ['source:reading'],
      source_path: 'internal.source.path',
      source_text: 'internal source text',
      recorded_at: null,
    }],
  });
}

function framedDecision(decisionToPrepare: string): CriticalSituationSynthesis['decision_frame'] {
  return {
    status: 'framed',
    decision_to_prepare: decisionToPrepare,
    decision_authority: 'internal decision authority',
    materially_distinct_paths: ['internal path'],
    distinguishing_conditions: ['internal condition'],
    timing_or_constraints: ['internal timing'],
    unresolved_basis: ['internal unresolved basis'],
  };
}

function decisionChangingUnknown(uncertainty: string, whyItMatters: string): CriticalSituationSynthesis['decision_changing_unknowns'][number] {
  return {
    uncertainty,
    why_it_matters: whyItMatters,
    current_evidence: ['internal-evidence-ref'],
    resolution_mode: 'internal resolution mode',
    related_decision: 'internal related decision',
    impact_dimensions: ['decision_frame'],
  };
}

describe('Live Understanding presentation boundary', () => {
  it('maps a supported portfolio tradeoff, framed decision, supported tension and multiple unknowns', () => {
    const synthesis = makeSynthesis({
      basisStatus: 'sufficient',
      tensions: [
        {
          statement: 'La evidencia de churn llega después de la revisión trimestral.',
          status: 'supported',
          support: ['source:lagging-churn', 'source:quarterly-review'],
          why_it_matters: 'La secuencia puede cambiar dónde concentrar el esfuerzo.',
          affected_decision: 'internal affected decision',
        },
        {
          statement: 'Tensión no respaldada.',
          status: 'unresolved',
          support: [],
          why_it_matters: 'No debe llegar a la presentación.',
          affected_decision: 'internal unresolved decision',
        },
      ],
      decisionFrame: framedDecision('Qué iniciativas pueden aportar evidencia útil antes de la revisión.'),
      unknowns: [
        decisionChangingUnknown('Qué iniciativas producirán evidencia a tiempo.', 'Puede cambiar la secuencia del esfuerzo.'),
        decisionChangingUnknown('Cuándo estará disponible la señal de churn.', 'Puede cambiar si la revisión permite comparar resultados.'),
      ],
      candidateFirstMovement: {
        movement: 'internal candidate first movement',
        why_now: 'internal reason now',
        existing_assets_used: ['internal asset'],
        what_it_may_clarify: 'internal clarification',
        decision_supported: 'internal supported decision',
        boundary: 'internal movement boundary',
        epistemic_role: 'PROPOSAL',
      },
    });

    expect(toLiveUnderstandingViewModel(synthesis)).toEqual({
      state: 'supported_reading',
      reading: 'Las señales llegan después del horizonte de revisión.',
      tensions: [{
        statement: 'La evidencia de churn llega después de la revisión trimestral.',
        whyItMatters: 'La secuencia puede cambiar dónde concentrar el esfuerzo.',
      }],
      decision: { decisionToPrepare: 'Qué iniciativas pueden aportar evidencia útil antes de la revisión.' },
      decisionChangingUnknowns: [
        { uncertainty: 'Qué iniciativas producirán evidencia a tiempo.', whyItMatters: 'Puede cambiar la secuencia del esfuerzo.' },
        { uncertainty: 'Cuándo estará disponible la señal de churn.', whyItMatters: 'Puede cambiar si la revisión permite comparar resultados.' },
      ],
    });
  });

  it('does not fabricate a reading, tension, or decision for an ambiguous aspiration', () => {
    const synthesis = makeSynthesis({
      insight: {
        statement: null,
        support: [],
        novelty_type: 'no_supported_insight',
        epistemic_role: 'INTERPRETATION',
        status: 'no_supported_insight',
      },
    });

    expect(toLiveUnderstandingViewModel(synthesis)).toEqual({
      state: 'no_supported_insight',
      decisionChangingUnknowns: [],
    });
  });

  it('returns no reading for insufficient basis and retains zero unknowns', () => {
    const synthesis = makeSynthesis({
      basisStatus: 'insufficient_basis',
      insight: {
        statement: null,
        support: [],
        novelty_type: 'no_supported_insight',
        epistemic_role: 'INTERPRETATION',
        status: 'no_supported_insight',
      },
    });

    expect(toLiveUnderstandingViewModel(synthesis)).toEqual({
      state: 'insufficient_basis',
      decisionChangingUnknowns: [],
    });
  });

  it('keeps a single-initiative checkpoint local and omits an unresolved tension', () => {
    const synthesis = makeSynthesis({
      basisStatus: 'partial',
      insight: {
        statement: 'La prueba activa permite preparar una decisión en el checkpoint previsto.',
        support: ['source:active-test', 'source:review-checkpoint'],
        novelty_type: 'decision_structure_clarified',
        epistemic_role: 'INTERPRETATION',
        status: 'supported',
      },
      tensions: [{
        statement: 'No se demuestra una tensión material.',
        status: 'unresolved',
        support: ['source:active-test'],
        why_it_matters: 'No convertir la coexistencia de objetivo y prueba en conflicto.',
        affected_decision: 'internal local checkpoint decision',
      }],
      decisionFrame: framedDecision('Cómo usar el resultado de la prueba en el checkpoint previsto.'),
    });

    expect(toLiveUnderstandingViewModel(synthesis)).toEqual({
      state: 'supported_reading',
      reading: 'La prueba activa permite preparar una decisión en el checkpoint previsto.',
      decision: { decisionToPrepare: 'Cómo usar el resultado de la prueba en el checkpoint previsto.' },
      decisionChangingUnknowns: [],
    });
  });

  it('does not add a decision when the source frame is not yet identifiable', () => {
    const synthesis = makeSynthesis();

    expect(toLiveUnderstandingViewModel(synthesis)).toEqual({
      state: 'supported_reading',
      reading: 'Las señales llegan después del horizonte de revisión.',
      decisionChangingUnknowns: [],
    });
  });

  it('serializes only the user-facing allowlist, even when source data has internal metadata', () => {
    const synthesis = makeSynthesis({
      tensions: [{
        statement: 'Supported tension.',
        status: 'supported',
        support: ['private-source-reference'],
        why_it_matters: 'This changes the framed decision.',
        affected_decision: 'private affected decision',
      }],
      decisionFrame: framedDecision('Whether the initiative should proceed after the evidence review.'),
      unknowns: [decisionChangingUnknown('The external evidence is not yet available.', 'It may change the decision frame.')],
      usableNow: [{
        item: 'private-usable-now-item',
        how_it_can_help: 'private-usable-now-action',
        source_refs: ['private-usable-source-ref'],
        provenance_refs: ['private-usable-provenance-ref'],
      }],
      candidateFirstMovement: {
        movement: 'private-candidate-first-movement',
        why_now: 'private-why-now',
        existing_assets_used: ['private-existing-asset'],
        what_it_may_clarify: 'private-clarification',
        decision_supported: 'private-proposal-decision',
        boundary: 'private-boundary',
        epistemic_role: 'PROPOSAL',
      },
    });
    Object.assign(synthesis, {
      provider_raw: 'private-provider-raw-output',
      provider: 'private-provider',
      model: 'private-model',
      prompt_hash: 'private-prompt-hash',
      manifest_hash: 'private-manifest-hash',
      prompt_version: 'private-prompt-version',
      skill_contract_version: 'private-skill-contract-version',
      schema_version: 'private-schema-version',
      execution_metadata: 'private-execution-metadata',
      resolved_prompt_metadata: 'private-resolved-prompt-metadata',
      conformance_result: 'private-conformance-result',
    });

    const synthesisBeforeMapping = structuredClone(synthesis);
    const viewModel = toLiveUnderstandingViewModel(synthesis);
    expect(synthesis).toEqual(synthesisBeforeMapping);
    const serialized = JSON.stringify(viewModel);
    const blockedFieldNames = [
      'candidate_first_movement',
      'selected_lenses',
      'reasoning_metadata',
      'provenance',
      'claim_ref',
      'source_ref',
      'source_refs',
      'epistemic_role',
      'origin',
      'review_disposition',
      'source_path',
      'source_text',
      'recorded_at',
      'prompt_hash',
      'manifest_hash',
      'prompt_version',
      'skill_contract_version',
      'schema_version',
      'execution_metadata',
      'resolved_prompt_metadata',
      'provider',
      'provider_raw',
      'model',
      'conformance_result',
      'situation_model',
      'usable_now',
      'resolution_mode',
      'current_evidence',
      'materially_distinct_paths',
    ];
    const blockedValues = [
      'private-source-reference',
      'private-affected-decision',
      'private-usable-now-item',
      'private-usable-now-action',
      'private-usable-source-ref',
      'private-usable-provenance-ref',
      'private-candidate-first-movement',
      'private-why-now',
      'private-existing-asset',
      'private-clarification',
      'private-proposal-decision',
      'private-boundary',
      'private-provider-raw-output',
      'private-provider',
      'private-model',
      'private-prompt-hash',
      'private-manifest-hash',
      'private-prompt-version',
      'private-skill-contract-version',
      'private-schema-version',
      'private-execution-metadata',
      'private-resolved-prompt-metadata',
      'private-conformance-result',
      'internal-provenance-id',
      'internal.source.path',
      'internal source text',
      'internal decision authority',
      'internal path',
      'internal condition',
      'internal timing',
      'internal unresolved basis',
      'internal-evidence-ref',
      'internal resolution mode',
      'internal related decision',
    ];

    for (const field of blockedFieldNames) expect(serialized.toLowerCase()).not.toContain(field.toLowerCase());
    for (const value of blockedValues) expect(serialized).not.toContain(value);
  });
});
