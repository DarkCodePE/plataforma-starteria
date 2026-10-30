import type {
  OwnerContinuityActivationReason,
  OwnerContinuityAssignmentRepository,
  OwnerContinuityProject,
  OwnerContinuityProjectRepository,
  OwnerPostStartContinuity,
} from '../domain/portfolio-handoff-owner-continuity.types';

type AuthenticatedOwner = { id: string; email: string };

export class PortfolioHandoffOwnerContinuityService {
  constructor(
    private readonly assignments: OwnerContinuityAssignmentRepository,
    private readonly projects: OwnerContinuityProjectRepository,
  ) {}

  async resolve(assignmentId: string, actor: AuthenticatedOwner): Promise<OwnerPostStartContinuity> {
    const assignment = await this.assignments.findById(assignmentId);
    if (!assignment) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'ASSIGNMENT_NOT_FOUND' };

    const normalizedActorEmail = actor.email.trim().toLowerCase();
    const ownerMember = assignment.members.find((member) => member.role === 'OWNER');
    const identityMatches = assignment.invitedEmailNormalized.trim().toLowerCase() === normalizedActorEmail
      && ownerMember?.userId === actor.id
      && assignment.acceptedBy === actor.id;
    if (!identityMatches) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'IDENTITY_MISMATCH' };
    if (assignment.state !== 'STARTED') return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'ASSIGNMENT_NOT_STARTED' };
    if (assignment.startedBy !== actor.id) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'IDENTITY_MISMATCH' };

    const challenge = await this.projects.findChallengeForContinuity(assignment.challengeId);
    if (!challenge) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TARGET_MISMATCH' };
    if (!assignment.organizationId || !challenge.organizationId) {
      return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TENANT_UNRESOLVED' };
    }
    if (assignment.organizationId !== challenge.organizationId) {
      return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TENANT_MISMATCH' };
    }

    const base = {
      assignmentId: assignment.id,
      challengeId: assignment.challengeId,
      challenge: { id: challenge.id, title: challenge.title },
      contextNote: assignment.contextNote ?? null,
      briefVersion: assignment.briefVersion ?? null,
      handoffState: 'STARTED' as const,
    };

    if (assignment.targetKind === 'CHALLENGE') {
      if (assignment.initiativeId) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TARGET_MISMATCH' };
      return {
        ...base,
        outcome: 'CHALLENGE_FORMULATION_REQUIRED',
        targetKind: 'CHALLENGE',
        initiativeId: null,
      };
    }

    if (!assignment.initiativeId) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TARGET_MISMATCH' };
    const project = await this.projects.findForContinuity(assignment.initiativeId, actor.id);
    if (!project) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'PROJECT_NOT_FOUND' };
    if (project.isArchived) return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'PROJECT_ARCHIVED' };
    if (!project.organizationId) {
      return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TENANT_UNRESOLVED' };
    }
    if (assignment.organizationId !== project.organizationId) {
      return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TENANT_MISMATCH' };
    }
    if (!project.challengeIds.includes(assignment.challengeId)) {
      return { outcome: 'ACCESS_DENIED', assignmentId, reason: 'TARGET_MISMATCH' };
    }

    const reasons = activationReasons(project);
    const projection = {
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      status: project.status,
      currentStep: project.currentStep,
      isArchived: project.isArchived,
      activationStatus: project.activationStatus,
      retrospectiveAssessmentStatus: project.retrospectiveAssessmentStatus,
      stepCount: project.stepCount,
      operationalStep: project.operationalStep,
      activeCheckpointStep: project.activeCheckpointStep,
    };
    if (reasons.length) {
      return {
        ...base,
        outcome: 'EXISTING_ACTIVATION_REQUIRED',
        targetKind: 'EXISTING_INITIATIVE',
        initiativeId: assignment.initiativeId,
        reasons,
        project: projection,
      };
    }

    return {
      ...base,
      outcome: 'EXISTING_READY',
      targetKind: 'EXISTING_INITIATIVE',
      initiativeId: assignment.initiativeId,
      project: { ...projection, workspacePath: `/projects/${encodeURIComponent(project.id)}` },
    };
  }
}

function activationReasons(project: OwnerContinuityProject): OwnerContinuityActivationReason[] {
  const reasons: OwnerContinuityActivationReason[] = [];
  const membership = project.actorMembership;
  if (!membership || membership.status !== 'ACTIVE' || !['OWNER', 'EDITOR'].includes(membership.role)) {
    reasons.push('OPERATIONAL_ACCESS_REQUIRED');
  }
  if (project.activationStatus === 'OWNER_PENDING') reasons.push('OWNER_ACTIVATION_REQUIRED');
  if (project.retrospectiveAssessmentStatus && project.retrospectiveAssessmentStatus !== 'ASSESSED') {
    reasons.push('RETROSPECTIVE_ASSESSMENT_REQUIRED');
  }
  if (project.stepCount < 1) reasons.push('STEPS_NOT_MATERIALIZED');
  if (project.operationalStep === null
    || project.operationalStep !== project.currentStep
    || (project.activeCheckpointStep !== null && project.activeCheckpointStep !== project.currentStep)) {
    reasons.push('OPERATIONAL_STATE_UNRESOLVED');
  }
  return reasons;
}

