import { describe, expect, it } from 'vitest';
import { DurableHandoffEventPort, PortfolioHandoffProjector } from '../application/portfolio-handoff-semantic-event.projector';
import { InMemoryHandoffSemanticEventRepository, InMemoryPortfolioHandoffProjectionRepository } from '../infrastructure/in-memory-portfolio-handoff-semantic-event.repository';
import type { HandoffSemanticEvent } from '../domain/portfolio-handoff-semantic-event.types';

const event = (type: HandoffSemanticEvent['eventType'], version: number, extra: Record<string, unknown> = {}): HandoffSemanticEvent => ({
  eventId: `${type}-${version}`, eventType: type, entityType: 'handoff_assignment', entityId: 'a-1', entityVersion: version,
  actorId: 'u-1', actorRole: 'initiative_owner', interactionChannel: 'web', organizationId: 'org-1', portfolioScopeRef: 'portfolio-1', challengeId: 'c-1', initiativeId: null,
  sourceRefs: [], originAssignmentId: 'a-1', payload: { targetKind: 'CHALLENGE', invitedIdentity: 'owner@example.test', ...extra }, occurredAt: new Date(`2026-09-28T12:0${version}:00Z`), recordedAt: new Date(`2026-09-28T12:0${version}:00Z`),
});

describe('H-TECH-08 durable semantic events and Portfolio projection', () => {
  it('persists bounded events, projects lifecycle and is idempotent', async () => {
    const events = new InMemoryHandoffSemanticEventRepository(); const projections = new InMemoryPortfolioHandoffProjectionRepository(); const port = new DurableHandoffEventPort(events, new PortfolioHandoffProjector(projections));
    await port.publish({ type: 'assignment_created', assignmentId: 'a-1', version: 1, challengeId: 'c-1', payload: { targetKind: 'CHALLENGE', token: 'must-not-persist' }, eventId: 'e-1' });
    await port.publish({ type: 'handoff_assignment_started', assignmentId: 'a-1', version: 4, challengeId: 'c-1', eventId: 'e-4' });
    await port.publish({ type: 'handoff_assignment_accepted', assignmentId: 'a-1', version: 3, challengeId: 'c-1', eventId: 'e-3' });
    await port.publish({ type: 'handoff_assignment_started', assignmentId: 'a-1', version: 4, challengeId: 'c-1', eventId: 'e-4' });
    const projection = await projections.findByAssignmentId('a-1');
    expect(events.events).toHaveLength(3); expect(events.events[0].payload.token).toBeUndefined(); expect(projection).toMatchObject({ handoffState: 'STARTED', projectionVersion: 4, initiativeRef: null }); expect(projection?.sourceEventRefs).toEqual(['e-1', 'e-4']);
  });

  it('projects rejection and response without changing identity', async () => {
    const repository = new InMemoryPortfolioHandoffProjectionRepository(); const projector = new PortfolioHandoffProjector(repository);
    await projector.apply(event('assignment_created', 1, { targetKind: 'EXISTING_INITIATIVE', initiativeId: 'i-1', members: [{ identityKey: 'owner', userId: 'u-1', role: 'OWNER' }] }));
    await projector.apply(event('assignment_rejected', 2, { rejectionReason: 'No capacity', handoffState: 'REJECTED' }));
    await projector.apply(event('portfolio_response_recorded', 3, { portfolioResponse: 'We will revisit' }));
    const projection = await repository.findByAssignmentId('a-1');
    expect(projection).toMatchObject({ targetKind: 'EXISTING_INITIATIVE', initiativeRef: 'i-1', handoffState: 'REJECTED', rejectionReason: 'No capacity', portfolioResponse: 'We will revisit' });
  });

  it('rebuilds deterministically and correlates a Challenge to a resulting Initiative', async () => {
    const repository = new InMemoryPortfolioHandoffProjectionRepository(); const projector = new PortfolioHandoffProjector(repository); const history = [event('assignment_created', 1), event('handoff_assignment_started', 2), event('initiative_linked_to_handoff_assignment', 3, { resultingInitiativeId: 'i-2' })];
    const first = await projector.rebuild('a-1', history); await repository.deleteByAssignmentId('a-1'); const rebuilt = await projector.rebuild('a-1', history);
    expect(rebuilt).toEqual(first); expect(rebuilt?.initiativeRef).toBeNull(); expect(rebuilt?.resultingInitiativeRef).toBe('i-2'); expect(rebuilt).not.toHaveProperty('currentStep');
  });
});
