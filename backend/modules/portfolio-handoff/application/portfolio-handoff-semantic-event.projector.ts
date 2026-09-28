import { randomUUID } from 'node:crypto';
import type { HandoffAssignment } from '../domain/portfolio-handoff-assignment.types';
import type { HandoffSemanticEvent, HandoffSemanticEventRepository, PortfolioHandoffProjection, PortfolioHandoffProjectionRepository } from '../domain/portfolio-handoff-semantic-event.types';

const MATERIAL = new Set(['assignment_created','invitation_sent','invitation_viewed','assignment_accepted','assignment_rejected','portfolio_response_recorded','handoff_assignment_started','assignment_revoked','assignment_expired','initiative_linked_to_handoff_assignment']);

export function eventFromAssignment(assignment: HandoffAssignment, eventType: HandoffSemanticEvent['eventType'], input: { eventId?: string; actorId?: string | null; interactionChannel?: HandoffSemanticEvent['interactionChannel']; occurredAt?: Date; payload?: Record<string, unknown> } = {}): HandoffSemanticEvent {
  const occurredAt = input.occurredAt ?? new Date();
  return { eventId: input.eventId ?? randomUUID(), eventType, entityType: 'handoff_assignment', entityId: assignment.id, entityVersion: assignment.version, actorId: input.actorId ?? null, actorRole: null, interactionChannel: input.interactionChannel ?? 'system', organizationId: assignment.organizationId ?? null, portfolioScopeRef: assignment.portfolioScopeRef ?? null, challengeId: assignment.challengeId, initiativeId: assignment.initiativeId ?? null, sourceRefs: [`handoff_assignment:${assignment.id}`], originAssignmentId: assignment.id, correlationId: null, causationEventId: null, payload: input.payload ?? {}, occurredAt, recordedAt: new Date() };
}

export class PortfolioHandoffProjector {
  constructor(private readonly projections: PortfolioHandoffProjectionRepository) {}

  async apply(event: HandoffSemanticEvent): Promise<PortfolioHandoffProjection | null> {
    if (event.entityType !== 'handoff_assignment' || !MATERIAL.has(event.eventType)) return null;
    const current = await this.projections.findByAssignmentId(event.entityId);
    if (current?.sourceEventRefs.includes(event.eventId)) return current;
    if (current && event.entityVersion < current.projectionVersion) return current;
    const next = reduce(current, event);
    return this.projections.save(next);
  }

  async rebuild(assignmentId: string, events: HandoffSemanticEvent[]): Promise<PortfolioHandoffProjection | null> {
    await this.projections.deleteByAssignmentId(assignmentId);
    let result: PortfolioHandoffProjection | null = null;
    for (const event of [...events].filter((item) => item.entityId === assignmentId).sort((a, b) => a.entityVersion - b.entityVersion || a.occurredAt.getTime() - b.occurredAt.getTime() || a.eventId.localeCompare(b.eventId))) result = await this.apply(event);
    return result;
  }
}

function reduce(current: PortfolioHandoffProjection | null, event: HandoffSemanticEvent): PortfolioHandoffProjection {
  const p = current ?? initial(event);
  const payload = event.payload;
  const members = Array.isArray(payload.members) ? payload.members as any[] : p.executionTeam.concat(p.observers);
  const owner = members.find((member) => member.role === 'OWNER');
  const executionTeam = members.filter((member) => member.role !== 'OBSERVER');
  const observers = members.filter((member) => member.role === 'OBSERVER');
  const state = payload.handoffState as HandoffAssignment['state'] | undefined;
  return { ...p, initiativeRef: (payload.initiativeId as string | null | undefined) ?? p.initiativeRef, resultingInitiativeRef: (payload.resultingInitiativeId as string | null | undefined) ?? p.resultingInitiativeRef, initiativeOwnerRef: owner?.userId ?? owner?.identityKey ?? p.initiativeOwnerRef, executionTeam, observers, invitedIdentity: (payload.invitedIdentity as string | null | undefined) ?? p.invitedIdentity, inviterRef: (payload.inviterRef as string | null | undefined) ?? p.inviterRef, handoffState: state ?? stateForEvent(p.handoffState, event.eventType), acceptedAt: event.eventType === 'assignment_accepted' ? event.occurredAt : p.acceptedAt, rejectedAt: event.eventType === 'assignment_rejected' ? event.occurredAt : p.rejectedAt, rejectionReason: (payload.rejectionReason as string | null | undefined) ?? p.rejectionReason, portfolioResponse: (payload.portfolioResponse as string | null | undefined) ?? p.portfolioResponse, startedAt: event.eventType === 'handoff_assignment_started' ? event.occurredAt : p.startedAt, lastMaterialEvent: event.eventType, sourceEventRefs: p.sourceEventRefs.concat(event.eventId), projectionVersion: Math.max(p.projectionVersion, event.entityVersion), generatedAt: new Date(event.recordedAt) };
}

function initial(event: HandoffSemanticEvent): PortfolioHandoffProjection { const p = event.payload; return { assignmentId: event.entityId, organizationId: event.organizationId ?? null, portfolioScopeRef: event.portfolioScopeRef ?? null, strategicFrontRef: (p.strategicFrontRef as string | null) ?? null, challengeRef: event.challengeId ?? String(p.challengeId ?? ''), challengeVersionRef: (p.challengeVersionRef as string | null) ?? null, targetKind: (p.targetKind as HandoffAssignment['targetKind']) ?? 'CHALLENGE', initiativeRef: event.initiativeId ?? null, invitedIdentity: (p.invitedIdentity as string | null) ?? null, initiativeOwnerRef: (p.initiativeOwnerRef as string | null) ?? null, executionTeam: [], observers: [], inviterRef: (p.inviterRef as string | null) ?? event.actorId ?? null, handoffState: (p.handoffState as HandoffAssignment['state']) ?? 'CREATED', acceptedAt: null, rejectedAt: null, rejectionReason: null, portfolioResponse: null, startedAt: null, resultingInitiativeRef: null, lastMaterialEvent: null, sourceEventRefs: [], projectionVersion: 0, generatedAt: new Date(event.recordedAt) }; }
function stateForEvent(current: HandoffAssignment['state'], type: HandoffSemanticEvent['eventType']): HandoffAssignment['state'] { const map: Partial<Record<HandoffSemanticEvent['eventType'], HandoffAssignment['state']>> = { assignment_created: 'CREATED', invitation_sent: 'SENT', invitation_viewed: 'VIEWED', assignment_accepted: 'ACCEPTED', assignment_rejected: 'REJECTED', handoff_assignment_started: 'STARTED', assignment_revoked: 'REVOKED', assignment_expired: 'EXPIRED' }; return map[type] ?? current; }

export class DurableHandoffEventPort {
  constructor(private readonly events: HandoffSemanticEventRepository, private readonly projector: PortfolioHandoffProjector) {}
  async publish(input: any): Promise<void> { const eventType = normalizeType(input.type); const event: HandoffSemanticEvent = { eventId: input.eventId ?? randomUUID(), eventType, entityType: 'handoff_assignment', entityId: input.assignmentId, entityVersion: input.version ?? input.entityVersion ?? 1, actorId: input.actorId ?? null, actorRole: input.actorRole ?? null, interactionChannel: input.interactionChannel ?? 'api', organizationId: input.organizationId ?? null, portfolioScopeRef: input.portfolioScopeRef ?? null, challengeId: input.challengeId ?? null, initiativeId: input.initiativeId ?? null, sourceRefs: input.sourceRefs ?? [`handoff_assignment:${input.assignmentId}`], originAssignmentId: input.assignmentId, correlationId: input.correlationId ?? null, causationEventId: input.causationEventId ?? null, payload: safePayload(input.payload ?? input), occurredAt: input.occurredAt ?? new Date(), recordedAt: new Date() }; await this.events.append(event); await this.projector.apply(event); }
}
function normalizeType(type: string): HandoffSemanticEvent['eventType'] { const value = type.replace(/^handoff_/, ''); if (value === 'assignment_started') return 'handoff_assignment_started'; if (value === 'rejection_response_recorded') return 'portfolio_response_recorded'; return value as HandoffSemanticEvent['eventType']; }
function safePayload(payload: Record<string, unknown>): Record<string, unknown> { const copy = { ...payload }; for (const key of Object.keys(copy)) if (/token|secret|hash/i.test(key)) delete copy[key]; return copy; }
