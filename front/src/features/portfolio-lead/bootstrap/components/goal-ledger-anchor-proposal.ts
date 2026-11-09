import type {
  PortfolioBootstrapAnchor,
  PortfolioGoalTurn,
  UpdatePortfolioBootstrapAnchorInput,
} from '../services/portfolioBootstrapClient';

const fields = ['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue'] as const;
type GoalField = (typeof fields)[number];

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function acceptedIds(sourceRefs: unknown): string[] {
  const refs = object(object(sourceRefs).objectiveConversation).goalLedgerAcceptedTurnIds;
  return Array.isArray(refs) ? refs.filter((id): id is string => typeof id === 'string') : [];
}

export function isGoalLedgerTurnAccepted(sourceRefs: unknown, turnId: string): boolean {
  return acceptedIds(sourceRefs).includes(turnId);
}

export function isGoalLedgerTurnRejected(sourceRefs: unknown, turnId: string): boolean {
  const rejected = object(object(sourceRefs).objectiveConversation).goalLedgerRejectedTurnIds;
  return Array.isArray(rejected) && rejected.includes(turnId);
}

export function isGoalLedgerTurnResolved(sourceRefs: unknown, turnId: string): boolean {
  return isGoalLedgerTurnAccepted(sourceRefs, turnId) || isGoalLedgerTurnRejected(sourceRefs, turnId);
}

/**
 * A *proposal* for the existing explicit updateAnchor action. This pure function
 * never persists anything or confirms E2. B3 keeps the human review checkpoint.
 */
export function createGoalLedgerAnchorProposal(
  anchor: PortfolioBootstrapAnchor,
  turn: PortfolioGoalTurn,
): UpdatePortfolioBootstrapAnchorInput {
  if (turn.sessionId !== anchor.bootstrapSessionId) {
    throw new Error('La respuesta pertenece a otra sesión.');
  }
  if (turn.anchorVersion !== anchor.version) {
    throw new Error('La versión del Anchor cambió. Recupera la información antes de incorporar esta respuesta.');
  }
  if (!fields.includes(turn.field as GoalField)) {
    throw new Error('La respuesta no corresponde a un campo del objetivo verificable.');
  }
  if (turn.disposition === 'retracted') {
    throw new Error('Una respuesta retractada no puede convertirse en un hecho de negocio.');
  }
  if (isGoalLedgerTurnAccepted(anchor.sourceRefs, turn.id)) {
    throw new Error('La respuesta ya consta incorporada al Anchor.');
  }
  const original = object(anchor.sourceRefs);
  const sourceRefs = Object.keys(original).length ? original
    : { priorSourceRefs: anchor.sourceRefs };
  const conversation = object(sourceRefs.objectiveConversation);
  const priorTurns = Array.isArray(conversation.turns) ? conversation.turns.slice(-11) : [];
  const priorUnknown = Array.isArray(conversation.unknownFields)
    ? conversation.unknownFields.filter((key): key is GoalField =>
      typeof key === 'string' && fields.includes(key as GoalField))
    : [];
  const isUnknown = turn.disposition === 'unknown' || turn.disposition === 'not_applicable';
  const unknownFields = isUnknown
    ? [...new Set([...priorUnknown, turn.field as GoalField])]
    : priorUnknown.filter((field) => field !== turn.field);
  const legacyTurn = {
    field: turn.field,
    value: turn.inputText,
    disposition: isUnknown ? 'unknown' : 'user_declared',
    origin: 'PortfolioLead',
    recordedAt: turn.createdAt,
    ledgerTurnId: turn.id,
    ledgerVersion: turn.version,
    semanticDisposition: turn.disposition,
  };
  const conversationNext = {
    ...conversation,
    field: turn.field,
    value: turn.inputText,
    disposition: legacyTurn.disposition,
    origin: 'PortfolioLead',
    recordedAt: turn.createdAt,
    turns: [...priorTurns, legacyTurn],
    unknownFields,
    pendingClarification: null,
    goalLedgerAcceptedTurnIds: [...acceptedIds(anchor.sourceRefs), turn.id],
  };
  const result: UpdatePortfolioBootstrapAnchorInput = {
    expectedVersion: anchor.version,
    sourceRefs: { ...sourceRefs, objectiveConversation: conversationNext },
  };
  if (turn.field === 'outcomeStatement') {
    // Anchor's primary outcome is non-nullable; unknown only enters provenance.
    if (!isUnknown) result.outcomeStatement = turn.inputText;
  } else if (turn.field === 'contextSummary') {
    result.contextSummary = isUnknown ? null : turn.inputText;
  } else if (turn.field === 'decisionToEnable') {
    result.decisionToEnable = isUnknown ? null : turn.inputText;
  } else if (turn.field === 'businessSignalValue') {
    result.businessSignalStatus = isUnknown ? 'unknown' : 'suggested';
    result.businessSignalValue = isUnknown ? null : turn.inputText;
  }
  return result;
}
