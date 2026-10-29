import { describe, expect, it } from 'vitest';
import { PortfolioHandoffOwnerContinuityService } from '../application/portfolio-handoff-owner-continuity.service';
import type {
  OwnerContinuityProject,
  OwnerContinuityProjectRepository,
} from '../domain/portfolio-handoff-owner-continuity.types';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';

const actor = { id: 'owner-user', email: 'owner@starteria.test' };

function assignment(overrides: Partial<HandoffAssignment> = {}): HandoffAssignment {
  return {
    id: 'assignment-1',
    organizationId: 'org-1',
    portfolioScopeRef: 'scope-1',
    challengeId: 'challenge-1',
    targetKind: 'EXISTING_INITIATIVE',
    initiativeId: 'project-1',
    briefVersionId: 'brief-version-7',
    contextNote: 'Contrastar primero la friccion observada.',
    invitedEmailNormalized: actor.email,
    invitedIdentityRef: null,
    createdByActorId: 'portfolio-lead-1',
    state: 'STARTED',
    version: 4,
    members: [{ identityKey: actor.email, emailNormalized: actor.email, userId: actor.id, role: 'OWNER' }],
    createdAt: new Date('2026-10-24T08:00:00Z'),
    updatedAt: new Date('2026-10-24T08:10:00Z'),
    sentAt: new Date('2026-10-24T08:01:00Z'),
    viewedAt: new Date('2026-10-24T08:02:00Z'),
    revokedAt: null,
    expiredAt: null,
    acceptedAt: new Date('2026-10-24T08:05:00Z'),
    acceptedBy: actor.id,
    rejectionReason: null,
    rejectedAt: null,
    rejectedBy: null,
    startedAt: new Date('2026-10-24T08:10:00Z'),
    startedBy: actor.id,
    portfolioResponse: null,
    portfolioResponseRecordedAt: null,
    portfolioResponseRecordedBy: null,
    briefVersion: {
      id: 'brief-version-7',
      versionNumber: 7,
      status: 'CONFIRMED',
      intent: 'Reducir la friccion de activacion',
      scope: 'Primeros siete dias',
      strategicContextRefs: {},
      inheritedContext: {},
      constraintsSnapshot: [],
      knownGaps: [],
      sourceRefs: [],
      provenance: { source: 'test' },
      confirmedAt: new Date('2026-10-23T12:00:00Z'),
    },
    ...overrides,
  };
}

function project(overrides: Partial<OwnerContinuityProject> = {}): OwnerContinuityProject {
  return {
    id: 'project-1',
    name: 'Onboarding guiado',
    organizationId: 'org-1',
    status: 'IN_PROGRESS',
    currentStep: 2,
    isArchived: false,
    activationStatus: 'OWNER_CONFIRMED',
    retrospectiveAssessmentStatus: 'ASSESSED',
    challengeIds: ['challenge-1'],
    stepCount: 4,
    operationalStep: 2,
    activeCheckpointStep: 2,
    actorMembership: { role: 'OWNER', status: 'ACTIVE' },
    ...overrides,
  };
}

function service(input: { currentAssignment?: HandoffAssignment | null; currentProject?: OwnerContinuityProject | null }) {
  const assignments = {
    findById: async () => input.currentAssignment === undefined ? assignment() : input.currentAssignment,
  };
  const projects: OwnerContinuityProjectRepository = {
    findForContinuity: async () => input.currentProject === undefined ? project() : input.currentProject,
    findChallengeForContinuity: async () => ({ id: 'challenge-1', title: 'Reducir la friccion de activacion', organizationId: 'org-1' }),
  };
  return new PortfolioHandoffOwnerContinuityService(assignments, projects);
}

describe('KAN-178 post-Start continuity resolver', () => {
  it('returns EXISTING_READY only for the exact active operational member and real Steps', async () => {
    const result = await service({}).resolve('assignment-1', actor);

    expect(result).toMatchObject({
      outcome: 'EXISTING_READY',
      assignmentId: 'assignment-1',
      initiativeId: 'project-1',
      briefVersion: { id: 'brief-version-7', versionNumber: 7, status: 'CONFIRMED' },
      project: {
        id: 'project-1',
        currentStep: 2,
        stepCount: 4,
        workspacePath: '/projects/project-1',
      },
    });
  });

  it('keeps an ADR-009 Project without Steps in activation pending and invents nothing', async () => {
    const result = await service({ currentProject: project({
      activationStatus: 'OWNER_PENDING',
      retrospectiveAssessmentStatus: 'PENDING_RETROACTIVE_ASSESSMENT',
      stepCount: 0,
      operationalStep: null,
      activeCheckpointStep: null,
      actorMembership: null,
    }) }).resolve('assignment-1', actor);

    expect(result).toMatchObject({
      outcome: 'EXISTING_ACTIVATION_REQUIRED',
      assignmentId: 'assignment-1',
      initiativeId: 'project-1',
      reasons: expect.arrayContaining([
        'OPERATIONAL_ACCESS_REQUIRED',
        'OWNER_ACTIVATION_REQUIRED',
        'RETROSPECTIVE_ASSESSMENT_REQUIRED',
        'STEPS_NOT_MATERIALIZED',
        'OPERATIONAL_STATE_UNRESOLVED',
      ]),
      project: { stepCount: 0 },
    });
    expect(result).not.toHaveProperty('project.workspacePath');
  });

  it('keeps a Project out of the workspace when its operational signal disagrees with currentStep', async () => {
    const result = await service({ currentProject: project({ operationalStep: 1 }) }).resolve('assignment-1', actor);

    expect(result).toMatchObject({
      outcome: 'EXISTING_ACTIVATION_REQUIRED',
      reasons: ['OPERATIONAL_STATE_UNRESOLVED'],
      project: { currentStep: 2, operationalStep: 1 },
    });
  });

  it('keeps a Project out of the workspace when an active checkpoint belongs to another Step', async () => {
    const result = await service({ currentProject: project({ activeCheckpointStep: 0 }) }).resolve('assignment-1', actor);

    expect(result).toMatchObject({
      outcome: 'EXISTING_ACTIVATION_REQUIRED',
      reasons: ['OPERATIONAL_STATE_UNRESOLVED'],
      project: { currentStep: 2, operationalStep: 2, activeCheckpointStep: 0 },
    });
  });

  it('returns CHALLENGE_FORMULATION_REQUIRED with the exact Assignment and BriefVersion', async () => {
    const result = await service({ currentAssignment: assignment({ targetKind: 'CHALLENGE', initiativeId: null }) })
      .resolve('assignment-1', actor);

    expect(result).toMatchObject({
      outcome: 'CHALLENGE_FORMULATION_REQUIRED',
      assignmentId: 'assignment-1',
      challengeId: 'challenge-1',
      challenge: { id: 'challenge-1', title: 'Reducir la friccion de activacion' },
      initiativeId: null,
      briefVersion: { id: 'brief-version-7', versionNumber: 7, status: 'CONFIRMED' },
    });
  });

  it('fails closed for identity mismatch, non-started assignments and unknown tenant ownership', async () => {
    await expect(service({}).resolve('assignment-1', { id: 'other-user', email: actor.email }))
      .resolves.toMatchObject({ outcome: 'ACCESS_DENIED', reason: 'IDENTITY_MISMATCH' });
    await expect(service({ currentAssignment: assignment({ state: 'ACCEPTED', startedBy: null, startedAt: null }) }).resolve('assignment-1', actor))
      .resolves.toMatchObject({ outcome: 'ACCESS_DENIED', reason: 'ASSIGNMENT_NOT_STARTED' });
    await expect(service({ currentProject: project({ organizationId: null }) }).resolve('assignment-1', actor))
      .resolves.toMatchObject({ outcome: 'ACCESS_DENIED', reason: 'TENANT_UNRESOLVED' });
  });

  it('does not treat pending or read-only project membership as operational access', async () => {
    for (const actorMembership of [
      { role: 'OWNER', status: 'PENDING' },
      { role: 'VIEWER', status: 'ACTIVE' },
    ] as const) {
      const result = await service({ currentProject: project({ actorMembership }) }).resolve('assignment-1', actor);
      expect(result).toMatchObject({
        outcome: 'EXISTING_ACTIVATION_REQUIRED',
        reasons: expect.arrayContaining(['OPERATIONAL_ACCESS_REQUIRED']),
      });
    }
  });

  it('is a read-only stable resolver on re-entry', async () => {
    const resolver = service({});
    expect(await resolver.resolve('assignment-1', actor)).toEqual(await resolver.resolve('assignment-1', actor));
  });
});

