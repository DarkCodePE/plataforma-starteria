import { describe, expect, it } from 'vitest';
import { DeterministicPortfolioEntryHandoffMaterializer } from '../handoff/handoff-materializer';
import { buildValueHandoffEvidenceV2 } from '../handoff/value-handoff-evidence';
import { createInitialSessionContext } from '../domain/session.types';
import type { PortfolioEntryAnalysisV2 } from '../domain/analysis.schema';
import type { SessionExecutionResult } from '../domain/session.types';
import { applyQuestionBudget } from '../session/question-budget';
import { DeterministicPortfolioEntryAgentAdapter } from '../../portfolio-entry/application/portfolio-entry-experimental-session.service';

describe('Portfolio Entry value handoff cognition', () => {
  it('preserves the planner reason on the emitted QuestionRecord', () => {
    const result = applyQuestionBudget(createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }), {
      questions: [{
        id: 'decision-gap', question: '¿Qué decisión necesitas habilitar?', reason_to_ask: 'Aclarar la decisión que debes preparar.',
        resolves: ['decision_to_enable'], priority: 1, expected_answer_type: 'text',
      }], question_count: 1, status: 'questions_required',
    }, 1);
    expect(result.emitted_questions[0]?.reason_to_ask).toBe('Aclarar la decisión que debes preparar.');
  });

  it('preserves an explicit decision from a deterministic entry turn', async () => {
    const result = await new DeterministicPortfolioEntryAgentAdapter().analyzeTurn({
      entryId: 'entry-1',
      sessionId: 'session-1',
      rawInput: 'Tengo 18 iniciativas y necesito decidir cuales continuar.',
      sessionContext: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    });

    expect(result.analysis.extracted_context.decision_to_enable).toBe('Decidir cuales continuar');

    const handoff = await new DeterministicPortfolioEntryHandoffMaterializer().materialize({
      sessionId: 'session-1',
      runId: 'run-1',
      analysis: result.analysis,
      context: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    });
    expect(handoff.handoff.decision_to_enable).toEqual(expect.objectContaining({ value: 'Decidir cuales continuar' }));
  });

  it('keeps specific situation anchors in understanding instead of falling back to frame taxonomy', async () => {
    const analysis = makeAnalysis();
    const result = await new DeterministicPortfolioEntryHandoffMaterializer().materialize({
      sessionId: 'session-specific',
      runId: 'run-specific',
      analysis,
      context: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    });

    expect(result.handoff.understanding.value).toContain('iniciativas inactivas');
    expect(result.handoff.understanding.value).toContain('usuarios impactados');
    expect(result.handoff.understanding.value).not.toBe('Situación de portfolio first.');
  });

  it('turns contextual analysis into a recommendation, rationale, mapped gaps and one Starteria path', async () => {
    const analysis = makeAnalysis();
    const context = createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 });
    const result = await new DeterministicPortfolioEntryHandoffMaterializer().materialize({
      sessionId: 'session-1', runId: 'run-1', analysis, context,
    });

    expect(result.handoff.recommended_approach?.description).toContain('usuarios impactados');
    expect(result.handoff.recommended_approach?.rationale).toContain('decisión');
    expect(result.handoff.decision_to_enable).toBe('unresolved');
    expect(result.handoff.starteria_path.map((item) => item.action)).toEqual([
      'structure', 'make_visible', 'compare_or_follow', 'resolve_gaps', 'prepare_decision',
    ]);
    expect(result.handoff.unresolved_context.map((gap) => gap.gap_id))
      .toEqual(result.handoff.gap_resolution_map.map((gap) => gap.gap_id));
    expect(result.valueDeltaEvidence?.metric).toBe('value_delta');
    expect(result.valueDeltaEvidence?.evaluation).toBe('HUMAN_REVIEW_REQUIRED');
  });

  it('emits automatic checks while keeping value_delta as a human-reviewed metric', () => {
    const analysis = makeAnalysis();
    const execution = makeExecution();
    const handoff = {
      understanding: { value: 'Portfolio amplio con iniciativas inactivas.' },
      desired_outcome: { value: 'Decidir dónde concentrar atención.' },
      decision_to_enable: 'unresolved' as const,
      recommended_approach: {
        description: 'Ordenar el portfolio de iniciativas y hacer visibles usuarios impactados y ventas antes de concentrar atención.',
        rationale: 'Así la decisión parte de señales y evidencia del portfolio real.',
        origin: 'AI_SUGGESTED' as const,
        review_disposition: 'UNREVIEWED' as const,
      },
      alternative_approaches: [],
      known_context: [],
      unresolved_context: [{ gap_id: 'gap-1', description: 'Falta evidencia.' }],
      gap_resolution_map: [{ gap_id: 'gap-1', gap_description: 'Falta evidencia.', resolution_type: 'REQUIRES_EXTERNAL_EVIDENCE' as const, resolution_stage: 'PORTFOLIO' as const }],
      evidence_or_clarity_needed: [],
      starteria_path: [
        { action: 'structure' as const, description: 'Ordenar.' },
        { action: 'make_visible' as const, description: 'Hacer visible.' },
        { action: 'prepare_decision' as const, description: 'Preparar.' },
      ],
      recommended_cta: 'Continuar con mi portafolio',
      provenance_summary: [],
      handoff_status: 'ready_with_uncertainty' as const,
    };
    const evidence = buildValueHandoffEvidenceV2({ execution, handoff, analysis });

    expect(evidence.metric).toBe('value_delta');
    expect(evidence.evaluation).toBe('HUMAN_REVIEW_REQUIRED');
    expect(evidence.automatic_checks.repeat_only_risk).toBe(false);
  });

  it('does not repeat a question after an unusable answer', () => {
    const context = {
      ...createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
      previous_questions: [{
        id: 'decision-gap', question: '¿Qué decisión quieres habilitar?', resolves: ['decision_to_enable'],
        turn_index: 1, interaction_mode: 'quick_clarification' as const, asked_at_budget_remaining: 3,
      }],
    };
    const result = applyQuestionBudget(context, {
      questions: [{
        id: 'decision-gap', question: '¿Qué decisión quieres habilitar?', reason_to_ask: 'Aclarar',
        resolves: ['decision_to_enable'], priority: 1, expected_answer_type: 'text',
      }], question_count: 1, status: 'questions_required',
    }, 2);

    expect(result.emitted_questions).toEqual([]);
  });
});

function makeAnalysis(): PortfolioEntryAnalysisV2 {
  return {
    entry_id: 'entry-1', analysis_version: 'v0.2', primary_intent: 'portfolio_prioritization', secondary_intents: [],
    initial_entry_state: 'portfolio_first', current_frame: 'portfolio_first',
    extracted_context: {
      summary: 'Gestionar un portfolio amplio con iniciativas inactivas y relacionarlo con usuarios impactados y ventas.',
      desired_outcome: 'Decidir dónde concentrar atención.',
    }, ambiguities: ['Falta un criterio explícito para concentrar atención.'], contradictions: [],
    reverse_alignment: { required: false, connection_state: 'not_required' }, provenance: [], status: 'ready',
  };
}

function makeExecution(): SessionExecutionResult {
  return {
    trace: {
      case_id: 'case-1', run_id: 'run-1', candidate_id: 'candidate-1',
      turns: [{ user_input: 'Gestionar un portfolio amplio con usuarios impactados y ventas.' } as never],
      questions_total: 2, quick_questions_total: 2, exploration_rounds: 0, mode_transitions: [],
      stop_reason: 'sufficient_context', clarification_status: 'ready_for_handoff', execution_guard_triggered: false,
    },
    final_context: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    completed: true, stop_reason: 'sufficient_context', violations: [],
  };
}
