import type { HandoffActivationBriefVersionProjection, HandoffAssignment, HandoffAssignmentRepository, HandoffTargetKind } from './portfolio-handoff-assignment.types';

export type HandoffInvitationAccess = {
  id: string;
  assignmentId: string;
  tokenHash: string;
  claimedByUserId: string | null;
  claimedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type HandoffDeliveryAttemptStatus = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
export const HANDOFF_DELIVERY_RESERVATION = 'IDEMPOTENCY_RESERVED';
export const HANDOFF_DELIVERY_OUTCOME_UNKNOWN = 'DELIVERY_OUTCOME_UNKNOWN';
export type HandoffDeliveryAttempt = {
  id: string;
  assignmentId: string;
  channel: 'EMAIL';
  status: HandoffDeliveryAttemptStatus;
  attemptedAt: Date;
  providerMessageRef: string | null;
  errorCategory: string | null;
  idempotencyKey: string;
  requestFingerprint: string;
  executionGeneration: number;
  executionOwnerId: string | null;
  leaseUntil: Date | null;
};

export type HandoffInvitationPreview = {
  assignmentId: string;
  targetKind: HandoffTargetKind;
  challengeId: string;
  initiativeId: string | null;
  briefVersion: HandoffActivationBriefVersionProjection | null;
  state: HandoffAssignment['state'];
  version: number;
  rejectionReason: string | null;
  portfolioResponse: string | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  authenticationRequired: boolean;
  identityClaimStatus: 'UNAUTHENTICATED' | 'MATCHED' | 'MISMATCH';
};

export type HandoffIdentityClaimResult = Omit<HandoffInvitationPreview, 'identityClaimStatus'> & {
  identityClaimStatus: 'MATCHED' | 'MISMATCH' | 'UNAUTHENTICATED' | 'INVALID_INVITATION' | 'EXPIRED' | 'REVOKED';
};

export interface HandoffInvitationAccessRepository {
  create(input: { assignmentId: string; tokenHash: string; expiresAt?: Date | null }): Promise<HandoffInvitationAccess>;
  findByTokenHash(tokenHash: string): Promise<HandoffInvitationAccess | null>;
  markClaimed(input: { accessId: string; userId: string }): Promise<void>;
  revokeForAssignment(assignmentId: string): Promise<void>;
  findActiveForAssignment(assignmentId: string): Promise<HandoffInvitationAccess | null>;
}

export interface HandoffDeliveryAttemptRepository {
  findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null>;
  findByDeliveryIntent(input: { assignmentId: string; requestFingerprint: string }): Promise<HandoffDeliveryAttempt | null>;
  bindIdempotencyKey(input: { assignmentId: string; idempotencyKey: string; attemptId: string }): Promise<HandoffDeliveryAttempt>;
  reserve(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<{ attempt: HandoffDeliveryAttempt; reserved: boolean }>;
  markExpiredUnknown(input: { attemptId: string; observedAt: Date }): Promise<HandoffDeliveryAttempt>;
  claimConfirmedFailure(input: { attemptId: string; expectedGeneration: number; executionOwnerId: string; idempotencyKey: string; attemptedAt: Date; leaseUntil: Date }): Promise<{ attempt: HandoffDeliveryAttempt; claimed: boolean }>;
  completeOwned(input: { attemptId: string; executionGeneration: number; executionOwnerId: string; status: HandoffDeliveryAttemptStatus; providerMessageRef: string | null; errorCategory: string | null; attemptedAt: Date }): Promise<{ attempt: HandoffDeliveryAttempt; completed: boolean }>;
}

export type HandoffDeliveryBatchItemResult = {
  assignmentId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  state: HandoffAssignment['state'];
  errorCategory: string | null;
  providerMessageRef: string | null;
  transportReceiptStatus: 'SMTP_ACCEPTED' | null;
};

export type HandoffDeliveryBatch = {
  id: string;
  organizationId: string;
  challengeId: string;
  actorId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  retryOfBatchId: string | null;
  assignmentIds: string[];
  status: 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'RECONCILIATION_REQUIRED';
  results: HandoffDeliveryBatchItemResult[];
  succeededCount: number;
  failedCount: number;
  processingLeaseUntil: Date | null;
  processingGeneration: number;
  processingOwnerId: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export interface HandoffDeliveryBatchRepository {
  findById(id: string): Promise<HandoffDeliveryBatch | null>;
  findByIdempotencyKey(input: { organizationId: string; idempotencyKey: string }): Promise<HandoffDeliveryBatch | null>;
  reserve(input: Omit<HandoffDeliveryBatch, 'id' | 'createdAt'>): Promise<{ batch: HandoffDeliveryBatch; reserved: boolean }>;
  reclaimProcessing(input: { batchId: string; staleBefore: Date; leaseUntil: Date; executionOwnerId: string }): Promise<{ batch: HandoffDeliveryBatch; reclaimed: boolean }>;
  saveProgress(input: { batchId: string; results: HandoffDeliveryBatchItemResult[]; status: HandoffDeliveryBatch['status']; completedAt: Date | null; processingLeaseUntil: Date | null; executionGeneration: number; executionOwnerId: string; observedAt: Date }): Promise<{ batch: HandoffDeliveryBatch; saved: boolean }>;
}

export type HandoffInvitationDependencies = {
  assignments: HandoffAssignmentRepository;
  access: HandoffInvitationAccessRepository;
};

export type SafeHandoffAssignment = Pick<HandoffAssignment, 'id' | 'targetKind' | 'challengeId' | 'initiativeId'>;
