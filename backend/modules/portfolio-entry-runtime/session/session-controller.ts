import type { PortfolioEntryAgentAdapterV2, PortfolioEntryAnalyzeTurnOutputV2 } from '../agent/portfolio-entry-agent-adapter';
import { applyQuestionBudget, consumeQuestionBudget, getAvailableQuestionBudget, GUIDED_QUESTION_BUDGET } from './question-budget';
import { applyAnswerResolution } from './single-turn-result';
import { SESSION_SAFETY_LIMITS } from './session-safety-limits';
import type {
  ClarificationStatus,
  InteractionMode,
  PortfolioEntrySessionRunInput,
  QuestionRecord,
  SessionContext,
  SessionExecutionResult,
  SessionTransition,
  SessionTurnTrace,
  TechnicalStopReason,
} from '../domain/session.types';

type ControllerOptions = {
  runId: string;
  candidateId: string;
  safetyLimits?: Partial<typeof SESSION_SAFETY_LIMITS>;
};

export class PortfolioEntrySessionController {
  constructor(
    private readonly adapter: PortfolioEntryAgentAdapterV2,
    private readonly options: ControllerOptions,
  ) {}

  async execute(input: PortfolioEntrySessionRunInput): Promise<SessionExecutionResult> {
    let context = input.initialContext;
    let nextUserInput: string | null = input.initialUserInput;
    let priorAnalysis: PortfolioEntryAnalyzeTurnOutputV2['analysis'] | undefined = input.priorAnalysis;
    const turns: SessionTurnTrace[] = [];
    const modeTransitions: SessionTransition[] = [];
    const violations: string[] = [];
    let modelCalls = 0;
    let modelExecution: SessionExecutionResult['modelExecution'];
    let executionGuardTriggered = false;
    let executionGuardReason: TechnicalStopReason | undefined;

    if (context.clarification_status === 'exploration_offered') {
      if (input.guidedExplorationChoice) {
        const optInTransition = applyExplorationChoice(context, input.guidedExplorationChoice);
        context = applyExplorationTransition(context, optInTransition, input.guidedExplorationChoice);
        modeTransitions.push(optInTransition);
        nextUserInput = optInTransition.to_status === 'guided_exploration'
          ? 'Acepto explorar un poco mas antes de ver una ruta provisional.'
          : null;
      } else if (input.userInputIntent === 'correction') {
        const correctionTransition = reopenClarificationForCorrection(context);
        context = { ...context, clarification_status: 'in_progress', stop_reason: null };
        modeTransitions.push(correctionTransition);
      } else {
        nextUserInput = null;
      }
    } else if (context.clarification_status === 'ready_for_handoff' && input.userInputIntent === 'correction') {
      const correctionTransition = reopenClarificationForCorrection(context);
      context = { ...context, clarification_status: 'in_progress', stop_reason: null };
      modeTransitions.push(correctionTransition);
    }

    while (nextUserInput !== null) {
      const userTurnGuard = checkSafetyGuard(turns.length + 1, modelCalls, context.exploration_round, this.options.safetyLimits);
      if (userTurnGuard) {
        executionGuardTriggered = true;
        executionGuardReason = userTurnGuard;
        context = { ...context, stop_reason: userTurnGuard };
        break;
      }

      const turnIndex = turns.length + 1;
      const currentUserInput = nextUserInput;
      const fromStatus = context.clarification_status;
      const fromMode = context.interaction_mode;
      context = {
        ...context,
        clarification_status: context.clarification_status === 'not_started' ? 'in_progress' : context.clarification_status,
      };

      modelCalls += 1;
      const generatedOutput = await this.adapter.analyzeTurn({
        entryId: `${input.caseId}-${input.runId}-${turnIndex}`,
        sessionId: input.sessionId ?? `${input.caseId}-${input.runId}`,
        rawInput: nextUserInput,
        priorAnalysis,
        sessionContext: context,
      });
      const output = input.guidedExplorationChoice === 'accept'
        && turns.length === 0
        && input.priorAnalysis
        ? { ...generatedOutput, analysis: input.priorAnalysis }
        : generatedOutput;
      modelExecution = output.modelExecution;
      priorAnalysis = output.analysis;

      const budgetApplication = applyQuestionBudget(context, output.question_plan, turnIndex);
      if (budgetApplication.overflow) violations.push('question_budget_overflow');
      const budgetBefore = budgetApplication.available_question_budget;
      context = consumeQuestionBudget(context, budgetApplication.emitted_question_count);
      context = {
        ...context,
        previous_questions: [...context.previous_questions, ...budgetApplication.emitted_questions],
      };

      const transition = transitionFromStructuredOutput(
        context,
        fromStatus,
        fromMode,
        budgetBefore,
        getAvailableQuestionBudget(context),
        output,
        budgetApplication.emitted_questions,
        budgetApplication.overflow,
      );
      context = {
        ...context,
        clarification_status: transition.to_status,
        interaction_mode: transition.to_mode,
        stop_reason: terminalStatuses.has(transition.to_status) ? transition.reason : context.stop_reason,
      };
      if (transition.from_mode !== transition.to_mode || transition.from_status !== transition.to_status) {
        modeTransitions.push(transition);
      }

      let scriptedResponseResult;
      nextUserInput = null;
      if (budgetApplication.emitted_questions.length > 0 && !terminalStatuses.has(context.clarification_status)) {
        scriptedResponseResult = input.followUpResponder?.(budgetApplication.emitted_questions, context);
        if (scriptedResponseResult?.response) {
          const answer = applyAnswerResolution(context, budgetApplication.emitted_questions[0] ?? null, scriptedResponseResult.matched_question_ids, scriptedResponseResult.response);
          context = answer.context;
          scriptedResponseResult = { ...scriptedResponseResult, matched_question_ids: answer.matchedQuestionIds, responded_resolves: answer.respondedResolves };
          nextUserInput = scriptedResponseResult.response;
        }
      }

      turns.push({
        turn_index: turnIndex,
        user_input: currentUserInput,
        analysis: output.analysis,
        initial_entry_state: output.analysis.initial_entry_state,
        current_frame: output.analysis.current_frame,
        intent: {
          primary_intent: output.analysis.primary_intent,
          secondary_intents: output.analysis.secondary_intents,
        },
        reverse_alignment: output.analysis.reverse_alignment,
        question_plan: output.question_plan,
        interaction_mode: fromMode,
        available_question_budget: budgetApplication.available_question_budget,
        received_question_count: budgetApplication.received_question_count,
        emitted_question_count: budgetApplication.emitted_question_count,
        questions_asked: budgetApplication.emitted_questions,
        budget_overflow: budgetApplication.overflow,
        scripted_response_result: scriptedResponseResult,
        transition,
      });

      if (terminalStatuses.has(context.clarification_status)) break;
    }

    const trace = {
      case_id: input.caseId,
      run_id: input.runId,
      candidate_id: input.candidateId,
      turns,
      questions_total: turns.reduce((total, turn) => total + turn.emitted_question_count, 0),
      quick_questions_total: context.quick_questions_asked,
      exploration_rounds: context.exploration_round,
      mode_transitions: modeTransitions,
      stop_reason: context.stop_reason,
      clarification_status: context.clarification_status,
      execution_guard_triggered: executionGuardTriggered,
      execution_guard_reason: executionGuardReason,
    };

    return {
      trace,
      final_context: context,
      completed: !executionGuardTriggered && terminalStatuses.has(context.clarification_status),
      stop_reason: context.stop_reason,
      violations,
      modelExecution,
    };
  }
}

const terminalStatuses = new Set<ClarificationStatus>([
  'ready_for_handoff',
  'ended_with_uncertainty',
  'abandoned',
]);

function transitionFromStructuredOutput(
  context: SessionContext,
  fromStatus: ClarificationStatus,
  fromMode: InteractionMode,
  budgetBefore: number,
  budgetAfter: number,
  output: PortfolioEntryAnalyzeTurnOutputV2,
  emittedQuestions: QuestionRecord[],
  budgetOverflow: boolean,
): SessionTransition {
  const plan = output.question_plan;

  // Quick Clarification must converge whenever a turn has no user-facing
  // question. A provider plan without an emitted question cannot leave the
  // user waiting in an answer state.
  if (context.interaction_mode === 'quick_clarification' && emittedQuestions.length === 0) {
    return createTransition(
      fromStatus,
      'exploration_offered',
      fromMode,
      fromMode,
      plan.stop_reason === 'sufficient_context'
        ? 'sufficient_context_checkpoint'
        : budgetBefore === 0
          ? 'quick_budget_exhausted'
          : 'no_new_material_question',
      plan.stop_reason === 'sufficient_context' || budgetBefore > 0 ? 'agent_output' : 'budget',
      budgetBefore,
      budgetAfter,
    );
  }

  if (context.interaction_mode === 'quick_clarification' && plan.stop_reason === 'sufficient_context') {
    return createTransition(
      fromStatus,
      'exploration_offered',
      fromMode,
      fromMode,
      'sufficient_context_checkpoint',
      'agent_output',
      budgetBefore,
      budgetAfter,
    );
  }

  if (context.interaction_mode === 'guided_exploration') {
    if (isReadySignal(plan.status, plan.stop_reason)) {
      return createTransition(fromStatus, 'exploration_offered', fromMode, fromMode, 'guided_checkpoint_reached', 'checkpoint', budgetBefore, budgetAfter);
    }

    if (budgetAfter === 0 || emittedQuestions.length === 0) {
      return createTransition(
        fromStatus,
        'exploration_offered',
        fromMode,
        fromMode,
        emittedQuestions.length === 0 ? 'no_new_material_question' : 'guided_budget_exhausted',
        'checkpoint',
        budgetBefore,
        budgetAfter,
      );
    }
  }

  if (isReadySignal(plan.status, plan.stop_reason)) {
    return createTransition(fromStatus, 'ready_for_handoff', fromMode, fromMode, plan.stop_reason ?? 'structured_no_questions_required', 'agent_output', budgetBefore, budgetAfter);
  }

  if (budgetOverflow && budgetBefore === 0 && context.interaction_mode === 'quick_clarification') {
    return createTransition(fromStatus, 'exploration_offered', fromMode, fromMode, 'no_new_material_question', 'checkpoint', budgetBefore, budgetAfter);
  }

  return createTransition(fromStatus, context.interaction_mode === 'guided_exploration' ? 'guided_exploration' : 'in_progress', fromMode, fromMode, 'questions_emitted', 'agent_output', budgetBefore, budgetAfter);
}

function applyExplorationChoice(context: SessionContext, choice: 'accept' | 'provisional_route' | 'reject'): SessionTransition {
  if (choice === 'accept') {
    if (context.interaction_mode !== 'quick_clarification' || context.exploration_round >= 1) {
      return createTransition(
        context.clarification_status,
        'ready_for_handoff',
        context.interaction_mode,
        context.interaction_mode,
        'guided_round_already_consumed',
        'checkpoint',
        getAvailableQuestionBudget(context),
        getAvailableQuestionBudget(context),
      );
    }
    return createTransition(
      context.clarification_status,
      'guided_exploration',
      context.interaction_mode,
      'guided_exploration',
      'user_accepted_guided_exploration',
      'user_choice',
      getAvailableQuestionBudget(context),
      GUIDED_QUESTION_BUDGET,
    );
  }
  if (choice === 'reject') {
    return createTransition(
      context.clarification_status,
      'ended_with_uncertainty',
      context.interaction_mode,
      context.interaction_mode,
      'user_rejected_guided_exploration',
      'user_choice',
      getAvailableQuestionBudget(context),
      getAvailableQuestionBudget(context),
    );
  }
  return createTransition(
    context.clarification_status,
    'ready_for_handoff',
    context.interaction_mode,
    context.interaction_mode,
    'user_chose_provisional_route',
    'user_choice',
    getAvailableQuestionBudget(context),
    getAvailableQuestionBudget(context),
  );
}

function applyExplorationTransition(
  context: SessionContext,
  transition: SessionTransition,
  choice: 'accept' | 'provisional_route' | 'reject',
): SessionContext {
  return {
    ...context,
    interaction_mode: transition.to_mode,
    clarification_status: transition.to_status,
    user_exploration_choice: choice,
    exploration_round: transition.to_status === 'guided_exploration' ? context.exploration_round + 1 : context.exploration_round,
    questions_asked_current_round: 0,
    exploration_goal: transition.to_status === 'guided_exploration' ? 'continue_clarifying_structured_question_plan' : context.exploration_goal,
    stop_reason: terminalStatuses.has(transition.to_status) ? transition.reason : null,
  };
}

function reopenClarificationForCorrection(context: SessionContext): SessionTransition {
  const availableBudget = getAvailableQuestionBudget(context);
  return createTransition(
    context.clarification_status,
    'in_progress',
    context.interaction_mode,
    context.interaction_mode,
    'user_correction_reopened_clarification',
    'user_input',
    availableBudget,
    availableBudget,
  );
}

function isReadySignal(_status: string | undefined, stopReason: string | undefined): boolean {
  return stopReason === 'sufficient_context'
    || stopReason === 'noncritical_gaps_only'
    || stopReason === 'exploration_goal_satisfied'
    || stopReason === 'later_stage_detail'
    || stopReason === 'step_boundary'
    || stopReason === 'no_supported_question';
}

function createTransition(
  fromStatus: ClarificationStatus,
  toStatus: ClarificationStatus,
  fromMode: InteractionMode,
  toMode: InteractionMode,
  reason: string,
  trigger: SessionTransition['trigger'],
  budgetBefore: number,
  budgetAfter: number,
): SessionTransition {
  return {
    from_status: fromStatus,
    to_status: toStatus,
    from_mode: fromMode,
    to_mode: toMode,
    reason,
    trigger,
    budget_before: budgetBefore,
    budget_after: budgetAfter,
  };
}

function checkSafetyGuard(
  nextTurnCount: number,
  modelCalls: number,
  explorationRounds: number,
  overrides: Partial<typeof SESSION_SAFETY_LIMITS> = {},
): TechnicalStopReason | null {
  const limits = { ...SESSION_SAFETY_LIMITS, ...overrides };
  if (nextTurnCount > limits.MAX_TOTAL_USER_TURNS) return 'max_total_user_turns';
  if (modelCalls >= limits.MAX_TOTAL_MODEL_CALLS) return 'max_total_model_calls';
  if (explorationRounds > limits.MAX_EXPLORATION_ROUNDS) return 'max_exploration_rounds';
  return null;
}
