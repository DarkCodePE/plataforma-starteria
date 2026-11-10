import { describe, expect, it, vi } from 'vitest';
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
  const persistedEventIds = new Set<string>();
  const publish = vi.fn(async (event: { eventId: string }) => { persistedEventIds.add(event.eventId); });
  const invitationService = new PortfolioHandoffInvitationService({ assignments, access }, { publish } as any);
  return { assignments, assignmentService, invitationService, access, publish, persistedEventIds };
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

  it('expires a direct authenticated claim once and publishes exactly one durable event on replay', async () => {
    const ctx = await createAssignment();
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id, new Date(Date.now() - 1));

    await expect(ctx.invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' }))
      .resolves.toMatchObject({ identityClaimStatus: 'EXPIRED' });
    await expect(ctx.invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' }))
      .resolves.toMatchObject({ identityClaimStatus: 'EXPIRED' });

    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('EXPIRED');
    expect(ctx.publish).toHaveBeenCalledTimes(2);
    expect(ctx.publish).toHaveBeenCalledWith(expect.objectContaining({
      type: 'assignment_expired',
      assignmentId: ctx.assignment.id,
      interactionChannel: 'system',
      eventId: expect.stringMatching(/^handoff-lifecycle:.*:assignment_expired:v2$/),
    }));
    expect(ctx.persistedEventIds.size).toBe(1);
  });

  it('reconciles the durable expiry event after publishing fails once', async () => {
    const assignments = new InMemoryPortfolioHandoffAssignmentRepository();
    const refs = new InMemoryHandoffReferenceRepository();
    refs.addChallenge({ id: 'challenge-1', organizationId: 'org-1' });
    const assignmentService = new PortfolioHandoffAssignmentService(assignments, refs);
    const access = new InMemoryHandoffInvitationAccessRepository();
    const persistedEventIds = new Set<string>();
    let firstAttempt = true;
    const publish = vi.fn(async (event: { eventId: string }) => {
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error('semantic event store unavailable');
      }
      persistedEventIds.add(event.eventId);
    });
    const invitationService = new PortfolioHandoffInvitationService({ assignments, access }, { publish } as any);
    const assignment = await assignmentService.createHandoffAssignment({
      challengeId: 'challenge-1', targetKind: 'CHALLENGE', invitedEmailNormalized: 'invitee@example.com', invitedIdentityRef: 'invitee@example.com', createdByActorId: 'actor-1',
      members: [{ identityKey: 'invitee@example.com', emailNormalized: 'invitee@example.com', role: 'OWNER' }],
    });
    const token = await invitationService.issueInvitationToken(assignment.id, new Date(Date.now() - 1));

    await expect(invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' }))
      .rejects.toThrow('semantic event store unavailable');
    expect((await assignments.findById(assignment.id))?.state).toBe('EXPIRED');

    await expect(invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' }))
      .resolves.toMatchObject({ identityClaimStatus: 'EXPIRED' });
    await expect(invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' }))
      .resolves.toMatchObject({ identityClaimStatus: 'EXPIRED' });

    expect(publish).toHaveBeenCalledTimes(3);
    expect(new Set(publish.mock.calls.map(([event]) => event.eventId)).size).toBe(1);
    expect(persistedEventIds.size).toBe(1);
  });

  it('preserves the exact confirmed BriefVersion projection through invitation read and claim', async () => {
    const ctx = await createAssignment();
    const briefVersion = {
      id: 'brief-version-2', versionNumber: 2, status: 'CONFIRMED' as const,
      intent: 'Validate the governed mandate', scope: 'One team',
      strategicContextRefs: { objective: 'Activation' }, inheritedContext: { challengeProblem: 'Drop-off' },
      constraintsSnapshot: ['legal'], knownGaps: ['baseline'], sourceRefs: [{ source: 'brief' }],
      provenance: { source: 'HUMAN_CONFIRMED' }, confirmedAt: new Date('2026-10-23T10:00:00.000Z'),
    };
    vi.spyOn(ctx.assignments, 'findById').mockResolvedValue({ ...ctx.assignment, briefVersionId: briefVersion.id, briefVersion });
    vi.spyOn(ctx.assignments, 'associateInvitedIdentity').mockResolvedValue({
      ...ctx.assignment,
      briefVersionId: briefVersion.id,
      briefVersion,
      members: [{ ...ctx.assignment.members[0], userId: 'user-1' }],
    });
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);

    await expect(ctx.invitationService.readInvitationByToken(token)).resolves.toMatchObject({ briefVersion: null });
    await expect(ctx.invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' })).resolves.toMatchObject({ briefVersion });
  });

  it('reveals canonical assignment context only to the matching recipient', async () => {
    const ctx = await createAssignment();
    const canonicalContext = {
      strategicFront: { id: 'front-1', name: 'Retención', strategicObjective: 'Reducir churn', horizon: 'Q2', constraints: 'Sin datos sensibles' },
      challenge: { id: 'challenge-1', title: 'Activación temprana', objective: 'Mejorar activación', description: 'Acompañar el primer uso', expectedDecision: 'Priorizar un piloto' },
      initiative: null,
      sender: { id: 'actor-1', name: 'Portfolio Lead', email: 'lead@example.com' },
      members: [{ identityKey: 'invitee@example.com', userId: null, emailNormalized: 'invitee@example.com', label: 'Owner invitada', role: 'OWNER', displayName: null }],
      assignmentContextNote: 'Revisar el Brief antes de responder.',
    };
    vi.spyOn(ctx.assignments, 'findById').mockResolvedValue({ ...ctx.assignment, canonicalContext } as any);
    vi.spyOn(ctx.assignments, 'associateInvitedIdentity').mockResolvedValue({
      ...ctx.assignment,
      members: [{ ...ctx.assignment.members[0], userId: 'user-1' }],
      canonicalContext: {
        ...canonicalContext,
        members: [{ ...canonicalContext.members[0], userId: 'user-1', displayName: 'Nora Owner' }],
      },
    } as any);
    const token = await ctx.invitationService.issueInvitationToken(ctx.assignment.id);

    await expect(ctx.invitationService.readInvitationByToken(token)).resolves.toMatchObject({ canonicalContext: null });
    await expect(ctx.invitationService.claimInvitedIdentity(token, { id: 'user-1', email: 'invitee@example.com' }))
      .resolves.toMatchObject({
        canonicalContext: { ...canonicalContext, members: [expect.objectContaining({ userId: 'user-1', displayName: 'Nora Owner' })] },
      });
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
