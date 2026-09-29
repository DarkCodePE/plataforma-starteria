export type HandoffTargetKind = 'EXISTING_INITIATIVE' | 'CHALLENGE';
export type HandoffAssignmentState = 'CREATED' | 'SENT' | 'VIEWED' | 'REVOKED' | 'EXPIRED';
export type HandoffMemberRole = 'OWNER' | 'EXECUTOR' | 'OBSERVER';

export type HandoffMemberInput = {
  identityKey: string;
  userId?: string | null;
  emailNormalized?: string | null;
  label?: string | null;
  role: HandoffMemberRole;
};

export type CreateHandoffAssignmentInput = {
  organizationId?: string | null;
  portfolioScopeRef?: string | null;
  challengeId: string;
  targetKind: HandoffTargetKind;
  initiativeId?: string | null;
  invitedEmailNormalized: string;
  invitedIdentityRef?: string | null;
  createdByActorId: string;
  members: HandoffMemberInput[];
};

export type HandoffAssignment = Omit<CreateHandoffAssignmentInput, 'members'> & {
  id: string;
  state: HandoffAssignmentState;
  version: number;
  members: HandoffMemberInput[];
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
  viewedAt: Date | null;
  revokedAt: Date | null;
  expiredAt: Date | null;
};

export type HandoffReference = { id: string; organizationId?: string | null };

export interface HandoffAssignmentRepository {
  create(input: CreateHandoffAssignmentInput): Promise<HandoffAssignment>;
  findById(id: string): Promise<HandoffAssignment | null>;
  associateInvitedIdentity(input: {
    assignmentId: string;
    userId: string;
    emailNormalized: string;
    identityRef?: string | null;
  }): Promise<HandoffAssignment | null>;
  transitionState(input: { assignmentId: string; from: HandoffAssignmentState[]; to: HandoffAssignmentState; now?: Date }): Promise<HandoffAssignment | null>;
}

export interface HandoffReferenceRepository {
  findChallenge(id: string): Promise<HandoffReference | null>;
  findInitiative(id: string): Promise<HandoffReference | null>;
}
