/**
 * KAN-253 B4-A — verified context for a future E2 semantic question planner.
 *
 * Read-only and deterministic. Provisional turns are never promoted to Anchor,
 * even when their wording looks like a business fact. This is NOT a model call.
 */
import type { GoalTurnDto } from './portfolio-bootstrap-goal-turn.service';

export type E2ConversationContext = {
  anchorVersion: number;
  ledgerVersion: number;
  confirmedE1: { reviewId: string; version: number; situation: string } | null;
  confirmedAnchor: {
    outcomeStatement: string | null;
    contextSummary: string | null;
    decisionToEnable: string | null;
    businessSignalValue: string | null;
  };
  activeProvisional: Array<{
    turnId: string;
    turnVersion: number;
    questionId: string;
    field: string;
    literalAnswer: string;
    disposition: GoalTurnDto['disposition'];
    source: 'user_input';
    reviewStatus: 'unreviewed' | 'incorporated' | 'stale_anchor';
  }>;
  excludedHistory: Array<{
    turnId: string;
    reason: 'superseded' | 'retracted';
  }>;
};

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function acceptedIds(sourceRefs: unknown): Set<string> {
  const source = asObject(asObject(sourceRefs).objectiveConversation).goalLedgerAcceptedTurnIds;
  return new Set(Array.isArray(source) ? source.filter((id): id is string => typeof id === 'string') : []);
}

export function buildE2ConversationContext(input: {
  anchor: {
    version: number;
    outcomeStatement: string | null;
    contextSummary: string | null;
    decisionToEnable: string | null;
    businessSignalValue: string | null;
    sourceRefs: unknown;
  };
  confirmedE1: { id: string; status: string; version: number; situation: string | null } | null;
  turns: GoalTurnDto[];
}): E2ConversationContext {
  const { anchor, confirmedE1 } = input;
  const turns = [...input.turns].sort((a, b) => a.version - b.version);
  const superseded = new Set(turns.flatMap((turn) => turn.supersedesTurnId ? [turn.supersedesTurnId] : []));
  const incorporated = acceptedIds(anchor.sourceRefs);

  return {
    anchorVersion: anchor.version,
    ledgerVersion: turns[turns.length - 1]?.version ?? 0,
    confirmedE1: confirmedE1?.status === 'confirmed' && confirmedE1.situation?.trim()
      ? { reviewId: confirmedE1.id, version: confirmedE1.version, situation: confirmedE1.situation.trim() }
      : null,
    confirmedAnchor: {
      outcomeStatement: anchor.outcomeStatement,
      contextSummary: anchor.contextSummary,
      decisionToEnable: anchor.decisionToEnable,
      businessSignalValue: anchor.businessSignalValue,
    },
    activeProvisional: turns.filter((turn) => !superseded.has(turn.id) && turn.disposition !== 'retracted')
      .map((turn) => ({
        turnId: turn.id,
        turnVersion: turn.version,
        questionId: turn.questionId,
        field: turn.field,
        literalAnswer: turn.inputText,
        disposition: turn.disposition,
        source: 'user_input' as const,
        reviewStatus: incorporated.has(turn.id)
          ? 'incorporated' as const
          : turn.anchorVersion !== anchor.version
            ? 'stale_anchor' as const
            : 'unreviewed' as const,
      })),
    excludedHistory: turns.filter((turn) => superseded.has(turn.id) || turn.disposition === 'retracted')
      .map((turn) => ({
        turnId: turn.id,
        reason: superseded.has(turn.id) ? 'superseded' as const : 'retracted' as const,
      })),
  };
}
