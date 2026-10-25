import { randomUUID } from 'node:crypto';
import type { HandoffDeliveryAttempt, HandoffDeliveryAttemptRepository } from '../domain/portfolio-handoff-invitation.types';

export class InMemoryHandoffDeliveryAttemptRepository implements HandoffDeliveryAttemptRepository {
  readonly attempts: HandoffDeliveryAttempt[] = [];
  private readonly idempotencyBindings = new Map<string, string>();
  async findByIdempotencyKey(input: { assignmentId: string; idempotencyKey: string }): Promise<HandoffDeliveryAttempt | null> {
    const attemptId = this.idempotencyBindings.get(`${input.assignmentId}:${input.idempotencyKey}`);
    return this.attempts.find((attempt) => attempt.id === attemptId)
      ?? this.attempts.find((attempt) => attempt.assignmentId === input.assignmentId && attempt.idempotencyKey === input.idempotencyKey)
      ?? null;
  }
  async findByDeliveryIntent(input: { assignmentId: string; requestFingerprint: string }): Promise<HandoffDeliveryAttempt | null> {
    return this.attempts.find((attempt) => attempt.assignmentId === input.assignmentId && attempt.requestFingerprint === input.requestFingerprint) ?? null;
  }
  async bindIdempotencyKey(input: { assignmentId: string; idempotencyKey: string; attemptId: string }): Promise<HandoffDeliveryAttempt> {
    const bindingKey = `${input.assignmentId}:${input.idempotencyKey}`;
    const boundAttemptId = this.idempotencyBindings.get(bindingKey);
    const attempt = this.attempts.find((item) => item.id === (boundAttemptId ?? input.attemptId));
    if (!attempt || attempt.assignmentId !== input.assignmentId) throw new Error('Delivery attempt not found for assignment');
    if (!boundAttemptId) this.idempotencyBindings.set(bindingKey, attempt.id);
    return attempt;
  }
  async reserve(input: Omit<HandoffDeliveryAttempt, 'id'>): Promise<{ attempt: HandoffDeliveryAttempt; reserved: boolean }> {
    const boundAttemptId = this.idempotencyBindings.get(`${input.assignmentId}:${input.idempotencyKey}`);
    const existing = this.attempts.find((attempt) => attempt.id === boundAttemptId)
      ?? this.attempts.find((attempt) => attempt.assignmentId === input.assignmentId && (attempt.idempotencyKey === input.idempotencyKey || attempt.requestFingerprint === input.requestFingerprint))
      ?? null;
    if (existing) {
      if (!boundAttemptId) this.idempotencyBindings.set(`${input.assignmentId}:${input.idempotencyKey}`, existing.id);
      return { attempt: existing, reserved: false };
    }
    const attempt = { ...input, id: randomUUID() };
    this.attempts.push(attempt);
    this.idempotencyBindings.set(`${input.assignmentId}:${input.idempotencyKey}`, attempt.id);
    return { attempt, reserved: true };
  }
  async markExpiredUnknown(input: { attemptId: string; observedAt: Date }): Promise<HandoffDeliveryAttempt> {
    const attempt = this.attempts.find((item) => item.id === input.attemptId);
    if (!attempt) throw new Error('Reserved delivery attempt not found');
    const expiredFencedReservation = attempt.status === 'UNKNOWN'
      && Boolean(attempt.leaseUntil && attempt.leaseUntil <= input.observedAt);
    const preFencingReservation = attempt.status === 'FAILED'
      && attempt.executionGeneration === 0
      && attempt.executionOwnerId === null
      && attempt.leaseUntil === null;
    if (attempt.errorCategory === 'IDEMPOTENCY_RESERVED' && (expiredFencedReservation || preFencingReservation)) {
      Object.assign(attempt, { status: 'UNKNOWN', errorCategory: 'DELIVERY_OUTCOME_UNKNOWN', executionOwnerId: null, leaseUntil: null });
    }
    return attempt;
  }
  async claimConfirmedFailure(input: { attemptId: string; expectedGeneration: number; executionOwnerId: string; idempotencyKey: string; attemptedAt: Date; leaseUntil: Date }): Promise<{ attempt: HandoffDeliveryAttempt; claimed: boolean }> {
    const attempt = this.attempts.find((item) => item.id === input.attemptId);
    if (!attempt) throw new Error('Failed delivery attempt not found');
    const bindingKey = `${attempt.assignmentId}:${input.idempotencyKey}`;
    const claimed = !this.idempotencyBindings.has(bindingKey)
      && attempt.status === 'FAILED'
      && attempt.executionGeneration === input.expectedGeneration
      && !['IDEMPOTENCY_RESERVED', 'DELIVERY_OUTCOME_UNKNOWN'].includes(attempt.errorCategory ?? '');
    if (claimed) Object.assign(attempt, {
      status: 'UNKNOWN', attemptedAt: input.attemptedAt, errorCategory: 'IDEMPOTENCY_RESERVED',
      executionGeneration: attempt.executionGeneration + 1,
      executionOwnerId: input.executionOwnerId, leaseUntil: input.leaseUntil,
    });
    if (claimed) this.idempotencyBindings.set(bindingKey, attempt.id);
    if (!this.idempotencyBindings.has(bindingKey)) this.idempotencyBindings.set(bindingKey, attempt.id);
    return { attempt, claimed };
  }
  async completeOwned(input: { attemptId: string; executionGeneration: number; executionOwnerId: string; status: HandoffDeliveryAttempt['status']; providerMessageRef: string | null; errorCategory: string | null; attemptedAt: Date }): Promise<{ attempt: HandoffDeliveryAttempt; completed: boolean }> {
    const attempt = this.attempts.find((item) => item.id === input.attemptId);
    if (!attempt) throw new Error('Reserved delivery attempt not found');
    const completed = attempt.status === 'UNKNOWN'
      && attempt.errorCategory === 'IDEMPOTENCY_RESERVED'
      && attempt.executionGeneration === input.executionGeneration
      && attempt.executionOwnerId === input.executionOwnerId
      && Boolean(attempt.leaseUntil && attempt.leaseUntil >= input.attemptedAt);
    if (completed) Object.assign(attempt, {
      status: input.status, providerMessageRef: input.providerMessageRef, errorCategory: input.errorCategory,
      attemptedAt: input.attemptedAt, executionOwnerId: null, leaseUntil: null,
    });
    return { attempt, completed };
  }
}
