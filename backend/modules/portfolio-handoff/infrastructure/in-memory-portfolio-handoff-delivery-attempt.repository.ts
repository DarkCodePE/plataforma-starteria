import { randomUUID } from 'node:crypto';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository } from '../domain/portfolio-handoff-invitation.types';

export class InMemoryHandoffDeliveryAttemptRepository implements HandoffDeliveryAttemptRepository {
  readonly attempts: HandoffDeliveryAttempt[] = [];
  async findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null> {
    return this.attempts.find((attempt) => attempt.assignmentId === input.assignmentId && attempt.idempotencyKey === input.idempotencyKey) ?? null;
  }
  async reserve(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<{ attempt: HandoffDeliveryAttempt; reserved: boolean }> {
    const existing = this.attempts.find((attempt) => attempt.assignmentId === input.assignmentId && attempt.idempotencyKey === input.idempotencyKey) ?? null;
    if (existing) return { attempt: existing, reserved: false };
    const attempt = { ...input, id: randomUUID() };
    this.attempts.push(attempt);
    return { attempt, reserved: true };
  }
  async reclaimReservation(input: { attemptId: string; staleBefore: Date; attemptedAt: Date }): Promise<{ attempt: HandoffDeliveryAttempt; reclaimed: boolean }> {
    const attempt = this.attempts.find((item) => item.id === input.attemptId);
    if (!attempt) throw new Error('Reserved delivery attempt not found');
    const reclaimed = attempt.errorCategory === 'IDEMPOTENCY_RESERVED' && attempt.attemptedAt.getTime() <= input.staleBefore.getTime();
    if (reclaimed) attempt.attemptedAt = input.attemptedAt;
    return { attempt, reclaimed };
  }
  async complete(input: { attemptId: string; status: HandoffDeliveryAttempt['status']; providerMessageRef: string | null; errorCategory: string | null; attemptedAt: Date }): Promise<HandoffDeliveryAttempt> {
    const attempt = this.attempts.find((item) => item.id === input.attemptId);
    if (!attempt) throw new Error('Reserved delivery attempt not found');
    Object.assign(attempt, { status: input.status, providerMessageRef: input.providerMessageRef, errorCategory: input.errorCategory, attemptedAt: input.attemptedAt });
    return attempt;
  }
}
