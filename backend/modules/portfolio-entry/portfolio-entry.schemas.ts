import { z } from 'zod';

export const sessionParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const criticalHandoffConfirmationParamsSchema = sessionParamsSchema.extend({
  artifactId: z.string().trim().min(1).max(128),
}).strict();

export const confirmedBriefIdentitySchema = z.object({
  source: z.literal('portfolio_entry'),
  sessionRevision: z.coerce.number().int().min(0),
  handoffId: z.string().min(1),
  handoffVersion: z.coerce.number().int().positive(),
  confirmationId: z.string().min(1),
  confirmationVersion: z.coerce.number().int().positive(),
}).strict();

export const createSessionBodySchema = z.object({
  sourceMetadata: z.record(z.unknown()).optional(),
}).strict().default({});

export const expectedRevisionSchema = z.object({
  expectedRevision: z.number().int().min(0),
});

export const submitMessageBodySchema = expectedRevisionSchema.extend({
  message: z.string().trim().min(1).max(8000),
  intent: z.enum(['answer', 'correction']).optional(),
  matchedQuestionIds: z.array(z.string().min(1)).max(1).optional(),
  respondedResolves: z.array(z.string().min(1)).max(20).optional(),
}).strict();

export const materializeHandoffBodySchema = expectedRevisionSchema.strict();

export const guidedExplorationBodySchema = expectedRevisionSchema.extend({
  choice: z.enum(['accept', 'provisional_route', 'reject']),
}).strict();

export const confirmationBodySchema = expectedRevisionSchema.extend({
  action: z.enum(['confirm', 'correct']),
  acceptedFields: z.array(z.string().min(1)).max(50).optional(),
  correctedFields: z.record(z.unknown()).optional(),
  rejectedFields: z.array(z.string().min(1)).max(50).optional(),
  notes: z.string().trim().max(4000).optional(),
}).strict();

export const criticalHandoffConfirmationBodySchema = z.object({
  action: z.literal('confirm'),
  expectedArtifactVersion: z.number().int().positive(),
  expectedContextRevision: z.number().int().min(0),
}).strict();

export const claimBodySchema = expectedRevisionSchema.strict();
export const abandonBodySchema = expectedRevisionSchema.strict();

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
export type SubmitMessageBody = z.infer<typeof submitMessageBodySchema>;
export type GuidedExplorationBody = z.infer<typeof guidedExplorationBodySchema>;
export type MaterializeHandoffBody = z.infer<typeof materializeHandoffBodySchema>;
export type ConfirmationBody = z.infer<typeof confirmationBodySchema>;
export type CriticalHandoffConfirmationBody = {
  action: 'confirm';
  expectedArtifactVersion: number;
  expectedContextRevision: number;
};
export type ClaimBody = z.infer<typeof claimBodySchema>;
export type ConfirmedBriefIdentity = z.infer<typeof confirmedBriefIdentitySchema>;
