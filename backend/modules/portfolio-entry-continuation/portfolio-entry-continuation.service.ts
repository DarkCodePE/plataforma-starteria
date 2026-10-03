import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import type { Permission } from '../../shared/authz/permissions';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { logger } from '../../shared/utils/logger';
import { PortfolioEntryApiError } from '../portfolio-entry/portfolio-entry.errors';
import type { PortfolioEntryIdempotencyRepository } from '../portfolio-entry/application/portfolio-entry-idempotency.repository';

export type PortfolioEntryContinuationResultDto = {
  continuationId: string;
  sessionId: string;
  status: 'CONTINUED';
  destinationRoute: string;
  continuedAt: string;
  /** True only because a pre-existing scoped grant was validated. */
  portfolioAccessGranted: boolean;
  portfolioScope: {
    kind: 'scoped_portfolio_grant';
    userId: string;
    organizationId: string | null;
  };
  context: {
    understanding: unknown;
    desiredOutcome: unknown;
    decisionToEnable: unknown;
    knownContext: unknown;
    unresolvedContext: unknown;
    evidenceOrClarityNeeded: unknown;
    provenanceSummary: unknown;
  };
};

export type ContinuePortfolioEntryInput = {
  sessionId: string;
  expectedRevision: number;
  authenticatedUserId: string;
  organizationId?: string;
  permissions: ReadonlySet<Permission>;
  idempotencyKey?: string;
  requestId?: string;
};

export type PortfolioContextResolutionDto = {
  sessionId: string;
  revision: number;
  contexts: Array<{ organizationId: string; name: string }>;
};

export type ReadPortfolioEntryContinuationInput = {
  continuationId: string;
  authenticatedUserId: string;
  permissions: ReadonlySet<Permission>;
};

export type ReadScopedEntryAccessInput = {
  identity: { sessionId: string; sessionRevision: number; handoffId: string; handoffVersion: number; confirmationId: string; confirmationVersion: number };
  authenticatedUserId: string;
};

export type PortfolioHomeEntryContextDto = {
  continuationId: string;
  sessionId: string;
  organization: { id: string; name: string };
  arrival: {
    understoodNeed: string | null;
    desiredOutcome: string | null;
    confirmedContext: string[];
    openItems: string[];
    laterWork: string[];
    organizationalUnknowns: string[];
    nextStep: string;
  };
};

const IDEMPOTENCY_OPERATION = 'continue_portfolio_session';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAPPING_VERSION = 'portfolio-entry-portfolio-continuation-v0.1';

export class PortfolioEntryContinuationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly idempotencyRepository: PortfolioEntryIdempotencyRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly scopedPortfolioAccess = new ScopedPortfolioAccessService(prisma),
  ) {}

  async continueToPortfolio(input: ContinuePortfolioEntryInput): Promise<PortfolioEntryContinuationResultDto> {
    if (!input.authenticatedUserId) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
    if (!input.idempotencyKey) throw PortfolioEntryApiError.missingIdempotencyKey();

    const payload = {
      expectedRevision: input.expectedRevision,
      target: 'PORTFOLIO',
      userId: input.authenticatedUserId,
      permission: 'portfolio:read',
      organizationId: input.organizationId ?? null,
    };
    return this.withIdempotency(input, payload, async () => {
      const organizationId = input.organizationId ?? await this.requireSingleContext(input);
      const continuation = await this.createContinuation(input, organizationId);
      logger.info({
        requestId: input.requestId,
        sessionId: input.sessionId,
        userId: input.authenticatedUserId,
        continuationId: continuation.continuationId,
      }, 'portfolio_entry_portfolio_continuation_completed');
      return continuation;
    });
  }

  async listPortfolioContexts(input: { sessionId: string; authenticatedUserId: string }): Promise<PortfolioContextResolutionDto> {
    if (!input.authenticatedUserId) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
    const row = await this.requireOwnedClaimedSession(input.sessionId, input.authenticatedUserId);
    const contexts = await this.scopedPortfolioAccess.listAccessibleOrganizations({
      userId: input.authenticatedUserId,
      capability: 'portfolio:read',
    });
    return {
      sessionId: row.id,
      revision: row.revision,
      contexts,
    };
  }

  async readContinuation(input: ReadPortfolioEntryContinuationInput): Promise<PortfolioEntryContinuationResultDto> {
    const row = await this.prisma.portfolioEntryPortfolioContinuation.findUnique({
      where: { id: input.continuationId },
    });
    if (!row) throw AppError.notFound('Portfolio Entry continuation', 'PORTFOLIO_ENTRY_CONTINUATION_NOT_FOUND');
    if (row.continuedByUserId !== input.authenticatedUserId) {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    const session = await this.prisma.portfolioEntrySession.findUnique({ where: { id: row.sessionId } });
    if (!session || session.ownerUserId !== input.authenticatedUserId || session.ownershipState !== 'CLAIMED') {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    const scope = readOrganizationScope(row.portfolioScope);
    if (!scope || !(await this.scopedPortfolioAccess.canUserAccessPortfolio({
      userId: input.authenticatedUserId,
      organizationId: scope,
      capability: 'portfolio:read',
    }))) {
      throw AppError.forbidden('No tienes acceso Portfolio para esta organizacion.', 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED');
    }
    return this.toDto(row);
  }

  async readPortfolioHomeEntryContext(input: ReadPortfolioEntryContinuationInput): Promise<PortfolioHomeEntryContextDto> {
    const row = await this.prisma.portfolioEntryPortfolioContinuation.findUnique({
      where: { id: input.continuationId },
    });
    if (!row || row.continuedByUserId !== input.authenticatedUserId) {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    const session = await this.prisma.portfolioEntrySession.findUnique({ where: { id: row.sessionId } });
    if (!session || session.ownerUserId !== input.authenticatedUserId || session.ownershipState !== 'CLAIMED') {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    const scope = readOrganizationScope(row.portfolioScope);
    if (!scope || !(await this.scopedPortfolioAccess.canUserAccessPortfolio({
      userId: input.authenticatedUserId,
      organizationId: scope,
      capability: 'portfolio:read',
    }))) {
      throw AppError.forbidden('No tienes acceso a este espacio de Portfolio.', 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED');
    }
    const organization = await this.prisma.organization.findUnique({ where: { id: scope }, select: { id: true, name: true } });
    if (!organization) throw AppError.forbidden('No tienes acceso a este espacio de Portfolio.', 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED');

    const snapshot = row.sourceSnapshot as Record<string, unknown>;
    const handoff = (snapshot.handoff ?? {}) as Record<string, unknown>;
    const confirmation = (snapshot.confirmation ?? {}) as Record<string, unknown>;
    return {
      continuationId: row.id,
      sessionId: row.sessionId,
      organization,
      arrival: {
        understoodNeed: publicText(handoff.understanding),
        desiredOutcome: publicText(handoff.desired_outcome),
        confirmedContext: confirmedContext(handoff, confirmation),
        openItems: publicTexts(handoff.unresolved_context),
        laterWork: publicTexts(handoff.later_work ?? handoff.later_stage_work),
        organizationalUnknowns: publicTexts(handoff.organizational_unknowns ?? handoff.authority_owned_unknowns),
        nextStep: 'Revisar este punto de partida y continuar estructurando el contexto del Portfolio.',
      },
    };
  }

  async authorizeScopedFirstValueEntry(input: ReadScopedEntryAccessInput): Promise<{ continuationId: string }> {
    const row = await this.prisma.portfolioEntryPortfolioContinuation.findFirst({
      where: { sessionId: input.identity.sessionId, continuedByUserId: input.authenticatedUserId },
    });
    if (!row) throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    const session = await this.prisma.portfolioEntrySession.findUnique({ where: { id: row.sessionId } });
    if (!session || session.ownerUserId !== input.authenticatedUserId || session.ownershipState !== 'CLAIMED'
      || session.revision !== input.identity.sessionRevision) {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    const snapshot = row.sourceSnapshot as Record<string, unknown>;
    const handoff = (snapshot.handoffRef ?? {}) as Record<string, unknown>;
    const confirmation = (snapshot.confirmation ?? {}) as Record<string, unknown>;
    if (handoff.id !== input.identity.handoffId || handoff.version !== input.identity.handoffVersion
      || confirmation.id !== input.identity.confirmationId || confirmation.version !== input.identity.confirmationVersion) {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    const scope = readOrganizationScope(row.portfolioScope);
    if (!scope || !(await this.scopedPortfolioAccess.canUserAccessPortfolio({ userId: input.authenticatedUserId, organizationId: scope, capability: 'portfolio:read' }))) {
      throw AppError.forbidden('No tienes acceso Portfolio para esta organizacion.', 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED');
    }
    return { continuationId: row.id };
  }

  private async createContinuation(input: ContinuePortfolioEntryInput, organizationId: string): Promise<PortfolioEntryContinuationResultDto> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.portfolioEntrySession.findUnique({ where: { id: input.sessionId } });
        if (!row) throw AppError.notFound('Portfolio Entry session', 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND');
        if (row.expiresAt <= this.now() || row.expiredAt || row.lifecycleStatus === 'EXPIRED') {
          throw new AppError(410, 'La sesion de Portfolio Entry expiro.', 'PORTFOLIO_ENTRY_SESSION_EXPIRED');
        }
        if (row.ownershipState !== 'CLAIMED' || !row.ownerUserId) {
          throw AppError.conflict('La sesion debe estar reclamada antes de continuar.', 'PORTFOLIO_ENTRY_CONTINUATION_NOT_CLAIMED');
        }
        if (row.ownerUserId !== input.authenticatedUserId) {
          throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
        }
        if (row.revision !== input.expectedRevision) {
          throw AppError.conflict('La sesion cambio antes de continuar.', 'PORTFOLIO_ENTRY_SESSION_CONFLICT');
        }
        if (row.continuationProfile !== 'PORTFOLIO_LEAD_ENTRY') {
          throw AppError.conflict('La sesion no tiene perfil Portfolio Lead para esta continuidad.', 'PORTFOLIO_ENTRY_CONTINUATION_PROFILE_FORBIDDEN');
        }
        if (row.lifecycleStatus !== 'CONFIRMED' && row.lifecycleStatus !== 'CONVERSION_ELIGIBLE') {
          throw AppError.conflict('La sesion no esta confirmada para continuar.', 'PORTFOLIO_ENTRY_CONTINUATION_NOT_CONFIRMED');
        }

        const projectConversion = await tx.portfolioEntryConversion.findUnique({ where: { sessionId: input.sessionId } });
        if (projectConversion) {
          throw AppError.conflict('La sesion ya fue convertida a Initiative/Project.', 'PORTFOLIO_ENTRY_CONTINUATION_INCOMPATIBLE_CONVERSION');
        }

        const existing = await tx.portfolioEntryPortfolioContinuation.findUnique({ where: { sessionId: input.sessionId } });
        if (existing) return existing;

        const [handoff, confirmation, user] = await Promise.all([
          tx.portfolioEntryHandoff.findFirst({
            where: { sessionId: input.sessionId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          }),
          tx.portfolioEntryConfirmation.findFirst({
            where: { sessionId: input.sessionId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          }),
          tx.user.findUnique({
            where: { id: input.authenticatedUserId },
            select: { id: true, organizationId: true },
          }),
        ]);
        if (!user) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
        if (!handoff) throw AppError.conflict('La sesion no tiene handoff confirmado.', 'PORTFOLIO_ENTRY_CONTINUATION_HANDOFF_REQUIRED');
        if (!confirmation || confirmation.status !== 'CONFIRMED') {
          throw AppError.conflict('La sesion no tiene confirmacion final.', 'PORTFOLIO_ENTRY_CONTINUATION_CONFIRMATION_REQUIRED');
        }
        if (confirmation.handoffId !== handoff.id) {
          throw AppError.conflict('La confirmacion ya no corresponde al handoff vigente.', 'PORTFOLIO_ENTRY_CONTINUATION_STALE_CONFIRMATION');
        }

        if (!(await this.scopedPortfolioAccess.canUserAccessPortfolio({
          userId: input.authenticatedUserId,
          organizationId,
          capability: 'portfolio:read',
        }))) {
          throw AppError.forbidden('No tienes acceso Portfolio para esta organizacion.', 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED');
        }

        const continuationId = randomUUID();
        const destinationRoute = '/portfolio/setup';
        const scope = {
          kind: 'scoped_portfolio_grant',
          userId: input.authenticatedUserId,
          organizationId,
        };
        const snapshot = buildSourceSnapshot(row, handoff, confirmation);
        const pendingItems = buildPendingItems(handoff.handoffPayload);

        const created = await tx.portfolioEntryPortfolioContinuation.create({
          data: {
            id: continuationId,
            sessionId: input.sessionId,
            handoffId: handoff.id,
            confirmationId: confirmation.id,
            continuedByUserId: input.authenticatedUserId,
            portfolioScope: scope as Prisma.InputJsonValue,
            sourceSnapshot: snapshot as Prisma.InputJsonValue,
            pendingItems: pendingItems as Prisma.InputJsonValue,
            mappingVersion: MAPPING_VERSION,
            destinationRoute,
          },
        });


        return created;
      });
      return this.toDto(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2002' || err.code === 'P2003')
      ) {
        const existing = await this.findContinuationBySession(input.sessionId);
        if (existing) return this.toDto(existing);
        throw AppError.conflict('La continuidad no pudo aplicarse por conflicto de datos.', 'PORTFOLIO_ENTRY_CONTINUATION_CONFLICT');
      }
      throw err;
    }
  }

  private async requireSingleContext(input: ContinuePortfolioEntryInput): Promise<string> {
    const resolved = await this.listPortfolioContexts({ sessionId: input.sessionId, authenticatedUserId: input.authenticatedUserId });
    if (resolved.contexts.length === 0) {
      throw AppError.forbidden('Tu avance esta guardado. Antes de seguir necesitamos ubicar en que espacio de tu organizacion corresponde trabajarlo.', 'PORTFOLIO_ENTRY_CONTINUATION_NO_AUTHORIZED_CONTEXT');
    }
    if (resolved.contexts.length !== 1) {
      throw AppError.conflict('Selecciona un espacio autorizado para continuar.', 'PORTFOLIO_ENTRY_CONTINUATION_CONTEXT_SELECTION_REQUIRED');
    }
    return resolved.contexts[0].organizationId;
  }

  private async requireOwnedClaimedSession(sessionId: string, userId: string) {
    const row = await this.prisma.portfolioEntrySession.findUnique({ where: { id: sessionId } });
    if (!row) throw AppError.notFound('Portfolio Entry session', 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND');
    if (row.ownershipState !== 'CLAIMED' || row.ownerUserId !== userId) {
      throw AppError.forbidden('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN');
    }
    if (row.expiresAt <= this.now() || row.expiredAt || row.lifecycleStatus === 'EXPIRED') {
      throw new AppError(410, 'La sesion de Portfolio Entry expiro.', 'PORTFOLIO_ENTRY_SESSION_EXPIRED');
    }
    return row;
  }

  private async withIdempotency(
    input: ContinuePortfolioEntryInput,
    payload: unknown,
    run: () => Promise<PortfolioEntryContinuationResultDto>,
  ): Promise<PortfolioEntryContinuationResultDto> {
    const now = this.now();
    const hash = createHash('sha256').update(stableJson(payload)).digest('hex');
    const existing = await this.idempotencyRepository.findActive(IDEMPOTENCY_OPERATION, input.sessionId, input.idempotencyKey!, now);
    if (existing) {
      if (existing.requestPayloadHash !== hash) throw PortfolioEntryApiError.idempotencyConflict();
      if (existing.status === 'COMPLETED') return existing.responseSnapshot as PortfolioEntryContinuationResultDto;
      const continuation = await this.findContinuationBySession(input.sessionId);
      if (continuation) {
        const recovered = this.toDto(continuation);
        await this.idempotencyRepository.complete({ id: existing.id, responseSnapshot: recovered });
        return recovered;
      }
      if (existing.status === 'IN_PROGRESS') throw PortfolioEntryApiError.idempotencyInProgress();
    }

    const record = existing?.status === 'FAILED'
      ? existing
      : await this.idempotencyRepository.create({
        operation: IDEMPOTENCY_OPERATION,
        scope: input.sessionId,
        sessionId: input.sessionId,
        idempotencyKey: input.idempotencyKey!,
        requestPayloadHash: hash,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      });
    if (record.requestPayloadHash !== hash) throw PortfolioEntryApiError.idempotencyConflict();

    try {
      const result = await run();
      await this.idempotencyRepository.complete({ id: record.id, responseSnapshot: result });
      return result;
    } catch (err) {
      await this.idempotencyRepository.markFailed(record.id);
      logger.error({
        requestId: input.requestId,
        sessionId: input.sessionId,
        userId: input.authenticatedUserId,
        err,
      }, 'portfolio_entry_portfolio_continuation_failed');
      throw err;
    }
  }

  private async findContinuationBySession(sessionId: string): Promise<ContinuationRow | null> {
    return this.prisma.portfolioEntryPortfolioContinuation.findUnique({ where: { sessionId } });
  }

  private toDto(row: ContinuationRow): PortfolioEntryContinuationResultDto {
    const snapshot = row.sourceSnapshot as Record<string, unknown>;
    const handoff = (snapshot.handoff ?? {}) as Record<string, unknown>;
    const scope = row.portfolioScope as PortfolioEntryContinuationResultDto['portfolioScope'];
    return {
      continuationId: row.id,
      sessionId: row.sessionId,
      status: 'CONTINUED',
      destinationRoute: row.destinationRoute,
      continuedAt: row.continuedAt.toISOString(),
      portfolioScope: scope,
      portfolioAccessGranted: true,
      context: {
        understanding: handoff.understanding,
        desiredOutcome: handoff.desired_outcome,
        decisionToEnable: handoff.decision_to_enable,
        knownContext: handoff.known_context,
        unresolvedContext: handoff.unresolved_context,
        evidenceOrClarityNeeded: handoff.evidence_or_clarity_needed,
        provenanceSummary: handoff.provenance_summary,
      },
    };
  }
}

type ContinuationRow = {
  id: string;
  sessionId: string;
  portfolioScope: Prisma.JsonValue;
  sourceSnapshot: Prisma.JsonValue;
  destinationRoute: string;
  continuedAt: Date;
};

function buildSourceSnapshot(row: any, handoff: any, confirmation: any): Record<string, unknown> {
  return {
    session: {
      id: row.id,
      revision: row.revision,
      rawEntry: row.rawEntry,
      entryOrigin: row.entryOrigin,
      semanticState: row.semanticState,
      continuationProfile: row.continuationProfile,
      contractVersion: row.contractVersion,
      runtimeVersion: row.runtimeVersion,
      schemaVersion: row.schemaVersion,
      promptManifestId: row.promptManifestId,
    },
    handoff: handoff.handoffPayload,
    handoffRef: {
      id: handoff.id,
      version: handoff.version,
      schemaVersion: handoff.schemaVersion,
      runtimeVersion: handoff.runtimeVersion,
      promptManifestId: handoff.promptManifestId,
      createdAt: handoff.createdAt.toISOString(),
    },
    confirmation: {
      id: confirmation.id,
      version: confirmation.version,
      status: confirmation.status,
      acceptedFields: confirmation.acceptedFields,
      correctedFields: confirmation.correctedFields,
      rejectedFields: confirmation.rejectedFields,
      notes: confirmation.notes,
      confirmedAt: confirmation.confirmedAt?.toISOString() ?? null,
    },
  };
}

function buildPendingItems(handoffPayload: Prisma.JsonValue): Record<string, unknown> {
  const handoff = handoffPayload as Record<string, unknown>;
  return {
    unresolved_context: handoff.unresolved_context ?? [],
    evidence_or_clarity_needed: handoff.evidence_or_clarity_needed ?? [],
  };
}

function readOrganizationScope(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const organizationId = (value as Record<string, unknown>).organizationId;
  return typeof organizationId === 'string' && organizationId.length > 0 ? organizationId : null;
}

function publicText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const candidate of [record.value, record.text, record.description, record.summary, record.statement]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

function publicTexts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(publicText).filter((item): item is string => Boolean(item));
}

function confirmedContext(handoff: Record<string, unknown>, confirmation: Record<string, unknown>): string[] {
  const accepted = confirmation.acceptedFields;
  if (accepted && typeof accepted === 'object' && !Array.isArray(accepted)) {
    return Object.values(accepted as Record<string, unknown>).map(publicText).filter((item): item is string => Boolean(item));
  }
  return publicTexts(handoff.known_context);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}
