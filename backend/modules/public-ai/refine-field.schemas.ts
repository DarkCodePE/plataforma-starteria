/**
 * Zod contract for the PUBLIC (no-auth) field-refinement bridge.
 * ADR-016 / SPEC-003 §Flujo A. Payload carries NO PII — the public draft is
 * anonymous; the lead PII lives in the sibling pilot-leads flow (ADR-015).
 */
import { z } from 'zod/v3';

export const refineFieldBodySchema = z.object({
  field: z.string().trim().min(1, 'Falta el campo a mejorar.').max(120),
  currentValue: z.string().max(8000).default(''),
  draftContext: z.record(z.unknown()).nullish(),
});

export type RefineFieldBody = z.infer<typeof refineFieldBodySchema>;
