import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';

type Db = PrismaClient | any;

const STEP_NUMBERS = [0, 1, 2, 3, 4] as const;

export class AdaptiveCycleService {
  constructor(private prisma: PrismaClient) {}

  async ensureActiveCycle(projectId: string, tx?: Db) {
    const db = (tx ?? this.prisma) as any;
    const active = await db.initiativeCycle.findFirst({
      where: { projectId, status: 'active' },
      orderBy: { cycleNumber: 'desc' },
    });
    if (active) {
      await this.backfillLegacyCycleRelationsTx(db, projectId, active.id);
      return active;
    }

    const existing = await db.initiativeCycle.findFirst({
      where: { projectId },
      orderBy: { cycleNumber: 'desc' },
    });
    if (existing) {
      if (existing.status === 'completed' || existing.status === 'superseded') return existing;
      throw AppError.conflict('La iniciativa no tiene un ciclo activo.', 'NO_ACTIVE_CYCLE');
    }

    return this.createInitialCycleTx(db, projectId);
  }

  async getOperationalCycle(projectId: string, tx?: Db) {
    const db = (tx ?? this.prisma) as any;
    const active = await db.initiativeCycle.findFirst({
      where: { projectId, status: 'active' },
      orderBy: { cycleNumber: 'desc' },
    });
    if (active) return active;
    const latest = await db.initiativeCycle.findFirst({
      where: { projectId },
      orderBy: { cycleNumber: 'desc' },
    });
    if (latest) return latest;
    return this.createInitialCycleTx(db, projectId);
  }

  async syncActiveCycleProjectionTx(tx: Db, projectId: string, cycleId: string, step: number, extraProjectData: Record<string, unknown> = {}) {
    await tx.initiativeCycle.update({
      where: { id: cycleId },
      data: { currentStep: step },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { ...extraProjectData, currentStep: step, lastModified: new Date() },
    });
    await this.ensureStepStatesTx(tx, cycleId, step);
  }

  async completeCycleTx(tx: Db, projectId: string, cycleId: string, step: number, completedAt = new Date()) {
    await tx.initiativeCycle.update({
      where: { id: cycleId },
      data: { currentStep: step, status: 'completed', completedAt },
    });
    await this.ensureStepStatesTx(tx, cycleId, step, true);
    await tx.project.update({
      where: { id: projectId },
      data: { currentStep: step, lastModified: completedAt },
    });
  }

  private async createInitialCycleTx(tx: Db, projectId: string) {
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (!project) throw AppError.notFound('Proyecto no encontrado.', 'PROJECT_NOT_FOUND');
    const completedByStep4 = await tx.adaptiveStepOutput.findFirst({
      where: { projectId, stepNumber: 4, status: 'confirmed' },
      orderBy: { version: 'desc' },
    });
    const isCompleted = Boolean(completedByStep4?.confirmedAt) || project.status === 'COMPLETED';
    const cycle = await tx.initiativeCycle.create({
      data: {
        projectId,
        cycleNumber: 1,
        triggerType: 'initial',
        startStep: 0,
        currentStep: project.currentStep ?? 0,
        status: isCompleted ? 'completed' : 'active',
        completedAt: isCompleted ? completedByStep4?.confirmedAt ?? new Date() : null,
      },
    });
    await this.backfillLegacyCycleRelationsTx(tx, projectId, cycle.id);
    await this.ensureStepStatesTx(tx, cycle.id, project.currentStep ?? 0, isCompleted);
    return cycle;
  }

  private async backfillLegacyCycleRelationsTx(tx: Db, projectId: string, cycleId: string) {
    // Prisma now models these cycleId columns as required, so `cycleId: null` is
    // rejected by the generated client even when an older database still contains
    // pre-cycle rows. Keep the compatibility backfill at the SQL boundary.
    if (typeof tx.$executeRawUnsafe === 'function') {
      for (const table of ['AdaptiveStepConfiguration', 'AdaptiveCheckpointInstance', 'AdaptiveStepOutput', 'AdaptiveProgressSignal']) {
        await tx.$executeRawUnsafe(
          `UPDATE "${table}" SET "cycleId" = $1 WHERE "projectId" = $2 AND "cycleId" IS NULL`,
          cycleId,
          projectId,
        );
      }
      return;
    }
    await tx.adaptiveStepConfiguration.updateMany({
      where: { projectId, cycleId: null },
      data: { cycleId },
    }).catch(() => ({ count: 0 }));
    await tx.adaptiveCheckpointInstance.updateMany({
      where: { projectId, cycleId: null },
      data: { cycleId },
    }).catch(() => ({ count: 0 }));
    await tx.adaptiveStepOutput.updateMany({
      where: { projectId, cycleId: null },
      data: { cycleId },
    }).catch(() => ({ count: 0 }));
    await tx.adaptiveProgressSignal.updateMany({
      where: { projectId, cycleId: null },
      data: { cycleId },
    }).catch(() => ({ count: 0 }));
  }

  private async ensureStepStatesTx(tx: Db, cycleId: string, currentStep: number, completed = false) {
    for (const stepNumber of STEP_NUMBERS) {
      const confirmedOutput = await tx.adaptiveStepOutput.findFirst({
        where: { cycleId, stepNumber, status: 'confirmed' },
        orderBy: { version: 'desc' },
      }).catch(() => null);
      const state = completed || confirmedOutput || stepNumber < currentStep
        ? 'confirmed'
        : stepNumber === currentStep
          ? 'active'
          : 'pending';
      await tx.cycleStepState.upsert({
        where: { cycleId_stepNumber: { cycleId, stepNumber } },
        create: { cycleId, stepNumber, state },
        update: { state },
      }).catch(async () => {
        const existing = await tx.cycleStepState.findFirst({ where: { cycleId, stepNumber } });
        if (existing) return tx.cycleStepState.update({ where: { id: existing.id }, data: { state } });
        return tx.cycleStepState.create({ data: { cycleId, stepNumber, state } });
      });
    }
  }
}
