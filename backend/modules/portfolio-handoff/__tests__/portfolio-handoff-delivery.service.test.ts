import { describe, expect, it } from 'vitest';
import { InMemoryHandoffReferenceRepository, InMemoryPortfolioHandoffAssignmentRepository } from '../infrastructure/in-memory-portfolio-handoff-assignment.repository';
import { InMemoryHandoffInvitationAccessRepository } from '../infrastructure/in-memory-portfolio-handoff-invitation.repository';
import { InMemoryHandoffDeliveryAttemptRepository } from '../infrastructure/in-memory-portfolio-handoff-delivery-attempt.repository';
import { PortfolioHandoffAssignmentService } from '../application/portfolio-handoff-assignment.service';
import { PortfolioHandoffDeliveryService, type HandoffInvitationDeliveryPort } from '../application/portfolio-handoff-delivery.service';
import { hashRefreshToken } from '../../auth/token.service';

async function context(send: HandoffInvitationDeliveryPort['send'] = async () => ({ delivered: true })) {
  const assignments = new InMemoryPortfolioHandoffAssignmentRepository();
  const refs = new InMemoryHandoffReferenceRepository();
  refs.addChallenge({ id: 'challenge-1', organizationId: 'org-1' });
  const assignment = await new PortfolioHandoffAssignmentService(assignments, refs).createHandoffAssignment({
    challengeId: 'challenge-1', targetKind: 'CHALLENGE', invitedEmailNormalized: 'owner@example.com', invitedIdentityRef: 'owner@example.com', createdByActorId: 'lead-1',
    members: [{ identityKey: 'owner@example.com', emailNormalized: 'owner@example.com', role: 'OWNER' }],
  });
  const access = new InMemoryHandoffInvitationAccessRepository();
  const attempts = new InMemoryHandoffDeliveryAttemptRepository();
  return { assignment, assignments, access, attempts, service: new PortfolioHandoffDeliveryService(assignments, access, attempts, { send }) };
}

describe('PortfolioHandoffDeliveryService / H-TECH-04', () => {
  it('sends created assignment and records sent only after successful delivery', async () => {
    const sent: any[] = [];
    const ctx = await context(async (message) => { sent.push(message); return { delivered: true, providerMessageRef: 'provider-1' }; });
    const result = await ctx.service.sendHandoffInvitation({ assignmentId: ctx.assignment.id, idempotencyKey: 'send-1', title: 'Reducir tiempos de respuesta' });
    expect(result).toMatchObject({ state: 'SENT', attemptStatus: 'SUCCEEDED' });
    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('SENT');
    expect(sent[0].to).toBe('owner@example.com');
    expect(sent[0].text).toContain('Revisar asignación');
    expect(sent[0].text).not.toMatch(/aceptar|rechazar|empezar/i);
    expect(sent[0].text).toContain('/handoff/invitations/');
  });

  it('does not mark sent when mailer is disabled or transport fails, and permits retry', async () => {
    let fail = true;
    const ctx = await context(async () => { if (fail) throw new Error('SMTP down'); return { delivered: true }; });
    expect(await ctx.service.sendHandoffInvitation({ assignmentId: ctx.assignment.id, idempotencyKey: 'send-1' })).toMatchObject({ state: 'CREATED', attemptStatus: 'FAILED' });
    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('CREATED');
    fail = false;
    expect(await ctx.service.sendHandoffInvitation({ assignmentId: ctx.assignment.id, idempotencyKey: 'send-2' })).toMatchObject({ state: 'SENT', attemptStatus: 'SUCCEEDED' });
  });

  it('is idempotent and does not infer viewed from delivery', async () => {
    let calls = 0;
    let message: any;
    const ctx = await context(async (input) => { calls += 1; message = input; return { delivered: true }; });
    await ctx.service.sendHandoffInvitation({ assignmentId: ctx.assignment.id, idempotencyKey: 'same-key' });
    expect(await ctx.service.sendHandoffInvitation({ assignmentId: ctx.assignment.id, idempotencyKey: 'same-key' })).toMatchObject({ attemptStatus: 'IDEMPOTENT', state: 'SENT' });
    expect(calls).toBe(1);
    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('SENT');
    const token = message.text.match(/\/handoff\/invitations\/([^\s]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(await ctx.service.markHandoffInvitationViewed(token)).toEqual({ state: 'VIEWED' });
    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('VIEWED');
    expect(hashRefreshToken(token)).toBe(ctx.access.accesses[0].tokenHash);
  });

  it('marks viewed only from a valid token, revokes access, and expires lazily', async () => {
    let message: any;
    const ctx = await context(async (input) => { message = input; return { delivered: true }; });
    await ctx.service.sendHandoffInvitation({ assignmentId: ctx.assignment.id, idempotencyKey: 'send-1' });
    const access = ctx.access.accesses[0];
    expect(access.tokenHash).toBeTruthy();
    const token = 'a'.repeat(64);
    // The real raw token is intentionally not recoverable from the repository.
    await expect(ctx.service.markHandoffInvitationViewed(token)).rejects.toMatchObject({ code: 'HANDOFF_INVITATION_INVALID' });
    const realToken = message.text.match(/\/handoff\/invitations\/([^\s]+)/)?.[1];
    expect(await ctx.service.markHandoffInvitationViewed(realToken)).toEqual({ state: 'VIEWED' });
    const revoked = await ctx.service.revokeHandoffInvitation(ctx.assignment.id);
    expect(revoked.state).toBe('REVOKED');
    expect(ctx.access.accesses[0].revokedAt).toBeTruthy();

    const created = await context();
    expect((await created.service.revokeHandoffInvitation(created.assignment.id)).state).toBe('REVOKED');

    let expiredMessage: any;
    const expiring = await context(async (input) => { expiredMessage = input; return { delivered: true }; });
    await expiring.service.sendHandoffInvitation({ assignmentId: expiring.assignment.id, idempotencyKey: 'send-expired', expiresAt: new Date(Date.now() - 1) });
    const expiredToken = expiredMessage.text.match(/\/handoff\/invitations\/([^\s]+)/)?.[1];
    await expect(expiring.service.markHandoffInvitationViewed(expiredToken)).rejects.toMatchObject({ code: 'HANDOFF_INVITATION_EXPIRED' });
    expect((await expiring.assignments.findById(expiring.assignment.id))?.state).toBe('EXPIRED');
    await expect(expiring.service.sendHandoffInvitation({ assignmentId: expiring.assignment.id, idempotencyKey: 'retry-expired' })).rejects.toMatchObject({ code: 'HANDOFF_INVITATION_NOT_SENDABLE' });
  });
});
