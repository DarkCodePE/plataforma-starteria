export type HandoffTargetKind = 'EXISTING_INITIATIVE' | 'CHALLENGE';
export type HandoffAssignmentState = 'CREATED' | 'SENT' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'REVOKED' | 'EXPIRED' | 'STARTED';
export type HandoffMemberRole = 'OWNER' | 'EXECUTOR' | 'OBSERVER';

export type HandoffMemberInput = {
  identityKey: string;
  userId?: string | null;
  emailNormalized?: string | null;
  label?: string | null;
  role: HandoffMemberRole;
};

export type HandoffActivationBriefVersionProjection = {
  id: string;
  versionNumber: number;
  status: 'DRAFT' | 'CONFIRMED';
  intent: string | null;
  scope: string | null;
  strategicContextRefs: unknown;
  inheritedContext: unknown;
  constraintsSnapshot: unknown;
  knownGaps: unknown;
  sourceRefs: unknown;
  provenance: unknown;
  confirmedAt: Date | null;
};

export type CreateHandoffAssignmentInput = {
  organizationId?: string | null;
  portfolioScopeRef?: string | null;
  challengeId: string;
  targetKind: HandoffTargetKind;
  initiativeId?: string | null;
  // ADR-008: immutable mandate reference for Challenge handoff. Nullable only
  // for historical rows and the Existing Initiative exception.
  briefVersionId?: string | null;
  contextNote?: string | null;
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
  acceptedAt: Date | null;
  acceptedBy: string | null;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  startedAt: Date | null;
  startedBy: string | null;
  portfolioResponse: string | null;
  portfolioResponseRecordedAt: Date | null;
  portfolioResponseRecordedBy: string | null;
  briefVersion?: HandoffActivationBriefVersionProjection | null;
};

export type UpdateCreatedHandoffAssignmentInput = {
  assignmentId: string;
  expectedVersion: number;
  invitedEmailNormalized: string;
  invitedIdentityRef?: string | null;
  contextNote?: string | null;
  members: HandoffMemberInput[];
  actorId: string;
};

export type HandoffReference = { id: string; organizationId?: string | null; challengeIds?: string[] };

export interface HandoffAssignmentRepository {
  create(input: CreateHandoffAssignmentInput): Promise<HandoffAssignment>;
  findById(id: string): Promise<HandoffAssignment | null>;
  updateCreated(input: UpdateCreatedHandoffAssignmentInput): Promise<HandoffAssignment | null>;
  associateInvitedIdentity(input: {
    assignmentId: string;
    userId: string;
    emailNormalized: string;
    identityRef?: string | null;
  }): Promise<HandoffAssignment | null>;
  transitionState(input: { assignmentId: string; from: HandoffAssignmentState[]; to: HandoffAssignmentState; now?: Date }): Promise<HandoffAssignment | null>;
  applyResponse(input: { assignmentId: string; from: HandoffAssignmentState[]; to: 'ACCEPTED' | 'REJECTED'; actorId: string; reason?: string; expectedVersion: number; now: Date }): Promise<HandoffAssignment | null>;
  startAssignedWork(input: { assignmentId: string; expectedVersion: number; actorId: string; now: Date }): Promise<HandoffAssignment | null>;
  recordPortfolioResponse(input: { assignmentId: string; response: string; actorId: string; now: Date }): Promise<HandoffAssignment | null>;
}

export type HandoffResponseCommandType = 'ACCEPT' | 'REJECT' | 'PORTFOLIO_RESPONSE' | 'START';
export type HandoffResponseCommand = { id: string; assignmentId: string; type: HandoffResponseCommandType; idempotencyKey: string; actorId: string; fingerprint: string; resultingVersion: number; createdAt: Date };
export interface HandoffResponseCommandRepository {
  findByIdempotencyKey(input: { assignmentId: string; type: HandoffResponseCommandType; idempotencyKey: string }): Promise<HandoffResponseCommand | null>;
  create(input: Omit<HandoffResponseCommand, 'id'>): Promise<HandoffResponseCommand>;
}

export type AtomicHandoffCommandInput = {
  assignmentId: string;
  type: HandoffResponseCommandType;
  idempotencyKey: string;
  actorId: string;
  fingerprint: string;
  expectedVersion?: number;
  reason?: string;
  response?: string;
  now: Date;
};

export type AtomicHandoffCommandResult = {
  assignment: HandoffAssignment;
  event: import('./portfolio-handoff-semantic-event.types').HandoffSemanticEvent;
};

export interface AtomicHandoffCommandRepository {
  execute(input: AtomicHandoffCommandInput): Promise<AtomicHandoffCommandResult>;
}

export interface HandoffReferenceRepository {
  findChallenge(id: string): Promise<HandoffReference | null>;
  findInitiative(id: string): Promise<HandoffReference | null>;
}
