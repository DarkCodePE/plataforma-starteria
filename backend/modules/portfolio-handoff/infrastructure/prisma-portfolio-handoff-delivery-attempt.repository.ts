import type { PrismaClient } from '@prisma/client';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository } from '../domain/portfolio-handoff-invitation.types';

export class PrismaPortfolioHandoffDeliveryAttemptRepository implements HandoffDeliveryAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { assignmentId_idempotencyKey: input } });
    return record ? mapAttempt(record) : null;
  }
  async reserve(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<{ attempt: HandoffDeliveryAttempt; reserved: boolean }> {
    try {
      const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.create({ data: input });
      return { attempt: mapAttempt(record), reserved: true };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.findByIdempotencyKey(input);
      if (!existing) throw error;
      return { attempt: existing, reserved: false };
    }
  }
  async reclaimReservation(input: { attemptId: string; staleBefore: Date; attemptedAt: Date }): Promise<{ attempt: HandoffDeliveryAttempt; reclaimed: boolean }> {
    const claimed = await (this.prisma as any).portfolioHandoffDeliveryAttempt.updateMany({
      where: { id: input.attemptId, status: 'FAILED', errorCategory: 'IDEMPOTENCY_RESERVED', attemptedAt: { lte: input.staleBefore } },
      data: { attemptedAt: input.attemptedAt },
    });
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { id: input.attemptId } });
    if (!record) throw new Error('Reserved delivery attempt not found');
    return { attempt: mapAttempt(record), reclaimed: claimed.count === 1 };
  }
  async complete(input: { attemptId: string; status: HandoffDeliveryAttempt['status']; providerMessageRef: string | null; errorCategory: string | null; attemptedAt: Date }): Promise<HandoffDeliveryAttempt> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.update({
      where: { id: input.attemptId },
      data: { status: input.status, providerMessageRef: input.providerMessageRef, errorCategory: input.errorCategory, attemptedAt: input.attemptedAt },
    });
    return mapAttempt(record);
  }
}

function mapAttempt(record: any): HandoffDeliveryAttempt {
  return { id: record.id, assignmentId: record.assignmentId, channel: record.channel, status: record.status, attemptedAt: record.attemptedAt, providerMessageRef: record.providerMessageRef, errorCategory: record.errorCategory, idempotencyKey: record.idempotencyKey, requestFingerprint: record.requestFingerprint };
}
