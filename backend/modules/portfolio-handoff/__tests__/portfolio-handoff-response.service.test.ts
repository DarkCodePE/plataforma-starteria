import { describe, expect, it } from 'vitest';
import { InMemoryHandoffInvitationAccessRepository } from '../infrastructure/in-memory-portfolio-handoff-invitation.repository';
import { InMemoryPortfolioHandoffAssignmentRepository } from '../infrastructure/in-memory-portfolio-handoff-assignment.repository';
import { InMemoryPortfolioHandoffResponseCommandRepository } from '../infrastructure/in-memory-portfolio-handoff-response-command.repository';
import { PortfolioHandoffAssignmentService } from '../application/portfolio-handoff-assignment.service';
import { PortfolioHandoffResponseService } from '../application/portfolio-handoff-response.service';
import { hashRefreshToken } from '../../auth/token.service';

const actor = { id: 'user-1', email: 'owner@example.com' };
async function setup(targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE' = 'CHALLENGE') {
  const assignments = new InMemoryPortfolioHandoffAssignmentRepository();
  const refs = { findChallenge: async () => ({ id: 'challenge-1', organizationId: 'org-1' }), findInitiative: async () => ({ id: 'initiative-1', organizationId: 'org-1' }) };
  const assignment = await new PortfolioHandoffAssignmentService(assignments, refs).createHandoffAssignment({ organizationId: 'org-1', challengeId: 'challenge-1', targetKind, initiativeId: targetKind === 'EXISTING_INITIATIVE' ? 'initiative-1' : null, invitedEmailNormalized: actor.email, createdByActorId: 'portfolio-1', members: [{ identityKey: actor.email, emailNormalized: actor.email, userId: actor.id, role: 'OWNER' }] });
  await assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED'], to: 'SENT' });
  const access = new InMemoryHandoffInvitationAccessRepository();
  const invitation = await access.create({ assignmentId: assignment.id, tokenHash: hashRefreshToken('token') });
  await access.markClaimed({ accessId: invitation.id, userId: actor.id });
  const commands = new InMemoryPortfolioHandoffResponseCommandRepository();
  const service = new PortfolioHandoffResponseService(assignments, access, commands, { publish: async () => {} }, () => new Date('2026-09-28T12:00:00Z'));
  return { assignments, access, assignment: (await assignments.findById(assignment.id))!, service };
}

describe('H-TECH-05 response commands', () => {
  it('accepts SENT, persists audit/version, is idempotent, and preserves target identity', async () => {
    const ctx = await setup('EXISTING_INITIATIVE');
    const first = await ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-1' });
    const second = await ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-1' });
    expect(first).toMatchObject({ state: 'ACCEPTED', version: 3, acceptedBy: actor.id, initiativeId: 'initiative-1' });
    expect(first.acceptedAt).toEqual(new Date('2026-09-28T12:00:00Z'));
    expect(second.version).toBe(3);
  });
  it('accepts VIEWED and keeps Challenge initiativeId null', async () => {
    const ctx = await setup();
    await ctx.assignments.transitionState({ assignmentId: ctx.assignment.id, from: ['SENT'], to: 'VIEWED' });
    const result = await ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 3, idempotencyKey: 'accept-viewed' });
    expect(result).toMatchObject({ state: 'ACCEPTED', initiativeId: null, version: 4 });
  });
  it('rejects with a material reason and does not create Core state', async () => {
    const ctx = await setup();
    await expect(ctx.service.rejectHandoffAssignment({ assignmentId: ctx.assignment.id, actor, reason: '  ', expectedVersion: 2, idempotencyKey: 'reject-empty' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    const result = await ctx.service.rejectHandoffAssignment({ assignmentId: ctx.assignment.id, actor, reason: 'Need more context', expectedVersion: 2, idempotencyKey: 'reject-1' });
    expect(result).toMatchObject({ state: 'REJECTED', rejectionReason: 'Need more context', rejectedBy: actor.id, version: 3, initiativeId: null });
  });
  it('rejects stale, wrong identity, revoked and invalid states without mutation', async () => {
    const ctx = await setup();
    await expect(ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 1, idempotencyKey: 'stale' })).rejects.toMatchObject({ code: 'STALE_VERSION' });
    await expect(ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor: { id: 'other', email: actor.email }, expectedVersion: 2, idempotencyKey: 'wrong' })).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
    await ctx.assignments.transitionState({ assignmentId: ctx.assignment.id, from: ['SENT'], to: 'REVOKED' });
    await expect(ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 3, idempotencyKey: 'revoked' })).rejects.toMatchObject({ code: 'REVOKED' });
  });
  it('records a Portfolio response without changing rejection ownership/state and is idempotent', async () => {
    const ctx = await setup();
    await ctx.service.rejectHandoffAssignment({ assignmentId: ctx.assignment.id, actor, reason: 'Not now', expectedVersion: 2, idempotencyKey: 'reject' });
    const first = await ctx.service.recordPortfolioRejectionResponse({ assignmentId: ctx.assignment.id, actorId: 'portfolio-1', response: 'We will revisit next cycle', idempotencyKey: 'response-1' });
    const second = await ctx.service.recordPortfolioRejectionResponse({ assignmentId: ctx.assignment.id, actorId: 'portfolio-1', response: 'We will revisit next cycle', idempotencyKey: 'response-1' });
    expect(first).toMatchObject({ state: 'REJECTED', version: 3, portfolioResponse: 'We will revisit next cycle', portfolioResponseRecordedBy: 'portfolio-1' });
    expect(second.version).toBe(3);
  });
  it('does not allow a Portfolio response before rejection or with empty text', async () => {
    const ctx = await setup();
    await expect(ctx.service.recordPortfolioRejectionResponse({ assignmentId: ctx.assignment.id, actorId: 'portfolio-1', response: '', idempotencyKey: 'bad' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    await expect(ctx.service.recordPortfolioRejectionResponse({ assignmentId: ctx.assignment.id, actorId: 'portfolio-1', response: 'reply', idempotencyKey: 'bad-state' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});

describe('H-TECH-07 Start boundary', () => {
  async function accepted(targetKind: 'CHALLENGE' | 'EXISTING_INITIATIVE' = 'CHALLENGE') {
    const ctx = await setup(targetKind);
    await ctx.service.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: `accept-${targetKind}` });
    return ctx;
  }

  it('starts only ACCEPTED, persists audit once, is idempotent, and emits one bounded event', async () => {
    const ctx = await accepted();
    const events: unknown[] = [];
    const service = new PortfolioHandoffResponseService(ctx.assignments, ctx.access, new InMemoryPortfolioHandoffResponseCommandRepository(), { publish: async (event) => { events.push(event); } }, () => new Date('2026-09-28T12:00:00Z'));
    const first = await service.startAssignedWork({ assignmentId: ctx.assignment.id, actor, expectedVersion: 3, idempotencyKey: 'start-1' });
    const second = await service.startAssignedWork({ assignmentId: ctx.assignment.id, actor, expectedVersion: 3, idempotencyKey: 'start-1' });
    expect(first).toMatchObject({ state: 'STARTED', version: 4, startedBy: actor.id });
    expect(first.startedAt).toEqual(new Date('2026-09-28T12:00:00Z'));
    expect(second.version).toBe(4);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'handoff_assignment_started', assignmentId: ctx.assignment.id, targetKind: 'CHALLENGE', initiativeId: null, version: 4 });
  });

  it('preserves an existing Initiative and does not emit initiative_started', async () => {
    const ctx = await accepted('EXISTING_INITIATIVE');
    const events: any[] = [];
    const service = new PortfolioHandoffResponseService(ctx.assignments, ctx.access, new InMemoryPortfolioHandoffResponseCommandRepository(), { publish: async (event) => { events.push(event); } }, () => new Date('2026-09-28T12:00:00Z'));
    const result = await service.startAssignedWork({ assignmentId: ctx.assignment.id, actor, expectedVersion: 3, idempotencyKey: 'start-existing' });
    expect(result).toMatchObject({ state: 'STARTED', initiativeId: 'initiative-1' });
    expect(events.some((event) => event.type === 'initiative_started')).toBe(false);
    expect(events[0]).toMatchObject({ type: 'handoff_assignment_started', initiativeId: 'initiative-1' });
  });

  it('rejects stale, wrong identity, unauthorized, and every non-ACCEPTED state', async () => {
    const ctx = await setup();
    await expect(ctx.service.startAssignedWork({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'not-accepted' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(ctx.service.startAssignedWork({ assignmentId: ctx.assignment.id, actor, expectedVersion: 1, idempotencyKey: 'stale' })).rejects.toMatchObject({ code: 'INVALID_STATE' });
    const acceptedCtx = await accepted();
    await expect(acceptedCtx.service.startAssignedWork({ assignmentId: acceptedCtx.assignment.id, actor: { id: 'other', email: actor.email }, expectedVersion: 3, idempotencyKey: 'wrong' })).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
    await expect(acceptedCtx.service.startAssignedWork({ assignmentId: acceptedCtx.assignment.id, actor: { id: 'owner-2', email: actor.email }, expectedVersion: 3, idempotencyKey: 'forbidden' })).rejects.toMatchObject({ code: 'IDENTITY_MISMATCH' });
    await expect(acceptedCtx.service.startAssignedWork({ assignmentId: acceptedCtx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'stale-accepted' })).rejects.toMatchObject({ code: 'STALE_VERSION' });
    for (const state of ['REVOKED', 'EXPIRED', 'REJECTED', 'VIEWED', 'SENT'] as const) {
      const stateCtx = await setup();
      if (state !== 'SENT') await stateCtx.assignments.transitionState({ assignmentId: stateCtx.assignment.id, from: ['SENT'], to: state });
      expect((await stateCtx.assignments.findById(stateCtx.assignment.id))?.state).toBe(state);
      await expect(stateCtx.service.startAssignedWork({ assignmentId: stateCtx.assignment.id, actor, expectedVersion: 2, idempotencyKey: `state-${state}` })).rejects.toMatchObject({ code: state === 'REVOKED' ? 'REVOKED' : state === 'EXPIRED' ? 'EXPIRED' : 'INVALID_STATE' });
    }
  });
});
