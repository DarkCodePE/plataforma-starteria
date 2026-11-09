/**
 * B4-C2B: projection of active provisional answers for E2 question selection.
 * Read-only. Never writes Anchor or upgrades user declarations to confirmed facts.
 */
import { buildGoalQuestionPlan, type GoalPlanAnchor, type GoalPlanContextReview, type GoalQuestionPlan, type GoalField } from './portfolio-bootstrap-goal-question-planner';
import type { GoalTurnDto } from './portfolio-bootstrap-goal-turn.service';

const fields = ['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue'] as const;
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function buildProvisionalGoalQuestionPlan(input: {
  sessionId: string;
  anchor: GoalPlanAnchor;
  contextReview: GoalPlanContextReview | null;
  turns: GoalTurnDto[];
}): GoalQuestionPlan {
  const { sessionId, anchor, contextReview } = input;
  const ordered = [...input.turns].sort((a, b) => a.version - b.version);
  const lastVersion = ordered.at(-1)?.version ?? 0;
  const superseded = new Set(ordered.flatMap((turn) => turn.supersedesTurnId ? [turn.supersedesTurnId] : []));
  const sourceRefs = object(anchor.sourceRefs);
  const conversation = object(sourceRefs.objectiveConversation);
  const acceptedRaw = conversation.goalLedgerAcceptedTurnIds;
  const accepted = new Set(Array.isArray(acceptedRaw) ? acceptedRaw.filter((id): id is string => typeof id === 'string') : []);
  const unknownRaw = conversation.unknownFields;
  const unknown = new Set<GoalField>(Array.isArray(unknownRaw)
    ? fields.filter((field) => unknownRaw.includes(field)) : []);
  const draft: GoalPlanAnchor = { ...anchor };
  const newestByField = new Map<GoalField, GoalTurnDto>();
  for (const turn of ordered) {
    if (!fields.includes(turn.field as GoalField) || turn.sessionId !== sessionId
      || turn.anchorVersion !== anchor.version
      || contextReview?.status !== 'confirmed' || turn.contextReviewVersion !== contextReview.version
      || superseded.has(turn.id) || turn.disposition === 'retracted' || accepted.has(turn.id)) continue;
    newestByField.set(turn.field as GoalField, turn);
  }
  for (const [field, turn] of newestByField) {
    if (turn.disposition === 'unknown' || turn.disposition === 'not_applicable') {
      unknown.add(field);
    } else {
      unknown.delete(field);
      draft[field] = turn.inputText;
    }
  }
  draft.sourceRefs = {
    ...sourceRefs,
    objectiveConversation: { ...conversation, unknownFields: [...unknown] },
  };
  const plan = buildGoalQuestionPlan({ sessionId, anchor: draft, contextReview });
  return {
    ...plan,
    activeQuestion: plan.activeQuestion ? {
      ...plan.activeQuestion,
      // The ID binds the question to this exact provisional ledger version.
      id: `${plan.activeQuestion.id}-ledger${lastVersion}`,
    } : null,
    reason: `${plan.reason} Se han tenido en cuenta las respuestas provisionales vigentes; todavía no están incorporadas al objetivo.`,
  };
}
