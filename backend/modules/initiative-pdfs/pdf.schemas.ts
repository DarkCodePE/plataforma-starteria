import { z } from 'zod/v3';

/**
 * Zod schemas for the initiative-pdfs module.
 *
 * All schemas are applied at the HTTP boundary (controller / multer middleware).
 * Internal service callers receive already-parsed input.
 *
 * Cuid is used for projectId because the Prisma `Project` model uses cuid().
 * Uuid is used for pdfId / runId because the PDF models use uuid().
 */

const CUID = /^c[a-z0-9]{20,30}$/i;
const cuidString = () => z.string().regex(CUID, 'projectId debe ser un cuid valido');

export const ALLOWED_PDF_MIME = 'application/pdf';
export const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB (PRD-002 NFR)

export const projectIdParam = z.object({
  id: cuidString(),
});

export const pdfIdParam = z.object({
  id: cuidString(),
  pdfId: z.string().uuid('pdfId debe ser uuid'),
});

export const runIdParam = z.object({
  id: cuidString(),
  runId: z.string().uuid('runId debe ser uuid'),
});

export const proposalParam = z.object({
  id: cuidString(),
  runId: z.string().uuid('runId debe ser uuid'),
  fieldPath: z.string().min(1).max(255),
});

export const extractRequestSchema = z
  .object({
    targetStep: z
      .enum(['step_0', 'step_1', 'step_2', 'step_3', 'step_4'])
      .optional(),
    language: z.enum(['es', 'en']).optional(),
  })
  .strict();

// Query for `GET /initiatives/:id/autofill-proposals` — optional runId filter.
// `.strict()` so unknown query params are rejected at the boundary.
export const listProposalsQuerySchema = z
  .object({
    runId: z.string().uuid('runId debe ser uuid').optional(),
  })
  .strict();

export const editProposalSchema = z
  .object({
    finalValue: z.unknown(),
  })
  .strict();

export type ExtractRequestInput = z.infer<typeof extractRequestSchema>;
export type EditProposalInput = z.infer<typeof editProposalSchema>;
