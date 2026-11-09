import { z } from 'zod/v3';

export const createPortfolioAttentionSchema = z.object({
  category: z.string().trim().min(3).max(80),
  reason: z.string().trim().min(3).max(2000),
  exitCondition: z.string().trim().min(3).max(2000),
  nextAction: z.string().trim().min(3).max(2000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  ownerId: z.string().trim().min(1).optional().nullable(),
}).strict();

export const portfolioAttentionActionSchema = z.object({
  action: z.enum(['acknowledge', 'assign', 'respond', 'escalate', 'resolve', 'cancel', 'reopen']),
  expectedVersion: z.number().int().nonnegative(),
  assigneeId: z.string().trim().min(1).optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();
