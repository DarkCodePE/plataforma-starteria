import { z } from 'zod/v3';

export const portfolioLabRequestBodySchema = z.object({
  challengeId: z.string().trim().min(1).max(191),
  briefId: z.string().trim().min(1).max(191),
  briefVersionId: z.string().trim().min(1).max(191),
  consentAccepted: z.literal(true),
  consentPurpose: z.string().trim().min(10).max(500),
}).strict();

export const portfolioLabRequestParamsSchema = z.object({
  requestId: z.string().trim().min(1).max(191),
}).strict();

export const portfolioLabTerminalStatusBodySchema = z.object({
  status: z.enum(['CLOSED', 'NOT_PROCEEDING', 'CANCELLED']),
}).strict();
