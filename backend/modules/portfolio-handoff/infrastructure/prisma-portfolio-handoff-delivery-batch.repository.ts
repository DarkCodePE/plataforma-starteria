import type { PrismaClient } from '@prisma/client';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffDeliveryBatch, HandoffDeliveryBatchItemResult, HandoffDeliveryBatchRepository } from '../domain/portfolio-handoff-invitation.types';
import type { HandoffDeliveryContext, HandoffDeliveryContextRepository } from '../application/portfolio-handoff-batch-delivery.service';

export class PrismaPortfolioHandoffDeliveryBatchRepository implements HandoffDeliveryBatchRepository, HandoffDeliveryContextRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<HandoffDeliveryBatch | null> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryBatch.findUnique({ where: { id } });
    return record ? mapBatch(record) : null;
  }

  async findByIdempotencyKey(input: { organizationId: string; idempotencyKey: string }): Promise<HandoffDeliveryBatch | null> {
    const record = await (this.prisma as any).portfolioHandoffDeliveryBatch.findUnique({ where: { organizationId_idempotencyKey: input } });
    return record ? mapBatch(record) : null;
  }

  async reserve(input: Omit<HandoffDeliveryBatch, 'id' | 'createdAt'>): Promise<{ batch: HandoffDeliveryBatch; reserved: boolean }> {
    try {
      const record = await (this.prisma as any).portfolioHandoffDeliveryBatch.create({ data: input });
      return { batch: mapBatch(record), reserved: true };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const existing = await this.findByIdempotencyKey({ organizationId: input.organizationId, idempotencyKey: input.idempotencyKey });
      if (!existing) throw error;
      return { batch: existing, reserved: false };
    }
  }

  async reclaimProcessing(input: { batchId: string; staleBefore: Date; leaseUntil: Date; executionOwnerId: string }): Promise<{ batch: HandoffDeliveryBatch; reclaimed: boolean }> {
    const claimed = await (this.prisma as any).portfolioHandoffDeliveryBatch.updateMany({
      where: {
        id: input.batchId,
        status: 'PROCESSING',
        OR: [{ processingLeaseUntil: null }, { processingLeaseUntil: { lte: input.staleBefore } }],
      },
      data: { processingLeaseUntil: input.leaseUntil, processingOwnerId: input.executionOwnerId, processingGeneration: { increment: 1 } },
    });
    const record = await (this.prisma as any).portfolioHandoffDeliveryBatch.findUnique({ where: { id: input.batchId } });
    if (!record) throw new Error('Delivery batch not found');
    return { batch: mapBatch(record), reclaimed: claimed.count === 1 };
  }

  async saveProgress(input: { batchId: string; executionGeneration: number; executionOwnerId: string; observedAt: Date; results: HandoffDeliveryBatchItemResult[]; status: HandoffDeliveryBatch['status']; completedAt: Date | null; processingLeaseUntil: Date | null }): Promise<{ batch: HandoffDeliveryBatch; saved: boolean }> {
    const succeededCount = input.results.filter((item) => item.status === 'SUCCEEDED').length;
    const saved = await (this.prisma as any).portfolioHandoffDeliveryBatch.updateMany({
      where: {
        id: input.batchId,
        status: 'PROCESSING',
        processingGeneration: input.executionGeneration,
        processingOwnerId: input.executionOwnerId,
        processingLeaseUntil: { gte: input.observedAt },
      },
      data: {
        results: input.results,
        status: input.status,
        completedAt: input.completedAt,
        processingLeaseUntil: input.processingLeaseUntil,
        processingOwnerId: input.status === 'PROCESSING' ? input.executionOwnerId : null,
        succeededCount,
        failedCount: input.results.filter((item) => item.status === 'FAILED').length,
      },
    });
    const record = await (this.prisma as any).portfolioHandoffDeliveryBatch.findUnique({ where: { id: input.batchId } });
    if (!record) throw new Error('Delivery batch not found');
    return { batch: mapBatch(record), saved: saved.count === 1 };
  }

  async findManyByIds(ids: string[]): Promise<HandoffDeliveryContext[]> {
    const records = await (this.prisma as any).portfolioHandoffAssignment.findMany({
      where: { id: { in: ids } },
      include: {
        members: true,
        briefVersion: true,
        challenge: { select: { id: true, title: true } },
        initiative: { select: { id: true, name: true, organizationId: true, portfolioMeta: { select: { challengeId: true } } } },
      },
    });
    const organizationIds = [...new Set(records.map((record: any) => record.organizationId).filter(Boolean))] as string[];
    const organizations = organizationIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: organizationIds } }, select: { id: true, name: true } })
      : [];
    const organizationNameById = new Map(organizations.map((organization) => [organization.id, organization.name]));
    return records.map((record: any) => ({
      assignment: mapAssignment(record),
      organizationName: organizationNameById.get(record.organizationId) ?? '',
      challengeName: record.challenge.title,
      initiativeName: record.initiative?.name ?? null,
      initiativeOrganizationId: record.initiative?.organizationId ?? null,
      initiativeChallengeIds: record.initiative?.portfolioMeta?.map((item: any) => item.challengeId) ?? [],
    }));
  }
}

function mapBatch(record: any): HandoffDeliveryBatch {
  return { ...record, results: record.results as HandoffDeliveryBatchItemResult[] };
}

function mapAssignment(record: any): HandoffAssignment {
  return {
    id: record.id, organizationId: record.organizationId, portfolioScopeRef: record.portfolioScopeRef,
    challengeId: record.challengeId, targetKind: record.targetKind, initiativeId: record.initiativeId,
    briefVersionId: record.briefVersionId, contextNote: record.contextNote, invitedEmailNormalized: record.invitedEmailNormalized,
    invitedIdentityRef: record.invitedIdentityRef, createdByActorId: record.createdByActorId, state: record.state,
    version: record.version, members: record.members.map((member: any) => ({ identityKey: member.identityKey, userId: member.userId, emailNormalized: member.emailNormalized, label: member.label, role: member.role })),
    createdAt: record.createdAt, updatedAt: record.updatedAt, sentAt: record.sentAt, viewedAt: record.viewedAt,
    revokedAt: record.revokedAt, expiredAt: record.expiredAt, acceptedAt: record.acceptedAt, acceptedBy: record.acceptedBy,
    rejectionReason: record.rejectionReason, rejectedAt: record.rejectedAt, rejectedBy: record.rejectedBy,
    startedAt: record.startedAt, startedBy: record.startedBy, portfolioResponse: record.portfolioResponse,
    portfolioResponseRecordedAt: record.portfolioResponseRecordedAt, portfolioResponseRecordedBy: record.portfolioResponseRecordedBy,
    briefVersion: record.briefVersion ? {
      id: record.briefVersion.id, versionNumber: record.briefVersion.versionNumber, status: record.briefVersion.status,
      intent: record.briefVersion.intent, scope: record.briefVersion.scope, strategicContextRefs: record.briefVersion.strategicContextRefs,
      inheritedContext: record.briefVersion.inheritedContext, constraintsSnapshot: record.briefVersion.constraintsSnapshot,
      knownGaps: record.briefVersion.knownGaps, sourceRefs: record.briefVersion.sourceRefs, provenance: record.briefVersion.provenance,
      confirmedAt: record.briefVersion.confirmedAt,
    } : null,
  };
}
