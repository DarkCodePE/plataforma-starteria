import { z } from 'zod/v3';

export const convertPortfolioEntryBodySchema = z.object({
  expectedRevision: z.number().int().min(0),
}).strict();

export type ConvertPortfolioEntryBody = z.infer<typeof convertPortfolioEntryBodySchema>;
