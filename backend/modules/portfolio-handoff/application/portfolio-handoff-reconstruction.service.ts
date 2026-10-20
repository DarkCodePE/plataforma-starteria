import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import type { HandoffAssignmentRepository } from '../domain/portfolio-handoff-assignment.types';

type ReconstructionActor = { id: string; role: string };

type ProjectReadPort = {
  getProjectForRead(projectId: string, userId: string, role: string): Promise<unknown>;
};

export type ExistingInitiativeReconstruction = {
  assignmentId: string;
  initiativeId: string;
  continuityState: 'CURRENT_GOVERNED_CORE_STATE' | 'CONTINUITY_REVIEW_REQUIRED';
  currentGovernedState: { cycleId: string; cycleNumber: number; stepNumber: number } | null;
  recovered: {
    sourceRefs: number;
    evidence: number;
    claims: number;
    snapshots: number;
    outputs: number;
    events: number;
  };
  gaps: Array<{ code: string; message: string }>;
};

/**
 * P6 Route B read model. It only recovers the current, persisted record of the
 * linked Project. It never writes history, invents a cycle, or marks a Step as
 * approved: a missing safe configuration is intentionally surfaced for review.
 */
export class PortfolioHandoffReconstructionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly assignments: HandoffAssignmentRepository,
    private readonly projects: ProjectReadPort,
  ) {}

  async readExistingInitiative(input: { assignmentId: string; actor: ReconstructionActor }): Promise<ExistingInitiativeReconstruction> {
    const assignment = await this.assignments.findById(input.assignmentId);
    if (!assignment || assignment.targetKind !== 'EXISTING_INITIATIVE' || !assignment.initiativeId || assignment.state !== 'STARTED') {
      throw AppError.notFound('Continuidad de iniciativa', 'HANDOFF_RECONSTRUCTION_NOT_AVAILABLE');
    }

    const owner = assignment.members.find((member) => member.role === 'OWNER');
    if (owner?.userId !== input.actor.id) {
      throw AppError.forbidden('Solo el Owner asignado puede reconstruir esta continuidad.', 'HANDOFF_RECONSTRUCTION_ACCESS_DENIED');
    }

    // ProjectService applies the existing Project membership/read policy before
    // any historical relation is queried below.
    await this.projects.getProjectForRead(assignment.initiativeId, input.actor.id, input.actor.role);

    const db = this.prisma as any;
    const [sourceRefs, evidence, claims, snapshots, outputs, events, activeCycle] = await Promise.all([
      db.sourceRef.findMany({ where: { projectId: assignment.initiativeId }, select: { id: true } }),
      db.evidence.findMany({ where: { projectId: assignment.initiativeId }, select: { id: true } }),
      db.truthClaim.findMany({ where: { projectId: assignment.initiativeId }, select: { id: true } }),
      db.initiativeContextSnapshot.findMany({ where: { initiativeId: assignment.initiativeId }, select: { id: true } }),
      db.adaptiveStepOutput.findMany({ where: { projectId: assignment.initiativeId }, select: { id: true } }),
      db.adaptiveAdaptationEvent.findMany({ where: { projectId: assignment.initiativeId }, select: { id: true } }),
      db.initiativeCycle.findFirst({
        where: { projectId: assignment.initiativeId, status: 'active' },
        orderBy: { cycleNumber: 'desc' },
        select: { id: true, cycleNumber: true },
      }),
    ]);

    const activeConfiguration = activeCycle
      ? await db.adaptiveStepConfiguration.findFirst({
          where: { projectId: assignment.initiativeId, cycleId: activeCycle.id, status: 'active' },
          orderBy: [{ stepNumber: 'desc' }, { version: 'desc' }],
          select: { stepNumber: true },
        })
      : null;

    const recovered = {
      sourceRefs: sourceRefs.length,
      evidence: evidence.length,
      claims: claims.length,
      snapshots: snapshots.length,
      outputs: outputs.length,
      events: events.length,
    };
    const gaps: ExistingInitiativeReconstruction['gaps'] = [];
    if (!recovered.sourceRefs) gaps.push({ code: 'SOURCES_NOT_RECOVERED', message: 'No hay fuentes recuperadas para revisar.' });
    if (!recovered.evidence) gaps.push({ code: 'EVIDENCE_NOT_RECOVERED', message: 'No hay evidencia recuperada para revisar.' });
    if (!recovered.outputs && !recovered.events && !recovered.snapshots) {
      gaps.push({ code: 'HISTORY_NOT_RECOVERED', message: 'No hay historia estructurada recuperada para revisar.' });
    }
    if (!activeCycle || !activeConfiguration) {
      gaps.push({ code: 'ACTIVE_CORE_STATE_UNAVAILABLE', message: 'No hay un ciclo y Step activo persistido que sea seguro continuar.' });
    }

    const currentGovernedState = activeCycle && activeConfiguration
      ? { cycleId: activeCycle.id, cycleNumber: activeCycle.cycleNumber, stepNumber: activeConfiguration.stepNumber }
      : null;

    return {
      assignmentId: assignment.id,
      initiativeId: assignment.initiativeId,
      continuityState: currentGovernedState ? 'CURRENT_GOVERNED_CORE_STATE' : 'CONTINUITY_REVIEW_REQUIRED',
      currentGovernedState,
      recovered,
      gaps,
    };
  }
}
