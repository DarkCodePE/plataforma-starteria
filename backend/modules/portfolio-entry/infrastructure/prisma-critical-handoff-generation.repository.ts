import type { PrismaClient } from '@prisma/client';
import type {
  ClaimCriticalHandoffGenerationInput,
  CriticalHandoffGeneration,
  CriticalHandoffGenerationFailureClass,
  CriticalHandoffGenerationRepository,
} from '../application/critical-handoff-generation.repository';

export class PrismaCriticalHandoffGenerationRepository implements CriticalHandoffGenerationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(sessionId: string, sourceContextRevision: number, now: Date, maxDurationMs: number) {
    let generation = await this.prisma.portfolioEntryCriticalHandoffGeneration.findUnique({
      where: { sessionId_sourceContextRevision: { sessionId, sourceContextRevision } },
    });
    if (generation?.status === 'GENERATING' && now.getTime() - generation.startedAt.getTime() > maxDurationMs) {
      await this.prisma.portfolioEntryCriticalHandoffGeneration.updateMany({
        where: { id: generation.id, status: 'GENERATING', startedAt: generation.startedAt },
        data: { status: 'FAILED', failureClass: 'stale', finishedAt: now },
      });
      generation = await this.prisma.portfolioEntryCriticalHandoffGeneration.findUnique({ where: { id: generation.id } });
    }
    return generation as CriticalHandoffGeneration | null;
  }

  async findLatest(sessionId: string, now: Date, maxDurationMs: number) {
    const latest = await this.prisma.portfolioEntryCriticalHandoffGeneration.findFirst({
      where: { sessionId }, orderBy: [{ createdAt: 'desc' }, { sourceContextRevision: 'desc' }],
    });
    return latest ? this.find(sessionId, latest.sourceContextRevision, now, maxDurationMs) : null;
  }

  async claim(input: ClaimCriticalHandoffGenerationInput) {
    const where = { sessionId_sourceContextRevision: { sessionId: input.sessionId, sourceContextRevision: input.sourceContextRevision } };
    let generation = await this.prisma.portfolioEntryCriticalHandoffGeneration.findUnique({ where });
    if (!generation) {
      try {
        generation = await this.prisma.portfolioEntryCriticalHandoffGeneration.create({ data: {
          sessionId: input.sessionId, sourceContextRevision: input.sourceContextRevision,
          expectedSessionRevision: input.expectedSessionRevision, status: 'GENERATING', attempt: 1, startedAt: input.now,
        } });
        return { generation: generation as CriticalHandoffGeneration, claimed: true };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        generation = await this.prisma.portfolioEntryCriticalHandoffGeneration.findUnique({ where });
      }
    }
    if (!generation) throw new Error('Critical Handoff generation disappeared after unique conflict.');
    if (generation.status === 'GENERATING' && input.now.getTime() - generation.startedAt.getTime() > input.maxDurationMs) {
      await this.prisma.portfolioEntryCriticalHandoffGeneration.updateMany({
        where: { id: generation.id, status: 'GENERATING', startedAt: generation.startedAt },
        data: { status: 'FAILED', failureClass: 'stale', finishedAt: input.now },
      });
      generation = await this.prisma.portfolioEntryCriticalHandoffGeneration.findUnique({ where: { id: generation.id } });
    }
    if (generation?.status === 'GENERATING' || generation?.status === 'READY') {
      return { generation: generation as CriticalHandoffGeneration, claimed: false };
    }
    const claim = await this.prisma.portfolioEntryCriticalHandoffGeneration.updateMany({
      where: { id: generation!.id, status: 'FAILED' },
      data: {
        expectedSessionRevision: input.expectedSessionRevision, status: 'GENERATING', failureClass: null,
        attempt: { increment: 1 }, startedAt: input.now, finishedAt: null,
      },
    });
    const current = await this.prisma.portfolioEntryCriticalHandoffGeneration.findUnique({ where: { id: generation!.id } });
    return { generation: current as CriticalHandoffGeneration, claimed: claim.count === 1 };
  }

  async markReady(sessionId: string, sourceContextRevision: number, now: Date) {
    await this.prisma.portfolioEntryCriticalHandoffGeneration.updateMany({
      where: { sessionId, sourceContextRevision, status: 'GENERATING' },
      data: { status: 'READY', failureClass: null, finishedAt: now },
    });
  }

  async markFailed(sessionId: string, sourceContextRevision: number, failureClass: CriticalHandoffGenerationFailureClass, now: Date) {
    await this.prisma.portfolioEntryCriticalHandoffGeneration.updateMany({
      where: { sessionId, sourceContextRevision, status: 'GENERATING' },
      data: { status: 'FAILED', failureClass, finishedAt: now },
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
