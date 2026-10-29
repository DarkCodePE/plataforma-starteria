/**
 * Zod contract for the PUBLIC (no-auth) pilot-lead capture surface.
 * PRD-003 / SPEC-003 / ADR-015. PII fields (email, phone) validated at the
 * boundary; `consentAccepted` is required true (enforced in the service so the
 * rejection carries a stable PILOT_CONSENT_REQUIRED code).
 */
import { z } from 'zod/v3';

/** Retention horizon for captured PII leads (ADR-015 §Compliance, proposal). */
export const RETENTION_DAYS = 180;

/** Canonical pilot bearer: 256 bits encoded as 64 uppercase hexadecimal chars. */
export const PILOT_CODE_REGEX = /^ST-PILOT-[A-F0-9]{64}$/;

/**
 * Snapshot of the public one-pager captured WITH the lead so the pilotCode can
 * later be redeemed to resume the initiative. Lenient + bounded: a partial or
 * evolving proposal must never break capture, and `aiOutput` is stored as-is
 * (the public one-pager — shape owned by the frontend). Size-guarded against
 * abuse. All fields optional; the whole `proposal` is optional too.
 */
export const pilotProposalSchema = z.object({
  inputText: z.string().max(20_000).optional(),
  sourceType: z.string().trim().max(20).optional(),
  title: z.string().trim().max(300).optional(),
  aiOutput: z.record(z.unknown()).optional(),
});

export type PilotProposal = z.infer<typeof pilotProposalSchema>;

export const pilotLeadBodySchema = z.object({
  draftId: z.string().trim().min(1, 'Falta el identificador del borrador.').max(200),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  email: z.string().trim().email('Correo electrónico inválido.').max(320),
  phone: z.string().trim().max(40).optional(),
  organization: z.string().trim().max(200).optional(),
  consentAccepted: z.boolean(),
  proposal: pilotProposalSchema.optional(),
});

export type PilotLeadBody = z.infer<typeof pilotLeadBodySchema>;

/** Path param for redeeming a pilot code (`GET /:pilotCode`). */
export const pilotCodeParamSchema = z.object({
  pilotCode: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(PILOT_CODE_REGEX, 'Código de postulación inválido.')),
});
