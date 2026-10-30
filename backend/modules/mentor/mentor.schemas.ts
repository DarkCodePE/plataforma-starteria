import { z } from 'zod/v3';

export const submitReviewSchema = z.object({
  decision: z.enum(['Aprobado', 'Iterar', 'Bloqueado']),
  summary: z.string().min(10).max(2000),
  goodPoints: z.array(z.string()).optional().default([]),
  missing: z.array(z.string()).optional().default([]),
  actions: z.array(z.string()).optional().default([]),
  questions: z.array(z.string()).optional().default([]),
  rubricScores: z.record(z.number().min(1).max(5)).optional(),
});

export const helpRequestSchema = z.object({
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(2000),
  stepNumber: z.number().int().min(1).max(4).optional(),
  moduleId: z.string().optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type HelpRequestInput = z.infer<typeof helpRequestSchema>;
