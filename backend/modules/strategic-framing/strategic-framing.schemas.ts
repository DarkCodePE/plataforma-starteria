import { z } from 'zod/v3';

export const strategicFramingStateParamsSchema = z.object({
  stateId: z.string().trim().min(1),
});

const nullableText = z.string().nullable().optional();

export const strategicFramingCorrectionBodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  intendedMovement: nullableText,
  whyItMatters: nullableText,
  movementSignalStatus: z.enum(['confirmed', 'proxy', 'suggested', 'unknown', 'conflicting']).nullable().optional(),
  movementSignalValue: nullableText,
  horizonContext: nullableText,
  decisionToEnable: nullableText,
  subjectLevel: z.enum(['front_like', 'challenge_like', 'initiative_like', 'unresolved']).optional(),
  parentStatus: z.enum(['known', 'provisional', 'unresolved']).optional(),
  parentLabel: nullableText,
  reason: nullableText,
}).strict();

export type StrategicFramingCorrectionBody = z.infer<typeof strategicFramingCorrectionBodySchema>;
