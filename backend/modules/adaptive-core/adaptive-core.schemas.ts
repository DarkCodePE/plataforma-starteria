import { z } from 'zod/v3';

export const checkpointResponseSchema = z.object({
  idempotencyKey: z.string().min(6),
  checkpointKey: z.string().min(1),
  responses: z.record(z.unknown()).default({}),
  truthBindings: z.object({
    claimId: z.string().min(1),
    evidenceIds: z.array(z.string().min(1)).min(1),
    sourceRefIds: z.array(z.string().min(1)).min(1),
  }).optional(),
  evidenceBindings: z.object({
    evidenceIds: z.array(z.string().min(1)).min(1),
    sourceRefIds: z.array(z.string().min(1)).min(1),
  }).optional(),
  confirmedAt: z.string().datetime().optional(),
});

export const criticalChangeSchema = z.object({
  idempotencyKey: z.string().min(6),
  field: z.enum(['scope', 'company_or_area', 'challenge_type', 'route', 'hypothesis', 'target_date', 'critical_restriction', 'selected_bet']),
  previousValue: z.unknown().optional(),
  nextValue: z.unknown(),
  reason: z.string().min(1).optional(),
  confirmed: z.boolean().default(false),
  action: z.enum(['update_route', 'keep_previous_route', 'split_phases', 'back_and_edit', 'return_to_prior_direction']).default('update_route'),
  basedOnCycleId: z.string().min(1).optional(),
  reentryStep: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable().optional(),
});

export const confirmCriticalChangeTransitionSchema = z.object({
  idempotencyKey: z.string().min(6),
  confirmed: z.boolean(),
  basedOnCycleId: z.string().min(1).optional(),
  confirmedReentryStep: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable().optional(),
});

export const decisionReadinessQuerySchema = z.object({
  decisionType: z.enum(['continue_experimenting', 'implement', 'scale', 'pause', 'close_with_learning']),
});

export const decisionAuthorityQuerySchema = decisionReadinessQuerySchema;

export const decisionRequestCreateSchema = z.object({
  idempotencyKey: z.string().min(6),
}).strict();

export const organizationalDecisionSchema = z.object({
  idempotencyKey: z.string().min(6),
  outcome: z.enum(['continue_experimenting', 'implement', 'scale', 'pause', 'close_with_learning']),
  rationale: z.string().trim().min(1),
  acceptedConditionCodes: z.array(z.string().min(1)).optional().default([]),
}).strict();

export const applyDecisionEffectsSchema = z.object({
  idempotencyKey: z.string().min(6).optional(),
}).strict();

export const confirmBriefSchema = z.object({
  idempotencyKey: z.string().min(6),
  brief: z.record(z.unknown()),
  confirmed: z.boolean(),
});

export type CheckpointResponseInput = z.infer<typeof checkpointResponseSchema>;
export type CriticalChangeInput = z.infer<typeof criticalChangeSchema>;
export type ConfirmCriticalChangeTransitionInput = z.infer<typeof confirmCriticalChangeTransitionSchema>;
export type DecisionReadinessQueryInput = z.infer<typeof decisionReadinessQuerySchema>;
export type DecisionAuthorityQueryInput = z.infer<typeof decisionAuthorityQuerySchema>;
export type DecisionRequestCreateInput = z.infer<typeof decisionRequestCreateSchema>;
export type OrganizationalDecisionInput = z.infer<typeof organizationalDecisionSchema>;
export type ApplyDecisionEffectsInput = z.infer<typeof applyDecisionEffectsSchema>;
export type ConfirmBriefInput = z.infer<typeof confirmBriefSchema>;
export type ConfirmStep1OutputInput = z.infer<typeof confirmBriefSchema>;
export type ConfirmStep2OutputInput = z.infer<typeof confirmBriefSchema>;
export type ConfirmStep3OutputInput = z.infer<typeof confirmBriefSchema>;
export type ConfirmStep4OutputInput = z.infer<typeof confirmBriefSchema>;
