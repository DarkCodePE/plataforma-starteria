import type { PrismaClient } from '@prisma/client';
import type { HandoffInvitationAccess, HandoffInvitationAccessRepository } from '../domain/portfolio-handoff-invitation.types';

export class PrismaPortfolioHandoffInvitationRepository implements HandoffInvitationAccessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { assignmentId: string; tokenHash: string; expiresAt?: Date | null }): Promise<HandoffInvitationAccess> {
    const record = await (this.prisma as any).portfolioHandoffInvitation.create({ data: { assignmentId: input.assignmentId, tokenHash: input.tokenHash, expiresAt: input.expiresAt ?? null } });
    return mapAccess(record);
  }

  async findByTokenHash(tokenHash: string): Promise<HandoffInvitationAccess | null> {
    const record = await (this.prisma as any).portfolioHandoffInvitation.findUnique({ where: { tokenHash } });
    return record ? mapAccess(record) : null;
  }

  async markClaimed(input: { accessId: string; userId: string }): Promise<void> {
    await (this.prisma as any).portfolioHandoffInvitation.updateMany({
      where: { id: input.accessId, claimedByUserId: null },
      data: { claimedByUserId: input.userId, claimedAt: new Date() },
    });
  }
  async revokeForAssignment(assignmentId: string): Promise<void> {
    await (this.prisma as any).portfolioHandoffInvitation.updateMany({ where: { assignmentId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

function mapAccess(record: any): HandoffInvitationAccess {
  return { id: record.id, assignmentId: record.assignmentId, tokenHash: record.tokenHash, claimedByUserId: record.claimedByUserId, claimedAt: record.claimedAt, expiresAt: record.expiresAt, revokedAt: record.revokedAt, createdAt: record.createdAt };
}
