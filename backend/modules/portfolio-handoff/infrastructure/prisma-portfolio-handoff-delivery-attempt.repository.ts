import type { PrismaClient } from '@prisma/client';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository } from '../domain/portfolio-handoff-invitation.types';

export class PrismaPortfolioHandoffDeliveryAttemptRepository implements HandoffDeliveryAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.findUnique({ where: { assignmentId_idempotencyKey: input } });
    return record ? mapAttempt(record) : null;
  }
  async create(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<HandoffDeliveryAttempt> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryAttempt.create({ data: input });
    return mapAttempt(record);
  }
}

function mapAttempt(record: any): HandoffDeliveryAttempt {
  return { id: record.id, assignmentId: record.assignmentId, channel: record.channel, status: record.status, attemptedAt: record.attemptedAt, providerMessageRef: record.providerMessageRef, errorCategory: record.errorCategory, idempotencyKey: record.idempotencyKey };
}
