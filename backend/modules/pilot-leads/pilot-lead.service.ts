/**
 * Public pilot-lead capture service (PRD-003 / SPEC-003 / ADR-015).
 *
 * Persists anonymous "interés en piloto" submissions, replacing the public
 * draft→project conversion funnel. Idempotent by `draftId` (a resend never
 * duplicates a lead). PII (email/phone) is persisted but never logged in clear;
 * the AuditLog `details` carries only ids/metadata.
 *
 * Dependency-injected over a minimal Prisma surface so the router tests stay
 * hermetic (no real DB), mirroring `PublicPdfService`.
 */
import { AppError } from '../../shared/errors/AppError';
import { config } from '../../config';
import { RETENTION_DAYS, type PilotLeadBody } from './pilot-lead.schemas';
import { derivePilotCode, hashPilotCode } from './pilot-code';

export interface PilotLeadDTO {
  id: string;
  pilotCode: string;
  status: string;
  createdAt: string;
}

/**
 * What redeeming a pilotCode returns. Deliberately carries the PUBLIC proposal
 * (the one-pager, so the initiative can be resumed) + low-risk personalization
 * (name, organization), but NOT the contactable PII (email/phone): the pilotCode
 * is a bearer token, so a public lookup must not become a PII-harvesting
 * oracle. The applicant re-confirms contact details on resume.
 */
export interface PilotResumeDTO {
  pilotCode: string;
  status: string;
  name: string;
  organization?: string | null;
  proposal: unknown;
  createdAt: string;
}

interface PilotLeadRecord {
  id: string;
  draftId: string;
  pilotCode: string;
  status: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
  proposal?: unknown;
  retentionUntil?: Date | string | null;
  createdAt: Date | string;
}

/** Minimal Prisma surface this service needs (DI-friendly, hermetic tests). */
export interface PilotLeadStore {
  pilotLead: {
    findUnique(
      args: { where: { draftId: string } | { pilotCode: string } },
    ): Promise<PilotLeadRecord | null>;
    create(args: { data: Record<string, unknown> }): Promise<PilotLeadRecord>;
    updateMany(args: {
      where: { id: string; pilotCode: string };
      data: { pilotCode: string };
    }): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * Payload handed to the notifier. Unlike the AuditLog (which stays PII-free),
 * this DOES carry the lead's contact details: the team notification's purpose is
 * to let a human follow up — exactly what the lead consented to
 * ("…para contactarte sobre el primer piloto"). Recipients are a trusted
 * internal inbox (issue #54). Notifiers MUST still keep PII out of logs.
 */
export interface PilotLeadNotice {
  id: string;
  pilotCode: string;
  name: string;
  email: string;
  phone?: string | null;
  organization?: string | null;
}
export type PilotLeadNotifier = (lead: PilotLeadNotice) => void | Promise<void>;

function toDto(lead: PilotLeadRecord, rawPilotCode: string): PilotLeadDTO {
  const created = lead.createdAt instanceof Date ? lead.createdAt : new Date(lead.createdAt);
  return { id: lead.id, pilotCode: rawPilotCode, status: lead.status, createdAt: created.toISOString() };
}

export class PilotLeadService {
  constructor(
    private readonly store: PilotLeadStore,
    private readonly notify: PilotLeadNotifier = () => undefined,
    private readonly pilotCodeSecret: string = config.pilotCodeSecret,
  ) {}

  private async resolveExistingSubmission(
    existing: PilotLeadRecord,
    input: PilotLeadBody,
    rawPilotCode: string,
    storedPilotCodeHash: string,
    ctx: { ipAddress?: string; userAgent?: string },
  ): Promise<PilotLeadDTO> {
    if (existing.email.trim().toLowerCase() !== input.email.trim().toLowerCase()) {
      throw AppError.conflict('La postulación no coincide con los datos originales.', 'PILOT_LEAD_IDENTITY_MISMATCH');
    }
    if (existing.pilotCode !== storedPilotCodeHash) {
      // Legacy 16-bit/plaintext credentials are never accepted for lookup.
      // A contact-bound idempotent resubmission atomically replaces the stored
      // value with the hash of the new high-entropy bearer.
      await this.store.pilotLead.updateMany({
        where: { id: existing.id, pilotCode: existing.pilotCode },
        data: { pilotCode: storedPilotCodeHash },
      });
      await this.store.auditLog.create({
        data: {
          action: 'pilot.lead.credential_reissued',
          resource: 'PilotLead',
          resourceId: existing.id,
          details: { reason: 'legacy_credential_invalidated' },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });
    }
    return toDto(existing, rawPilotCode);
  }

  async submit(
    input: PilotLeadBody,
    ctx: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<PilotLeadDTO> {
    if (input.consentAccepted !== true) {
      throw AppError.conflict(
        'Necesitamos tu consentimiento para contactarte sobre el primer piloto.',
        'PILOT_CONSENT_REQUIRED',
      );
    }

    const rawPilotCode = derivePilotCode(input.draftId, this.pilotCodeSecret);
    const storedPilotCodeHash = hashPilotCode(rawPilotCode);

    // Idempotencia por draftId: el mismo draft deriva el mismo bearer sin almacenarlo.
    // Reconfirm the contact identity before returning any bearer: draftId is an
    // idempotency key, not an authentication credential.
    const existing = await this.store.pilotLead.findUnique({ where: { draftId: input.draftId } });
    if (existing) return this.resolveExistingSubmission(existing, input, rawPilotCode, storedPilotCodeHash, ctx);

    const now = new Date();
    const retentionUntil = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    let lead: PilotLeadRecord;
    try {
      lead = await this.store.pilotLead.create({
        data: {
          draftId: input.draftId,
          pilotCode: storedPilotCodeHash,
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          organization: input.organization ?? null,
          consentAccepted: true,
          consentAt: now,
          status: 'submitted',
          source: 'public_landing',
          retentionUntil,
          // Persist the one-pager snapshot so the pilotCode can later be redeemed
          // to resume the initiative. Omit when absent (legacy/partial captures)
          // so the nullable Json column stays NULL without a Prisma null sentinel.
          ...(input.proposal ? { proposal: input.proposal } : {}),
        },
      });
    } catch (err) {
      // Concurrent identical submit → unique(draftId) violation (Prisma P2002).
      // Re-read and return the winner so the contract stays idempotent.
      if ((err as { code?: string })?.code === 'P2002') {
        const raced = await this.store.pilotLead.findUnique({ where: { draftId: input.draftId } });
        if (raced) return this.resolveExistingSubmission(raced, input, rawPilotCode, storedPilotCodeHash, ctx);
      }
      throw err;
    }

    // Audit — ids/metadata only, never the PII payload.
    await this.store.auditLog.create({
      data: {
        action: 'pilot.lead.captured',
        resource: 'PilotLead',
        resourceId: lead.id,
        details: { source: 'public_landing' },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    // Fire-and-forget notification (channel TBD — issue #54). Never blocks/throws
    // the user's submit on a notification failure.
    try {
      await this.notify({
        id: lead.id,
        pilotCode: rawPilotCode,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        organization: input.organization ?? null,
      });
    } catch {
      /* swallow: a notification failure must not fail lead capture */
    }

    return toDto(lead, rawPilotCode);
  }

  /**
   * Redeem a pilotCode to resume the initiative. Returns the persisted public
   * proposal + light personalization so the frontend can rehydrate the
   * one-pager. Unknown code → 404 PILOT_CODE_NOT_FOUND. Audited (non-PII).
   */
  async resume(
    pilotCode: string,
    ctx: { ipAddress?: string; userAgent?: string } = {},
  ): Promise<PilotResumeDTO> {
    const lead = await this.store.pilotLead.findUnique({ where: { pilotCode: hashPilotCode(pilotCode) } });
    if (!lead) {
      throw AppError.notFound('Código de postulación', 'PILOT_CODE_NOT_FOUND');
    }
    if (lead.retentionUntil && new Date(lead.retentionUntil).getTime() <= Date.now()) {
      throw new AppError(410, 'Tu código de postulación expiró.', 'PILOT_RETENTION_EXPIRED');
    }

    await this.store.auditLog.create({
      data: {
        action: 'pilot.lead.resumed',
        resource: 'PilotLead',
        resourceId: lead.id,
        details: { hasProposal: lead.proposal != null },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
    });

    const created = lead.createdAt instanceof Date ? lead.createdAt : new Date(lead.createdAt);
    return {
      pilotCode,
      status: lead.status,
      name: lead.name,
      organization: lead.organization ?? null,
      proposal: lead.proposal ?? null,
      createdAt: created.toISOString(),
    };
  }
}
