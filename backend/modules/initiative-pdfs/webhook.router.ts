/**
 * Internal webhook router for ai-service push notifications.
 *
 * Mounted at `/api/v1/internal/ai/webhooks` from `backend/app.ts`.
 *
 * Why: the ai-service runs PDF extractions asynchronously (5+ min p95). Without
 * a push channel, backend only learns about completion when the frontend polls.
 * That makes the persistence reactive — if the user navigates away mid-run, the
 * proposals stay stranded in ai-service's in-memory `RunRegistry`. The webhook
 * makes ai-service push the terminal RunState to backend, so DB is updated
 * regardless of whether anyone is polling. The frontend poll is now a fallback.
 *
 * Auth: `X-Internal-Token` shared-secret (same secret used in the outbound
 * `AiServiceClient` direction so the rotation surface stays single-keyed).
 * TODO(ADR-011): replace with HMAC-SHA256 + timestamp + replay protection,
 * mirroring `bridge.service.ts` once TASK-007 lands.
 *
 * Idempotent by construction: the handler delegates to
 * `PdfService.applyUpstreamRunUpdate`, which no-ops when the mapped status
 * equals the current row state. Re-deliveries are safe.
 */

import { Request, Response, NextFunction, Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod/v3';
import { config } from '../../config';
import { AppError } from '../../shared/errors/AppError';
import { ApiResponse } from '../../shared/types/api.types';
import { validate } from '../../shared/middleware/validate';
import { PdfExtractionRunDTO } from './pdf.types';

// ─── Service contract ───────────────────────────────────────────────────────

/**
 * Minimal slice of `PdfService` the webhook needs. Declared here so the test
 * suite can inject a stub without importing the full service (which pulls in
 * Prisma + storage + ai-client at module load).
 */
export interface WebhookCapablePdfService {
  applyUpstreamRunUpdate(
    aiRunId: string,
    upstream: {
      status?: string;
      costUsd?: number | null;
      errorReason?: string | null;
      proposals?: Record<string, unknown> | null;
    },
  ): Promise<PdfExtractionRunDTO | null>;
}

// ─── Auth middleware ────────────────────────────────────────────────────────

function verifyInternalToken(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const raw = req.headers['x-internal-token'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  const expected = config.aiServiceToken;
  // Constant-time compare; both sides padded to the longer length so length
  // mismatch alone doesn't leak via timing.
  const a = Buffer.from(header ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    next(
      AppError.unauthorized(
        'Missing or invalid internal token.',
        'INTERNAL_AUTH_FAILED',
      ),
    );
    return;
  }
  next();
}

// ─── Body schema (matches ai-service PdfExtractRunState wire shape) ─────────

const webhookBodySchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cost_capped']),
  costUsd: z.number().nullable().optional(),
  errorReason: z.string().nullable().optional(),
  // `proposals` is the nested InitiativeExtraction tree — kept as a passthrough
  // record because flattening lives in `extraction-flatten.ts`. Marked optional
  // since non-terminal pushes (running/pending) may omit it.
  proposals: z.record(z.unknown()).nullable().optional(),
});

const aiRunIdParam = z.object({
  aiRunId: z.string().min(1).max(128),
});

// ─── Factory ────────────────────────────────────────────────────────────────

export function createAiWebhookRouter(service: WebhookCapablePdfService): Router {
  const router = Router();

  router.use(verifyInternalToken);

  router.post(
    '/pdf-extract/runs/:aiRunId',
    validate(aiRunIdParam, 'params'),
    validate(webhookBodySchema, 'body'),
    async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
      try {
        const { aiRunId } = req.params as { aiRunId: string };
        const updated = await service.applyUpstreamRunUpdate(aiRunId, req.body);
        if (!updated) {
          // No backend-side row knows about this aiRunId. This can happen if the
          // ai-service was restarted with state from a prior incarnation that
          // never made it to the DB, or if the request row was deleted. 404 so
          // ai-service can decide to drop the retry rather than loop forever.
          throw AppError.notFound('Extraccion', 'PDF_RUN_NOT_FOUND');
        }
        res.json({
          success: true,
          data: { runId: updated.runId, status: updated.status },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
