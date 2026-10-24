import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PortfolioHandoffBatchDeliveryService, type HandoffDeliveryContext } from '../application/portfolio-handoff-batch-delivery.service';
import type { PortfolioHandoffDeliveryService } from '../application/portfolio-handoff-delivery.service';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffDeliveryBatch, HandoffDeliveryBatchItemResult, HandoffDeliveryBatchRepository } from '../domain/portfolio-handoff-invitation.types';

class BatchMemory implements HandoffDeliveryBatchRepository {
  records: HandoffDeliveryBatch[] = [];
  async findById(id: string) { return this.records.find((item) => item.id === id) ?? null; }
  async findByIdempotencyKey(input: { organizationId: string; idempotencyKey: string }) { return this.records.find((item) => item.organizationId === input.organizationId && item.idempotencyKey === input.idempotencyKey) ?? null; }
  async reserve(input: Omit<HandoffDeliveryBatch, 'id' | 'createdAt'>) {
    const existing = this.records.find((item) => item.organizationId === input.organizationId && item.idempotencyKey === input.idempotencyKey);
    if (existing) return { batch: existing, reserved: false };
    const batch = { ...input, id: randomUUID(), createdAt: new Date() };
    this.records.push(batch);
    return { batch, reserved: true };
  }
  async saveProgress(input: { batchId: string; results: HandoffDeliveryBatchItemResult[]; status: HandoffDeliveryBatch['status']; completedAt: Date | null }) {
    const record = (await this.findById(input.batchId))!;
    Object.assign(record, input, { succeededCount: input.results.filter((item) => item.status === 'SUCCEEDED').length, failedCount: input.results.filter((item) => item.status === 'FAILED').length });
    return record;
  }
}

function assignment(id: string, version = 1): HandoffAssignment {
  return {
    id, organizationId: 'org-1', portfolioScopeRef: null, challengeId: 'challenge-1', targetKind: 'CHALLENGE', initiativeId: null,
    briefVersionId: 'brief-v1', contextNote: 'Contexto exacto', invitedEmailNormalized: `${id}@example.test`, invitedIdentityRef: null,
    createdByActorId: 'actor-1', state: 'CREATED', version, members: [{ identityKey: `${id}@example.test`, emailNormalized: `${id}@example.test`, role: 'OWNER' }],
    createdAt: new Date(), updatedAt: new Date(), sentAt: null, viewedAt: null, revokedAt: null, expiredAt: null, acceptedAt: null,
    acceptedBy: null, rejectionReason: null, rejectedAt: null, rejectedBy: null, startedAt: null, startedBy: null,
    portfolioResponse: null, portfolioResponseRecordedAt: null, portfolioResponseRecordedBy: null,
    briefVersion: { id: 'brief-v1', versionNumber: 1, status: 'CONFIRMED', intent: 'Resultado esperado', scope: 'Alcance', strategicContextRefs: [], inheritedContext: {}, constraintsSnapshot: {}, knownGaps: [], sourceRefs: [], provenance: {}, confirmedAt: new Date() },
  };
}

function context(value: HandoffAssignment): HandoffDeliveryContext {
  return { assignment: value, challengeName: 'Reto de crecimiento', initiativeName: null, initiativeOrganizationId: null, initiativeChallengeIds: [] };
}

function setup(values = [assignment('a-1'), assignment('a-2')]) {
  const batches = new BatchMemory();
  const findManyByIds = vi.fn(async (ids: string[]) => values.filter((item) => ids.includes(item.id)).map(context));
  const sendHandoffInvitation = vi.fn(async ({ assignmentId }: { assignmentId: string }) => ({ state: assignmentId === 'a-2' ? 'CREATED' as const : 'SENT' as const, attemptStatus: assignmentId === 'a-2' ? 'FAILED' as const : 'SUCCEEDED' as const }));
  const service = new PortfolioHandoffBatchDeliveryService(batches, { findManyByIds }, { sendHandoffInvitation } as unknown as PortfolioHandoffDeliveryService);
  return { batches, findManyByIds, sendHandoffInvitation, service };
}

describe('PortfolioHandoffBatchDeliveryService / PL-06B', () => {
  it('preflights every selected assignment before sending any invitation', async () => {
    const ctx = setup([assignment('a-1'), { ...assignment('a-2'), version: 2 }]);
    await expect(ctx.service.send({ organizationId: 'org-1', challengeId: 'challenge-1', actorId: 'actor-1', idempotencyKey: 'batch-1', items: [{ assignmentId: 'a-1', expectedVersion: 1 }, { assignmentId: 'a-2', expectedVersion: 1 }] }))
      .rejects.toMatchObject({ code: 'STALE_VERSION' });
    expect(ctx.sendHandoffInvitation).not.toHaveBeenCalled();
  });

  it('persists partial outcomes, replays idempotently, and retries only failed items', async () => {
    const ctx = setup();
    const input = { organizationId: 'org-1', challengeId: 'challenge-1', actorId: 'actor-1', idempotencyKey: 'batch-1', items: [{ assignmentId: 'a-1', expectedVersion: 1 }, { assignmentId: 'a-2', expectedVersion: 1 }] };
    const first = await ctx.service.send(input);
    expect(first).toMatchObject({ status: 'PARTIAL', succeededCount: 1, failedCount: 1 });
    expect(await ctx.service.send(input)).toBe(first);
    expect(ctx.sendHandoffInvitation).toHaveBeenCalledTimes(2);

    ctx.sendHandoffInvitation.mockResolvedValue({ state: 'SENT', attemptStatus: 'SUCCEEDED' });
    const retry = await ctx.service.send({ ...input, idempotencyKey: 'batch-retry', retryOfBatchId: first.id, items: [{ assignmentId: 'a-2', expectedVersion: 1 }] });
    expect(retry).toMatchObject({ status: 'COMPLETED', succeededCount: 1, failedCount: 0, retryOfBatchId: first.id });
    expect(ctx.sendHandoffInvitation).toHaveBeenCalledTimes(3);
  });

  it('rejects reuse of a batch key with a different selection', async () => {
    const ctx = setup();
    const base = { organizationId: 'org-1', challengeId: 'challenge-1', actorId: 'actor-1', idempotencyKey: 'same-key' };
    await ctx.service.send({ ...base, items: [{ assignmentId: 'a-1', expectedVersion: 1 }] });
    await expect(ctx.service.send({ ...base, items: [{ assignmentId: 'a-2', expectedVersion: 1 }] }))
      .rejects.toMatchObject({ code: 'HANDOFF_BATCH_IDEMPOTENCY_CONFLICT' });
  });

  it('waits for the winning concurrent batch and returns its terminal result once', async () => {
    const ctx = setup([assignment('a-1')]);
    let releaseDelivery!: () => void;
    const deliveryGate = new Promise<void>((resolve) => { releaseDelivery = resolve; });
    ctx.sendHandoffInvitation.mockImplementation(async () => {
      await deliveryGate;
      return { state: 'SENT', attemptStatus: 'SUCCEEDED', providerMessageRef: 'provider-batch', errorCategory: null };
    });
    const input = { organizationId: 'org-1', challengeId: 'challenge-1', actorId: 'actor-1', idempotencyKey: 'concurrent-batch', items: [{ assignmentId: 'a-1', expectedVersion: 1 }] };

    const winner = ctx.service.send(input);
    await vi.waitFor(() => expect(ctx.sendHandoffInvitation).toHaveBeenCalledTimes(1));
    const replay = ctx.service.send(input);
    await Promise.resolve();
    releaseDelivery();

    const [first, second] = await Promise.all([winner, replay]);
    expect(first).toMatchObject({ status: 'COMPLETED', succeededCount: 1 });
    expect(second).toMatchObject({ id: first.id, status: 'COMPLETED', succeededCount: 1 });
    expect(ctx.sendHandoffInvitation).toHaveBeenCalledTimes(1);
  });
});
