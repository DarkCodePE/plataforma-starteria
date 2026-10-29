import { z } from 'zod/v3';

export const createCheckpointSchema = z.object({
  body: z.object({
    projectId: z.string().cuid(),
    stepNumber: z.number().int().refine((n) => [0, 2, 4].includes(n), {
      message: 'Checkpoint solo disponible en steps 0, 2 y 4',
    }),
    sponsorId: z.string().cuid(),
    expiresInHours: z.number().int().min(1).max(168).default(72),
  }),
});

export const respondCheckpointSchema = z.object({
  body: z.object({
    alignmentSignal: z.enum(['ALIGNED', 'CONCERNS', 'PIVOT_SUGGESTED']),
    strategicFeedback: z.string().max(2000).optional(),
    focusRecommendation: z.string().max(1000).optional(),
  }),
});

export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>['body'];
export type RespondCheckpointInput = z.infer<typeof respondCheckpointSchema>['body'];
