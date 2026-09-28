import { randomUUID } from 'node:crypto';
import type { HandoffInvitationAccess, HandoffInvitationAccessRepository } from '../domain/portfolio-handoff-invitation.types';

export class InMemoryHandoffInvitationAccessRepository implements HandoffInvitationAccessRepository {
  readonly accesses: HandoffInvitationAccess[] = [];

  async create(input: { assignmentId: string; tokenHash: string; expiresAt?: Date | null }): Promise<HandoffInvitationAccess> {
    const access: HandoffInvitationAccess = { id: randomUUID(), assignmentId: input.assignmentId, tokenHash: input.tokenHash, claimedByUserId: null, claimedAt: null, expiresAt: input.expiresAt ?? null, revokedAt: null, createdAt: new Date() };
    this.accesses.push(access);
    return { ...access };
  }
  async findByTokenHash(tokenHash: string): Promise<HandoffInvitationAccess | null> {
    const access = this.accesses.find((candidate) => candidate.tokenHash === tokenHash);
    return access ? { ...access } : null;
  }
  async markClaimed(input: { accessId: string; userId: string }): Promise<void> {
    const access = this.accesses.find((candidate) => candidate.id === input.accessId);
    if (access && !access.claimedByUserId) { access.claimedByUserId = input.userId; access.claimedAt = new Date(); }
  }
}
