import api from '../../../app/services/api';

export type HandoffBriefVersion = {
  id: string;
  versionNumber: number;
  status: 'DRAFT' | 'CONFIRMED';
  intent: string | null;
  scope: string | null;
  strategicContextRefs?: unknown;
  inheritedContext?: unknown;
  constraintsSnapshot?: unknown;
  knownGaps?: unknown;
  sourceRefs?: unknown;
  provenance?: unknown;
  confirmedAt?: string | null;
};

export type HandoffInvitationPreview = {
  assignmentId: string;
  targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE';
  challengeId: string;
  initiativeId: string | null;
  briefVersion: HandoffBriefVersion | null;
  state: 'CREATED' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED' | 'STARTED';
  version: number;
  rejectionReason: string | null;
  portfolioResponse: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  authenticationRequired: boolean;
  identityClaimStatus: 'UNAUTHENTICATED' | 'MATCHED' | 'MISMATCH' | 'INVALID_INVITATION' | 'EXPIRED' | 'REVOKED';
};

type ContinuityBase = {
  assignmentId: string;
  challengeId: string;
  challenge: { id: string; title: string };
  contextNote: string | null;
  briefVersion: HandoffBriefVersion | null;
  handoffState: 'STARTED';
};

type ContinuityProject = {
  id: string;
  name: string;
  organizationId: string;
  status: string;
  currentStep: number;
  isArchived: boolean;
  activationStatus: 'OWNER_PENDING' | 'OWNER_CONFIRMED' | null;
  retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT' | 'IN_REVIEW' | 'ASSESSED' | null;
  stepCount: number;
  operationalStep: number | null;
  activeCheckpointStep: number | null;
};

export type HandoffOwnerContinuity =
  | (ContinuityBase & { outcome: 'EXISTING_READY'; targetKind: 'EXISTING_INITIATIVE'; initiativeId: string; project: ContinuityProject & { workspacePath: string } })
  | (ContinuityBase & { outcome: 'EXISTING_ACTIVATION_REQUIRED'; targetKind: 'EXISTING_INITIATIVE'; initiativeId: string; reasons: Array<'OPERATIONAL_ACCESS_REQUIRED' | 'OWNER_ACTIVATION_REQUIRED' | 'RETROSPECTIVE_ASSESSMENT_REQUIRED' | 'STEPS_NOT_MATERIALIZED' | 'OPERATIONAL_STATE_UNRESOLVED'>; project: ContinuityProject })
  | (ContinuityBase & { outcome: 'CHALLENGE_FORMULATION_REQUIRED'; targetKind: 'CHALLENGE'; initiativeId: null })
  | { outcome: 'ACCESS_DENIED'; assignmentId: string };

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
  return { ...data.data, assignmentId, authenticationRequired: true, identityClaimStatus: 'MATCHED' };
}

export async function rejectHandoffAssignment(assignmentId: string, reason: string, expectedVersion: number): Promise<HandoffInvitationPreview> {
  const { data } = await api.post(`/handoff/assignments/${encodeURIComponent(assignmentId)}/reject`, { reason: reason.trim(), expectedVersion }, {
    headers: { 'Idempotency-Key': createIdempotencyKey('reject', assignmentId) },
  });
  return { ...data.data, assignmentId, authenticationRequired: true, identityClaimStatus: 'MATCHED' };
}

export async function startAssignedWork(assignmentId: string, expectedVersion: number): Promise<HandoffInvitationPreview> {
  const idempotencyKey = createIdempotencyKey('start', assignmentId);
  const { data } = await api.post(`/handoff/assignments/${encodeURIComponent(assignmentId)}/start`, { expectedVersion, idempotencyKey }, { headers: { 'Idempotency-Key': idempotencyKey } });
  return { ...data.data, assignmentId, authenticationRequired: true, identityClaimStatus: 'MATCHED' };
}

export async function resolvePostStartContinuity(assignmentId: string): Promise<HandoffOwnerContinuity> {
  const { data } = await api.get(`/handoff/assignments/${encodeURIComponent(assignmentId)}/post-start-continuity`);
  return data.data;
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
