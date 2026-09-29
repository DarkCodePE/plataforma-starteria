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
}

export type HandoffInvitationDependencies = {
  assignments: HandoffAssignmentRepository;
  access: HandoffInvitationAccessRepository;
};

export type SafeHandoffAssignment = Pick<HandoffAssignment, 'id' | 'targetKind' | 'challengeId' | 'initiativeId'>;
