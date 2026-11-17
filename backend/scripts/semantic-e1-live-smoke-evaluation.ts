import type { SemanticTurnDto } from '../modules/portfolio-bootstrap/portfolio-bootstrap-semantic.service';

export const semanticE1PreflightPredicates = [
  'processing',
  'status',
  'provider',
  'model',
  'tokenUsage',
  'facts',
  'startingPoint',
  'mainUncertainty',
  'hasNextStep',
] as const;

export type SemanticE1PreflightPredicate = typeof semanticE1PreflightPredicates[number];

type PreflightTurn = Pick<
  SemanticTurnDto,
  'status' | 'facts' | 'hypotheses' | 'dispositions' | 'emittedQuestion' | 'convergence' | 'execution'
>;

export interface SemanticE1PreflightInput {
  processing: boolean;
  turn: PreflightTurn;
}

export interface SemanticE1PreflightEvaluation {
  passed: boolean;
  predicates: Record<SemanticE1PreflightPredicate, boolean>;
  failedPredicates: SemanticE1PreflightPredicate[];
  diagnostics: {
    status: SemanticTurnDto['status'];
    provider: string | null;
    model: string | null;
    tokenUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    convergenceStatus: SemanticTurnDto['convergence']['status'];
    emittedQuestion: boolean;
    synthesis: boolean;
  };
}

export function evaluateSemanticE1Preflight(input: SemanticE1PreflightInput): SemanticE1PreflightEvaluation {
  const { turn } = input;
  const activeFactConcepts = new Set(turn.facts
    .filter((fact) => fact.status !== 'retracted')
    .map((fact) => fact.conceptId));
  const materialUnknownConcepts = new Set(['main_uncertainty', 'uncertainty', 'root_cause', 'solution']);
  const hasUnknownMaterialUncertainty = turn.dispositions.some((item) => (
    item.disposition === 'unknown'
    && materialUnknownConcepts.has(item.conceptId)
    && !activeFactConcepts.has(item.conceptId)
  ));
  const predicates: Record<SemanticE1PreflightPredicate, boolean> = {
    processing: !input.processing,
    status: turn.status === 'completed',
    provider: Boolean(turn.execution.provider)
      && turn.execution.provider !== 'deterministic_test_adapter',
    model: Boolean(turn.execution.model),
    tokenUsage: turn.execution.totalTokens > 0,
    facts: turn.facts.length > 0,
    startingPoint: turn.hypotheses.some((item) => item.hypothesisId.startsWith('starting_point.')),
    // A material question is a valid E1 outcome before the main uncertainty is resolved.
    // The orchestrator has already applied the question relevance and grounding guardrails.
    mainUncertainty: turn.hypotheses.some((item) => item.hypothesisId === 'main_uncertainty')
      || turn.facts.some((item) => (
        item.conceptId === 'main_uncertainty' || item.conceptId === 'uncertainty'
      ))
      || hasUnknownMaterialUncertainty
      || (turn.convergence.status === 'question_required' && Boolean(turn.emittedQuestion)),
    hasNextStep: Boolean(turn.emittedQuestion) || Boolean(turn.convergence.synthesis),
  };
  const failedPredicates = semanticE1PreflightPredicates.filter((predicate) => !predicates[predicate]);

  return {
    passed: failedPredicates.length === 0,
    predicates,
    failedPredicates,
    diagnostics: {
      status: turn.status,
      provider: turn.execution.provider,
      model: turn.execution.model,
      tokenUsage: {
        inputTokens: turn.execution.inputTokens,
        outputTokens: turn.execution.outputTokens,
        totalTokens: turn.execution.totalTokens,
      },
      convergenceStatus: turn.convergence.status,
      emittedQuestion: Boolean(turn.emittedQuestion),
      synthesis: Boolean(turn.convergence.synthesis),
    },
  };
}
