import { createHash, randomUUID } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffDeliveryBatch, HandoffDeliveryBatchRepository } from '../domain/portfolio-handoff-invitation.types';
import type { PortfolioHandoffDeliveryService } from './portfolio-handoff-delivery.service';

export type HandoffDeliveryContext = {
  assignment: HandoffAssignment;
  organizationName: string;
  challengeName: string;
  initiativeName: string | null;
  initiativeOrganizationId: string | null;
  initiativeChallengeIds: string[];
};

export interface HandoffDeliveryContextRepository {
  findManyByIds(ids: string[]): Promise<HandoffDeliveryContext[]>;
}

export type SendHandoffInvitationBatchInput = {
  organizationId: string;
  challengeId: string;
  actorId: string;
  idempotencyKey: string;
  items: Array<{ assignmentId: string; expectedVersion: number }>;
  retryOfBatchId?: string | null;
};

export class PortfolioHandoffBatchDeliveryService {
  constructor(
    private readonly batches: HandoffDeliveryBatchRepository,
    private readonly contexts: HandoffDeliveryContextRepository,
    private readonly delivery: PortfolioHandoffDeliveryService,
    private readonly now: () => Date = () => new Date(),
    private readonly processingLeaseMs = 30_000,
    private readonly maxBatchSize = 25,
  ) {}

  async send(input: SendHandoffInvitationBatchInput): Promise<HandoffDeliveryBatch> {
    const normalized = normalize(input, this.maxBatchSize);
    const requestFingerprint = fingerprint(normalized);
    const existing = await this.batches.findByIdempotencyKey({ organizationId: normalized.organizationId, idempotencyKey: normalized.idempotencyKey });
    if (existing) {
      return this.replayExistingBatch(normalized, requestFingerprint, existing);
    }

    await this.assertRetrySelection(normalized);
    const contexts = await this.contexts.findManyByIds(normalized.items.map((item) => item.assignmentId));
    this.assertPreflight(normalized, contexts);

    const reservedAt = this.now();
    const reservation = await this.batches.reserve({
      organizationId: normalized.organizationId,
      challengeId: normalized.challengeId,
      actorId: normalized.actorId,
      idempotencyKey: normalized.idempotencyKey,
      requestFingerprint,
      retryOfBatchId: normalized.retryOfBatchId,
      assignmentIds: normalized.items.map((item) => item.assignmentId),
      status: 'PROCESSING',
      results: [],
      succeededCount: 0,
      failedCount: 0,
      processingLeaseUntil: this.nextLease(reservedAt),
      processingGeneration: 1,
      processingOwnerId: randomUUID(),
      completedAt: null,
    });
    if (!reservation.reserved) {
      return this.replayExistingBatch(normalized, requestFingerprint, reservation.batch);
    }
    return this.processReservedBatch(normalized, reservation.batch, contexts);
  }

  private async processReservedBatch(
    input: ReturnType<typeof normalize>,
    initial: HandoffDeliveryBatch,
    contexts?: HandoffDeliveryContext[],
    recovering = false,
  ): Promise<HandoffDeliveryBatch> {
    let batch = initial;
    const completedIds = new Set(batch.results.map((item) => item.assignmentId));
    const pendingItems = input.items.filter((item) => !completedIds.has(item.assignmentId));
    const resolvedContexts = contexts ?? await this.contexts.findManyByIds(pendingItems.map((item) => item.assignmentId));
    if (pendingItems.length > 0) {
      this.assertPreflight({ ...input, items: pendingItems }, resolvedContexts, recovering);
    }

    const byId = new Map(resolvedContexts.map((context) => [context.assignment.id, context]));
    for (const item of pendingItems) {
      const context = byId.get(item.assignmentId)!;
      const assignment = context.assignment;
      const targetName = assignment.targetKind === 'EXISTING_INITIATIVE' ? context.initiativeName! : context.challengeName;
      const briefContext = assignment.briefVersion
        ? `Brief confirmado v${assignment.briefVersion.versionNumber}: ${assignment.briefVersion.intent ?? assignment.briefVersion.scope ?? 'Contexto confirmado'}`
        : 'Este encargo no incorpora un Brief.';
      const result = await this.delivery.sendHandoffInvitation({
        assignmentId: assignment.id,
        actorId: input.actorId,
        idempotencyKey: `${input.idempotencyKey}:${assignment.id}`,
        title: `${assignment.targetKind === 'EXISTING_INITIATIVE' ? 'Iniciativa' : 'Reto'}: ${targetName}`,
        targetName,
        invitingOrganizationName: context.organizationName,
        whyItMatters: [assignment.contextNote, briefContext].filter(Boolean).join('\n\n'),
      });
      const results = [...batch.results, {
        assignmentId: assignment.id,
        status: result.attemptStatus === 'FAILED'
          ? 'FAILED' as const
          : result.attemptStatus === 'UNKNOWN'
            ? 'UNKNOWN' as const
            : 'SUCCEEDED' as const,
        state: result.state,
        errorCategory: result.errorCategory,
        providerMessageRef: result.providerMessageRef,
        transportReceiptStatus: result.transportReceiptStatus,
      }];
      const observedAt = this.now();
      const progress = await this.batches.saveProgress({
        batchId: batch.id,
        executionGeneration: batch.processingGeneration,
        executionOwnerId: batch.processingOwnerId!,
        observedAt,
        results,
        status: 'PROCESSING',
        completedAt: null,
        processingLeaseUntil: this.nextLease(observedAt),
      });
      batch = progress.batch;
      if (!progress.saved) return batch;
    }

    const succeededCount = batch.results.filter((item) => item.status === 'SUCCEEDED').length;
    const failedCount = batch.results.filter((item) => item.status === 'FAILED').length;
    const unknownCount = batch.results.filter((item) => item.status === 'UNKNOWN').length;
    const status = unknownCount > 0
      ? 'RECONCILIATION_REQUIRED'
      : failedCount === 0
        ? 'COMPLETED'
        : succeededCount === 0
          ? 'FAILED'
          : 'PARTIAL';
    const completedAt = this.now();
    const terminal = await this.batches.saveProgress({
      batchId: batch.id,
      executionGeneration: batch.processingGeneration,
      executionOwnerId: batch.processingOwnerId!,
      observedAt: completedAt,
      results: batch.results,
      status,
      completedAt,
      processingLeaseUntil: null,
    });
    return terminal.batch;
  }

  private async replayExistingBatch(input: ReturnType<typeof normalize>, requestFingerprint: string, initial: HandoffDeliveryBatch): Promise<HandoffDeliveryBatch> {
    if (initial.requestFingerprint !== requestFingerprint) throw AppError.conflict('La clave de idempotencia ya se utilizo con otra seleccion', 'HANDOFF_BATCH_IDEMPOTENCY_CONFLICT');
    let batch = initial;
    const immediate = await this.tryReclaimBatch(batch);
    if (immediate.reclaimed) return this.resumeReclaimedBatch(input, immediate.batch);
    for (let index = 0; batch.status === 'PROCESSING' && index < 500; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      batch = await this.batches.findByIdempotencyKey({ organizationId: input.organizationId, idempotencyKey: input.idempotencyKey }) ?? batch;
    }
    if (batch.status === 'PROCESSING') {
      const reclaimed = await this.tryReclaimBatch(batch);
      if (reclaimed.reclaimed) return this.resumeReclaimedBatch(input, reclaimed.batch);
      throw AppError.conflict('El lote con esta clave sigue en proceso', 'HANDOFF_BATCH_IN_PROGRESS');
    }
    return batch;
  }

  private async tryReclaimBatch(batch: HandoffDeliveryBatch) {
    if (batch.status !== 'PROCESSING') return { batch, reclaimed: false };
    const now = this.now();
    return this.batches.reclaimProcessing({ batchId: batch.id, staleBefore: now, leaseUntil: this.nextLease(now), executionOwnerId: randomUUID() });
  }

  private async resumeReclaimedBatch(input: ReturnType<typeof normalize>, batch: HandoffDeliveryBatch): Promise<HandoffDeliveryBatch> {
    await this.assertRetrySelection(input);
    return this.processReservedBatch(input, batch, undefined, true);
  }

  private nextLease(from = this.now()): Date {
    return new Date(from.getTime() + this.processingLeaseMs);
  }

  private async assertRetrySelection(input: ReturnType<typeof normalize>): Promise<void> {
    if (!input.retryOfBatchId) return;
    const prior = await this.batches.findById(input.retryOfBatchId);
    if (!prior || prior.organizationId !== input.organizationId || prior.challengeId !== input.challengeId) {
      throw AppError.notFound('Lote de envio', 'HANDOFF_BATCH_NOT_FOUND');
    }
    const failed = new Set(prior.results.filter((item) => item.status === 'FAILED').map((item) => item.assignmentId));
    if (!input.items.length || input.items.some((item) => !failed.has(item.assignmentId))) {
      throw AppError.conflict('Solo se pueden reintentar invitaciones fallidas', 'HANDOFF_BATCH_RETRY_SELECTION_INVALID');
    }
  }

  private assertPreflight(input: ReturnType<typeof normalize>, contexts: HandoffDeliveryContext[], recovering = false): void {
    const byId = new Map(contexts.map((context) => [context.assignment.id, context]));
    if (byId.size !== input.items.length) throw AppError.notFound('Asignacion', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
    for (const item of input.items) {
      const context = byId.get(item.assignmentId)!;
      const assignment = context.assignment;
      if (assignment.organizationId !== input.organizationId || assignment.challengeId !== input.challengeId) throw AppError.notFound('Asignacion', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
      const alreadyDeliveredDuringRecovery = recovering && (assignment.state === 'SENT' || assignment.state === 'VIEWED');
      if (assignment.state !== 'CREATED' && !alreadyDeliveredDuringRecovery) throw AppError.conflict('La asignacion ya no esta preparada', 'HANDOFF_INVITATION_NOT_SENDABLE');
      if (!alreadyDeliveredDuringRecovery && assignment.version !== item.expectedVersion) throw AppError.conflict('La asignacion cambio durante la revision', 'STALE_VERSION');
      const owner = assignment.members.find((member) => member.role === 'OWNER');
      if (!owner || owner.emailNormalized !== assignment.invitedEmailNormalized) throw AppError.conflict('La identidad destinataria no es consistente', 'HANDOFF_INVITED_IDENTITY_INVALID');
      if (assignment.targetKind === 'CHALLENGE' && (!assignment.briefVersion || assignment.briefVersion.status !== 'CONFIRMED' || assignment.briefVersion.id !== assignment.briefVersionId)) {
        throw AppError.conflict('El encargo no conserva un Brief confirmado valido', 'HANDOFF_BRIEF_VERSION_INVALID');
      }
      if (assignment.targetKind === 'EXISTING_INITIATIVE' && (!context.initiativeName || context.initiativeOrganizationId !== input.organizationId || !context.initiativeChallengeIds.includes(input.challengeId))) {
        throw AppError.notFound('Iniciativa', 'HANDOFF_INITIATIVE_NOT_ASSIGNABLE');
      }
    }
  }
}

function normalize(input: SendHandoffInvitationBatchInput, maxBatchSize: number) {
  const items = [...input.items]
    .map((item) => ({ assignmentId: item.assignmentId.trim(), expectedVersion: item.expectedVersion }))
    .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
  if (!input.idempotencyKey.trim()) throw AppError.badRequest('Idempotency key requerida', 'HANDOFF_IDEMPOTENCY_REQUIRED');
  if (!items.length || items.some((item) => !item.assignmentId || !Number.isInteger(item.expectedVersion) || item.expectedVersion < 1)) throw AppError.badRequest('Seleccion de asignaciones invalida', 'HANDOFF_BATCH_ITEMS_INVALID');
  if (items.length > maxBatchSize) throw AppError.badRequest('El lote excede el maximo permitido', 'HANDOFF_BATCH_TOO_LARGE');
  if (new Set(items.map((item) => item.assignmentId)).size !== items.length) throw AppError.badRequest('No se puede repetir una asignacion', 'HANDOFF_BATCH_ITEMS_DUPLICATED');
  return { ...input, idempotencyKey: input.idempotencyKey.trim(), retryOfBatchId: input.retryOfBatchId?.trim() || null, items };
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
