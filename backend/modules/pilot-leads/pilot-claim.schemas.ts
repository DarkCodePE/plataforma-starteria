/**
 * Zod contracts + constants for the pilot-claim flow (ADR-018).
 *
 * Redeeming a pilot code mints a single-use claim token; after the user
 * authenticates, the token is consumed to import the lead's proposal into a
 * Project. The pilotCode param validation is reused from pilot-lead.schemas.
 */
import { z } from 'zod/v3';

export { pilotCodeParamSchema } from './pilot-lead.schemas';

/** Claim token lifetime: long enough to sign up / log in, short enough to limit reuse. */
export const CLAIM_TTL_MS = 15 * 60 * 1000;

/** Body for consuming a claim (post-auth). The opaque token is high-entropy hex. */
export const claimConsumeBodySchema = z.object({
  claimToken: z.string().trim().min(32).max(200),
});

export type ClaimConsumeBody = z.infer<typeof claimConsumeBodySchema>;
