import api from '../../../app/services/api';

export type HandoffInvitationPreview = {
  assignmentId: string;
  targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE';
  challengeId: string;
  initiativeId: string | null;
  authenticationRequired: boolean;
  identityClaimStatus: 'UNAUTHENTICATED' | 'MATCHED' | 'MISMATCH';
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
