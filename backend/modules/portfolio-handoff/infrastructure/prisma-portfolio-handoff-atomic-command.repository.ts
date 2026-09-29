import type { PrismaClient } from '@prisma/client';
import type { AtomicHandoffCommandInput, AtomicHandoffCommandRepository, AtomicHandoffCommandResult, HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffSemanticEvent } from '../domain/portfolio-handoff-semantic-event.types';
import { eventIdForCommand } from '../application/portfolio-handoff-semantic-event.projector';
import { PrismaPortfolioHandoffAssignmentRepository } from './prisma-portfolio-handoff-assignment.repository';
import { PrismaHandoffSemanticEventRepository } from './prisma-portfolio-handoff-semantic-event.repository';
import { PrismaPortfolioHandoffResponseCommandRepository } from './prisma-portfolio-handoff-response-command.repository';

/** Bounded transaction boundary for a handoff command. No broker or generic event bus. */
export class PrismaPortfolioHandoffAtomicCommandRepository implements AtomicHandoffCommandRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: AtomicHandoffCommandInput): Promise<AtomicHandoffCommandResult> {
    return this.prisma.$transaction(async (tx) => {
      const assignments = new PrismaPortfolioHandoffAssignmentRepository(tx as PrismaClient);
      const commands = new PrismaPortfolioHandoffResponseCommandRepository(tx as PrismaClient);
      const events = new PrismaHandoffSemanticEventRepository(tx as PrismaClient);
      const existing = await commands.findByIdempotencyKey({ assignmentId: input.assignmentId, type: input.type, idempotencyKey: input.idempotencyKey });
      let assignment: HandoffAssignment | null;
      if (existing) {
        if (existing.fingerprint !== input.fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
        assignment = await assignments.findById(input.assignmentId);
        if (!assignment) throw new Error('HANDOFF_NOT_FOUND');
      } else if (input.type === 'ACCEPT' || input.type === 'REJECT') {
        assignment = await assignments.applyResponse({ assignmentId: input.assignmentId, from: ['SENT', 'VIEWED'], to: input.type === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', actorId: input.actorId, reason: input.reason, expectedVersion: input.expectedVersion!, now: input.now });
        if (!assignment) throw new Error('STALE_VERSION');
        await commands.create({ assignmentId: input.assignmentId, type: input.type, idempotencyKey: input.idempotencyKey, actorId: input.actorId, fingerprint: input.fingerprint, resultingVersion: assignment.version, createdAt: input.now });
      } else if (input.type === 'START') {
        assignment = await assignments.startAssignedWork({ assignmentId: input.assignmentId, expectedVersion: input.expectedVersion!, actorId: input.actorId, now: input.now });
        if (!assignment) throw new Error('STALE_VERSION');
        await commands.create({ assignmentId: input.assignmentId, type: input.type, idempotencyKey: input.idempotencyKey, actorId: input.actorId, fingerprint: input.fingerprint, resultingVersion: assignment.version, createdAt: input.now });
      } else {
        assignment = await assignments.recordPortfolioResponse({ assignmentId: input.assignmentId, response: input.response!, actorId: input.actorId, now: input.now });
        if (!assignment) throw new Error('INVALID_STATE');
        await commands.create({ assignmentId: input.assignmentId, type: input.type, idempotencyKey: input.idempotencyKey, actorId: input.actorId, fingerprint: input.fingerprint, resultingVersion: assignment.version, createdAt: input.now });
      }

      const event: HandoffSemanticEvent = {
        eventId: eventIdForCommand(input.assignmentId, input.type, input.idempotencyKey),
        eventType: input.type === 'ACCEPT' ? 'assignment_accepted' : input.type === 'REJECT' ? 'assignment_rejected' : input.type === 'START' ? 'handoff_assignment_started' : 'portfolio_response_recorded',
        entityType: 'handoff_assignment', entityId: assignment.id, entityVersion: assignment.version,
        actorId: input.actorId, actorRole: null, interactionChannel: 'api', organizationId: assignment.organizationId ?? null,
        portfolioScopeRef: assignment.portfolioScopeRef ?? null, challengeId: assignment.challengeId, initiativeId: assignment.initiativeId ?? null,
        sourceRefs: [`handoff_assignment:${assignment.id}`], originAssignmentId: assignment.id, correlationId: null, causationEventId: null,
        payload: { targetKind: assignment.targetKind, initiativeId: assignment.initiativeId, handoffState: assignment.state, rejectionReason: assignment.rejectionReason, portfolioResponse: assignment.portfolioResponse, members: assignment.members },
        occurredAt: input.now, recordedAt: input.now,
      };
      await events.append(event);
      return { assignment, event };
    });
  }
}
