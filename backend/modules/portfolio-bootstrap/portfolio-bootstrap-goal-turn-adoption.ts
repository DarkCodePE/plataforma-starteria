import { AppError } from '../../shared/errors/AppError';
import type { UpdateAnchorBody } from './portfolio-bootstrap.schemas';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function ids(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim())) return null;
  return value;
}

const fields = new Set(['outcomeStatement', 'contextSummary', 'decisionToEnable', 'businessSignalValue']);

/** Verify provenance before a human-triggered, CAS-protected Anchor update. */
export async function validateGoalLedgerAnchorAdoption(
  db: any,
  sessionId: string,
  anchor: { version: number; sourceRefs: unknown },
  body: UpdateAnchorBody,
): Promise<void> {
  if (body.sourceRefs === undefined) return;
  const before = ids(record(record(anchor.sourceRefs).objectiveConversation).goalLedgerAcceptedTurnIds);
  const afterConversation = record(record(body.sourceRefs).objectiveConversation);
  const after = ids(afterConversation.goalLedgerAcceptedTurnIds);
  const beforeRejected = ids(record(record(anchor.sourceRefs).objectiveConversation).goalLedgerRejectedTurnIds);
  const afterRejected = ids(afterConversation.goalLedgerRejectedTurnIds);
  const fail = () => AppError.conflict(
    'La procedencia del turno E2 no coincide con la sesión o con la versión del objetivo.',
    'PORTFOLIO_GOAL_RECEIPT_INVALID',
  );
  if (!before || !after || !beforeRejected || !afterRejected
    || beforeRejected.length !== afterRejected.length
    || !beforeRejected.every((id, i) => id === afterRejected[i])) throw fail();
  // Reject receipts are created only by the atomic human checkpoint command,
  // never by an arbitrary legacy PATCH of Anchor sourceRefs.
  if (before.length === after.length && before.every((id, i) => id === after[i])) return;

  // Only one additional receipt may be incorporated per human command.
  if (body.expectedVersion !== anchor.version || after.length !== before.length + 1
    || !before.every((id, i) => id === after[i]) || new Set(after).size !== after.length) throw fail();
  const turnId = after.at(-1);
  const receipt = await db.portfolioBootstrapGoalTurn.findFirst({
    where: { id: turnId, bootstrapSessionId: sessionId },
  });
  if (!receipt || receipt.anchorVersion !== anchor.version
    || receipt.disposition === 'retracted' || !fields.has(receipt.field)) throw fail();
  const lastTurn = Array.isArray(afterConversation.turns)
    ? afterConversation.turns.at(-1) : null;
  const transcript = record(lastTurn);
  if (transcript.ledgerTurnId !== receipt.id || transcript.ledgerVersion !== receipt.turnVersion
    || transcript.field !== receipt.field || transcript.value !== receipt.inputText) throw fail();
  const isUnknown = receipt.disposition === 'unknown' || receipt.disposition === 'not_applicable';
  if (isUnknown) {
    const unknownFields = afterConversation.unknownFields;
    if (!Array.isArray(unknownFields) || !unknownFields.includes(receipt.field)) throw fail();
    if (receipt.field !== 'outcomeStatement' && body[receipt.field as 'contextSummary' | 'decisionToEnable' | 'businessSignalValue'] !== null) {
      throw fail();
    }
    if (receipt.field === 'outcomeStatement' && body.outcomeStatement !== undefined) throw fail();
  } else {
    if (body[receipt.field as keyof UpdateAnchorBody] !== receipt.inputText) throw fail();
  }
}
