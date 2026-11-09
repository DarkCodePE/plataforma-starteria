import { AppError } from '../../shared/errors/AppError';
import type { PortfolioGoalCheckpoint } from './portfolio-bootstrap-goal-turn.schemas';
import type { GoalTurnDto } from './portfolio-bootstrap-goal-turn.service';

type Field = 'outcomeStatement' | 'contextSummary' | 'decisionToEnable' | 'businessSignalValue';
const fields: ReadonlyArray<Field> = ['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue'];
const fail = (message: string) => AppError.conflict(message, 'PORTFOLIO_E2_CHECKPOINT_CONFLICT');

function obj(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function receiptIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export type GoalCheckpointAnchor = {
  version: number;
  outcomeStatement: string;
  contextSummary: string | null;
  decisionToEnable: string | null;
  businessSignalStatus: string;
  businessSignalValue: string | null;
  sourceRefs: unknown;
};
export type GoalCheckpointProjection = {
  outcomeStatement: string;
  contextSummary: string | null;
  decisionToEnable: string | null;
  businessSignalStatus: 'confirmed' | 'proxy' | 'suggested' | 'unknown' | 'conflicting';
  businessSignalValue: string | null;
  sourceRefs: Record<string, unknown>;
  acceptedTurnIds: string[];
  rejectedTurnIds: string[];
};

/**
 * Server-owned, pure checkpoint projection. The client supplies ONLY decisions,
 * never field text, sourceRefs, provenance, or a forged result. Every live,
 * undecided turn must be explicitly accepted/rejected in one atomic checkpoint.
 */
export function projectGoalCheckpoint(input: {
  sessionId: string;
  anchor: GoalCheckpointAnchor;
  turns: GoalTurnDto[];
  contextReviewVersion: number;
  checkpoint: PortfolioGoalCheckpoint;
  actorUserId: string;
}): GoalCheckpointProjection {
  const { sessionId, anchor, turns, checkpoint, contextReviewVersion } = input;
  if (checkpoint.expectedAnchorVersion !== anchor.version
    || checkpoint.expectedContextReviewVersion !== contextReviewVersion
    || checkpoint.expectedLedgerVersion !== (turns.at(-1)?.version ?? 0)) {
    throw fail('La versión del contexto, objetivo o conversación cambió: recarga antes de revisar.');
  }
  const refs = obj(anchor.sourceRefs);
  const existing = obj(refs.objectiveConversation);
  const previousAccepted = receiptIds(existing.goalLedgerAcceptedTurnIds);
  const previousRejected = receiptIds(existing.goalLedgerRejectedTurnIds);
  const completed = new Set([...previousAccepted, ...previousRejected]);
  const superseded = new Set(turns.flatMap((turn) => turn.supersedesTurnId ? [turn.supersedesTurnId] : []));
  const open = turns.filter((turn) => !superseded.has(turn.id)
    && turn.disposition !== 'retracted' && !completed.has(turn.id));
  const requested = new Map(checkpoint.decisions.map((choice) => [choice.turnId, choice.action]));
  if (open.length === 0 || open.length !== requested.size
    || open.some((turn) => !requested.has(turn.id))) {
    throw fail('Debes revisar exactamente todas las respuestas vigentes pendientes; algunas cambiaron.');
  }

  const accepted: GoalTurnDto[] = [];
  const rejected: GoalTurnDto[] = [];
  const acceptedFields = new Set<Field>();
  for (const turn of open) {
    if (turn.sessionId !== sessionId || turn.anchorVersion !== anchor.version
      || turn.contextReviewVersion !== contextReviewVersion || !fields.includes(turn.field as Field)) {
      throw fail('Hay respuestas de otra sesión, versión u origen. Recarga y revisa.');
    }
    if (requested.get(turn.id) === 'accept') {
      if (acceptedFields.has(turn.field as Field)) {
        throw fail('Solo se puede aceptar una respuesta vigente por campo del objetivo.');
      }
      acceptedFields.add(turn.field as Field);
      accepted.push(turn);
    } else {
      rejected.push(turn);
    }
  }

  const next: GoalCheckpointProjection = {
    outcomeStatement: anchor.outcomeStatement,
    contextSummary: anchor.contextSummary,
    decisionToEnable: anchor.decisionToEnable,
    businessSignalStatus: anchor.businessSignalStatus as GoalCheckpointProjection['businessSignalStatus'],
    businessSignalValue: anchor.businessSignalValue,
    sourceRefs: {},
    acceptedTurnIds: accepted.map((turn) => turn.id),
    rejectedTurnIds: rejected.map((turn) => turn.id),
  };
  const unknownsRaw = existing.unknownFields;
  const unknowns = new Set<Field>(Array.isArray(unknownsRaw)
    ? fields.filter((field) => unknownsRaw.includes(field)) : []);
  for (const turn of accepted) {
    const field = turn.field as Field;
    const unknown = turn.disposition === 'unknown' || turn.disposition === 'not_applicable';
    if (unknown) unknowns.add(field);
    else unknowns.delete(field);
    if (field === 'outcomeStatement') {
      // Primary outcome is non-nullable; uncertainty stays in provenance only.
      if (!unknown) next.outcomeStatement = turn.inputText;
    } else if (field === 'contextSummary') {
      next.contextSummary = unknown ? null : turn.inputText;
    } else if (field === 'decisionToEnable') {
      next.decisionToEnable = unknown ? null : turn.inputText;
    } else {
      next.businessSignalStatus = unknown ? 'unknown' : 'suggested';
      next.businessSignalValue = unknown ? null : turn.inputText;
    }
  }
  const priorTurns = Array.isArray(existing.turns) ? existing.turns.slice(-Math.max(0, 12 - accepted.length)) : [];
  const recorded = accepted.map((turn) => ({
    field: turn.field,
    value: turn.inputText,
    disposition: turn.disposition === 'user_declared' ? 'user_declared' : 'unknown',
    semanticDisposition: turn.disposition,
    origin: 'PortfolioLead',
    recordedAt: turn.createdAt,
    ledgerTurnId: turn.id,
    ledgerVersion: turn.version,
  }));
  next.sourceRefs = {
    ...(Object.keys(refs).length ? refs : { priorSourceRefs: anchor.sourceRefs }),
    objectiveConversation: {
      ...existing,
      turns: [...priorTurns, ...recorded].slice(-12),
      unknownFields: [...unknowns],
      pendingClarification: null,
      goalLedgerAcceptedTurnIds: [...previousAccepted, ...next.acceptedTurnIds],
      goalLedgerRejectedTurnIds: [...previousRejected, ...next.rejectedTurnIds],
      lastHumanCheckpoint: {
        expectedAnchorVersion: checkpoint.expectedAnchorVersion,
        expectedLedgerVersion: checkpoint.expectedLedgerVersion,
        expectedContextReviewVersion: checkpoint.expectedContextReviewVersion,
        acceptedTurnIds: next.acceptedTurnIds,
        rejectedTurnIds: next.rejectedTurnIds,
        actorUserId: input.actorUserId,
      },
      disposition: 'user_declared',
    },
  };
  return next;
}
