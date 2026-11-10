import type { HandoffAssignment, HandoffAssignmentRepository } from '../domain/portfolio-handoff-assignment.types';
import type { DurableHandoffEventPort } from './portfolio-handoff-semantic-event.projector';

export async function expireHandoffAssignment(
  assignments: HandoffAssignmentRepository,
  events: DurableHandoffEventPort | undefined,
  assignment: HandoffAssignment,
  occurredAt: Date,
): Promise<HandoffAssignment | null> {
  const transitioned = assignment.state === 'EXPIRED'
    ? assignment
    : await assignments.transitionState({
      assignmentId: assignment.id,
      from: ['CREATED', 'SENT', 'VIEWED'],
      to: 'EXPIRED',
      now: occurredAt,
    });
  const expired = transitioned ?? await assignments.findById(assignment.id);
  if (expired?.state !== 'EXPIRED') return null;
  if (!events) return expired;

  await events.publish({
    eventId: `handoff-lifecycle:${expired.id}:assignment_expired:v${expired.version}`,
    type: 'assignment_expired',
    assignmentId: expired.id,
    version: expired.version,
    actorId: null,
    occurredAt,
    interactionChannel: 'system',
    organizationId: expired.organizationId,
    portfolioScopeRef: expired.portfolioScopeRef,
    challengeId: expired.challengeId,
    initiativeId: expired.initiativeId,
    payload: {
      handoffState: expired.state,
      targetKind: expired.targetKind,
      initiativeId: expired.initiativeId,
    },
  });
  return expired;
}
