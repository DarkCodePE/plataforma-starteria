import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { corsOptions } from './config/cors';
import { config } from './config';
import { requestId } from './shared/middleware/request-id';
import { errorHandler } from './shared/errors/error-handler';
import { logger } from './shared/utils/logger';
import { AppError } from './shared/errors/AppError';

import { authRouter } from './modules/auth/auth.router';
import { projectRouter } from './modules/projects/project.router';
import { stepRouter } from './modules/steps/step.router';
import { evidenceRouter } from './modules/evidence/evidence.router';
import { mentorRouter } from './modules/mentor/mentor.router';
import { cohortRouter } from './modules/cohort/cohort.router';
import { userRouter, teamRouter } from './modules/users/user.router';
import { helpRouter } from './modules/mentor/mentor.router';
import { sponsorRouter } from './modules/sponsor/sponsor.router';
import { portfolioRouter } from './modules/portfolio/portfolio.router';
import { initialReviewRouter } from './modules/initial-review/initial-review.router';
import { pdfRouter, initiativePdfService } from './modules/initiative-pdfs/pdf.router';
import { publicPdfRouter } from './modules/initiative-pdfs/public-pdf.router';
import { pilotLeadRouter } from './modules/pilot-leads';
import { refineFieldRouter } from './modules/public-ai';
import { portfolioEntryRouter } from './modules/portfolio-entry';
import { portfolioBootstrapRouter } from './modules/portfolio-bootstrap';
import { createAiWebhookRouter } from './modules/initiative-pdfs/webhook.router';
import { billingRouter } from './modules/billing/billing.router';
import { aiRouter } from './modules/ai';
import { companyRouter, initiativeContextRouter } from './modules/companies/company.router';
import { copilotRouter } from './modules/copilot/copilot.router';
import { copilotReadinessHandler } from './modules/copilot/copilot-readiness';
import { truthRouter } from './modules/truth/truth.router';
import { strategicFramingRouter } from './modules/strategic-framing/strategic-framing.router';
import { portfolioHandoffInvitationRouter, portfolioHandoffDeliveryRouter, portfolioHandoffResponseRouter } from './modules/portfolio-handoff/portfolio-handoff-invitation.router';
import { firstValueP3Router } from './modules/first-value-p3/first-value-p3.router';
import { reconstructionRouter } from './modules/reconstruction/reconstruction.router';

export function createApp() {
  const app = express();

  // Global middleware
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(pinoHttp({ logger }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/api/readiness/copilot', copilotReadinessHandler);

  // API v1 routes
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/projects', projectRouter);
  app.use('/api/v1/projects', stepRouter);
  app.use('/api/v1/projects', evidenceRouter);
  app.use('/api/v1/mentor', mentorRouter);
  app.use('/api/v1/admin', cohortRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/projects', teamRouter);
  app.use('/api/v1/projects', helpRouter);
  app.use('/api/v1/sponsor', sponsorRouter);
  app.use('/api/v1/portfolio', portfolioRouter);
  app.use('/api/v1', firstValueP3Router);
  app.use('/api/v1/copilot', copilotRouter);
  app.use('/api/v1/truth', truthRouter);
  app.use('/api/v1/initial-reviews', initialReviewRouter);
  app.use('/api/v1/companies', companyRouter);
  // PRD-005 / issue #85: AUTHENTICATED AI bridge (refine-field). Same ai-service
  // contract as the public path, but behind `authenticate` so usage is
  // attributable to a user and metered by the entitlement layer (`ai_refine`,
  // shadow mode until BILLING_ENFORCEMENT_ENABLED flips).
  app.use('/api/v1/ai', aiRouter);
  // TASK-006: PDF storage + extraction routes mirror evidence/step registration.
  app.use('/api/v1/initiatives', pdfRouter);
  app.use('/api/v1/initiatives', initiativeContextRouter);
  app.use('/api/v1/initiatives', reconstructionRouter);
  // issue #23: PUBLIC (no-auth) PDF extraction for the anonymous landing flow.
  // Hardened, Project-row-free, Step0-scoped, PII-redaction-enforced. NO
  // `authenticate` middleware — guardrails live in the router/multipart layer.
  app.use('/api/v1/public/pdf-extract', publicPdfRouter);
  // PRD-003 / ADR-015: PUBLIC (no-auth) pilot-lead capture for the landing
  // pivot. Persists anonymous "interés en piloto" (PII + consent) — replaces the
  // public draft→project conversion. Rate-limited; no `authenticate`.
  app.use('/api/v1/public/pilot-leads', pilotLeadRouter);
  // ADR-016: PUBLIC (no-auth) field-refinement bridge → ai-service LangChain
  // chain (ADR-006). Rate-limited (cost cap proxy); HMAC/X-Internal-Token to the
  // ai-service. On failure the frontend falls back to a local heuristic.
  app.use('/api/v1/public/refine-field', refineFieldRouter);
  app.use('/api/v1/public/portfolio-entry', portfolioEntryRouter);
  app.use('/api/v1/portfolio-bootstrap', portfolioBootstrapRouter);
  app.use('/api/v1/strategic-framing', strategicFramingRouter);
  app.use('/api/v1/public/handoff-invitations', portfolioHandoffInvitationRouter);
app.use('/api/v1/portfolio/handoff-assignments', portfolioHandoffDeliveryRouter);
app.use('/api/v1/handoff/assignments', portfolioHandoffResponseRouter);
  // Internal ai-service → backend push channel (X-Internal-Token only; no JWT).
  // Lets ai-service notify backend the moment an extraction finishes so the DB is
  // updated even when no frontend client is actively polling.
  app.use('/api/v1/internal/ai/webhooks', createAiWebhookRouter(initiativePdfService));
  // PRD-005 / ADR-021: provider-agnostic billing webhooks (Culqi/MercadoPago/Yape/
  // Manual). Internal class (X-Internal-Token + per-provider signature), no JWT —
  // same auth class as the ai-service webhook above. Idempotent (ADR-020).
  app.use('/api/v1/internal/billing', billingRouter);

  // 404 handler
  app.use((_req, _res, next) => {
    next(AppError.notFound('Ruta'));
  });

  // Error handler
  app.use(errorHandler);

  return app;
}
