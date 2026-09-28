import api from '../../../app/services/api';

export type HandoffInvitationPreview = {
  assignmentId: string;
  targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE';
  challengeId: string;
  initiativeId: string | null;
  state: 'CREATED' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED' | 'STARTED';
  version: number;
  rejectionReason: string | null;
  portfolioResponse: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  authenticationRequired: boolean;
  identityClaimStatus: 'UNAUTHENTICATED' | 'MATCHED' | 'MISMATCH' | 'INVALID_INVITATION' | 'EXPIRED' | 'REVOKED';
};

const PENDING_HANDOFF_KEY = 'starteria.handoff.pendingInvitation';

export async function readHandoffInvitation(token: string): Promise<HandoffInvitationPreview> {
  const { data } = await api.get(`/public/handoff-invitations/${encodeURIComponent(token)}`);
  return data.data;
}

export async function claimHandoffInvitation(token: string) {
  const { data } = await api.post('/public/handoff-invitations/claim', { token });
  return data.data as HandoffInvitationPreview;
}

function createIdempotencyKey(command: 'accept' | 'reject' | 'start', assignmentId: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `handoff:${command}:${assignmentId}:${uuid}`;
}

export async function acceptHandoffAssignment(assignmentId: string, expectedVersion: number): Promise<HandoffInvitationPreview> {
  const { data } = await api.post(`/handoff/assignments/${encodeURIComponent(assignmentId)}/accept`, { expectedVersion }, {
    headers: { 'Idempotency-Key': createIdempotencyKey('accept', assignmentId) },
  });
  return { ...data.data, authenticationRequired: true, identityClaimStatus: 'MATCHED' };
}

export async function rejectHandoffAssignment(assignmentId: string, reason: string, expectedVersion: number): Promise<HandoffInvitationPreview> {
  const { data } = await api.post(`/handoff/assignments/${encodeURIComponent(assignmentId)}/reject`, { reason: reason.trim(), expectedVersion }, {
    headers: { 'Idempotency-Key': createIdempotencyKey('reject', assignmentId) },
  });
  return { ...data.data, authenticationRequired: true, identityClaimStatus: 'MATCHED' };
}

export async function startAssignedWork(assignmentId: string, expectedVersion: number): Promise<HandoffInvitationPreview> {
  const idempotencyKey = createIdempotencyKey('start', assignmentId);
  const { data } = await api.post(`/handoff/assignments/${encodeURIComponent(assignmentId)}/start`, { expectedVersion, idempotencyKey }, { headers: { 'Idempotency-Key': idempotencyKey } });
  return { ...data.data, authenticationRequired: true, identityClaimStatus: 'MATCHED' };
}

/** Reads the current response state through the invitation's existing, token-scoped read model. */
export async function readHandoffResponseState(token: string): Promise<HandoffInvitationPreview> {
  return readHandoffInvitation(token);
}

export function savePendingHandoffInvitation(token: string): void {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(PENDING_HANDOFF_KEY, token);
}

export function readPendingHandoffInvitation(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(PENDING_HANDOFF_KEY);
}

export function clearPendingHandoffInvitation(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(PENDING_HANDOFF_KEY);
}
