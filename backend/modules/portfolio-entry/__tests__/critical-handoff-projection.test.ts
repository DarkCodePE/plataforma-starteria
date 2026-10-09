import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  criticalSituationSynthesisSchema,
  type CriticalSituationSynthesis,
} from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import { toCriticalHandoffProjection } from '../presentation/critical-handoff-projection';

const sourceRef = 'session.user_message:message-1';

function makeSynthesis(overrides: Partial<CriticalSituationSynthesis> = {}): CriticalSituationSynthesis {
  const synthesis: CriticalSituationSynthesis = {
    basis_status: 'sufficient',
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
      material_tensions: [],
    },
    reasoning_metadata: { selected_lenses: ['priority / allocation'] },
    situation_insight: {
      statement: 'La evidencia disponible llega después del checkpoint.',
      support: [sourceRef],
      novelty_type: 'sequence_dependency_exposed',
      epistemic_role: 'INTERPRETATION',
      status: 'supported',
    },
    material_tensions: [],
    decision_frame: {
      status: 'not_yet_identifiable',
      decision_to_prepare: null,
      decision_authority: 'responsable del checkpoint',
      materially_distinct_paths: [],
      distinguishing_conditions: [],
      timing_or_constraints: [],
      unresolved_basis: [],
    },
    usable_now: [],
    decision_changing_unknowns: [],
    candidate_first_movement: null,
    uncertainty_statement: null,
    provenance: [{
      id: 'private-provenance-id',
      claim_ref: 'situation_insight.statement',
      origin: 'AI_INFERRED',
      review_disposition: 'UNREVIEWED',
      source_refs: [sourceRef],
      source_path: null,
      source_text: null,
      recorded_at: null,
    }],
  };

  return criticalSituationSynthesisSchema.parse({ ...synthesis, ...overrides });
}

function noInsight(): CriticalSituationSynthesis['situation_insight'] {
  return {
    statement: null,
    support: [],
    novelty_type: 'no_supported_insight',
    epistemic_role: 'INTERPRETATION',
    status: 'no_supported_insight',
  };
}

function framedDecision(decision: string): CriticalSituationSynthesis['decision_frame'] {
  return {
    status: 'framed',
    decision_to_prepare: decision,
    decision_authority: 'responsable del checkpoint',
    materially_distinct_paths: ['Continuar el trabajo existente', 'Esperar nueva evidencia'],
    distinguishing_conditions: ['Qué evidencia estará disponible'],
    timing_or_constraints: ['El checkpoint ocurre este trimestre'],
    unresolved_basis: [],
  };
}

function usableNow(item: string, howItCanHelp: string): CriticalSituationSynthesis['usable_now'][number] {
  return {
    item,
    how_it_can_help: howItCanHelp,
    source_refs: [sourceRef],
    provenance_refs: ['private-usable-provenance-id'],
  };
}

function firstMovement(overrides: Partial<NonNullable<CriticalSituationSynthesis['candidate_first_movement']>> = {}): NonNullable<CriticalSituationSynthesis['candidate_first_movement']> {
  return {
    movement: 'Revisar el resultado existente antes del checkpoint.',
    why_now: 'El checkpoint ya está previsto para este trimestre.',
    existing_assets_used: [],
    what_it_may_clarify: 'Qué opciones quedan respaldadas por la evidencia.',
    decision_supported: 'Qué evidencia llevar al checkpoint.',
    boundary: 'No toma la decisión por la persona.',
    epistemic_role: 'PROPOSAL',
    ...overrides,
  };
}

describe('Critical Handoff deterministic projection', () => {
  it('projects sufficient supported insight as a supported final reading', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({ basis_status: 'sufficient' }));

    expect(projection.conclusionStatus).toBe('supported');
    expect(projection.finalReading).toBe('La evidencia disponible llega después del checkpoint.');
  });

  it('projects partial supported insight as a bounded final reading', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({ basis_status: 'partial' }));

    expect(projection.conclusionStatus).toBe('bounded');
    expect(projection.finalReading).toBe('La evidencia disponible llega después del checkpoint.');
  });

  it('projects insufficient basis without a reading or first movement', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      basis_status: 'insufficient_basis',
      situation_insight: noInsight(),
    }));

    expect(projection.conclusionStatus).toBe('insufficient_basis');
    expect(projection.finalReading).toBeNull();
    expect(projection.firstMovement).toBeNull();
  });

  it('projects no-supported-insight as insufficient basis without a reading', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      basis_status: 'partial',
      situation_insight: noInsight(),
    }));

    expect(projection.conclusionStatus).toBe('insufficient_basis');
    expect(projection.finalReading).toBeNull();
  });

  it('projects only the user-facing decision statement when the decision is framed', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      decision_frame: framedDecision('Qué evidencia llevar al checkpoint de este trimestre.'),
    }));

    expect(projection.decisionInView).toBe('Qué evidencia llevar al checkpoint de este trimestre.');
  });

  it('returns no decision when the source decision is not yet identifiable', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis());

    expect(projection.decisionInView).toBeNull();
  });

  it('projects usable-now entries with only safe fields and preserves source order', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      usable_now: [
        usableNow('El análisis de churn existente.', 'Permite comparar señales antes del checkpoint.'),
        usableNow('La revisión trimestral prevista.', 'Ofrece el momento para preparar la decisión.'),
      ],
    }));

    expect(projection.usableNow).toEqual([
      { item: 'El análisis de churn existente.', howItCanHelp: 'Permite comparar señales antes del checkpoint.' },
      { item: 'La revisión trimestral prevista.', howItCanHelp: 'Ofrece el momento para preparar la decisión.' },
    ]);
  });

  it('preserves uncertainty and why-it-matters for multiple decision-changing unknowns', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      decision_changing_unknowns: [
        {
          uncertainty: 'Cuándo estará disponible la señal de churn.',
          why_it_matters: 'Puede cambiar si llega a tiempo para el checkpoint.',
          current_evidence: [sourceRef],
          resolution_mode: 'internal resolution mode',
          related_decision: 'private decision id',
          impact_dimensions: ['decision_frame'],
        },
        {
          uncertainty: 'Qué equipos pueden preparar la comparación.',
          why_it_matters: 'Puede cambiar la secuencia del trabajo.',
          current_evidence: null,
          resolution_mode: 'another internal resolution mode',
          related_decision: 'another private decision id',
          impact_dimensions: ['ability_to_act_now'],
        },
      ],
    }));

    expect(projection.decisionChangingUnknowns).toEqual([
      { uncertainty: 'Cuándo estará disponible la señal de churn.', whyItMatters: 'Puede cambiar si llega a tiempo para el checkpoint.' },
      { uncertainty: 'Qué equipos pueden preparar la comparación.', whyItMatters: 'Puede cambiar la secuencia del trabajo.' },
    ]);
  });

  it('projects a valid first movement with only approved fields and source-backed assets', () => {
    const asset = 'El análisis de churn existente.';
    const projection = toCriticalHandoffProjection(makeSynthesis({
      usable_now: [usableNow(asset, 'Permite comparar señales antes del checkpoint.')],
      candidate_first_movement: firstMovement({ existing_assets_used: [asset, 'Activo sin respaldo en usable_now'] }),
    }));

    expect(projection.firstMovement).toEqual({
      movement: 'Revisar el resultado existente antes del checkpoint.',
      whyNow: 'El checkpoint ya está previsto para este trimestre.',
      whatItMayClarify: 'Qué opciones quedan respaldadas por la evidencia.',
      boundary: 'No toma la decisión por la persona.',
      existingAssetsUsed: [asset],
    });
  });

  it('keeps a null source first movement null', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({ candidate_first_movement: null }));

    expect(projection.firstMovement).toBeNull();
  });

  it('rejects attempted first movement when the source has insufficient basis', () => {
    const synthesis = makeSynthesis({
      basis_status: 'insufficient_basis',
      situation_insight: noInsight(),
      candidate_first_movement: firstMovement(),
    });

    expect(() => toCriticalHandoffProjection(synthesis)).toThrow(ZodError);
  });

  it('serializes only the Critical Handoff allowlist and blocks internal metadata', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      candidate_first_movement: firstMovement({ existing_assets_used: ['private asset'] }),
    }));
    const serialized = JSON.stringify(projection);
    const forbidden = [
      'selected_lenses', 'reasoning_metadata', 'provenance', 'claim_ref', 'source_ref', 'source_refs',
      'epistemic_role', 'prompt_hash', 'manifest_hash', 'provider', 'model', 'conformance_result',
      'starteria_path', 'recommended_cta', 'recommended_approach', 'gap_resolution_map',
      'candidate_first_movement', 'situation_model', 'material_tensions', 'distinctAlternative',
    ];

    expect(forbidden.filter((field) => serialized.includes(field))).toEqual([]);
    expect(projection.firstMovement).not.toBeNull();
  });

  it('does not select a distinct alternative from materially distinct paths', () => {
    const projection = toCriticalHandoffProjection(makeSynthesis({
      decision_frame: framedDecision('Qué evidencia llevar al checkpoint.'),
    }));

    expect(projection).not.toHaveProperty('distinctAlternative');
  });

  it('does not mutate the source synthesis', () => {
    const synthesis = makeSynthesis({
      usable_now: [usableNow('Trabajo existente.', 'Puede aportar contexto.')],
      candidate_first_movement: firstMovement(),
    });
    const before = structuredClone(synthesis);

    toCriticalHandoffProjection(synthesis);

    expect(synthesis).toEqual(before);
  });

  it('produces materially different projections for materially different source inputs', () => {
    const first = toCriticalHandoffProjection(makeSynthesis({
      situation_insight: {
        statement: 'La señal llega después de la revisión.',
        support: [sourceRef],
        novelty_type: 'sequence_dependency_exposed',
        epistemic_role: 'INTERPRETATION',
        status: 'supported',
      },
      decision_frame: framedDecision('Qué preparar para la revisión.'),
      usable_now: [usableNow('La revisión prevista.', 'Fija el momento de decisión.')],
    }));
    const second = toCriticalHandoffProjection(makeSynthesis({
      basis_status: 'partial',
      situation_insight: {
        statement: 'La autorización externa condiciona el orden del trabajo.',
        support: [sourceRef],
        novelty_type: 'relationship_made_explicit',
        epistemic_role: 'INTERPRETATION',
        status: 'supported',
      },
      decision_frame: framedDecision('Qué trabajo puede avanzar mientras llega la autorización.'),
      decision_changing_unknowns: [{
        uncertainty: 'Cuándo llegará la autorización.',
        why_it_matters: 'Puede cambiar el orden del trabajo.',
        current_evidence: null,
        resolution_mode: 'internal resolution mode',
        related_decision: 'private decision id',
        impact_dimensions: ['critical_dependency'],
      }],
    }));

    expect(first).not.toEqual(second);
    expect(first.finalReading).not.toBe(second.finalReading);
    expect(first.decisionInView).not.toBe(second.decisionInView);
    expect(second.conclusionStatus).toBe('bounded');
  });

  it('rejects a supported insight combined with insufficient basis instead of downgrading it', () => {
    const synthesis = makeSynthesis({ basis_status: 'insufficient_basis' });

    expect(() => toCriticalHandoffProjection(synthesis)).toThrow(ZodError);
  });

  it('treats an explicitly null situation insight as insufficient basis', () => {
    const source = { ...makeSynthesis(), situation_insight: null };

    const projection = toCriticalHandoffProjection(source as never);

    expect(projection.conclusionStatus).toBe('insufficient_basis');
    expect(projection.finalReading).toBeNull();
    expect(projection.firstMovement).toBeNull();
  });

  it('rejects malformed source structure and malformed movement fields', () => {
    const synthesis = makeSynthesis({ candidate_first_movement: firstMovement() });
    const malformed = {
      ...synthesis,
      candidate_first_movement: { ...synthesis.candidate_first_movement, boundary: undefined },
    };

    expect(() => toCriticalHandoffProjection({ ...synthesis, basis_status: 'unknown' } as never)).toThrow(ZodError);
    expect(() => toCriticalHandoffProjection(malformed as never)).toThrow(ZodError);
  });
});
