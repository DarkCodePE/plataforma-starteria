import type {
  ActionExecution,
  ActionExecutionStatus,
  ActionPlan,
  ActionPlanStatus,
  CommandExecutionError,
  CommandExecutionResult,
  CopilotConversation,
  CopilotMessage,
  IntentAssessment,
  ObjectReference,
  ProjectionLink,
  ProposedAction,
} from '../domain/copilot.types';
import type { OrganizationAccessReader } from '../application/strategic-front.authorization';
import type {
  createActionExecutionPendingSchema,
  createActionPlanSchema,
  createCopilotConversationSchema,
  createCopilotMessageSchema,
  createIntentAssessmentSchema,
  createProposedActionSchema,
} from '../schemas/copilot.schemas';
import type { z } from 'zod/v3';

export type CreateCopilotConversationInput = z.infer<typeof createCopilotConversationSchema>;
export type CreateCopilotMessageInput = z.infer<typeof createCopilotMessageSchema>;
export type CreateIntentAssessmentInput = z.infer<typeof createIntentAssessmentSchema>;
export type CreateActionPlanInput = z.infer<typeof createActionPlanSchema>;
export type CreateProposedActionInput = z.infer<typeof createProposedActionSchema>;
export type CreateActionExecutionPendingInput = z.infer<typeof createActionExecutionPendingSchema>;

export type EditProposedActionInput = {
  proposedPayload: Record<string, unknown>;
  expectedVersion: number;
};

export type ApproveProposedActionInput = {
  expectedVersion: number;
  approvedBy: string;
  approvedAt?: Date;
};

export type RejectProposedActionInput = {
  expectedVersion: number;
  rejectedBy: string;
  rejectedAt?: Date;
};

export type UpdateActionExecutionStatusInput = {
  status: ActionExecutionStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  executedBy?: string | null;
};

export type ClaimStaleExecutionInput = {
  claimId: string;
  staleBefore: Date;
};

export type MarkExecutionManualReviewInput = {
  error: CommandExecutionError;
  completedAt?: Date;
};

export type CompleteActionExecutionInput = {
  result: CommandExecutionResult;
  createdObjectReferences: ObjectReference[];
  updatedObjectReferences: ObjectReference[];
  projectionLinks: ProjectionLink[];
  completedAt?: Date;
};

export type FailActionExecutionInput = {
  error: CommandExecutionError;
  result?: CommandExecutionResult;
  completedAt?: Date;
};

export type AuditEventInput = {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
};

export interface CopilotRepository extends OrganizationAccessReader {
  getActorOrganizationId(userId: string): Promise<string | null>;
  createConversation(input: CreateCopilotConversationInput): Promise<CopilotConversation>;
  findConversationById(id: string): Promise<CopilotConversation | null>;
  updateConversationStatus(id: string, status: CopilotConversation['status']): Promise<CopilotConversation>;
  addMessage(input: CreateCopilotMessageInput): Promise<CopilotMessage>;
  listMessages(conversationId: string): Promise<CopilotMessage[]>;
  saveIntentAssessment(input: CreateIntentAssessmentInput): Promise<IntentAssessment>;
  findLatestIntentAssessmentByConversation(conversationId: string): Promise<IntentAssessment | null>;
  createActionPlan(input: CreateActionPlanInput): Promise<ActionPlan>;
  createProposedAction(input: CreateProposedActionInput): Promise<ProposedAction>;
  findActionPlanById(id: string): Promise<ActionPlan | null>;
  findCurrentActionPlanByConversation(conversationId: string): Promise<ActionPlan | null>;
  findProposedActionById(id: string): Promise<ProposedAction | null>;
  updateProposedActionPayload(id: string, input: EditProposedActionInput): Promise<ProposedAction>;
  approveProposedAction(id: string, input: ApproveProposedActionInput): Promise<ProposedAction>;
  rejectProposedAction(id: string, input: RejectProposedActionInput): Promise<ProposedAction>;
  updateProposedActionStatus(id: string, status: ProposedAction['status']): Promise<ProposedAction>;
  updateActionPlanStatus(id: string, status: ActionPlanStatus): Promise<ActionPlan>;
  supersedeActionPlan(id: string, supersededById: string): Promise<ActionPlan>;
  createPendingActionExecution(input: CreateActionExecutionPendingInput): Promise<ActionExecution>;
  findExecutionById(id: string): Promise<ActionExecution | null>;
  findExecutionByIdempotencyKey(idempotencyKey: string): Promise<ActionExecution | null>;
  listExecutionsByAction(proposedActionId: string): Promise<ActionExecution[]>;
  listStaleNonTerminalExecutions(staleBefore: Date, limit: number): Promise<ActionExecution[]>;
  claimStaleActionExecution(id: string, input: ClaimStaleExecutionInput): Promise<ActionExecution | null>;
  updateActionExecutionStatus(id: string, input: UpdateActionExecutionStatusInput): Promise<ActionExecution>;
  completeActionExecution(id: string, input: CompleteActionExecutionInput): Promise<ActionExecution>;
  failActionExecution(id: string, input: FailActionExecutionInput): Promise<ActionExecution>;
  markActionExecutionManualReview(id: string, input: MarkExecutionManualReviewInput): Promise<ActionExecution>;
  writeAudit(event: AuditEventInput): Promise<void>;
}
