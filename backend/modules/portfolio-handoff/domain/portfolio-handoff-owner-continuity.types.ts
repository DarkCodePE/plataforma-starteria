import type {
  HandoffActivationBriefVersionProjection,
  HandoffAssignment,
  HandoffAssignmentRepository,
} from './portfolio-handoff-assignment.types';

export type OwnerContinuityActivationReason =
  | 'OPERATIONAL_ACCESS_REQUIRED'
  | 'OWNER_ACTIVATION_REQUIRED'
  | 'RETROSPECTIVE_ASSESSMENT_REQUIRED'
  | 'STEPS_NOT_MATERIALIZED'
  | 'OPERATIONAL_STATE_UNRESOLVED';

export type OwnerContinuityDeniedReason =
  | 'ASSIGNMENT_NOT_FOUND'
  | 'IDENTITY_MISMATCH'
  | 'ASSIGNMENT_NOT_STARTED'
  | 'TARGET_MISMATCH'
  | 'PROJECT_NOT_FOUND'
  | 'PROJECT_ARCHIVED'
  | 'TENANT_UNRESOLVED'
  | 'TENANT_MISMATCH';

export type OwnerContinuityProject = {
  id: string;
  name: string;
  organizationId: string | null;
  status: string;
  currentStep: number;
  isArchived: boolean;
  activationStatus: 'OWNER_PENDING' | 'OWNER_CONFIRMED' | null;
  retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT' | 'IN_REVIEW' | 'ASSESSED' | null;
  challengeIds: string[];
  stepCount: number;
  operationalStep: number | null;
  activeCheckpointStep: number | null;
  actorMembership: { role: 'OWNER' | 'EDITOR' | 'VIEWER'; status: 'ACTIVE' | 'PENDING' } | null;
};

export type OwnerContinuityChallenge = {
  id: string;
  title: string;
  organizationId: string | null;
};

export interface OwnerContinuityProjectRepository {
  findForContinuity(projectId: string, actorId: string): Promise<OwnerContinuityProject | null>;
  findChallengeForContinuity(challengeId: string): Promise<OwnerContinuityChallenge | null>;
}

export type OwnerContinuityAssignmentRepository = Pick<HandoffAssignmentRepository, 'findById'>;

type ContinuityBase = {
  assignmentId: string;
  challengeId: string;
  challenge: { id: string; title: string };
  contextNote: string | null;
  briefVersion: HandoffActivationBriefVersionProjection | null;
  handoffState: Extract<HandoffAssignment['state'], 'STARTED'>;
};

type ExistingProjectProjection = Omit<OwnerContinuityProject, 'actorMembership' | 'challengeIds'>;

export type OwnerPostStartContinuity =
  | (ContinuityBase & {
      outcome: 'EXISTING_READY';
      targetKind: 'EXISTING_INITIATIVE';
      initiativeId: string;
      project: ExistingProjectProjection & { workspacePath: string };
    })
  | (ContinuityBase & {
      outcome: 'EXISTING_ACTIVATION_REQUIRED';
      targetKind: 'EXISTING_INITIATIVE';
      initiativeId: string;
      reasons: OwnerContinuityActivationReason[];
      project: ExistingProjectProjection;
    })
  | (ContinuityBase & {
      outcome: 'CHALLENGE_FORMULATION_REQUIRED';
      targetKind: 'CHALLENGE';
      initiativeId: null;
    })
  | {
      outcome: 'ACCESS_DENIED';
      assignmentId: string;
      reason: OwnerContinuityDeniedReason;
    };

