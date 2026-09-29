import type { HandoffAssignment, HandoffMemberInput } from './portfolio-handoff-assignment.types';

export type HandoffSemanticEventType =
  | 'assignment_created' | 'invitation_sent' | 'invitation_viewed'
  | 'assignment_accepted' | 'assignment_rejected' | 'portfolio_response_recorded'
  | 'handoff_assignment_started' | 'assignment_revoked' | 'assignment_expired'
  | 'initiative_linked_to_handoff_assignment'
  | 'initiative_started' | 'step_entered' | 'step_completed' | 'blocker_raised'
  | 'blocker_resolved' | 'support_requested' | 'decision_requested'
  | 'relevant_progress_recorded';

export type HandoffSemanticEvent = {
  eventId: string;
  eventType: HandoffSemanticEventType;
  entityType: 'handoff_assignment' | 'initiative';
  entityId: string;
  entityVersion: number;
  actorId?: string | null;
  actorRole?: string | null;
  interactionChannel: 'web' | 'api' | 'copilot' | 'external_assistant' | 'system';
  organizationId?: string | null;
  portfolioScopeRef?: string | null;
  challengeId?: string | null;
  initiativeId?: string | null;
  sourceRefs: string[];
  originAssignmentId?: string | null;
  correlationId?: string | null;
  causationEventId?: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  recordedAt: Date;
};

export type PortfolioHandoffProjection = {
  assignmentId: string;
  organizationId: string | null;
  portfolioScopeRef: string | null;
  strategicFrontRef: string | null;
  challengeRef: string;
  challengeVersionRef: string | null;
  targetKind: HandoffAssignment['targetKind'];
  initiativeRef: string | null;
  invitedIdentity: string | null;
  initiativeOwnerRef: string | null;
  executionTeam: HandoffMemberInput[];
  observers: HandoffMemberInput[];
  inviterRef: string | null;
  handoffState: HandoffAssignment['state'];
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  portfolioResponse: string | null;
  startedAt: Date | null;
  resultingInitiativeRef: string | null;
  lastMaterialEvent: HandoffSemanticEventType | null;
  sourceEventRefs: string[];
  projectionVersion: number;
  generatedAt: Date;
};

export type HandoffSemanticEventRepository = {
  append(event: HandoffSemanticEvent): Promise<HandoffSemanticEvent>;
  listByAssignment(assignmentId: string): Promise<HandoffSemanticEvent[]>;
  listAll(): Promise<HandoffSemanticEvent[]>;
};

export type PortfolioHandoffProjectionRepository = {
  findByAssignmentId(assignmentId: string): Promise<PortfolioHandoffProjection | null>;
  save(projection: PortfolioHandoffProjection): Promise<PortfolioHandoffProjection>;
  deleteByAssignmentId(assignmentId: string): Promise<void>;
};
