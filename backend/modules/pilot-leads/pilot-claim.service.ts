/**
 * Pilot claim service (ADR-018).
 *
 * `issue(pilotCode)` mints a single-use, server-stored claim token bound to the
 * lead and returns ONLY non-PII personalization (name/organization/proposal) —
 * never email/phone, so the short code never becomes a PII oracle.
 *
 * `consume(rawToken, user)` validates+consumes the token (single-use) and
 * imports the lead's proposal into a Project owned by the authenticated user.
 * Idempotent: a given lead produces at most one Project.
 *
 * DI over a minimal Prisma surface + a project-creation callback keeps tests
 * hermetic (no real DB), mirroring PilotLeadService.
 */
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { hashRefreshToken } from '../auth/token.service';
import { CLAIM_TTL_MS } from './pilot-claim.schemas';
import { hashPilotCode } from './pilot-code';

export interface PilotLeadRow {
  id: string;
  pilotCode: string;
  name: string;
  email: string;
  organization?: string | null;
  proposal?: unknown;
  retentionUntil?: Date | string | null;
}

interface ClaimRow {
  tokenHash: string;
  pilotLeadId: string;
  expiresAt: Date | string;
  consumedAt?: Date | string | null;
  createdProjectId?: string | null;
}

interface ProjectRow {
  id: string;
}

export interface PilotClaimStore {
  $transaction<T>(
    run: (tx: PilotClaimStore) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
  pilotLead: {
    findUnique(args: { where: { pilotCode: string } | { id: string } }): Promise<PilotLeadRow | null>;
  };
  pilotClaimToken: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findUnique(args: { where: { tokenHash: string } }): Promise<ClaimRow | null>;
    update(args: { where: { tokenHash: string }; data: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  project: {
      // Keep the minimal store contract compatible with Prisma's nullable unique key.
    findFirst(args: { where: { pilotLeadId: string } }): Promise<ProjectRow | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/** Creates the Project for the authenticated user from the lead's proposal → projectId. */
export type PilotProjectCreator = (
  userId: string,
  role: string,
  lead: PilotLeadRow,
  tx: PilotClaimStore,
) => Promise<string>;

export interface PilotClaimIssueDTO {
  claimToken: string;
  expiresAt: string;
  name: string;
  organization: string | null;
  proposal: unknown;
  hasProposal: boolean;
}

export interface PilotClaimConsumeDTO {
  projectId: string;
  alreadyExisted: boolean;
}

type Ctx = { ipAddress?: string; userAgent?: string };

export class PilotClaimService {
  constructor(
    private readonly store: PilotClaimStore,
    private readonly createProject: PilotProjectCreator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Mint a claim token for a redeemed pilot code. Returns NO contact PII. */
  async issue(pilotCode: string, ctx: Ctx = {}): Promise<PilotClaimIssueDTO> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(this.now().getTime() + CLAIM_TTL_MS);
    try {
      return await this.store.$transaction(async (tx) => {
        const lead = await tx.pilotLead.findUnique({ where: { pilotCode: hashPilotCode(pilotCode) } });
      // Byte-identical to resume()'s 404 so this adds no oracle the resume route lacked.
      if (!lead) throw AppError.notFound('Código de postulación', 'PILOT_CODE_NOT_FOUND');
      if (lead.retentionUntil && new Date(lead.retentionUntil).getTime() < this.now().getTime()) {
        throw new AppError(410, 'Tu código de postulación expiró.', 'PILOT_RETENTION_EXPIRED');
      }
      if (await tx.project.findFirst({ where: { pilotLeadId: lead.id } })) {
        throw AppError.conflict('La continuación ya fue utilizada.', 'PILOT_CLAIM_ALREADY_CONSUMED');
      }

      // A newly issued intent supersedes every older, unused claim for this lead.
      await tx.pilotClaimToken.updateMany({
        where: { pilotLeadId: lead.id, consumedAt: null },
        data: { consumedAt: this.now() },
      });
      await tx.pilotClaimToken.create({
        data: { tokenHash, pilotLeadId: lead.id, expiresAt, createdProjectId: null },
      });
      await tx.auditLog.create({
        data: {
          action: 'pilot.claim.issued',
          resource: 'PilotLead',
          resourceId: lead.id,
          details: { hasProposal: lead.proposal != null },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      });

        return {
          claimToken: rawToken,
          expiresAt: expiresAt.toISOString(),
          name: lead.name,
          organization: lead.organization ?? null,
          proposal: lead.proposal ?? null,
          hasProposal: lead.proposal != null,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (['P2002', 'P2034'].includes((error as { code?: string }).code ?? '')) {
        throw AppError.conflict('La continuación cambió mientras se emitía. Intenta nuevamente.', 'PILOT_CLAIM_RETRY_REQUIRED');
      }
      throw error;
    }
  }

  /** Consume a claim (post-auth) → create/return the user's Project. Single-use + idempotent. */
  async consume(
    rawToken: string,
    user: { id: string; role: string; email: string },
    ctx: Ctx = {},
  ): Promise<PilotClaimConsumeDTO> {
    const tokenHash = hashRefreshToken(rawToken);
    try {
      return await this.store.$transaction(async (tx) => {
        const claim = await tx.pilotClaimToken.findUnique({ where: { tokenHash } });
        if (!claim) throw AppError.notFound('Solicitud de continuación', 'PILOT_CLAIM_NOT_FOUND');
        if (claim.consumedAt || claim.createdProjectId) {
          throw AppError.conflict('La continuación ya fue utilizada.', 'PILOT_CLAIM_ALREADY_CONSUMED');
        }
        if (new Date(claim.expiresAt).getTime() <= this.now().getTime()) {
          throw new AppError(410, 'Tu enlace de continuación expiró. Vuelve a ingresar tu código.', 'PILOT_CLAIM_EXPIRED');
        }

        const lead = await tx.pilotLead.findUnique({ where: { id: claim.pilotLeadId } });
        if (!lead) throw AppError.notFound('Código de postulación', 'PILOT_CODE_NOT_FOUND');
        if (lead.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
          throw AppError.forbidden('La continuación no pertenece a esta cuenta.', 'PILOT_CLAIM_IDENTITY_MISMATCH');
        }
        if (await tx.project.findFirst({ where: { pilotLeadId: lead.id } })) {
          throw AppError.conflict('La continuación ya fue utilizada.', 'PILOT_CLAIM_ALREADY_CONSUMED');
        }

        const consumed = await tx.pilotClaimToken.updateMany({
          where: { tokenHash, consumedAt: null, expiresAt: { gt: this.now() } },
          data: { consumedAt: this.now() },
        });
        if (consumed.count !== 1) {
          throw AppError.conflict('La continuación ya fue utilizada.', 'PILOT_CLAIM_ALREADY_CONSUMED');
        }

        const projectId = await this.createProject(user.id, user.role, lead, tx);
        await tx.pilotClaimToken.update({
          where: { tokenHash },
          data: { createdProjectId: projectId },
        });
        await tx.auditLog.create({
          data: {
            action: 'pilot.claim.consumed',
            resource: 'Project',
            resourceId: projectId,
            details: { pilotLeadId: lead.id, userId: user.id },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
        });
        return { projectId, alreadyExisted: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (['P2002', 'P2034'].includes((error as { code?: string }).code ?? '')) {
        throw AppError.conflict('La continuación ya fue utilizada.', 'PILOT_CLAIM_ALREADY_CONSUMED');
      }
      throw error;
    }
  }
}
