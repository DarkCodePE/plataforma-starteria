import { z } from 'zod/v3';

export const cohortIdParam = z.object({
  id: z.string().uuid(),
});

export const cohortQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
  includeEvidence: z.coerce.boolean().default(false),
});

export type CohortQuery = z.infer<typeof cohortQuerySchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
