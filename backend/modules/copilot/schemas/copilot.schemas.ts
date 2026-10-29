import { z } from 'zod/v3';
import {
  ACTION_EXECUTION_STATUSES,
  ACTION_PLAN_STATUSES,
  COPILOT_ADAPTER_TYPES,
  COPILOT_CONFIDENCE,
  COPILOT_CONVERSATION_STATUSES,
  COPILOT_INTENTS,
  COPILOT_MESSAGE_ROLES,
  COPILOT_MESSAGE_TYPES,
  COPILOT_OPERATIONS,
  PROPOSED_ACTION_STATUSES,
} from '../domain/copilot.types';

export const sourceReferenceSchema = z.object({
  type: z.enum(['message', 'document', 'portfolio_object', 'system']),
  id: z.string().min(1),
  label: z.string().max(300).optional(),
}).strict();

export const objectReferenceSchema = z.object({
  type: z.string().min(1).max(100),
  id: z.string().min(1).max(200),
  label: z.string().max(300).optional(),
}).strict();

export const projectionLinkSchema = z.object({
  label: z.string().min(1).max(300),
  href: z.string().min(1).max(1000),
  objectType: z.string().min(1).max(100).optional(),
  objectId: z.string().min(1).max(200).optional(),
}).strict();

export const commandExecutionErrorSchema = z.object({
  code: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  retryable: z.boolean(),
}).strict();

export const commandExecutionResultSchema = z.object({
  success: z.boolean(),
  commandType: z.string().min(1).max(200),
  createdObjects: z.array(objectReferenceSchema).default([]),
  updatedObjects: z.array(objectReferenceSchema).default([]),
  warnings: z.array(z.string().min(1).max(1000)).default([]),
  projectionLinks: z.array(projectionLinkSchema).default([]),
  error: commandExecutionErrorSchema.optional(),
}).strict();

export const copilotConversationStatusSchema = z.enum(COPILOT_CONVERSATION_STATUSES);
export const copilotMessageRoleSchema = z.enum(COPILOT_MESSAGE_ROLES);
export const copilotMessageTypeSchema = z.enum(COPILOT_MESSAGE_TYPES);
export const copilotIntentSchema = z.enum(COPILOT_INTENTS);
export const copilotOperationSchema = z.enum(COPILOT_OPERATIONS);
export const copilotConfidenceSchema = z.enum(COPILOT_CONFIDENCE);
export const copilotAdapterTypeSchema = z.enum(COPILOT_ADAPTER_TYPES);
export const actionPlanStatusSchema = z.enum(ACTION_PLAN_STATUSES);
export const proposedActionStatusSchema = z.enum(PROPOSED_ACTION_STATUSES);
export const actionExecutionStatusSchema = z.enum(ACTION_EXECUTION_STATUSES);

export const createCopilotConversationSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  status: copilotConversationStatusSchema.default('collecting_context'),
  contextObjectType: z.string().min(1).max(100).optional(),
  contextObjectId: z.string().min(1).max(200).optional(),
}).strict();

export const createCopilotMessageSchema = z.object({
  conversationId: z.string().min(1),
  role: copilotMessageRoleSchema,
  messageType: copilotMessageTypeSchema,
  content: z.string().min(1).max(20000),
  sourceReferences: z.array(sourceReferenceSchema).default([]),
}).strict();

export const createIntentAssessmentSchema = z.object({
  conversationId: z.string().min(1),
  originalMessageId: z.string().min(1),
  primaryIntent: copilotIntentSchema,
  operation: copilotOperationSchema,
  detectedEntities: z.record(z.unknown()).default({}),
  ambiguousObjects: z.array(objectReferenceSchema).default([]),
  missingInformation: z.array(z.string().min(1)).default([]),
  recommendedCapabilities: z.array(z.string().min(1)).default([]),
  confidence: copilotConfidenceSchema,
  sourceReferences: z.array(sourceReferenceSchema).default([]),
  adapterType: copilotAdapterTypeSchema,
  rubricVersion: z.string().min(1).max(100),
}).strict();

export const createActionPlanSchema = z.object({
  conversationId: z.string().min(1),
  intentAssessmentId: z.string().min(1),
  summary: z.string().min(1).max(4000),
  status: actionPlanStatusSchema.default('draft'),
  version: z.number().int().positive().default(1),
  createdBy: z.string().min(1),
}).strict();

export const createStrategicFrontCapabilityPayloadSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(2).max(200),
  objective: z.string().max(2000).optional(),
  mainKpi: z.string().max(500).optional(),
  baseline: z.string().max(500).optional(),
  target: z.string().max(500).optional(),
  horizon: z.string().max(500).optional(),
  sponsor: z.string().max(500).optional(),
  areaOrBusinessUnit: z.string().max(500).optional(),
  priority: z.enum(['Alta', 'Media', 'Baja']).optional(),
  createdBy: z.string().min(1),
}).strict();

export type CreateStrategicFrontCapabilityPayload = z.infer<typeof createStrategicFrontCapabilityPayloadSchema>;

export const createProposedActionSchema = z.object({
  actionPlanId: z.string().min(1),
  capabilityId: z.string().min(1),
  ownerPrd: z.string().min(1),
  operation: copilotOperationSchema,
  commandType: z.string().min(1),
  title: z.string().min(1).max(300),
  explanation: z.string().min(1).max(4000),
  proposedPayload: z.record(z.unknown()),
  editableFields: z.array(z.string().min(1)).default([]),
  requiredPermissions: z.array(z.string().min(1)).default([]),
  requiresConfirmation: z.boolean(),
  dependencyActionIds: z.array(z.string().min(1)).default([]),
  status: proposedActionStatusSchema.default('proposed'),
  version: z.number().int().positive().default(1),
}).strict();

export const editProposedActionPayloadSchema = z.object({
  proposedPayload: z.record(z.unknown()),
  expectedVersion: z.number().int().positive(),
}).strict();

export const createActionExecutionPendingSchema = z.object({
  proposedActionId: z.string().min(1),
  idempotencyKey: z.string().min(1).max(500),
  approvedBy: z.string().min(1),
  executedBy: z.string().min(1).optional(),
  correlationId: z.string().min(8).max(100).optional(),
  commandPayload: z.record(z.unknown()),
  result: commandExecutionResultSchema.nullable().optional(),
  error: commandExecutionErrorSchema.nullable().optional(),
  createdObjectReferences: z.array(objectReferenceSchema).default([]),
  updatedObjectReferences: z.array(objectReferenceSchema).default([]),
  projectionLinks: z.array(projectionLinkSchema).default([]),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
}).strict();

export const approveProposedActionSchema = z.object({
  actionId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  approvedBy: z.string().min(1),
  organizationId: z.string().min(1),
}).strict();

export const rejectProposedActionSchema = z.object({
  actionId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  rejectedBy: z.string().min(1),
  organizationId: z.string().min(1),
  reason: z.string().max(1000).optional(),
}).strict();

export const executeApprovedActionSchema = z.object({
  actionId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  idempotencyKey: z.string().min(1).max(500),
  executedBy: z.string().min(1),
  organizationId: z.string().min(1),
}).strict();

export const conversationalAssessmentResultSchema = z.object({
  primaryIntent: copilotIntentSchema,
  secondaryIntents: z.array(copilotIntentSchema).default([]),
  operation: copilotOperationSchema,
  detectedEntities: z.record(z.unknown()).default({}),
  ambiguousObjects: z.array(objectReferenceSchema).default([]),
  missingInformation: z.array(z.string().min(1)).default([]),
  recommendedCapabilities: z.array(z.string().min(1)).default([]),
  assumptions: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  sourceReferences: z.array(sourceReferenceSchema).default([]),
  confidence: copilotConfidenceSchema,
  adapterType: copilotAdapterTypeSchema,
  rubricVersion: z.string().min(1).max(100),
  proposedPayload: z.record(z.unknown()).optional(),
  assistantMessage: z.string().min(1).max(4000),
}).strict();

export const createConversationHttpSchema = z.object({
  contextObjectType: z.string().min(1).max(100).optional(),
  contextObjectId: z.string().min(1).max(200).optional(),
}).strict();

export const sendMessageHttpSchema = z.object({
  content: z.string().trim().min(1).max(20000),
}).strict();

export const editProposedActionHttpSchema = z.object({
  expectedVersion: z.number().int().positive(),
  proposedPayload: z.record(z.unknown()),
}).strict();

export const approveActionHttpSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

export const rejectActionHttpSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().max(1000).optional(),
}).strict();

export const executeActionHttpSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();
