import { randomUUID } from 'node:crypto';
import type {
  CreateHandoffAssignmentInput,
  HandoffAssignment,
  HandoffAssignmentRepository,
  HandoffReference,
  HandoffReferenceRepository,
  HandoffAssignmentState,
} from '../domain/portfolio-handoff-assignment.types';

export class InMemoryPortfolioHandoffAssignmentRepository implements HandoffAssignmentRepository {
  private readonly assignments = new Map<string, HandoffAssignment>();

  async create(input: CreateHandoffAssignmentInput): Promise<HandoffAssignment> {
    const now = new Date();
    const assignment: HandoffAssignment = {
      ...input,
      id: randomUUID(),
      state: 'CREATED',
      version: 1,
      members: input.members.map((member) => ({ ...member, identityKey: member.identityKey.trim().toLowerCase() })),
      createdAt: now,
      updatedAt: now,
      sentAt: null,
      viewedAt: null,
      revokedAt: null,
      expiredAt: null,
      acceptedAt: null, acceptedBy: null, rejectionReason: null, rejectedAt: null, rejectedBy: null,
      portfolioResponse: null, portfolioResponseRecordedAt: null, portfolioResponseRecordedBy: null,
    };
    this.assignments.set(assignment.id, assignment);
    return clone(assignment);
  }

  async findById(id: string): Promise<HandoffAssignment | null> {
    const assignment = this.assignments.get(id);
    return assignment ? clone(assignment) : null;
  }

  async associateInvitedIdentity(input: { assignmentId: string; userId: string; emailNormalized: string; identityRef?: string | null }): Promise<HandoffAssignment | null> {
    const assignment = this.assignments.get(input.assignmentId);
    if (!assignment) return null;
    const member = assignment.members.find((candidate) => candidate.role === 'OWNER' && !candidate.userId && (candidate.emailNormalized === input.emailNormalized || candidate.identityKey === input.emailNormalized || candidate.identityKey === input.identityRef));
    if (member) member.userId = input.userId;
    return clone(assignment);
  }

  async transitionState(input: { assignmentId: string; from: HandoffAssignmentState[]; to: HandoffAssignmentState; now?: Date }): Promise<HandoffAssignment | null> {
    const assignment = this.assignments.get(input.assignmentId);
    if (!assignment || !input.from.includes(assignment.state)) return null;
    assignment.state = input.to;
    assignment.version += 1;
    assignment.updatedAt = input.now ?? new Date();
    if (input.to === 'SENT') assignment.sentAt = assignment.updatedAt;
    if (input.to === 'VIEWED') assignment.viewedAt = assignment.updatedAt;
    if (input.to === 'REVOKED') assignment.revokedAt = assignment.updatedAt;
    if (input.to === 'EXPIRED') assignment.expiredAt = assignment.updatedAt;
    return clone(assignment);
  }

  async applyResponse(input: { assignmentId: string; from: HandoffAssignmentState[]; to: 'ACCEPTED' | 'REJECTED'; actorId: string; reason?: string; expectedVersion: number; now: Date }): Promise<HandoffAssignment | null> {
    const assignment = this.assignments.get(input.assignmentId);
    if (!assignment || assignment.version !== input.expectedVersion || !input.from.includes(assignment.state)) return null;
    assignment.state = input.to; assignment.version += 1; assignment.updatedAt = input.now;
    if (input.to === 'ACCEPTED') { assignment.acceptedAt = input.now; assignment.acceptedBy = input.actorId; }
    else { assignment.rejectionReason = input.reason!; assignment.rejectedAt = input.now; assignment.rejectedBy = input.actorId; }
    return clone(assignment);
  }

  async recordPortfolioResponse(input: { assignmentId: string; response: string; actorId: string; now: Date }): Promise<HandoffAssignment | null> {
    const assignment = this.assignments.get(input.assignmentId);
    if (!assignment || assignment.state !== 'REJECTED') return null;
    assignment.portfolioResponse = input.response; assignment.portfolioResponseRecordedAt = input.now; assignment.portfolioResponseRecordedBy = input.actorId; assignment.updatedAt = input.now;
    return clone(assignment);
  }
}

export class InMemoryHandoffReferenceRepository implements HandoffReferenceRepository {
  constructor(
    private readonly challenges = new Map<string, HandoffReference>(),
    private readonly initiatives = new Map<string, HandoffReference>(),
  ) {}
  addChallenge(reference: HandoffReference): void { this.challenges.set(reference.id, reference); }
  addInitiative(reference: HandoffReference): void { this.initiatives.set(reference.id, reference); }
  async findChallenge(id: string): Promise<HandoffReference | null> { return this.challenges.get(id) ?? null; }
  async findInitiative(id: string): Promise<HandoffReference | null> { return this.initiatives.get(id) ?? null; }
}

function clone(assignment: HandoffAssignment): HandoffAssignment {
  return { ...assignment, members: assignment.members.map((member) => ({ ...member })), createdAt: new Date(assignment.createdAt), updatedAt: new Date(assignment.updatedAt) };
}
