import type { PrismaClient } from '@prisma/client';
import type {
  OwnerContinuityProject,
  OwnerContinuityProjectRepository,
} from '../domain/portfolio-handoff-owner-continuity.types';

export class PrismaPortfolioHandoffOwnerContinuityRepository implements OwnerContinuityProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findChallengeForContinuity(challengeId: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      select: { id: true, title: true, name: true, strategicFront: { select: { organizationId: true } } },
    });
    if (!challenge) return null;
    return {
      id: challenge.id,
      title: challenge.title || challenge.name || 'Reto sin titulo',
      organizationId: challenge.strategicFront.organizationId,
    };
  }

  async findForContinuity(projectId: string, actorId: string): Promise<OwnerContinuityProject | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        status: true,
        currentStep: true,
        isArchived: true,
        activationStatus: true,
        retrospectiveAssessmentStatus: true,
        portfolioMeta: { select: { challengeId: true } },
        _count: { select: { steps: true } },
        adaptiveProgressSignal: { select: { stepNumber: true, signalJson: true } },
        adaptiveCheckpointInstances: {
          where: { status: { in: ['ready', 'in_progress'] } },
          select: { stepNumber: true },
          orderBy: [{ startedAt: 'desc' }],
          take: 1,
        },
        teamMembers: {
          where: { userId: actorId },
          select: { role: true, status: true },
          take: 1,
        },
      },
    });
    if (!project) return null;
    const signalJson = project.adaptiveProgressSignal?.signalJson;
    const signalStep = signalJson && typeof signalJson === 'object' && !Array.isArray(signalJson)
      ? (signalJson as Record<string, unknown>).step
      : null;
    const operationalStep = typeof signalStep === 'number'
      && Number.isInteger(signalStep)
      && signalStep === project.adaptiveProgressSignal?.stepNumber
      ? signalStep
      : null;
    return {
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      status: project.status,
      currentStep: project.currentStep,
      isArchived: project.isArchived,
      activationStatus: project.activationStatus,
      retrospectiveAssessmentStatus: project.retrospectiveAssessmentStatus,
      challengeIds: project.portfolioMeta.map((meta) => meta.challengeId),
      stepCount: project._count.steps,
      operationalStep,
      activeCheckpointStep: project.adaptiveCheckpointInstances[0]?.stepNumber ?? null,
      actorMembership: project.teamMembers[0] ?? null,
    };
  }
}

