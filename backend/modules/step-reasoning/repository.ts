import type { PrismaClient } from '@prisma/client';

export interface SessionKey {
  organizationId: string;
  projectId: string;
  cycleId: string;
  stepNumber: 0 | 1 | 2 | 3 | 4;
  createdById: string;
}

export interface ClaimTurnInput {
  sessionId: string;
  clientTurnId: string;
  actorId: string;
  inputText: string;
  sourceContextHash: string;
  contextSnapshotJson: unknown;
  requestId: string;
}

export interface StepReasoningRepositoryLike {
  findSession(key: SessionKey): Promise<any | null>;
  createSession(key: SessionKey & { lastContextHash: string }): Promise<any>;
  listTurns(sessionId: string): Promise<any[]>;
  claimTurn(input: ClaimTurnInput): Promise<{ turn: any; claimed: boolean }>;
  reclaimFailedTurn(turnId: string, input: Pick<ClaimTurnInput, 'sourceContextHash' | 'contextSnapshotJson' | 'requestId'>): Promise<boolean>;
  completeTurn(turnId: string, result: Record<string, unknown>): Promise<any>;
  failTurn(turnId: string, result: Record<string, unknown>): Promise<any>;
}

export class PrismaStepReasoningRepository implements StepReasoningRepositoryLike {
  constructor(private readonly prisma: PrismaClient) {}

  async findSession(key: SessionKey) {
    return (this.prisma as any).stepReasoningSession.findUnique({
      where: { organizationId_projectId_cycleId_stepNumber_createdById: key },
    });
  }

  async createSession(input: SessionKey & { lastContextHash: string }) {
    const db = this.prisma as any;
    try {
      return await db.stepReasoningSession.create({ data: input });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      return db.stepReasoningSession.findUniqueOrThrow({
        where: {
          organizationId_projectId_cycleId_stepNumber_createdById: {
            organizationId: input.organizationId,
            projectId: input.projectId,
            cycleId: input.cycleId,
            stepNumber: input.stepNumber,
            createdById: input.createdById,
          },
        },
      });
    }
  }

  listTurns(sessionId: string) {
    return (this.prisma as any).stepReasoningTurn.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
  }

  async claimTurn(input: ClaimTurnInput): Promise<{ turn: any; claimed: boolean }> {
    const db = this.prisma as any;
    const existing = await db.stepReasoningTurn.findUnique({ where: { sessionId_clientTurnId: { sessionId: input.sessionId, clientTurnId: input.clientTurnId } } });
    if (existing) return { turn: existing, claimed: false };
    try {
      const turn = await db.stepReasoningTurn.create({ data: { ...input, status: 'PENDING' } });
      return { turn, claimed: true };
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      return {
        turn: await db.stepReasoningTurn.findUniqueOrThrow({ where: { sessionId_clientTurnId: { sessionId: input.sessionId, clientTurnId: input.clientTurnId } } }),
        claimed: false,
      };
    }
  }

  async reclaimFailedTurn(turnId: string, input: Pick<ClaimTurnInput, 'sourceContextHash' | 'contextSnapshotJson' | 'requestId'>): Promise<boolean> {
    const result = await (this.prisma as any).stepReasoningTurn.updateMany({
      where: { id: turnId, status: 'FAILED' },
      data: {
        ...input,
        status: 'PENDING',
        assistantText: null,
        structuredOutputJson: null,
        executionMode: null,
        errorCode: null,
        completedAt: null,
      },
    });
    return result.count === 1;
  }

  completeTurn(turnId: string, result: Record<string, unknown>) {
    return (this.prisma as any).stepReasoningTurn.update({ where: { id: turnId }, data: { ...result, status: 'SUCCEEDED', completedAt: new Date() } });
  }

  failTurn(turnId: string, result: Record<string, unknown>) {
    return (this.prisma as any).stepReasoningTurn.update({ where: { id: turnId }, data: { ...result, status: 'FAILED', completedAt: new Date() } });
  }
}

