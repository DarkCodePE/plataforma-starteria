import { PortfolioHandoffAssignmentError } from './portfolio-handoff-assignment.errors';
import type {
  CreateHandoffAssignmentInput,
  HandoffAssignment,
  HandoffAssignmentRepository,
  HandoffReferenceRepository,
} from '../domain/portfolio-handoff-assignment.types';
import { eventFromAssignment, type DurableHandoffEventPort } from './portfolio-handoff-semantic-event.projector';

export class PortfolioHandoffAssignmentService {
  constructor(
    private readonly repository: HandoffAssignmentRepository,
    private readonly references: HandoffReferenceRepository,
    private readonly events?: DurableHandoffEventPort,
  ) {}

  async createHandoffAssignment(input: CreateHandoffAssignmentInput): Promise<HandoffAssignment> {
    validateInput(input);
    const challenge = await this.references.findChallenge(input.challengeId);
    if (!challenge) throw invalid('challenge_ref must reference an existing Challenge');
    assertScope(input.organizationId, challenge.organizationId, 'challenge');
    if (input.initiativeId) {
      const initiative = await this.references.findInitiative(input.initiativeId);
      if (!initiative) throw invalid('initiative_ref must reference an existing Project/Initiative');
      assertScope(input.organizationId, initiative.organizationId, 'initiative');
    }
    const assignment = await this.repository.create({ ...input, initiativeId: input.initiativeId ?? null });
    if (this.events) await this.events.publish(eventFromAssignment(assignment, 'assignment_created', { actorId: input.createdByActorId, interactionChannel: 'api', payload: { targetKind: assignment.targetKind, initiativeId: assignment.initiativeId, challengeId: assignment.challengeId, members: assignment.members, invitedIdentity: assignment.invitedEmailNormalized } }));
    return assignment;
  }

  getHandoffAssignment(id: string): Promise<HandoffAssignment | null> {
    return this.repository.findById(id);
  }
}

function validateInput(input: CreateHandoffAssignmentInput): void {
  if (!input.challengeId) throw invalid('challenge_ref is required');
  if (!input.createdByActorId) throw invalid('created_by actor is required');
  if (!input.invitedEmailNormalized) throw invalid('invited identity is required');
  if (input.targetKind === 'EXISTING_INITIATIVE' && !input.initiativeId) throw invalid('EXISTING_INITIATIVE requires initiative_ref');
  if (input.targetKind === 'CHALLENGE' && input.initiativeId) throw invalid('CHALLENGE requires initiative_ref to be null');
  if (input.members.filter((member) => member.role === 'OWNER').length !== 1) throw invalid('assignment requires exactly one Initiative Owner');
  const identities = input.members.map((member) => member.identityKey.trim().toLowerCase());
  if (identities.some((identity) => !identity) || new Set(identities).size !== identities.length) throw invalid('member identities must be unique and non-empty');
  if (input.members.filter((member) => member.role !== 'OBSERVER').length > 3) throw invalid('execution team cannot exceed three people');
}

function assertScope(expected: string | null | undefined, actual: string | null | undefined, ref: string): void {
  if (expected && actual && expected !== actual) throw invalid(`${ref} is outside the assignment organization/scope`);
}

function invalid(message: string): PortfolioHandoffAssignmentError {
  return new PortfolioHandoffAssignmentError('INVALID_ASSIGNMENT', message);
}
