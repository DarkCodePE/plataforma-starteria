import { describe, expect, it } from 'vitest';
import { InMemoryHandoffReferenceRepository, InMemoryPortfolioHandoffAssignmentRepository } from '../infrastructure/in-memory-portfolio-handoff-assignment.repository';
import { InMemoryHandoffInvitationAccessRepository } from '../infrastructure/in-memory-portfolio-handoff-invitation.repository';
import { PortfolioHandoffAssignmentService } from '../application/portfolio-handoff-assignment.service';
import { PortfolioHandoffInvitationService } from '../application/portfolio-handoff-invitation.service';
import { hashRefreshToken } from '../../auth/token.service';

function makeServices() {
  const assignments = new InMemoryPortfolioHandoffAssignmentRepository();
  const refs = new InMemoryHandoffReferenceRepository();
  refs.addChallenge({ id: 'challenge-1', organizationId: 'org-1' });
  const assignmentService = new PortfolioHandoffAssignmentService(assignments, refs);
  const access = new InMemoryHandoffInvitationAccessRepository();
  const invitationService = new PortfolioHandoffInvitationService({ assignments, access });
  return { assignments, assignmentService, invitationService, access };
}

async function createAssignment() {
  const ctx = makeServices();
  const assignment = await ctx.assignmentService.createHandoffAssignment({
    challengeId: 'challenge-1', targetKind: 'CHALLENGE', invitedEmailNormalized: 'invitee@example.com', invitedIdentityRef: 'invitee@example.com', createdByActorId: 'actor-1',
    members: [{ identityKey: 'invitee@example.com', emailNormalized: 'invitee@example.com', role: 'OWNER' }],
  });
  return { ...ctx, assignment };
}

describe('PortfolioHandoffInvitationService / H-TECH-03', () => {
  it('issues a high-entropy opaque token and stores only its hash', async () => {
    const ctx = await createAssignment();
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx.access.accesses[0].tokenHash).toBe(hashRefreshToken(token));
    expect(ctx.access.accesses[0].tokenHash).not.toBe(token);
  });

  it('reads safe context without exposing the invited email', async () => {
    const ctx = await createAssignment();
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);
    const preview = await ctx.invitationService.readInvitationByToken(token);
    expect(preview).toMatchObject({ assignmentId: ctx.assignment.id, targetKind: 'CHALLENGE', authenticationRequired: true, identityClaimStatus: 'UNAUTHENTICATED' });
    expect(JSON.stringify(preview)).not.toContain('invitee@example.com');
  });

  it('rejects invalid, expired and revoked tokens safely', async () => {
    const ctx = await createAssignment();
    await expect(ctx.invitationService.readInvitationByToken('a'.repeat(64))).rejects.toMatchObject({ code: 'HANDOFF_INVITATION_INVALID' });
    const expired = await ctx.invitationService.issueInvitationToken(ctx.assignment.id, new Date(Date.now() - 1));
    await expect(ctx.invitationService.readInvitationByToken(expired)).rejects.toMatchObject({ code: 'HANDOFF_INVITATION_EXPIRED' });
    const active = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);
    ctx.access.accesses.find((access) => access.tokenHash === hashRefreshToken(active))!.revokedAt = new Date();
    await expect(ctx.invitationService.readInvitationByToken(active)).rejects.toMatchObject({ code: 'HANDOFF_INVITATION_INVALID' });
  });

  it('matches identity, associates it idempotently, and safely replays', async () => {
    const ctx = await createAssignment();
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);
    const first = await ctx.invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'INVITEE@example.com' });
    const second = await ctx.invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' });
    expect(first.identityClaimStatus).toBe('MATCHED');
    expect(second.identityClaimStatus).toBe('MATCHED');
    expect((await ctx.assignments.findById(ctx.assignment.id))!.members[0].userId).toBe('user-1');
  });

  it('returns MISMATCH without mutating assignment identity or creating downstream state', async () => {
    const ctx = await createAssignment();
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);
    const result = await ctx.invitationService.claimInvitedIdentity(token, { id: 'attacker', email: 'other@example.com' });
    expect(result.identityClaimStatus).toBe('MISMATCH');
    const assignment = await ctx.assignments.findById(ctx.assignment.id);
    expect(assignment?.invitedEmailNormalized).toBe('invitee@example.com');
    expect(assignment?.members[0].userId ?? null).toBeNull();
  });
});
