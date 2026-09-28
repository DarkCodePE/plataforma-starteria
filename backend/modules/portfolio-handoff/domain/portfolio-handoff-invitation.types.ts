import type { HandoffAssignment, HandoffAssignmentRepository, HandoffTargetKind } from './portfolio-handoff-assignment.types';

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
export type HandoffDeliveryAttempt = {
  id: string;
  assignmentId: string;
  channel: 'EMAIL';
  status: HandoffDeliveryAttemptStatus;
  attemptedAt: Date;
  providerMessageRef: string | null;
  errorCategory: string | null;
  idempotencyKey: string;
};

export type HandoffInvitationPreview = {
  assignmentId: string;
  targetKind: HandoffTargetKind;
  challengeId: string;
  initiativeId: string | null;
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
  create(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<HandoffDeliveryAttempt>;
}

export type HandoffInvitationDependencies = {
  assignments: HandoffAssignmentRepository;
  access: HandoffInvitationAccessRepository;
};

export type SafeHandoffAssignment = Pick<HandoffAssignment, 'id' | 'targetKind' | 'challengeId' | 'initiativeId'>;
