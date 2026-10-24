import { createHash } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffDeliveryBatch, HandoffDeliveryBatchRepository } from '../domain/portfolio-handoff-invitation.types';
import type { PortfolioHandoffDeliveryService } from './portfolio-handoff-delivery.service';

export type HandoffDeliveryContext = {
  assignment: HandoffAssignment;
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
  ) {}

  async send(input: SendHandoffInvitationBatchInput): Promise<HandoffDeliveryBatch> {
    const normalized = normalize(input);
    const requestFingerprint = fingerprint(normalized);
    const existing = await this.batches.findByIdempotencyKey({ organizationId: normalized.organizationId, idempotencyKey: normalized.idempotencyKey });
    if (existing) {
      return this.replayExistingBatch(normalized.organizationId, normalized.idempotencyKey, requestFingerprint, existing);
    }

    await this.assertRetrySelection(normalized);
    const contexts = await this.contexts.findManyByIds(normalized.items.map((item) => item.assignmentId));
    this.assertPreflight(normalized, contexts);

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
      completedAt: null,
    });
    if (!reservation.reserved) {
      return this.replayExistingBatch(normalized.organizationId, normalized.idempotencyKey, requestFingerprint, reservation.batch);
    }
    let batch = reservation.batch;

    const byId = new Map(contexts.map((context) => [context.assignment.id, context]));
    for (const item of normalized.items) {
      const context = byId.get(item.assignmentId)!;
      const assignment = context.assignment;
      const targetName = assignment.targetKind === 'EXISTING_INITIATIVE' ? context.initiativeName! : context.challengeName;
      const briefContext = assignment.briefVersion
        ? `Brief confirmado v${assignment.briefVersion.versionNumber}: ${assignment.briefVersion.intent ?? assignment.briefVersion.scope ?? 'Contexto confirmado'}`
        : 'Este encargo no incorpora un Brief.';
      const result = await this.delivery.sendHandoffInvitation({
        assignmentId: assignment.id,
        idempotencyKey: `${normalized.idempotencyKey}:${assignment.id}`,
        requestFingerprint: fingerprint({ batch: requestFingerprint, assignmentId: assignment.id }),
        title: `${assignment.targetKind === 'EXISTING_INITIATIVE' ? 'Iniciativa' : 'Reto'}: ${targetName}`,
        whyItMatters: [assignment.contextNote, briefContext].filter(Boolean).join('\n\n'),
      });
      const results = [...batch.results, {
        assignmentId: assignment.id,
        status: result.attemptStatus === 'FAILED' ? 'FAILED' as const : 'SUCCEEDED' as const,
        state: result.state,
        errorCategory: result.errorCategory,
        providerMessageRef: result.providerMessageRef,
      }];
      batch = await this.batches.saveProgress({ batchId: batch.id, results, status: 'PROCESSING', completedAt: null });
    }

    const succeededCount = batch.results.filter((item) => item.status === 'SUCCEEDED').length;
    const failedCount = batch.results.length - succeededCount;
    const status = failedCount === 0 ? 'COMPLETED' : succeededCount === 0 ? 'FAILED' : 'PARTIAL';
    return this.batches.saveProgress({ batchId: batch.id, results: batch.results, status, completedAt: this.now() });
  }

  private async replayExistingBatch(organizationId: string, idempotencyKey: string, requestFingerprint: string, initial: HandoffDeliveryBatch): Promise<HandoffDeliveryBatch> {
    if (initial.requestFingerprint !== requestFingerprint) throw AppError.conflict('La clave de idempotencia ya se utilizo con otra seleccion', 'HANDOFF_BATCH_IDEMPOTENCY_CONFLICT');
    let batch = initial;
    for (let index = 0; batch.status === 'PROCESSING' && index < 500; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      batch = await this.batches.findByIdempotencyKey({ organizationId, idempotencyKey }) ?? batch;
    }
    if (batch.status === 'PROCESSING') throw AppError.conflict('El lote con esta clave sigue en proceso', 'HANDOFF_BATCH_IN_PROGRESS');
    return batch;
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

  private assertPreflight(input: ReturnType<typeof normalize>, contexts: HandoffDeliveryContext[]): void {
    const byId = new Map(contexts.map((context) => [context.assignment.id, context]));
    if (byId.size !== input.items.length) throw AppError.notFound('Asignacion', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
    for (const item of input.items) {
      const context = byId.get(item.assignmentId)!;
      const assignment = context.assignment;
      if (assignment.organizationId !== input.organizationId || assignment.challengeId !== input.challengeId) throw AppError.notFound('Asignacion', 'HANDOFF_ASSIGNMENT_NOT_FOUND');
      if (assignment.state !== 'CREATED') throw AppError.conflict('La asignacion ya no esta preparada', 'HANDOFF_INVITATION_NOT_SENDABLE');
      if (assignment.version !== item.expectedVersion) throw AppError.conflict('La asignacion cambio durante la revision', 'STALE_VERSION');
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

function normalize(input: SendHandoffInvitationBatchInput) {
  const items = [...input.items]
    .map((item) => ({ assignmentId: item.assignmentId.trim(), expectedVersion: item.expectedVersion }))
    .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId));
  if (!input.idempotencyKey.trim()) throw AppError.badRequest('Idempotency key requerida', 'HANDOFF_IDEMPOTENCY_REQUIRED');
  if (!items.length || items.some((item) => !item.assignmentId || !Number.isInteger(item.expectedVersion) || item.expectedVersion < 1)) throw AppError.badRequest('Seleccion de asignaciones invalida', 'HANDOFF_BATCH_ITEMS_INVALID');
  if (new Set(items.map((item) => item.assignmentId)).size !== items.length) throw AppError.badRequest('No se puede repetir una asignacion', 'HANDOFF_BATCH_ITEMS_DUPLICATED');
  return { ...input, idempotencyKey: input.idempotencyKey.trim(), retryOfBatchId: input.retryOfBatchId?.trim() || null, items };
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
