import crypto from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { can, type Permission } from '../../shared/authz/permissions';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { AppError } from '../../shared/errors/AppError';
import type { PortfolioBootstrapContextPayload } from './portfolio-bootstrap.schemas';

type SourceCompanyContext = { companyId: string; versionId: string; versionNumber: number } | null;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function canonicalContextHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function companyEntryFingerprint(entry: {
  dimension: unknown; fieldKey: unknown; valueJson: unknown; sourceType: unknown;
  sourceId: unknown; confidence: unknown; verificationStatus: unknown;
}): string {
  return canonicalContextHash({
    dimension: entry.dimension,
    fieldKey: entry.fieldKey,
    valueJson: entry.valueJson,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId ?? null,
    confidence: entry.confidence ?? null,
    verificationStatus: entry.verificationStatus,
  });
}

export function isRetryableContextWriteConflict(error: unknown): boolean {
  const candidate = error as { code?: string; meta?: { code?: string } };
  return candidate?.code === 'P2034' || (candidate?.code === 'P2010' && candidate.meta?.code === '40001');
}

export interface ContextReviewDto {
  id: string;
  sessionId: string;
  status: 'draft' | 'confirmed';
  version: number;
  draft: PortfolioBootstrapContextPayload;
  confirmedSnapshot: PortfolioBootstrapContextPayload | null;
  effectiveContext: PortfolioBootstrapContextPayload | null;
  hasPendingCorrection: boolean;
  sourceCompanyContext: SourceCompanyContext;
  sourceOutdated: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class PortfolioBootstrapContextService {
  constructor(private readonly prisma: PrismaClient) {}

  async getContext(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<ContextReviewDto | null> {
    const db = this.prisma as any;
    const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
    await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:read');
    const review = await db.portfolioBootstrapContextReview.findUnique({ where: { bootstrapSessionId: session.id } });
    return review ? this.toDto(db, review) : null;
  }

  async saveDraft(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
    expectedVersion: number;
    context: PortfolioBootstrapContextPayload;
    sourceCompanyContext?: SourceCompanyContext;
  }): Promise<ContextReviewDto> {
    this.requireIdempotencyKey(input.idempotencyKey);
    const payloadHash = canonicalContextHash({
      expectedVersion: input.expectedVersion,
      context: input.context,
      sourceCompanyContext: input.sourceCompanyContext ?? null,
    });
    return this.withSerializableRetry(() => this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:write');
      const replay = await this.replay(db, session.id, 'save_draft', input.idempotencyKey, payloadHash);
      if (replay) return replay;

      const source = await this.validateSource(db, session, input.authenticatedUserId, input.sourceCompanyContext ?? null, input.context, true);
      const current = await db.portfolioBootstrapContextReview.findUnique({ where: { bootstrapSessionId: session.id } });
      let review: any;
      if (!current) {
        if (input.expectedVersion !== 0) throw this.versionConflict();
        try {
          review = await db.portfolioBootstrapContextReview.create({ data: {
            bootstrapSessionId: session.id,
            status: 'draft', version: 1,
            draftJson: input.context,
            sourceCompanyId: source?.companyId ?? null,
            sourceCompanyContextVersionId: source?.versionId ?? null,
            sourceCompanyContextVersionNumber: source?.versionNumber ?? null,
            provenanceJson: this.provenance(input.context),
          } });
        } catch (error) {
          if ((error as { code?: string }).code === 'P2002') throw this.versionConflict();
          throw error;
        }
      } else {
        if (current.version !== input.expectedVersion) throw this.versionConflict();
        const nextVersion = current.version + 1;
        const changed = await db.portfolioBootstrapContextReview.updateMany({
          where: { id: current.id, version: input.expectedVersion },
          data: {
            status: 'draft', version: nextVersion, draftJson: input.context,
            sourceCompanyId: source?.companyId ?? null,
            sourceCompanyContextVersionId: source?.versionId ?? null,
            sourceCompanyContextVersionNumber: source?.versionNumber ?? null,
            provenanceJson: this.provenance(input.context),
          },
        });
        if (changed.count !== 1) throw this.versionConflict();
        review = await db.portfolioBootstrapContextReview.findUnique({ where: { id: current.id } });
      }
      await db.portfolioBootstrapContextReviewVersion.create({ data: {
        reviewId: review.id, version: review.version, action: 'draft_saved', snapshotJson: input.context,
        actorUserId: input.authenticatedUserId,
      } });
      await this.audit(db, input.authenticatedUserId, 'portfolio_bootstrap_context_draft_saved', review.id, session.id, review.version);
      const response = await this.toDto(db, review, false);
      await this.persistReceipt(db, session.id, 'save_draft', input.idempotencyKey, payloadHash, response, review.version);
      return response;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
  }

  async confirm(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
    expectedVersion: number;
  }): Promise<ContextReviewDto> {
    this.requireIdempotencyKey(input.idempotencyKey);
    const payloadHash = canonicalContextHash({ expectedVersion: input.expectedVersion });
    return this.withSerializableRetry(() => this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:write');
      const replay = await this.replay(db, session.id, 'confirm', input.idempotencyKey, payloadHash);
      if (replay) return replay;
      const current = await db.portfolioBootstrapContextReview.findUnique({ where: { bootstrapSessionId: session.id } });
      if (!current || current.version !== input.expectedVersion || current.status !== 'draft') throw this.versionConflict();
      const source = current.sourceCompanyId ? {
        companyId: current.sourceCompanyId,
        versionId: current.sourceCompanyContextVersionId,
        versionNumber: current.sourceCompanyContextVersionNumber,
      } : null;
      await this.validateSource(db, session, input.authenticatedUserId, source, current.draftJson, true);
      const nextVersion = current.version + 1;
      const confirmedAt = new Date();
      const changed = await db.portfolioBootstrapContextReview.updateMany({
        where: { id: current.id, version: input.expectedVersion, status: 'draft' },
        data: {
          status: 'confirmed', version: nextVersion,
          confirmedSnapshotJson: current.draftJson,
          confirmedBy: input.authenticatedUserId,
          confirmedAt,
        },
      });
      if (changed.count !== 1) throw this.versionConflict();
      const review = await db.portfolioBootstrapContextReview.findUnique({ where: { id: current.id } });
      await db.portfolioBootstrapContextReviewVersion.create({ data: {
        reviewId: review.id, version: review.version, action: 'confirmed', snapshotJson: current.draftJson,
        actorUserId: input.authenticatedUserId,
      } });
      await this.audit(db, input.authenticatedUserId, 'portfolio_bootstrap_context_confirmed', review.id, session.id, review.version);
      const response = await this.toDto(db, review, false);
      await this.persistReceipt(db, session.id, 'confirm', input.idempotencyKey, payloadHash, response, review.version);
      return response;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
  }

  private async requireOwnedSession(db: any, sessionId: string, userId: string): Promise<any> {
    const session = await db.portfolioBootstrapSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, userId: true, organizationId: true },
    });
    if (!session) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
    return session;
  }

  private async authorize(db: any, session: any, userId: string, permissions: ReadonlySet<Permission>, capability: Permission): Promise<void> {
    if (can(permissions, capability)) return;
    const allowed = session.organizationId && await new ScopedPortfolioAccessService(db).canUserAccessPortfolio({
      userId, organizationId: session.organizationId, capability: capability as 'portfolio:read' | 'portfolio:write',
    });
    if (!allowed) throw AppError.forbidden('No tienes permiso Portfolio para este contexto.', capability === 'portfolio:read'
      ? 'PORTFOLIO_BOOTSTRAP_READ_REQUIRED' : 'PORTFOLIO_BOOTSTRAP_WRITE_REQUIRED');
  }

  private async validateSource(db: any, session: any, actorId: string, source: SourceCompanyContext, context: any, requireLatest: boolean): Promise<SourceCompanyContext> {
    const extracted = this.fields(context).filter((field) => field.provenance === 'source_extracted');
    if (!source) {
      if (extracted.length) throw AppError.badRequest('La procedencia Company requiere una versión fuente.', 'COMPANY_CONTEXT_SOURCE_REQUIRED');
      return null;
    }
    if (!session.organizationId) throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { organizationId: true } });
    const company = await db.company.findUnique({ where: { id: source.companyId } });
    if (!company || company.deletedAt || company.scope !== 'ORGANIZATION'
      || company.organizationId !== session.organizationId || actor?.organizationId !== session.organizationId) {
      throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    }
    if (company.status !== 'ACTIVE') throw AppError.conflict('La empresa fuente ya no está activa.', 'COMPANY_CONTEXT_UNAVAILABLE');
    const membership = await db.companyMembership.findFirst({ where: { companyId: company.id, userId: actorId, status: 'APPROVED' } });
    if (!membership) throw AppError.forbidden('No tienes acceso de lectura a esta empresa.', 'COMPANY_ACCESS_DENIED');
    const version = await db.companyContextVersion.findFirst({ where: {
      id: source.versionId, companyId: company.id, versionNumber: source.versionNumber, status: 'PUBLISHED',
    } });
    if (!version) throw AppError.notFound('Versión de contexto Company', 'COMPANY_CONTEXT_VERSION_NOT_FOUND');
    if (requireLatest) {
      const latest = await db.companyContextVersion.findFirst({
        where: { companyId: company.id, status: 'PUBLISHED' }, orderBy: { versionNumber: 'desc' }, select: { id: true },
      });
      if (latest?.id !== version.id) throw AppError.conflict('Existe una versión Company más reciente.', 'COMPANY_CONTEXT_VERSION_STALE');
    }
    for (const field of extracted) {
      const ref = field.sourceRef;
      const entry = await db.companyContextEntry.findFirst({ where: {
        ...(ref.entryId ? { id: ref.entryId } : {}),
        companyId: company.id, versionId: version.id, dimension: ref.dimension, fieldKey: ref.fieldKey,
        sourceId: ref.sourceId ?? null,
      } });
      if (!entry || companyEntryFingerprint(entry) !== ref.entryFingerprint) {
        throw AppError.conflict('La fuente Company no coincide con el snapshot publicado.', 'COMPANY_CONTEXT_ENTRY_FINGERPRINT_MISMATCH');
      }
    }
    return source;
  }

  private fields(context: any): any[] {
    return [context.situation, context.area, context.stakeholder, context.pilotExperience,
      ...(context.constraints ?? []), ...(context.assumptions ?? [])].filter(Boolean);
  }

  private provenance(context: any): unknown {
    return this.fields(context).map(({ provenance, sourceRef }) => ({ provenance, sourceRef: sourceRef ?? null }));
  }

  private async replay(db: any, sessionId: string, operation: string, key: string, payloadHash: string): Promise<ContextReviewDto | null> {
    const receipt = await db.portfolioBootstrapContextOperation.findUnique({ where: {
      bootstrapSessionId_operation_idempotencyKeyHash: {
        bootstrapSessionId: sessionId, operation, idempotencyKeyHash: canonicalContextHash(key),
      },
    } });
    if (!receipt) return null;
    if (receipt.payloadHash !== payloadHash) throw AppError.conflict('Idempotency-Key reutilizada con otro payload.', 'PORTFOLIO_CONTEXT_IDEMPOTENCY_CONFLICT');
    return receipt.responseJson as ContextReviewDto;
  }

  private async persistReceipt(db: any, sessionId: string, operation: string, key: string, payloadHash: string, response: ContextReviewDto, version: number): Promise<void> {
    await db.portfolioBootstrapContextOperation.create({ data: {
      bootstrapSessionId: sessionId, operation,
      idempotencyKeyHash: canonicalContextHash(key), payloadHash,
      responseJson: response, resultingReviewVersion: version,
    } });
  }

  private async toDto(db: any, review: any, inspectDrift = true): Promise<ContextReviewDto> {
    let sourceOutdated = false;
    if (inspectDrift && review.sourceCompanyId) {
      const [company, latest] = await Promise.all([
        db.company.findUnique({ where: { id: review.sourceCompanyId }, select: { status: true, deletedAt: true } }),
        db.companyContextVersion.findFirst({ where: { companyId: review.sourceCompanyId, status: 'PUBLISHED' }, orderBy: { versionNumber: 'desc' }, select: { id: true } }),
      ]);
      sourceOutdated = !company || Boolean(company.deletedAt) || company.status !== 'ACTIVE' || latest?.id !== review.sourceCompanyContextVersionId;
    }
    const draft = review.draftJson as PortfolioBootstrapContextPayload;
    const confirmed = (review.confirmedSnapshotJson ?? null) as PortfolioBootstrapContextPayload | null;
    return {
      id: review.id, sessionId: review.bootstrapSessionId, status: review.status, version: review.version,
      draft, confirmedSnapshot: confirmed, effectiveContext: confirmed,
      hasPendingCorrection: Boolean(confirmed && review.status === 'draft'),
      sourceCompanyContext: review.sourceCompanyId ? {
        companyId: review.sourceCompanyId,
        versionId: review.sourceCompanyContextVersionId,
        versionNumber: review.sourceCompanyContextVersionNumber,
      } : null,
      sourceOutdated, confirmedBy: review.confirmedBy ?? null,
      confirmedAt: review.confirmedAt ? new Date(review.confirmedAt).toISOString() : null,
      createdAt: new Date(review.createdAt).toISOString(), updatedAt: new Date(review.updatedAt).toISOString(),
    };
  }

  private async audit(db: any, actorId: string, action: string, reviewId: string, sessionId: string, version: number): Promise<void> {
    await db.auditLog.create({ data: {
      userId: actorId, action, resource: 'PortfolioBootstrapContextReview', resourceId: reviewId,
      details: { sessionId, version },
    } });
  }

  private requireIdempotencyKey(key: string): void {
    if (!key.trim()) throw AppError.badRequest('Falta Idempotency-Key.', 'PORTFOLIO_CONTEXT_IDEMPOTENCY_REQUIRED');
  }

  private versionConflict(): AppError {
    return AppError.conflict('La versión de contexto cambió; vuelve a leer antes de reintentar.', 'PORTFOLIO_CONTEXT_VERSION_CONFLICT');
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await operation(); } catch (error) {
        if (attempt === 1 || !isRetryableContextWriteConflict(error)) throw error;
      }
    }
    throw AppError.conflict('No fue posible serializar la operación.', 'PORTFOLIO_CONTEXT_RETRY_EXHAUSTED');
  }
}
