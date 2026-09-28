import type { PrismaClient } from '@prisma/client';
import type {
  CreateHandoffAssignmentInput,
  HandoffAssignment,
  HandoffAssignmentRepository,
  HandoffReference,
  HandoffReferenceRepository,
  HandoffAssignmentState,
} from '../domain/portfolio-handoff-assignment.types';

export class PrismaPortfolioHandoffAssignmentRepository implements HandoffAssignmentRepository, HandoffReferenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateHandoffAssignmentInput): Promise<HandoffAssignment> {
    const record = await this.prisma.portfolioHandoffAssignment.create({
      data: {
        organizationId: input.organizationId ?? null,
        portfolioScopeRef: input.portfolioScopeRef ?? null,
        challengeId: input.challengeId,
        targetKind: input.targetKind,
        initiativeId: input.initiativeId ?? null,
        invitedEmailNormalized: input.invitedEmailNormalized,
        invitedIdentityRef: input.invitedIdentityRef ?? null,
        createdByActorId: input.createdByActorId,
        members: { create: input.members.map((member) => ({ ...member, identityKey: member.identityKey.trim().toLowerCase() })) },
      },
      include: { members: true },
    });
    return mapAssignment(record);
  }

  async findById(id: string): Promise<HandoffAssignment | null> {
    const record = await this.prisma.portfolioHandoffAssignment.findUnique({ where: { id }, include: { members: true } });
    return record ? mapAssignment(record) : null;
  }

  async associateInvitedIdentity(input: { assignmentId: string; userId: string; emailNormalized: string; identityRef?: string | null }): Promise<HandoffAssignment | null> {
    const prisma = this.prisma as any;
    const assignment = await prisma.portfolioHandoffAssignment.findUnique({ where: { id: input.assignmentId }, include: { members: true } });
    if (!assignment) return null;
    const member = assignment.members.find((candidate: any) => candidate.role === 'OWNER' && !candidate.userId && (candidate.emailNormalized === input.emailNormalized || candidate.identityKey === input.emailNormalized || candidate.identityKey === input.identityRef));
    if (!member) return null;
    await prisma.portfolioHandoffMember.update({ where: { id: member.id }, data: { userId: input.userId } });
    return this.findById(input.assignmentId);
  }

  async transitionState(input: { assignmentId: string; from: HandoffAssignmentState[]; to: HandoffAssignmentState; now?: Date }): Promise<HandoffAssignment | null> {
    const now = input.now ?? new Date();
    const timestampField = input.to === 'SENT' ? { sentAt: now } : input.to === 'VIEWED' ? { viewedAt: now } : input.to === 'REVOKED' ? { revokedAt: now } : input.to === 'EXPIRED' ? { expiredAt: now } : {};
    const result = await (this.prisma as any).portfolioHandoffAssignment.updateMany({
      where: { id: input.assignmentId, state: { in: input.from } },
      data: { state: input.to, version: { increment: 1 }, updatedAt: now, ...timestampField },
    });
    return result.count ? this.findById(input.assignmentId) : null;
  }

  async applyResponse(input: { assignmentId: string; from: HandoffAssignmentState[]; to: 'ACCEPTED' | 'REJECTED'; actorId: string; reason?: string; expectedVersion: number; now: Date }): Promise<HandoffAssignment | null> {
    const data = input.to === 'ACCEPTED' ? { state: input.to, acceptedAt: input.now, acceptedBy: input.actorId } : { state: input.to, rejectionReason: input.reason!, rejectedAt: input.now, rejectedBy: input.actorId };
    const result = await (this.prisma as any).portfolioHandoffAssignment.updateMany({ where: { id: input.assignmentId, state: { in: input.from }, version: input.expectedVersion }, data: { ...data, version: { increment: 1 }, updatedAt: input.now } });
    return result.count ? this.findById(input.assignmentId) : null;
  }

  async recordPortfolioResponse(input: { assignmentId: string; response: string; actorId: string; now: Date }): Promise<HandoffAssignment | null> {
    const result = await (this.prisma as any).portfolioHandoffAssignment.updateMany({ where: { id: input.assignmentId, state: 'REJECTED' }, data: { portfolioResponse: input.response, portfolioResponseRecordedAt: input.now, portfolioResponseRecordedBy: input.actorId, updatedAt: input.now } });
    return result.count ? this.findById(input.assignmentId) : null;
  }

  async findChallenge(id: string): Promise<HandoffReference | null> {
    const record = await this.prisma.challenge.findUnique({ where: { id }, select: { id: true, strategicFront: { select: { organizationId: true } } } });
    return record ? { id: record.id, organizationId: record.strategicFront.organizationId } : null;
  }

  async findInitiative(id: string): Promise<HandoffReference | null> {
    const record = await this.prisma.project.findUnique({ where: { id }, select: { id: true, owner: { select: { organizationId: true } } } });
    return record ? { id: record.id, organizationId: record.owner.organizationId } : null;
  }
}

function mapAssignment(record: any): HandoffAssignment {
  return {
    id: record.id,
    organizationId: record.organizationId,
    portfolioScopeRef: record.portfolioScopeRef,
    challengeId: record.challengeId,
    targetKind: record.targetKind,
    initiativeId: record.initiativeId,
    invitedEmailNormalized: record.invitedEmailNormalized,
    invitedIdentityRef: record.invitedIdentityRef,
    createdByActorId: record.createdByActorId,
    state: record.state,
    version: record.version,
    members: record.members.map((member: any) => ({ identityKey: member.identityKey, userId: member.userId, emailNormalized: member.emailNormalized, label: member.label, role: member.role })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sentAt: record.sentAt,
    viewedAt: record.viewedAt,
    revokedAt: record.revokedAt,
    expiredAt: record.expiredAt,
    acceptedAt: record.acceptedAt, acceptedBy: record.acceptedBy, rejectionReason: record.rejectionReason, rejectedAt: record.rejectedAt, rejectedBy: record.rejectedBy,
    portfolioResponse: record.portfolioResponse, portfolioResponseRecordedAt: record.portfolioResponseRecordedAt, portfolioResponseRecordedBy: record.portfolioResponseRecordedBy,
  };
}
