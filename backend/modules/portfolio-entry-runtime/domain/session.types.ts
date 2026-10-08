import type { PortfolioEntryAnalysisV2, QuestionPlanV2 } from './analysis.schema';

export type InteractionMode = 'quick_clarification' | 'guided_exploration';

export type ClarificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'exploration_offered'
  | 'guided_exploration'
  | 'ready_for_handoff'
  | 'ended_with_uncertainty'
  | 'abandoned';

export type UserExplorationChoice = 'not_offered' | 'accept' | 'reject' | 'provisional_route';

export type TechnicalStopReason =
  | 'completed'
  | 'checkpoint_reached'
  | 'quick_budget_exhausted'
  | 'scripted_response_unavailable'
  | 'max_exploration_rounds'
  | 'max_total_user_turns'
  | 'max_total_model_calls'
  | 'budget_violation';

export type SessionContext = {
  interaction_mode: InteractionMode;
  quick_question_budget: 3;
  quick_questions_asked: number;
  exploration_round: number;
  questions_asked_current_round: number;
  previous_questions: QuestionRecord[];
  answered_gaps: string[];
  exploration_goal: string | null;
  user_exploration_choice: UserExplorationChoice;
  clarification_status: ClarificationStatus;
  stop_reason: string | null;
};

export type QuestionRecord = {
  id: string;
  question: string;
  reason_to_ask?: string | null;
  question_type?: string;
  resolves: string[];
  turn_index: number;
  interaction_mode: InteractionMode;
  asked_at_budget_remaining: number;
};

export type FollowUpResponseResult = {
  response: string | null;
  matched_question_ids: string[];
  response_rule_ids_used: string[];
  responded_resolves: string[];
  unmatched_questions: QuestionRecord[];
  fallback_used: boolean;
  consumed_once_rule_ids: string[];
};

export type ScriptedResponseResult = FollowUpResponseResult;

export type SessionTransition = {
  from_status: ClarificationStatus;
  to_status: ClarificationStatus;
  from_mode: InteractionMode;
  to_mode: InteractionMode;
  reason: string;
  trigger: 'agent_output' | 'user_input' | 'user_choice' | 'budget' | 'checkpoint' | 'safety_guard' | 'scripted_responder';
  budget_before: number;
  budget_after: number;
  guard_triggered?: boolean;
  guard_reason?: TechnicalStopReason;
};

export type QuestionBudgetApplication = {
  available_question_budget: number;
  received_question_count: number;
  emitted_question_count: number;
  emitted_questions: QuestionRecord[];
  overflow: boolean;
};

export type SessionTurnTrace = {
  turn_index: number;
  user_input: string;
  analysis: PortfolioEntryAnalysisV2;
  initial_entry_state: PortfolioEntryAnalysisV2['initial_entry_state'];
  current_frame: PortfolioEntryAnalysisV2['current_frame'];
  intent: {
    primary_intent: PortfolioEntryAnalysisV2['primary_intent'];
    secondary_intents: PortfolioEntryAnalysisV2['secondary_intents'];
  };
  reverse_alignment: PortfolioEntryAnalysisV2['reverse_alignment'];
  question_plan: QuestionPlanV2;
  interaction_mode: InteractionMode;
  available_question_budget: number;
  received_question_count: number;
  emitted_question_count: number;
  questions_asked: QuestionRecord[];
  budget_overflow: boolean;
  scripted_response_result?: FollowUpResponseResult;
  transition: SessionTransition;
  provenance_delta?: unknown;
};

export type SessionTrace = {
  case_id: string;
  run_id: string;
  candidate_id: string;
  turns: SessionTurnTrace[];
  questions_total: number;
  quick_questions_total: number;
  exploration_rounds: number;
  mode_transitions: SessionTransition[];
  stop_reason: string | null;
  clarification_status: ClarificationStatus;
  execution_guard_triggered: boolean;
  execution_guard_reason?: TechnicalStopReason;
};

export type SessionExecutionResult = {
  trace: SessionTrace;
  final_context: SessionContext;
  completed: boolean;
  stop_reason: string | null;
  violations: string[];
  modelExecution?: import('../model/model-execution-types').ModelExecutionResult<unknown>;
};

export type PortfolioEntryInitialSessionSettings = {
  initial_mode: InteractionMode;
  quick_question_budget: 3;
};

export type PortfolioEntrySessionRunInput = {
  caseId: string;
  runId: string;
  candidateId: string;
  initialUserInput: string;
  initialContext: SessionContext;
  priorAnalysis?: PortfolioEntryAnalysisV2;
  sessionId?: string;
  userInputIntent?: 'answer' | 'correction';
  guidedExplorationChoice?: 'accept' | 'provisional_route' | 'reject';
  followUpResponder?: (questions: QuestionRecord[], context: SessionContext) => FollowUpResponseResult;
};

export function createInitialSessionContext(settings: PortfolioEntryInitialSessionSettings): SessionContext {
  return {
    interaction_mode: settings.initial_mode,
    quick_question_budget: settings.quick_question_budget,
    quick_questions_asked: 0,
    exploration_round: 0,
    questions_asked_current_round: 0,
    previous_questions: [],
    answered_gaps: [],
    exploration_goal: null,
    user_exploration_choice: 'not_offered',
    clarification_status: 'not_started',
    stop_reason: null,
  };
}
