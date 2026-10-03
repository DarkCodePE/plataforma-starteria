import { z } from 'zod';

export const continuePortfolioEntryBodySchema = z.object({
  expectedRevision: z.number().int().min(0),
  organizationId: z.string().min(1).optional(),
}).strict();

export const continuationParamsSchema = z.object({
  continuationId: z.string().min(1),
});

export const scopedEntryIdentitySchema = z.object({
  source: z.literal('portfolio_entry'),
  sessionId: z.string().uuid(),
  sessionRevision: z.number().int().min(0),
  handoffId: z.string().min(1),
  handoffVersion: z.number().int().positive(),
  confirmationId: z.string().min(1),
  confirmationVersion: z.number().int().positive(),
}).strict();

export type ContinuePortfolioEntryBody = z.infer<typeof continuePortfolioEntryBodySchema>;

export const portfolioContextParamsSchema = z.object({
  sessionId: z.string().min(1),
});
