import { createHash, createHmac } from 'node:crypto';

const CONTEXT = 'starteria:pilot-lead-code:v2';

/**
 * Deterministic, high-entropy bearer for an idempotent draft submission.
 * The HMAC key is an independent server secret; only a one-way hash is stored.
 */
export function derivePilotCode(draftId: string, secret: string): string {
  const digest = createHmac('sha256', secret)
    .update(CONTEXT)
    .update('\0')
    .update(draftId)
    .digest('hex')
    .toUpperCase();
  return `ST-PILOT-${digest}`;
}

export function hashPilotCode(rawCode: string): string {
  return createHash('sha256').update(rawCode).digest('hex');
}
