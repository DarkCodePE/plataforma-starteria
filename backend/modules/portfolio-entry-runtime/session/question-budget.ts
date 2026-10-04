import type { QuestionPlanV2 } from '../domain/analysis.schema';
import type { QuestionBudgetApplication, QuestionRecord, SessionContext } from '../domain/session.types';

export const GUIDED_QUESTION_BUDGET = 2;

export function getAvailableQuestionBudget(context: SessionContext): number {
  if (context.interaction_mode === 'quick_clarification') {
    return Math.max(0, context.quick_question_budget - context.quick_questions_asked);
  }
  return Math.max(0, GUIDED_QUESTION_BUDGET - context.questions_asked_current_round);
}

export function applyQuestionBudget(
  context: SessionContext,
  questionPlan: QuestionPlanV2,
  turnIndex: number,
): QuestionBudgetApplication {
  const available = getAvailableQuestionBudget(context);
  const received = questionPlan.questions.length;
  const emitted = questionPlan.questions
    .filter((question, index, questions) => index === questions.findIndex((candidate) => (
      candidate.id === question.id || normalizeQuestion(candidate.question) === normalizeQuestion(question.question)
    )))
    .filter((question) => !context.previous_questions.some((previous) => isEquivalentQuestion(previous, question)))
    .sort((left, right) => left.priority - right.priority)
    .slice(0, Math.min(1, available))
    .map<QuestionRecord>((question) => ({
    id: question.id,
    question: question.question,
    reason_to_ask: question.reason_to_ask,
    question_type: question.question_type,
    resolves: question.resolves,
    turn_index: turnIndex,
    interaction_mode: context.interaction_mode,
    asked_at_budget_remaining: available,
  }));

  return {
    available_question_budget: available,
    received_question_count: received,
    emitted_question_count: emitted.length,
    emitted_questions: emitted,
    // A provider batch is a contract violation even when the remaining
    // budget could technically fit it. Only the normalized question consumes
    // one user-facing slot.
    overflow: received > 1 || received > available,
  };
}

function normalizeQuestion(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeResolves(resolves: string[]): string {
  return [...new Set(resolves.map(normalizeQuestion).filter(Boolean))].sort().join('|');
}

function isEquivalentQuestion(previous: QuestionRecord, candidate: { id?: string; question?: string; resolves?: string[] }): boolean {
  if (!candidate.id || !candidate.question || !candidate.resolves) return false;
  return previous.id === candidate.id
    || normalizeQuestion(previous.question) === normalizeQuestion(candidate.question)
    || (normalizeResolves(previous.resolves) !== '' && normalizeResolves(previous.resolves) === normalizeResolves(candidate.resolves));
}

export function consumeQuestionBudget(context: SessionContext, emittedQuestionCount: number): SessionContext {
  if (emittedQuestionCount === 0) return context;
  if (context.interaction_mode === 'quick_clarification') {
    return {
      ...context,
      quick_questions_asked: context.quick_questions_asked + emittedQuestionCount,
    };
  }
  return {
    ...context,
    questions_asked_current_round: context.questions_asked_current_round + emittedQuestionCount,
  };
}
