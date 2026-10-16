/**
 * Router for the initiative-pdfs module (TASK-006 / SPEC-002).
 *
 * Mounted at `/api/v1/initiatives/:id/pdfs` from `backend/app.ts`.
 *
 * The upload route uses `express.raw({ type: 'application/pdf' })` instead of
 * multer to avoid pulling a new dep. Clients send the PDF bytes directly as
 * the request body with `Content-Type: application/pdf` and the original
 * filename in the `X-File-Name` header. This is V1 — TASK-009 will adjust the
 * frontend dropzone to match this contract.
 */

import express, { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { config } from '../../config';
import { authenticate } from '../auth/auth.middleware';
import { requireProjectTeamAccess } from '../projects/project-team-access';
import { requireEntitlement } from '../billing/entitlement.middleware';
import { validate } from '../../shared/middleware/validate';
import { LocalDiskPdfStorage } from './storage.service';
import { AiServiceClient } from './ai-client';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import {
  MAX_PDF_BYTES,
  ALLOWED_PDF_MIME,
  extractRequestSchema,
  editProposalSchema,
  listProposalsQuerySchema,
} from './pdf.schemas';

// Composition root for the module — wired once at import time.
const storage = new LocalDiskPdfStorage(config.localStorageDir);
const aiClient = new AiServiceClient({
  baseUrl: config.aiServiceUrl,
  token: config.aiServiceToken,
});
const service = new PdfService(prisma, storage, aiClient);
const controller = new PdfController(service);

export const pdfRouter = Router({ mergeParams: true });

pdfRouter.use(authenticate);

// Antes sólo pedía sesión: cualquier usuario logueado podía subir, extraer o confirmar
// propuestas en una iniciativa ajena con su ID. Leer: el equipo y el Portfolio Lead asignado;
// subir, extraer y resolver propuestas: OWNER o EDITOR (igual que el resto del trabajo de Steps).
const canRead = requireProjectTeamAccess(prisma, 'read', 'id');
const canWrite = requireProjectTeamAccess(prisma, 'write', 'id');

// 1. Upload PDF (multipart-free — body is the raw PDF stream).
pdfRouter.post(
  '/:id/pdfs',
  canWrite,
  express.raw({ type: ALLOWED_PDF_MIME, limit: MAX_PDF_BYTES }),
  controller.upload,
);

// 2. Trigger extraction against the ai-service.
// PRD-005 / ADR-020: meter `pdf_extract` (real LLM cost). Shadow mode by default —
// metered on a successful (2xx) trigger response; ideal terminal-webhook metering
// is a future hardening (SPEC-005 §metering).
pdfRouter.post(
  '/:id/pdfs/:pdfId/extract',
  canWrite,
  requireEntitlement('pdf_extract'),
  validate(extractRequestSchema),
  controller.startExtraction,
);

// 3. Poll run state.
pdfRouter.get('/:id/pdfs/runs/:runId', canRead, controller.getRun);

// 4. List proposals for a completed run.
pdfRouter.get('/:id/pdfs/runs/:runId/proposals', canRead, controller.listProposals);

// 4b. Project-scoped proposal listing used by the frontend hydration path.
//     `?runId=...` (optional) filters to a single run; omit it to fetch
//     proposals across ALL completed runs for the project. Distinct from
//     route 4 above which is run-scoped and returns the `{ proposals, meta }`
//     envelope used by internal/test consumers.
pdfRouter.get(
  '/:id/autofill-proposals',
  canRead,
  validate(listProposalsQuerySchema, 'query'),
  controller.listProposalsByProject,
);

// 5. Confirm a proposal (proposedValue → finalValue).
pdfRouter.post('/:id/pdfs/runs/:runId/proposals/:fieldPath/confirm', canWrite, controller.confirmProposal);

// 6. Edit a proposal with a founder-supplied finalValue.
pdfRouter.post(
  '/:id/pdfs/runs/:runId/proposals/:fieldPath/edit',
  canWrite,
  validate(editProposalSchema),
  controller.editProposal,
);

// 7. Discard a proposal (status = DISCARDED).
pdfRouter.post(
  '/:id/pdfs/runs/:runId/proposals/:fieldPath/discard',
  canWrite,
  controller.discardProposal,
);

// Export the service for use by other modules (portfolio guard, sweepers, etc).
export { service as initiativePdfService };
