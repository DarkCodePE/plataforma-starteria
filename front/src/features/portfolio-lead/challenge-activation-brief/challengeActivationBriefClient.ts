import api, { parseApiError } from '../../../app/services/api';
import { createIdempotencyKey } from '../../portfolio-entry/public/idempotency';

type Envelope<T> = { success: true; data: T };
export type ActivationBriefVersion = {
  id: string; versionNumber: number; status: 'DRAFT' | 'CONFIRMED'; intent: string | null; scope: string | null;
  strategicContextRefs: unknown; inheritedContext: unknown; constraintsSnapshot: unknown; knownGaps: unknown; sourceRefs: unknown; provenance: unknown;
  createdAt: string; confirmedAt: string | null;
};
export type ActivationBrief = { id: string; challengeId: string; organizationId: string; versions: ActivationBriefVersion[] };
export type HandoffAssignmentMember = { identityKey: string; emailNormalized?: string | null; label?: string | null; role: 'OWNER' | 'EXECUTOR' | 'OBSERVER' };
export type HandoffAssignment = {
  id: string; state: string; version: number; targetKind: 'EXISTING_INITIATIVE' | 'CHALLENGE'; initiativeId: string | null;
  briefVersionId: string | null; contextNote: string | null; invitedEmailNormalized: string;
  initiative?: { id: string; name: string } | null;
  briefVersion?: ActivationBriefVersion | null;
  deliveryAttempts?: Array<{ status: 'SUCCEEDED' | 'FAILED'; errorCategory: string | null; attemptedAt: string }>;
  members: HandoffAssignmentMember[]; createdAt?: string; updatedAt?: string;
  sentAt?: string | null; viewedAt?: string | null; acceptedAt?: string | null; rejectedAt?: string | null;
  portfolioResponse?: string | null;
};
export type HandoffDeliveryBatch = {
  id: string; status: 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED'; retryOfBatchId: string | null;
  results: Array<{ assignmentId: string; status: 'SUCCEEDED' | 'FAILED'; state: string; errorCategory: string | null }>;
  succeededCount: number; failedCount: number;
};
export type ImportedInitiativeRecord = {
  id: string;
  label: string;
  purpose?: string | null;
  currentState?: string | null;
  ownerCandidate?: string | null;
  sourceType?: string;
  sourceLabel?: string;
  sourceRefs?: unknown;
  sourceVersion: string;
  reason: 'IMPORTED_RECORD_NOT_CANONICAL';
};
export type AssignableInitiatives = {
  canonicalInitiatives: Array<{
    id: string; name: string; description?: string | null; ownerEmail: string | null; ownerName: string | null;
    activationStatus?: 'OWNER_PENDING' | 'OWNER_CONFIRMED' | null;
    retrospectiveAssessmentStatus?: 'PENDING_RETROACTIVE_ASSESSMENT' | 'IN_REVIEW' | 'ASSESSED' | null;
  }>;
  importedRecords: ImportedInitiativeRecord[];
  otherImportedRecords: Array<Omit<ImportedInitiativeRecord, 'reason'> & {
    category: 'cross_cutting' | 'outside_objective' | 'ungrouped';
    reason: 'NOT_RELATED_TO_CHALLENGE';
  }>;
};
export type ImportedInitiativeCommandInput = {
  expectedWorkItemUpdatedAt: string;
  identityConfirmed: true;
  alignmentConfirmed: true;
};
export type ImportedInitiativeCommandResult = {
  idempotent: boolean;
  link: { id: string; mode: 'LINK_EXISTING' | 'REGISTER_EXISTING'; workItemId: string; projectId: string; challengeId: string; status: 'ACTIVE' | 'REVOKED' };
  project: { id: string; name: string; description: string | null; ownerEmail: string | null; ownerName: string | null; activationStatus: 'OWNER_PENDING' | 'OWNER_CONFIRMED' | null; retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT' | 'IN_REVIEW' | 'ASSESSED' | null };
};
export type AssignmentPreparationInput = {
  targetKind: 'EXISTING_INITIATIVE' | 'CHALLENGE'; initiativeId: string | null;
  briefId: string | null; briefVersionId: string | null; contextNote: string | null;
  invitedEmailNormalized: string; invitedIdentityRef?: string | null; members: HandoffAssignmentMember[];
};
export type BriefInput = { intent?: string | null; scope?: string | null; strategicContextRefs?: unknown; inheritedContext?: unknown; constraintsSnapshot?: unknown; knownGaps?: unknown; sourceRefs?: unknown; provenance?: unknown };

async function post<T>(path: string, body: unknown, idempotencyScope: string, idempotencyKey?: string): Promise<T> {
  try {
    const { data } = await api.post<Envelope<T>>(path, body, { headers: { 'Idempotency-Key': idempotencyKey ?? createIdempotencyKey(idempotencyScope) } });
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export async function createActivationBrief(challengeId: string, input: BriefInput, idempotencyKey?: string): Promise<{ brief: ActivationBrief; idempotent: boolean }> {
  return post(`/portfolio/challenges/${encodeURIComponent(challengeId)}/activation-briefs`, input, `activation-brief:create:${challengeId}`, idempotencyKey);
}
export async function listActivationBriefs(challengeId: string): Promise<ActivationBrief[]> {
  try { const { data } = await api.get<Envelope<ActivationBrief[]>>(`/portfolio/challenges/${encodeURIComponent(challengeId)}/activation-briefs`); return data.data; }
  catch (error) { throw parseApiError(error); }
}
export async function getActivationBrief(briefId: string): Promise<ActivationBrief> {
  try { const { data } = await api.get<Envelope<ActivationBrief>>(`/portfolio/activation-briefs/${encodeURIComponent(briefId)}`); return data.data; }
  catch (error) { throw parseApiError(error); }
}
export async function createActivationBriefVersion(briefId: string, input: BriefInput, idempotencyKey?: string): Promise<{ version: ActivationBriefVersion; idempotent: boolean }> {
  return post(`/portfolio/activation-briefs/${encodeURIComponent(briefId)}/versions`, input, `activation-brief:version:${briefId}`, idempotencyKey);
}
export async function confirmActivationBriefVersion(versionId: string, idempotencyKey?: string): Promise<{ version: ActivationBriefVersion; idempotent: boolean }> {
  return post(`/portfolio/activation-brief-versions/${encodeURIComponent(versionId)}/confirm`, {}, `activation-brief:confirm:${versionId}`, idempotencyKey);
}
export async function createChallengeHandoffAssignment(challengeId: string, input: AssignmentPreparationInput, idempotencyKey?: string): Promise<{ assignment: HandoffAssignment; idempotent: boolean }> {
  return post(`/portfolio/challenges/${encodeURIComponent(challengeId)}/handoff-assignments`, input, `activation-brief:assignment:${challengeId}:${input.briefVersionId}:${input.invitedEmailNormalized}`, idempotencyKey);
}
export async function listChallengeHandoffAssignments(challengeId: string): Promise<HandoffAssignment[]> {
  try { const { data } = await api.get<Envelope<HandoffAssignment[]>>(`/portfolio/challenges/${encodeURIComponent(challengeId)}/handoff-assignments`); return data.data; }
  catch (error) { throw parseApiError(error); }
}
export async function listAssignableInitiatives(challengeId: string): Promise<AssignableInitiatives> {
  try { const { data } = await api.get<Envelope<AssignableInitiatives>>(`/portfolio/challenges/${encodeURIComponent(challengeId)}/assignable-initiatives`); return data.data; }
  catch (error) { throw parseApiError(error); }
}
export async function registerImportedInitiative(challengeId: string, workItemId: string, input: ImportedInitiativeCommandInput & { name?: string; description?: string | null }, idempotencyKey?: string): Promise<ImportedInitiativeCommandResult> {
  return post(`/portfolio/challenges/${encodeURIComponent(challengeId)}/imported-initiatives/${encodeURIComponent(workItemId)}/register`, input, `imported-initiative:register:${challengeId}:${workItemId}`, idempotencyKey);
}
export async function linkImportedInitiative(challengeId: string, workItemId: string, input: ImportedInitiativeCommandInput & { projectId: string }, idempotencyKey?: string): Promise<ImportedInitiativeCommandResult> {
  return post(`/portfolio/challenges/${encodeURIComponent(challengeId)}/imported-initiatives/${encodeURIComponent(workItemId)}/link`, input, `imported-initiative:link:${challengeId}:${workItemId}:${input.projectId}`, idempotencyKey);
}
export async function updateChallengeHandoffAssignment(assignmentId: string, input: { expectedVersion: number; contextNote: string | null; invitedEmailNormalized: string; invitedIdentityRef?: string | null; members: HandoffAssignmentMember[] }, idempotencyKey?: string): Promise<{ assignment: HandoffAssignment; idempotent: boolean }> {
  try {
    const { data } = await api.patch<Envelope<{ assignment: HandoffAssignment; idempotent: boolean }>>(`/portfolio/handoff-assignments/${encodeURIComponent(assignmentId)}/preparation`, input, { headers: { 'Idempotency-Key': idempotencyKey ?? createIdempotencyKey(`activation-brief:update-assignment:${assignmentId}:${input.expectedVersion}`) } });
    return data.data;
  } catch (error) { throw parseApiError(error); }
}

export async function sendHandoffInvitationBatch(challengeId: string, items: Array<{ assignmentId: string; expectedVersion: number }>, idempotencyKey: string, retryOfBatchId?: string): Promise<HandoffDeliveryBatch> {
  return post('/portfolio/handoff-assignments/batch/invitations', { challengeId, items, retryOfBatchId: retryOfBatchId ?? null }, `handoff:send-batch:${challengeId}`, idempotencyKey);
}
