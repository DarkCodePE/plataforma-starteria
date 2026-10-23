import { describe, expect, it } from 'vitest';
import {
  InMemoryHandoffReferenceRepository,
  InMemoryPortfolioHandoffAssignmentRepository,
  PortfolioHandoffAssignmentError,
  PortfolioHandoffAssignmentService,
  type CreateHandoffAssignmentInput,
} from '../index';

const owner = { identityKey: 'owner@example.com', emailNormalized: 'owner@example.com', role: 'OWNER' as const };
const executor = (n: number) => ({ identityKey: `executor-${n}@example.com`, role: 'EXECUTOR' as const });
const observer = (n: number) => ({ identityKey: `observer-${n}@example.com`, role: 'OBSERVER' as const });

function setup() {
  const refs = new InMemoryHandoffReferenceRepository();
  refs.addChallenge({ id: 'challenge-1', organizationId: 'org-1' });
  refs.addInitiative({ id: 'project-1', organizationId: 'org-1', challengeIds: ['challenge-1'] });
  refs.addInitiative({ id: 'project-unlinked', organizationId: 'org-1', challengeIds: ['challenge-other'] });
  const repository = new InMemoryPortfolioHandoffAssignmentRepository();
  return { service: new PortfolioHandoffAssignmentService(repository, refs), repository };
}

function input(overrides: Partial<CreateHandoffAssignmentInput> = {}): CreateHandoffAssignmentInput {
  return {
    organizationId: 'org-1',
    challengeId: 'challenge-1',
    targetKind: 'CHALLENGE',
    invitedEmailNormalized: 'owner@example.com',
    createdByActorId: 'portfolio-lead-1',
    members: [owner],
    ...overrides,
  };
}

async function fails(promise: Promise<unknown>, message: string) {
  await expect(promise).rejects.toMatchObject({ code: 'INVALID_ASSIGNMENT', message });
}

describe('PortfolioHandoffAssignmentService / H-TECH-02', () => {
  it('requires an existing initiative ref for EXISTING_INITIATIVE and preserves it', async () => {
    const { service } = setup();
    await fails(service.createHandoffAssignment(input({ targetKind: 'EXISTING_INITIATIVE' })), 'EXISTING_INITIATIVE requires initiative_ref');
    const assignment = await service.createHandoffAssignment(input({ targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-1' }));
    expect(assignment.initiativeId).toBe('project-1');
  });

  it('requires the canonical Project to be linked to this Challenge through InitiativePortfolioMeta', async () => {
    const { service } = setup();
    await fails(
      service.createHandoffAssignment(input({ targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-unlinked' })),
      'initiative_ref must reference a canonical Project linked to this Challenge',
    );
  });

  it('rejects a nonexistent initiative and a challenge with an initiative ref', async () => {
    const { service } = setup();
    await fails(service.createHandoffAssignment(input({ targetKind: 'EXISTING_INITIATIVE', initiativeId: 'missing' })), 'initiative_ref must reference an existing Project/Initiative');
    await fails(service.createHandoffAssignment(input({ targetKind: 'CHALLENGE', initiativeId: 'project-1' })), 'CHALLENGE requires initiative_ref to be null');
  });

  it('requires an existing challenge and rejects scope mismatch', async () => {
    const { service } = setup();
    await fails(service.createHandoffAssignment(input({ challengeId: 'missing' })), 'challenge_ref must reference an existing Challenge');
    await fails(service.createHandoffAssignment(input({ organizationId: 'org-2' })), 'challenge is outside the assignment organization/scope');
  });

  it.each([
    ['zero owners', []],
    ['two owners', [owner, { identityKey: 'owner-2@example.com', role: 'OWNER' as const }]],
  ])('rejects %s', async (_label, members) => {
    const { service } = setup();
    await fails(service.createHandoffAssignment(input({ members })), 'assignment requires exactly one Initiative Owner');
  });

  it('accepts owner-only and owner plus one or two executors', async () => {
    const { service } = setup();
    for (const members of [[owner], [owner, executor(1)], [owner, executor(1), executor(2)]]) {
      const assignment = await service.createHandoffAssignment(input({ members }));
      expect(assignment.members.filter((member) => member.role !== 'OBSERVER')).toHaveLength(members.length);
    }
  });

  it('rejects a fourth executor, duplicate identities, and counts observers outside the cap', async () => {
    const { service } = setup();
    await fails(service.createHandoffAssignment(input({ members: [owner, executor(1), executor(2), executor(3)] })), 'execution team cannot exceed three people');
    await fails(service.createHandoffAssignment(input({ members: [owner, { ...executor(1), identityKey: 'OWNER@example.com' }] })), 'member identities must be unique and non-empty');
    const assignment = await service.createHandoffAssignment(input({ members: [owner, executor(1), executor(2), observer(1), observer(2), observer(3)] }));
    expect(assignment.members.filter((member) => member.role === 'OBSERVER')).toHaveLength(3);
  });

  it('persists unresolved owner identity, deterministic initial version, and does not create Core entities', async () => {
    const { service, repository } = setup();
    const assignment = await service.createHandoffAssignment(input({ members: [{ ...owner, userId: null }] }));
    expect(assignment.members[0].userId).toBeNull();
    expect(assignment.version).toBe(1);
    expect(assignment.state).toBe('CREATED');
    expect(await service.getHandoffAssignment(assignment.id)).toMatchObject({ initiativeId: null, version: 1 });
    expect(await repository.findById(assignment.id)).not.toBeNull();
  });

  it('persists contextual preparation and allows optimistic editing only while CREATED', async () => {
    const { service, repository } = setup();
    const assignment = await service.createHandoffAssignment(input({ contextNote: 'Validar la barrera con clientes activos.' }));
    expect(assignment.contextNote).toBe('Validar la barrera con clientes activos.');

    const updated = await service.updateCreatedHandoffAssignment({
      assignmentId: assignment.id,
      expectedVersion: 1,
      invitedEmailNormalized: 'new-owner@example.com',
      contextNote: 'Priorizar evidencia de las dos primeras semanas.',
      members: [{ identityKey: 'new-owner@example.com', emailNormalized: 'new-owner@example.com', role: 'OWNER' }],
      actorId: 'portfolio-lead-1',
    });
    expect(updated).toMatchObject({ version: 2, state: 'CREATED', invitedEmailNormalized: 'new-owner@example.com', contextNote: 'Priorizar evidencia de las dos primeras semanas.' });

    await fails(service.updateCreatedHandoffAssignment({
      assignmentId: assignment.id,
      expectedVersion: 1,
      invitedEmailNormalized: 'stale@example.com',
      contextNote: null,
      members: [{ identityKey: 'stale@example.com', emailNormalized: 'stale@example.com', role: 'OWNER' }],
      actorId: 'portfolio-lead-1',
    }), 'assignment changed or is no longer editable in CREATED');

    await repository.transitionState({ assignmentId: assignment.id, from: ['CREATED'], to: 'SENT' });
    await fails(service.updateCreatedHandoffAssignment({
      assignmentId: assignment.id,
      expectedVersion: 3,
      invitedEmailNormalized: 'late@example.com',
      contextNote: null,
      members: [{ identityKey: 'late@example.com', emailNormalized: 'late@example.com', role: 'OWNER' }],
      actorId: 'portfolio-lead-1',
    }), 'assignment changed or is no longer editable in CREATED');
  });
});
