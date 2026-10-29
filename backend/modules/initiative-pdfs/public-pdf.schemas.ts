import { z } from 'zod/v3';

/**
 * Zod schemas + guardrail constants for the PUBLIC (no-auth) PDF extraction
 * surface (issue #23).
 *
 * This is an UNAUTHENTICATED file-upload + LLM surface, so every limit here is
 * intentionally STRICTER than the authenticated initiative-pdfs path:
 *   - 10 MB cap (vs 50 MB authenticated) — landing-page decks are small.
 *   - PDF mime AND `.pdf` extension both required.
 *   - draftId / anonymousSessionId are opaque client-supplied identifiers;
 *     they are length-bounded and charset-restricted so they cannot be used as
 *     an injection vector into the storage path (storage.service also
 *     sanitises, this is defence-in-depth at the boundary).
 */

export const PUBLIC_ALLOWED_PDF_MIME = 'application/pdf';
export const MAX_PUBLIC_PDF_BYTES = 10 * 1024 * 1024; // 10 MB (issue #23 guardrail)

/** Public path is ALWAYS scoped to Step 0 (the landing autofill flow). */
export const PUBLIC_TARGET_STEP = 'step_0' as const;

// Opaque client identifier: letters, digits, dash, underscore. 1..128 chars.
// Rejects path separators / dots so it is safe to use as a storage segment.
const opaqueId = (label: string) =>
  z
    .string()
    .min(1, `${label} es obligatorio`)
    .max(128, `${label} es demasiado largo`)
    .regex(/^[A-Za-z0-9_-]+$/, `${label} contiene caracteres no permitidos`);

/**
 * Body fields that travel alongside the multipart `file` part. The file itself
 * is parsed by the router's multipart middleware (not Zod) and validated for
 * mime/extension/size there.
 */
export const publicExtractBodySchema = z
  .object({
    anonymousSessionId: opaqueId('anonymousSessionId'),
    draftId: opaqueId('draftId'),
  })
  .strict();

// `runId` is a uuid minted server-side for the ephemeral run.
export const publicRunIdParam = z.object({
  runId: z.string().uuid('runId debe ser uuid'),
});

export type PublicExtractBody = z.infer<typeof publicExtractBodySchema>;
