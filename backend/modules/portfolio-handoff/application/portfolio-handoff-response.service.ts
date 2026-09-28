import { createHash } from 'node:crypto';
import type { HandoffAssignment, HandoffAssignmentRepository, HandoffResponseCommandRepository, HandoffResponseCommandType } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffInvitationAccessRepository } from '../domain/portfolio-handoff-invitation.types';
import { PortfolioHandoffAssignmentError } from './portfolio-handoff-assignment.errors';

export type HandoffEvent = { type: 'handoff_assignment_accepted' | 'handoff_assignment_rejected' | 'handoff_rejection_response_recorded' | 'handoff_assignment_started'; assignmentId: string; targetKind?: HandoffAssignment['targetKind']; challengeId?: string | null; initiativeId?: string | null; actorId: string; occurredAt: Date; version: number; interactionChannel?: 'web' | 'api' | 'copilot' | 'external_assistant' | 'system'; payload?: Record<string, unknown> };
export type HandoffEventPort = { publish(event: HandoffEvent): Promise<void> };
export const noopHandoffEventPort: HandoffEventPort = { async publish() {} };
export type HandoffActor = { id: string; email: string };

export class PortfolioHandoffResponseService {
  constructor(private readonly assignments: HandoffAssignmentRepository, private readonly access: HandoffInvitationAccessRepository, private readonly commands: HandoffResponseCommandRepository, private readonly events: HandoffEventPort = noopHandoffEventPort, private readonly now: () => Date = () => new Date()) {}

  async acceptHandoffAssignment(input: { assignmentId: string; actor: HandoffActor; expectedVersion: number; idempotencyKey: string }): Promise<HandoffAssignment> {
    return this.respond(input, 'ACCEPT', undefined, 'ACCEPTED');
  }
  async rejectHandoffAssignment(input: { assignmentId: string; actor: HandoffActor; reason: string | null; expectedVersion: number; idempotencyKey: string }): Promise<HandoffAssignment> {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!reason) throw failure('REASON_REQUIRED', 'A rejection reason is required');
    return this.respond(input, 'REJECT', reason, 'REJECTED');
  }
  async startAssignedWork(input: { assignmentId: string; actor: HandoffActor; expectedVersion: number; idempotencyKey: string }): Promise<HandoffAssignment> {
    if (!validIdempotencyKey(input.idempotencyKey)) throw failure('IDEMPOTENCY_REQUIRED', 'An idempotency key is required');
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw failure('STALE_VERSION', 'Assignment version is stale');
    const assignment = await this.requireAssignment(input.assignmentId);
    if (assignment.state === 'REVOKED') throw failure('REVOKED', 'Assignment is no longer available');
    if (assignment.state === 'EXPIRED') throw failure('EXPIRED', 'Assignment is no longer available');
    const access = await this.access.findActiveForAssignment(input.assignmentId);
    if (!access || access.claimedByUserId !== input.actor.id) throw failure('IDENTITY_MISMATCH', 'Invitation identity does not match the authenticated actor');
    const owner = assignment.members.find((member) => member.role === 'OWNER');
    if (!owner || owner.userId !== input.actor.id) throw failure('FORBIDDEN', 'Only the assigned Initiative Owner can start this work');
    const fingerprint = fingerprintOf(input.actor.id, 'START');
    const existing = await this.commands.findByIdempotencyKey({ assignmentId: input.assignmentId, type: 'START', idempotencyKey: input.idempotencyKey });
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw failure('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for another command');
      return assignment;
    }
    if (assignment.state !== 'ACCEPTED') throw failure('INVALID_STATE', 'Assignment must be accepted before it can start');
    if (assignment.version !== input.expectedVersion) throw failure('STALE_VERSION', 'Assignment version is stale');
    const now = this.now();
    const updated = await this.assignments.startAssignedWork({ assignmentId: input.assignmentId, expectedVersion: input.expectedVersion, actorId: input.actor.id, now });
    if (!updated) throw failure('STALE_VERSION', 'Assignment changed while starting');
    await this.commands.create({ assignmentId: input.assignmentId, type: 'START', idempotencyKey: input.idempotencyKey, actorId: input.actor.id, fingerprint, resultingVersion: updated.version, createdAt: now });
    await this.events.publish({ type: 'handoff_assignment_started', assignmentId: updated.id, targetKind: updated.targetKind, initiativeId: updated.initiativeId, actorId: input.actor.id, occurredAt: now, version: updated.version });
    return updated;
  }
  async recordPortfolioRejectionResponse(input: { assignmentId: string; actorId: string; response: string; idempotencyKey: string }): Promise<HandoffAssignment> {
    if (!validIdempotencyKey(input.idempotencyKey)) throw failure('IDEMPOTENCY_REQUIRED', 'An idempotency key is required');
    const response = input.response.trim();
    if (!response) throw failure('REASON_REQUIRED', 'A portfolio response is required');
    const assignment = await this.requireAssignment(input.assignmentId);
    if (assignment.state !== 'REJECTED' || !assignment.rejectionReason) throw failure('INVALID_STATE', 'Only rejected assignments accept a Portfolio response');
    const fingerprint = fingerprintOf(input.actorId, response);
    const existing = await this.commands.findByIdempotencyKey({ assignmentId: input.assignmentId, type: 'PORTFOLIO_RESPONSE', idempotencyKey: input.idempotencyKey });
    if (existing) { if (existing.fingerprint !== fingerprint) throw failure('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for another command'); return assignment; }
    const updated = await this.assignments.recordPortfolioResponse({ assignmentId: input.assignmentId, response, actorId: input.actorId, now: this.now() });
    if (!updated) throw failure('INVALID_STATE', 'Assignment is not rejected');
    await this.commands.create({ assignmentId: input.assignmentId, type: 'PORTFOLIO_RESPONSE', idempotencyKey: input.idempotencyKey, actorId: input.actorId, fingerprint, resultingVersion: updated.version, createdAt: this.now() });
    await this.events.publish({ type: 'handoff_rejection_response_recorded', assignmentId: updated.id, actorId: input.actorId, occurredAt: this.now(), version: updated.version, payload: { portfolioResponse: updated.portfolioResponse, handoffState: updated.state } });
    return updated;
  }
  private async respond(input: { assignmentId: string; actor: HandoffActor; expectedVersion: number; idempotencyKey: string }, type: 'ACCEPT' | 'REJECT', reason: string | undefined, target: 'ACCEPTED' | 'REJECTED'): Promise<HandoffAssignment> {
    if (!input.idempotencyKey.trim()) throw failure('IDEMPOTENCY_REQUIRED', 'An idempotency key is required');
    const assignment = await this.requireAssignment(input.assignmentId);
    const access = await this.access.findActiveForAssignment(input.assignmentId);
    if (!access || access.claimedByUserId !== input.actor.id) throw failure('IDENTITY_MISMATCH', 'Invitation identity does not match the authenticated actor');
    const owner = assignment.members.find((member) => member.role === 'OWNER');
    if (!owner || (owner.userId && owner.userId !== input.actor.id)) throw failure('IDENTITY_MISMATCH', 'Invitation identity does not match the authenticated actor');
    const fingerprint = fingerprintOf(input.actor.id, reason ?? '');
    const existing = await this.commands.findByIdempotencyKey({ assignmentId: input.assignmentId, type, idempotencyKey: input.idempotencyKey });
    if (existing) { if (existing.fingerprint !== fingerprint) throw failure('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for another command'); return assignment; }
    if (assignment.version !== input.expectedVersion) throw failure('STALE_VERSION', 'Assignment version is stale');
    if (!['SENT', 'VIEWED'].includes(assignment.state)) throw failure(assignment.state === 'REVOKED' ? 'REVOKED' : assignment.state === 'EXPIRED' ? 'EXPIRED' : 'INVALID_STATE', 'Assignment cannot accept this response in its current state');
    const updated = await this.assignments.applyResponse({ assignmentId: input.assignmentId, from: ['SENT', 'VIEWED'], to: target, actorId: input.actor.id, reason, expectedVersion: input.expectedVersion, now: this.now() });
    if (!updated) throw failure('STALE_VERSION', 'Assignment changed while responding');
    await this.commands.create({ assignmentId: input.assignmentId, type, idempotencyKey: input.idempotencyKey, actorId: input.actor.id, fingerprint, resultingVersion: updated.version, createdAt: this.now() });
    await this.events.publish({ type: target === 'ACCEPTED' ? 'handoff_assignment_accepted' : 'handoff_assignment_rejected', assignmentId: updated.id, actorId: input.actor.id, occurredAt: this.now(), version: updated.version, payload: { targetKind: updated.targetKind, initiativeId: updated.initiativeId, rejectionReason: updated.rejectionReason, handoffState: updated.state } });
    return updated;
  }
  private async requireAssignment(id: string): Promise<HandoffAssignment> { const assignment = await this.assignments.findById(id); if (!assignment) throw failure('NOT_FOUND', 'Handoff assignment not found'); return assignment; }
}
function fingerprintOf(actorId: string, value: string): string { return createHash('sha256').update(`${actorId}\0${value}`).digest('hex'); }
function validIdempotencyKey(value: string): boolean { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 200; }
function failure(code: string, message: string): PortfolioHandoffAssignmentError { return new PortfolioHandoffAssignmentError(code, message); }
