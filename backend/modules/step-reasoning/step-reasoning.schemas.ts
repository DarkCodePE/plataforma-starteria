import { z } from 'zod';

export const stepReasoningTurnSchema = z.object({
  sessionId: z.string().cuid().optional(),
  clientTurnId: z.string().uuid(),
  expectedCycleId: z.string().min(1).optional(),
  expectedContextHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  message: z.string().trim().min(1).max(8_000),
  mode: z.enum(['orient', 'work_with_me', 'unblock']).default('work_with_me'),
  retryFailed: z.boolean().default(false),
}).strict();

export const stepReasoningSuggestionSchema = z.object({
  field: z.string().trim().min(1).max(120),
  proposedValue: z.string().trim().min(1).max(4_000),
  rationale: z.string().trim().min(1).max(2_000),
  status: z.literal('UNREVIEWED'),
  sourceRefs: z.array(z.string().trim().min(1).max(240)).max(12).default([]),
}).strict();

export const stepReasoningAiResponseSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  nextInteraction: z.object({
    kind: z.enum(['ask', 'reflect', 'summarize']),
    question: z.string().trim().min(1).max(2_000),
  }).strict(),
  known: z.array(z.string().trim().min(1).max(2_000)).max(12),
  unknown: z.array(z.string().trim().min(1).max(2_000)).max(12),
  contradictions: z.array(z.string().trim().min(1).max(2_000)).max(8),
  suggestions: z.array(stepReasoningSuggestionSchema).max(8),
  warnings: z.array(z.string().trim().min(1).max(2_000)).max(8),
  isReadyForHumanReview: z.boolean(),
  model: z.string().trim().min(1).max(240),
  promptVersion: z.literal('steps/reasoning/v0.1'),
  promptHash: z.string().trim().min(1).max(160),
  providerRunId: z.string().trim().max(240).nullable().optional(),
  tokensUsed: z.number().int().nonnegative().nullable().optional(),
  costUsd: z.number().nonnegative().max(0.05).nullable().optional(),
  latencyMs: z.number().int().nonnegative().nullable().optional(),
}).strict().superRefine((value, ctx) => {
  const serialized = JSON.stringify(value).toUpperCase();
  for (const forbidden of ['USER_CONFIRMED', 'CHECKPOINT_CONFIRMED', 'EXECUTE_COMMAND']) {
    if (serialized.includes(forbidden)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Forbidden authority token: ${forbidden}` });
    }
  }
});

export type StepReasoningTurnInput = z.infer<typeof stepReasoningTurnSchema>;
export type StepReasoningAiResponse = z.infer<typeof stepReasoningAiResponseSchema>;

