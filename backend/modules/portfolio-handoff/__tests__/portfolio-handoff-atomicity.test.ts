import { describe, expect, it } from 'vitest';
import { InMemoryHandoffInvitationAccessRepository } from '../infrastructure/in-memory-portfolio-handoff-invitation.repository';
import { InMemoryPortfolioHandoffAssignmentRepository } from '../infrastructure/in-memory-portfolio-handoff-assignment.repository';
import { InMemoryPortfolioHandoffResponseCommandRepository } from '../infrastructure/in-memory-portfolio-handoff-response-command.repository';
import { InMemoryHandoffSemanticEventRepository, InMemoryPortfolioHandoffProjectionRepository } from '../infrastructure/in-memory-portfolio-handoff-semantic-event.repository';
import { PortfolioHandoffAssignmentService } from '../application/portfolio-handoff-assignment.service';
import { PortfolioHandoffProjector, DurableHandoffEventPort } from '../application/portfolio-handoff-semantic-event.projector';
import { PortfolioHandoffResponseService, type HandoffEventPort } from '../application/portfolio-handoff-response.service';
import type { AtomicHandoffCommandInput, AtomicHandoffCommandRepository, AtomicHandoffCommandResult, HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffSemanticEvent } from '../domain/portfolio-handoff-semantic-event.types';
import { hashRefreshToken } from '../../auth/token.service';

const actor = { id: 'owner-1', email: 'owner@example.com' };

class AtomicFixture implements AtomicHandoffCommandRepository {
  readonly events = new InMemoryHandoffSemanticEventRepository();
  failBeforeCommit = false;
  constructor(private readonly assignments: InMemoryPortfolioHandoffAssignmentRepository, private readonly commands: InMemoryPortfolioHandoffResponseCommandRepository) {}
  async execute(input: AtomicHandoffCommandInput): Promise<AtomicHandoffCommandResult> {
    const existing = await this.commands.findByIdempotencyKey(input);
    const current = (await this.assignments.findById(input.assignmentId))!;
    if (existing) return { assignment: current, event: (await this.events.listByAssignment(input.assignmentId)).find((event) => event.entityVersion === existing.resultingVersion)! };
    if (this.failBeforeCommit) throw new Error('EVENT_PERSISTENCE_FAILED');
    const assignment = input.type === 'START'
      ? (await this.assignments.startAssignedWork({ assignmentId: input.assignmentId, expectedVersion: input.expectedVersion!, actorId: input.actorId, now: input.now }))!
      : input.type === 'ACCEPT' || input.type === 'REJECT'
        ? (await this.assignments.applyResponse({ assignmentId: input.assignmentId, from: ['SENT', 'VIEWED'], to: input.type === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', expectedVersion: input.expectedVersion!, actorId: input.actorId, reason: input.reason, now: input.now }))!
        : (await this.assignments.recordPortfolioResponse({ assignmentId: input.assignmentId, response: input.response!, actorId: input.actorId, now: input.now }))!;
    await this.commands.create({ assignmentId: input.assignmentId, type: input.type, idempotencyKey: input.idempotencyKey, actorId: input.actorId, fingerprint: input.fingerprint, resultingVersion: assignment.version, createdAt: input.now });
    const event: HandoffSemanticEvent = { eventId: `event-${input.type}-${input.idempotencyKey}`, eventType: input.type === 'ACCEPT' ? 'assignment_accepted' : input.type === 'REJECT' ? 'assignment_rejected' : input.type === 'START' ? 'handoff_assignment_started' : 'portfolio_response_recorded', entityType: 'handoff_assignment', entityId: assignment.id, entityVersion: assignment.version, actorId: input.actorId, interactionChannel: 'api', organizationId: assignment.organizationId, portfolioScopeRef: assignment.portfolioScopeRef, challengeId: assignment.challengeId, initiativeId: assignment.initiativeId, sourceRefs: [`handoff_assignment:${assignment.id}`], originAssignmentId: assignment.id, payload: { targetKind: assignment.targetKind, initiativeId: assignment.initiativeId, handoffState: assignment.state, rejectionReason: assignment.rejectionReason, portfolioResponse: assignment.portfolioResponse, members: assignment.members }, occurredAt: input.now, recordedAt: input.now };
    await this.events.append(event);
    return { assignment, event };
  }
}

async function fixture() {
  const assignments = new InMemoryPortfolioHandoffAssignmentRepository();
  const assignment = await new PortfolioHandoffAssignmentService(assignments, { findChallenge: async () => ({ id: 'challenge-1', organizationId: 'org-1' }), findInitiative: async () => null }).createHandoffAssignment({ organizationId: 'org-1', challengeId: 'challenge-1', targetKind: 'CHALLENGE', invitedEmailNormalized: actor.email, createdByActorId: 'portfolio-1', members: [{ identityKey: actor.email, emailNormalized: actor.email, userId: actor.id, role: 'OWNER' }] });
  await assignments.transitionState({ assignmentId: assignment.id, from: ['CREATED'], to: 'SENT' });
  const access = new InMemoryHandoffInvitationAccessRepository(); const invitation = await access.create({ assignmentId: assignment.id, tokenHash: hashRefreshToken('token') }); await access.markClaimed({ accessId: invitation.id, userId: actor.id });
  const commands = new InMemoryPortfolioHandoffResponseCommandRepository(); const atomic = new AtomicFixture(assignments, commands); const projector = new PortfolioHandoffProjector(new InMemoryPortfolioHandoffProjectionRepository());
  const service = (events: HandoffEventPort = new DurableHandoffEventPort(atomic.events, projector)) => new PortfolioHandoffResponseService(assignments, access, commands, events, () => new Date('2026-09-28T12:00:00Z'), atomic);
  return { assignments, atomic, projector, service, assignment: (await assignments.findById(assignment.id))! };
}

describe('H-TECH-08 atomic command recovery', () => {
  it('Accept event persistence failure leaves no committed lifecycle mutation', async () => {
    const ctx = await fixture(); ctx.atomic.failBeforeCommit = true;
    await expect(ctx.service().acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-fail' })).rejects.toThrow('EVENT_PERSISTENCE_FAILED');
    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('SENT');
    expect(await ctx.atomic.events.listByAssignment(ctx.assignment.id)).toHaveLength(0);
  });

  it('Start event persistence failure leaves no committed lifecycle mutation', async () => {
    const ctx = await fixture(); await ctx.service().acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept' });
    ctx.atomic.failBeforeCommit = true;
    await expect(ctx.service().startAssignedWork({ assignmentId: ctx.assignment.id, actor, expectedVersion: 3, idempotencyKey: 'start-fail' })).rejects.toThrow('EVENT_PERSISTENCE_FAILED');
    expect((await ctx.assignments.findById(ctx.assignment.id))?.state).toBe('ACCEPTED');
  });

  it('same-key retry recovers projection after durable event commit', async () => {
    const ctx = await fixture(); let fail = true;
    const failingProjection: HandoffEventPort = { publish: async (event) => { if (fail) { fail = false; throw new Error('PROJECTION_FAILED'); } await new DurableHandoffEventPort(ctx.atomic.events, ctx.projector).publish(event); } };
    await expect(ctx.service(failingProjection).acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-retry' })).rejects.toThrow('PROJECTION_FAILED');
    expect(await ctx.atomic.events.listByAssignment(ctx.assignment.id)).toHaveLength(1);
    const result = await ctx.service(failingProjection).acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-retry' });
    expect(result.state).toBe('ACCEPTED'); expect((await ctx.projector.rebuild(ctx.assignment.id, await ctx.atomic.events.listByAssignment(ctx.assignment.id)))?.handoffState).toBe('ACCEPTED');
  });

  it('duplicate recovery is event-idempotent and replay is deterministic', async () => {
    const ctx = await fixture(); const svc = ctx.service();
    await svc.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-once' });
    await svc.acceptHandoffAssignment({ assignmentId: ctx.assignment.id, actor, expectedVersion: 2, idempotencyKey: 'accept-once' });
    const events = await ctx.atomic.events.listByAssignment(ctx.assignment.id); expect(events).toHaveLength(1);
    const first = await ctx.projector.rebuild(ctx.assignment.id, events); const second = await ctx.projector.rebuild(ctx.assignment.id, events);
    expect(second).toEqual(first);
  });

  it('durably records Reject and Portfolio response as separate material events', async () => {
    const ctx = await fixture(); const svc = ctx.service();
    await svc.rejectHandoffAssignment({ assignmentId: ctx.assignment.id, actor, reason: 'Not now', expectedVersion: 2, idempotencyKey: 'reject-once' });
    await svc.recordPortfolioRejectionResponse({ assignmentId: ctx.assignment.id, actorId: 'portfolio-1', response: 'We will revisit', idempotencyKey: 'response-once' });
    expect((await ctx.atomic.events.listByAssignment(ctx.assignment.id)).map((event) => event.eventType)).toEqual(['assignment_rejected', 'portfolio_response_recorded']);
  });
});
