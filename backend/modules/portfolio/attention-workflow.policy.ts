/**
 * G04 governance policy for existing AttentionItem.
 * A transition is a proposed command, never an implicit Step or decision.
 * Writes and authorization are responsibilities of the persistence adapter.
 */
export type AttentionWorkflowStatus = 'open' | 'acknowledged' | 'resolved' | 'cancelled';
export type AttentionWorkflowAction = 'acknowledge' | 'assign' | 'respond' | 'escalate' | 'resolve' | 'cancel' | 'reopen';
export type AttentionWorkflowInput = {
  status: AttentionWorkflowStatus;
  action: AttentionWorkflowAction;
  currentOwnerId: string | null;
  actorId: string;
  assigneeId?: string;
  note?: string;
};
export type AttentionWorkflowTransition = {
  status: AttentionWorkflowStatus;
  ownerId: string | null;
  resolutionNote: string | null;
  event: { action: AttentionWorkflowAction; actorId: string; assigneeId: string | null; note: string | null };
};

export class AttentionWorkflowError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AttentionWorkflowError';
  }
}

function requiredNote(input: AttentionWorkflowInput): string {
  const note = input.note?.trim() ?? '';
  if (note.length < 8 || note.length > 2000) {
    throw new AttentionWorkflowError('NOTE_REQUIRED', 'La acción exige una explicación de 8 a 2000 caracteres.');
  }
  return note;
}

export function planAttentionTransition(input: AttentionWorkflowInput): AttentionWorkflowTransition {
  const { action, status, actorId } = input;
  if (!actorId.trim()) throw new AttentionWorkflowError('ACTOR_REQUIRED', 'Falta el actor autenticado.');
  const closed = status === 'resolved' || status === 'cancelled';
  if (closed && action !== 'reopen') {
    throw new AttentionWorkflowError('ATTENTION_ALREADY_CLOSED', 'Primero debes reabrir el bloqueo.');
  }
  if (!closed && action === 'reopen') {
    throw new AttentionWorkflowError('ATTENTION_NOT_CLOSED', 'Esta solicitud ya está abierta.');
  }
  const assigneeId = input.assigneeId?.trim() || null;
  if ((action === 'assign' || action === 'escalate') && !assigneeId) {
    throw new AttentionWorkflowError('ASSIGNEE_REQUIRED', 'Selecciona un responsable antes de continuar.');
  }
  if (action === 'escalate' && assigneeId === input.currentOwnerId) {
    throw new AttentionWorkflowError('ESCALATION_NO_CHANGE', 'Escalar exige un responsable diferente.');
  }
  const note = action === 'respond' || action === 'escalate' || action === 'resolve' || action === 'cancel' || action === 'reopen'
    ? requiredNote(input) : input.note?.trim() || null;
  const transitions: Record<AttentionWorkflowAction, AttentionWorkflowStatus> = {
    acknowledge: 'acknowledged', assign: status, respond: status, escalate: 'acknowledged',
    resolve: 'resolved', cancel: 'cancelled', reopen: 'open',
  };
  if (action === 'acknowledge' && status !== 'open') {
    throw new AttentionWorkflowError('ATTENTION_NOT_OPEN', 'Solo se puede reconocer un bloqueo abierto.');
  }
  return {
    status: transitions[action],
    ownerId: action === 'assign' || action === 'escalate' ? assigneeId : input.currentOwnerId,
    resolutionNote: action === 'resolve' ? note : action === 'reopen' ? null : null,
    event: { action, actorId, assigneeId: action === 'assign' || action === 'escalate' ? assigneeId : null, note },
  };
}
