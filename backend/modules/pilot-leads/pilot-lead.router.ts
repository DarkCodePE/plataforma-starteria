/**
 * Router for the PUBLIC (no-auth) pilot-lead capture surface.
 *
 * Mounted at `/api/v1/public/pilot-leads` from `backend/app.ts`. NO
 * `authenticate` middleware — anonymous landing visitors submit interest in the
 * pilot. Guardrails: per-IP rate limiting (in-memory; same pattern as the
 * public PDF router) + Zod validation in the controller.
 *
 * Route: POST / → persist lead → 201 { id, pilotCode, status, createdAt }
 */
import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../../shared/db/prisma';
import { AppError } from '../../shared/errors/AppError';
import { authenticate } from '../auth/auth.middleware';
import { PilotLeadService, type PilotLeadStore } from './pilot-lead.service';
import {
  createEmailPilotLeadNotifier,
  createApplicantConfirmationNotifier,
  combinePilotLeadNotifiers,
} from './pilot-lead.notifier';
import { PilotLeadController } from './pilot-lead.controller';
import {
  PilotClaimService,
  type PilotClaimStore,
} from './pilot-claim.service';
import { PilotClaimController } from './pilot-claim.controller';
import { createPilotProject } from './pilot-project-creator';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Minimal in-memory per-IP rate limiter (dep-free), mirrors public-pdf. */
function createIpRateLimiter(windowMs: number, maxRequests: number): RequestHandler {
  const store = new Map<string, RateLimitEntry>();
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 60_000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }
    entry.count++;
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', String(retryAfter));
      next(AppError.rateLimited(retryAfter));
      return;
    }
    next();
  };
}

export interface PilotLeadRouterOptions {
  /** Override the per-IP submit cap (tests use a high value). */
  maxRequests?: number;
  /** Override the rate-limit window. */
  windowMs?: number;
}

/** Optional claim-flow wiring (ADR-018). Injected so tests can stub auth + service. */
export interface PilotLeadRouterDeps {
  claimController?: PilotClaimController;
  /** Auth middleware guarding the (authenticated) consume route. Defaults to the real one. */
  authenticate?: RequestHandler;
}

/** Build the router around an injected service (tests inject a mocked store). */
export function buildPilotLeadRouter(
  service: PilotLeadService,
  options: PilotLeadRouterOptions = {},
  deps: PilotLeadRouterDeps = {},
): Router {
  const controller = new PilotLeadController(service);
  const router = Router();
  const limiter = createIpRateLimiter(options.windowMs ?? 10 * 60_000, options.maxRequests ?? 15);
  router.post('/', limiter, controller.create);
  // Redeem a high-entropy pilot bearer. Rate limiting remains defense in depth.
  router.get('/:pilotCode', limiter, controller.resume);

  // Pilot-claim flow (ADR-018): redeem code → claim token → (auth) → create project.
  if (deps.claimController) {
    const auth = deps.authenticate ?? authenticate;
    // Anonymous + rate-limited: mints a single-use claim token (no PII returned).
    router.post('/:pilotCode/claim', limiter, deps.claimController.issue);
    // Authenticated: consumes the claim and creates the user's project.
    router.post('/consume-claim', auth, deps.claimController.consume);
  }
  return router;
}

/**
 * Production notifier (issue #54): on each new lead, fires two best-effort
 * emails over SMTP — (1) the team inbox (PILOT_LEAD_NOTIFY_TO) gets an actionable
 * notification, (2) the applicant gets a confirmation of their submission (the
 * UI's "te enviaremos una confirmación" promise). Each is independent: one
 * failing never blocks the other. Both degrade to a non-PII log line when
 * SMTP/recipients are unset (dev/test default).
 */
export const pilotLeadService = new PilotLeadService(
  prisma as unknown as PilotLeadStore,
  combinePilotLeadNotifiers(
    createEmailPilotLeadNotifier(),
    createApplicantConfirmationNotifier(),
  ),
);

/**
 * Pilot-claim wiring (ADR-018). Creating the project reuses ProjectService
 * (createProject + updateStep0) and the server-ported proposal→Step0 mapper;
 * the project is stamped with `pilotLeadId` so the flow is idempotent.
 */
export const pilotClaimService = new PilotClaimService(
  prisma as unknown as PilotClaimStore,
  createPilotProject,
);
export const pilotClaimController = new PilotClaimController(pilotClaimService);

export const pilotLeadRouter = buildPilotLeadRouter(pilotLeadService, {}, { claimController: pilotClaimController });
