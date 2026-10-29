import { z } from 'zod/v3';
import api, { parseApiError } from '../../../app/services/api';

const carriedField = z.object({ text: z.string(), sourceRef: z.string(),
  origin: z.enum(['USER_DECLARED', 'EXTRACTED_FROM_USER_TEXT', 'AI_INFERRED', 'AI_SUGGESTED']),
  truthClass: z.enum(['PROVISIONAL_USER_CONTEXT', 'CONFIRMED_REPRESENTATION', 'ORGANIZATIONAL_AUTHORITY_REQUIRED']),
}).strict();

export const portfolioSetupHomeArrivalSchema = z.object({
  dtoVersion: z.literal('portfolio-setup-home-arrival-v0.1'),
  snapshotId: z.string().min(1), snapshotGeneration: z.number().int().positive(), sessionId: z.string().min(1),
  organization: z.object({ id: z.string().min(1), name: z.string() }).strict(),
  source: z.object({ contextRevision: z.number().int().nonnegative(), criticalHandoffId: z.string().min(1),
    criticalHandoffVersion: z.number().int().positive() }).strict(),
  continuationProfile: z.object({ value: z.literal('PORTFOLIO_LEAD_ENTRY'), version: z.literal(1) }).strict(),
  carriedContext: z.object({ criticalReading: carriedField.optional(), decisionFrame: carriedField.optional(),
    knownContext: z.array(carriedField).max(10).optional(), confirmedRepresentation: carriedField.optional(),
    firstMoveSuggestion: carriedField.optional() }).strict().nullable(),
  openItems: z.array(z.object({ sourceRef: z.string(), kind: z.enum([
    'SOURCE_CURRENTNESS_BLOCKER', 'ACCESS_SCOPE_BLOCKER', 'ORGANIZATIONAL_AUTHORITY_BLOCKER',
    'EXTERNAL_EVIDENCE_BLOCKER', 'DOWNSTREAM_NON_BLOCKING']), description: z.string(),
    impact: z.string().optional(), evidenceRequired: z.string().optional(), status: z.string().optional(),
    nextOwner: z.string().optional() }).strict()).max(20),
  currentness: z.literal('REVALIDATED_AT_HOME_ARRIVAL'), bootstrapEligible: z.literal(true),
}).strict();
export type PortfolioSetupHomeArrival = z.infer<typeof portfolioSetupHomeArrivalSchema>;

export class PortfolioSetupArrivalError extends Error {
  constructor(public readonly code: string, public readonly status: number | undefined) {
    super(code);
  }
}

export async function readPortfolioSetupHomeArrival(snapshotId: string): Promise<PortfolioSetupHomeArrival> {
  try {
    const { data } = await api.get<{ success: true; data: unknown }>(
      `/public/portfolio-entry/continuations/${encodeURIComponent(snapshotId)}/portfolio-home-arrival`);
    return portfolioSetupHomeArrivalSchema.parse(data.data);
  } catch (error) {
    if (error instanceof z.ZodError) throw new PortfolioSetupArrivalError('INVALID_RESPONSE', undefined);
    const parsed = parseApiError(error);
    const status = (error as { response?: { status?: number } })?.response?.status;
    throw new PortfolioSetupArrivalError(parsed.code ?? 'VALIDATION_FAILED', status);
  }
}
