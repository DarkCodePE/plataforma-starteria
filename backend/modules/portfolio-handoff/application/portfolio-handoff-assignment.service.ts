import { PortfolioHandoffAssignmentError } from './portfolio-handoff-assignment.errors';
import type {
  CreateHandoffAssignmentInput,
  HandoffAssignment,
  HandoffAssignmentRepository,
  HandoffReferenceRepository,
  UpdateCreatedHandoffAssignmentInput,
} from '../domain/portfolio-handoff-assignment.types';
import type { DurableHandoffEventPort } from './portfolio-handoff-semantic-event.projector';

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
      if (!initiative.challengeIds?.includes(input.challengeId)) throw invalid('initiative_ref must reference a canonical Project linked to this Challenge');
    }
    const assignment = await this.repository.create({ ...input, initiativeId: input.initiativeId ?? null });
    if (this.events) await this.events.publish({
      type: 'assignment_created', assignmentId: assignment.id, version: assignment.version,
      actorId: input.createdByActorId, interactionChannel: 'api', organizationId: assignment.organizationId,
      challengeId: assignment.challengeId, initiativeId: assignment.initiativeId,
      payload: { targetKind: assignment.targetKind, initiativeId: assignment.initiativeId, challengeId: assignment.challengeId, briefVersionId: assignment.briefVersionId ?? null, members: assignment.members, invitedIdentity: assignment.invitedEmailNormalized },
    });
    return assignment;
  }

  getHandoffAssignment(id: string): Promise<HandoffAssignment | null> {
    return this.repository.findById(id);
  }

  async updateCreatedHandoffAssignment(input: UpdateCreatedHandoffAssignmentInput): Promise<HandoffAssignment> {
    validateMembers(input.members);
    if (!input.invitedEmailNormalized) throw invalid('invited identity is required');
    const assignment = await this.repository.updateCreated(input);
    if (!assignment) throw invalid('assignment changed or is no longer editable in CREATED');
    if (this.events) await this.events.publish({
      type: 'assignment_preparation_updated', assignmentId: assignment.id, version: assignment.version,
      actorId: input.actorId, interactionChannel: 'api', organizationId: assignment.organizationId,
      challengeId: assignment.challengeId, initiativeId: assignment.initiativeId,
      payload: { contextNote: assignment.contextNote ?? null, members: assignment.members, invitedIdentity: assignment.invitedEmailNormalized },
    });
    return assignment;
  }
}

function validateInput(input: CreateHandoffAssignmentInput): void {
  if (!input.challengeId) throw invalid('challenge_ref is required');
  if (!input.createdByActorId) throw invalid('created_by actor is required');
  if (!input.invitedEmailNormalized) throw invalid('invited identity is required');
  if (input.targetKind === 'EXISTING_INITIATIVE' && !input.initiativeId) throw invalid('EXISTING_INITIATIVE requires initiative_ref');
  if (input.targetKind === 'CHALLENGE' && input.initiativeId) throw invalid('CHALLENGE requires initiative_ref to be null');
  validateMembers(input.members);
}

function validateMembers(members: CreateHandoffAssignmentInput['members']): void {
  if (members.filter((member) => member.role === 'OWNER').length !== 1) throw invalid('assignment requires exactly one Initiative Owner');
  const identities = members.map((member) => member.identityKey.trim().toLowerCase());
  if (identities.some((identity) => !identity) || new Set(identities).size !== identities.length) throw invalid('member identities must be unique and non-empty');
  if (members.filter((member) => member.role !== 'OBSERVER').length > 3) throw invalid('execution team cannot exceed three people');
}

function assertScope(expected: string | null | undefined, actual: string | null | undefined, ref: string): void {
  if (expected && actual && expected !== actual) throw invalid(`${ref} is outside the assignment organization/scope`);
}

function invalid(message: string): PortfolioHandoffAssignmentError {
  return new PortfolioHandoffAssignmentError('INVALID_ASSIGNMENT', message);
}
