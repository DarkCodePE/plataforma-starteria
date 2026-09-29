import { randomUUID } from 'node:crypto';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository } from '../domain/portfolio-handoff-invitation.types';

export class InMemoryHandoffDeliveryAttemptRepository implements HandoffDeliveryAttemptRepository {
  readonly attempts: HandoffDeliveryAttempt[] = [];
  async findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null> {
    return this.attempts.find((attempt) => attempt.assignmentId === input.assignmentId && attempt.idempotencyKey === input.idempotencyKey) ?? null;
  }
  async create(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<HandoffDeliveryAttempt> {
    const attempt = { ...input, id: randomUUID() };
    this.attempts.push(attempt);
    return attempt;
  }
}
