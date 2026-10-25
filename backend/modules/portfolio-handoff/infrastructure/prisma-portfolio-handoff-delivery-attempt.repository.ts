import type { PrismaClient } from '@prisma/client';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository } from '../domain/portfolio-handoff-invitation.types';

export class PrismaPortfolioHandoffDeliveryAttemptRepository implements HandoffDeliveryAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null> {
    const binding = await (this.prisma as any).portfolioHandoffDeliveryAttemptKey.findUnique({
      where: { assignmentId_idempotencyKey: input },
      include: { attempt: true },
    });
    const record = binding?.attempt
      ?? await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { assignmentId_idempotencyKey: input } });
    return record ? mapAttempt(record) : null;
  }
  async findByDeliveryIntent(input: { assignmentId: string; requestFingerprint: string }): Promise<HandoffDeliveryAttempt | null> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { assignmentId_requestFingerprint: input } });
    return record ? mapAttempt(record) : null;
  }
  async bindIdempotencyKey(input: { assignmentId: string; idempotencyKey: string; attemptId: string }): Promise<HandoffDeliveryAttempt> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { id: input.attemptId } });
    if (!record || record.assignmentId !== input.assignmentId) throw new Error('Delivery attempt not found for assignment');
    return this.bindOrResolveKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey, attempt: mapAttempt(record) });
  }
  async reserve(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<{ attempt: HandoffDeliveryAttempt; reserved: boolean }> {
    try {
      const record = await (this.prisma as any).$transaction(async (tx: any) => {
        const attempt = await tx.portfolioHandoffDeliveryAttempt.create({ data: input });
        await tx.portfolioHandoffDeliveryAttemptKey.create({
          data: { assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey, attemptId: attempt.id },
        });
        return attempt;
      });
      return { attempt: mapAttempt(record), reserved: true };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.findByIdempotencyKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey })
        ?? await this.findByDeliveryIntent({ assignmentId: input.assignmentId, requestFingerprint: input.requestFingerprint });
      if (!existing) throw error;
      return { attempt: await this.bindOrResolveKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey, attempt: existing }), reserved: false };
    }
  }
  async markExpiredUnknown(input: { attemptId: string; observedAt: Date }): Promise<HandoffDeliveryAttempt> {
    await (this.prisma as any).portfolioHandoffDeliveryAttempt.updateMany({
      where: {
        id: input.attemptId,
        errorCategory: 'IDEMPOTENCY_RESERVED',
        OR: [
          { status: 'UNKNOWN', leaseUntil: { lte: input.observedAt } },
          // Compatibility with attempts created before persistent fencing.
          { status: 'FAILED', executionGeneration: 0, executionOwnerId: null, leaseUntil: null },
        ],
      },
      data: { status: 'UNKNOWN', errorCategory: 'DELIVERY_OUTCOME_UNKNOWN', executionOwnerId: null, leaseUntil: null },
    });
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { id: input.attemptId } });
    if (!record) throw new Error('Reserved delivery attempt not found');
    return mapAttempt(record);
  }
  async claimConfirmedFailure(input: { attemptId: string; expectedGeneration: number; executionOwnerId: string; idempotencyKey: string; attemptedAt: Date; leaseUntil: Date }): Promise<{ attempt: HandoffDeliveryAttempt; claimed: boolean }> {
    let claimed = false;
    try {
      await (this.prisma as any).$transaction(async (tx: any) => {
        const updated = await tx.portfolioHandoffDeliveryAttempt.updateMany({
          where: { id: input.attemptId, status: 'FAILED', executionGeneration: input.expectedGeneration, errorCategory: { notIn: ['IDEMPOTENCY_RESERVED', 'DELIVERY_OUTCOME_UNKNOWN'] } },
          data: {
            status: 'UNKNOWN', attemptedAt: input.attemptedAt, errorCategory: 'IDEMPOTENCY_RESERVED',
            executionGeneration: { increment: 1 }, executionOwnerId: input.executionOwnerId, leaseUntil: input.leaseUntil,
          },
        });
        if (updated.count !== 1) throw new DeliveryClaimLostError();
        await tx.portfolioHandoffDeliveryAttemptKey.create({
          data: { assignmentId: (await tx.portfolioHandoffDeliveryAttempt.findUniqueOrThrow({ where: { id: input.attemptId } })).assignmentId, idempotencyKey: input.idempotencyKey, attemptId: input.attemptId },
        });
      });
      claimed = true;
    } catch (error) {
      if (!(error instanceof DeliveryClaimLostError) && (error as { code?: string }).code !== 'P2002') throw error;
    }
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { id: input.attemptId } });
    if (!record) throw new Error('Failed delivery attempt not found');
    const attempt = mapAttempt(record);
    return {
      attempt: claimed
        ? attempt
        : await this.bindOrResolveKey({ assignmentId: attempt.assignmentId, idempotencyKey: input.idempotencyKey, attempt }),
      claimed,
    };
  }
  async completeOwned(input: { attemptId: string; executionGeneration: number; executionOwnerId: string; status: HandoffDeliveryAttempt['status']; providerMessageRef: string | null; errorCategory: string | null; attemptedAt: Date }): Promise<{ attempt: HandoffDeliveryAttempt; completed: boolean }> {
    const completed = await (this.prisma as any).portfolioHandoffDeliveryAttempt.updateMany({
      where: {
        id: input.attemptId, status: 'UNKNOWN', errorCategory: 'IDEMPOTENCY_RESERVED',
        executionGeneration: input.executionGeneration, executionOwnerId: input.executionOwnerId, leaseUntil: { gte: input.attemptedAt },
      },
      data: {
        status: input.status, providerMessageRef: input.providerMessageRef, errorCategory: input.errorCategory,
        attemptedAt: input.attemptedAt, executionOwnerId: null, leaseUntil: null,
      },
    });
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { id: input.attemptId } });
    if (!record) throw new Error('Reserved delivery attempt not found');
    return { attempt: mapAttempt(record), completed: completed.count === 1 };
  }

  private async bindOrResolveKey(input: { assignmentId: string; idempotencyKey: string; attempt: HandoffDeliveryAttempt }): Promise<HandoffDeliveryAttempt> {
    try {
      await (this.prisma as any).portfolioHandoffDeliveryAttemptKey.create({
        data: { assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey, attemptId: input.attempt.id },
      });
      return input.attempt;
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      return await this.findByIdempotencyKey({ assignmentId: input.assignmentId, idempotencyKey: input.idempotencyKey }) ?? input.attempt;
    }
  }
}

class DeliveryClaimLostError extends Error {}

function mapAttempt(record: any): HandoffDeliveryAttempt {
  return {
    id: record.id, assignmentId: record.assignmentId, channel: record.channel, status: record.status, attemptedAt: record.attemptedAt,
    providerMessageRef: record.providerMessageRef, errorCategory: record.errorCategory, idempotencyKey: record.idempotencyKey,
    requestFingerprint: record.requestFingerprint, executionGeneration: record.executionGeneration, executionOwnerId: record.executionOwnerId,
    leaseUntil: record.leaseUntil,
  };
}
