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

export type HandoffDeliveryAttemptStatus = 'SUCCEEDED' | 'FAILED';
export const HANDOFF_DELIVERY_RESERVATION = 'IDEMPOTENCY_RESERVED';
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
  reserve(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<{ attempt: HandoffDeliveryAttempt; reserved: boolean }>;
  reclaimReservation(input: { attemptId: string; staleBefore: Date; attemptedAt: Date }): Promise<{ attempt: HandoffDeliveryAttempt; reclaimed: boolean }>;
  complete(input: { attemptId: string; status: HandoffDeliveryAttemptStatus; providerMessageRef: string | null; errorCategory: string | null; attemptedAt: Date }): Promise<HandoffDeliveryAttempt>;
}

export type HandoffDeliveryBatchItemResult = {
  assignmentId: string;
  status: 'SUCCEEDED' | 'FAILED';
  state: HandoffAssignment['state'];
  errorCategory: string | null;
  providerMessageRef: string | null;
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
  status: 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  results: HandoffDeliveryBatchItemResult[];
  succeededCount: number;
  failedCount: number;
  createdAt: Date;
  completedAt: Date | null;
};

export interface HandoffDeliveryBatchRepository {
  findById(id: string): Promise<HandoffDeliveryBatch | null>;
  findByIdempotencyKey(input: { organizationId: string; idempotencyKey: string }): Promise<HandoffDeliveryBatch | null>;
  reserve(input: Omit<HandoffDeliveryBatch, 'id' | 'createdAt'>): Promise<{ batch: HandoffDeliveryBatch; reserved: boolean }>;
  saveProgress(input: { batchId: string; results: HandoffDeliveryBatchItemResult[]; status: HandoffDeliveryBatch['status']; completedAt: Date | null }): Promise<HandoffDeliveryBatch>;
}

export type HandoffInvitationDependencies = {
  assignments: HandoffAssignmentRepository;
  access: HandoffInvitationAccessRepository;
};

export type SafeHandoffAssignment = Pick<HandoffAssignment, 'id' | 'targetKind' | 'challengeId' | 'initiativeId'>;
