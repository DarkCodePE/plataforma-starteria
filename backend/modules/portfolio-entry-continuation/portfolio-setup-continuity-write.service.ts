import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { parseCriticalHandoffLifecycle, parseCriticalHandoffPayload,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { BUSINESS_CAPABILITY_BOUNDARY_VERSION, STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION } from '../portfolio-entry/domain/starteria-path.types';
import { projectStarteriaPath } from '../portfolio-entry/presentation/starteria-path-projection';
import { STARTERIA_PATH_DTO_SCHEMA_VERSION } from '../portfolio-entry-starteria-path/presentation/starteria-path.dto';
import { carriedProjectionSchema, classifyContinuationRow, CONTINUATION_114F_FORMAT,
  openItemsSchema, sourceBindingFingerprint, type SnapshotMaterialBinding } from './portfolio-entry-continuation.data-contract';

const OPERATION = 'PORTFOLIO_SETUP_CONTINUE_V1';
const IDEMPOTENCY_NO_EXPIRY = new Date('9999-12-31T00:00:00.000Z');

const sourceBindingSchema = z.object({
  sessionId: z.string().min(1), contextRevision: z.number().int().nonnegative(),
  criticalHandoffId: z.string().min(1), criticalHandoffVersion: z.number().int().positive(),
  criticalHandoffSchemaVersion: z.string().min(1), confirmedAt: z.string().datetime(),
  starteriaPath: z.object({ projectionVersion: z.string().min(1), schemaVersion: z.string().min(1),
    boundaryVersion: z.string().min(1), criticalHandoffId: z.string().min(1),
    criticalHandoffVersion: z.number().int().positive(), sourceContextRevision: z.number().int().nonnegative(),
  }).strict().optional(),
}).strict();

export const portfolioSetupContinueRequestSchema = z.object({
  expectedSessionRevision: z.number().int().nonnegative(), sourceBinding: sourceBindingSchema,
  organizationId: z.string().trim().min(1).max(128).optional(),
}).strict();
export type PortfolioSetupContinueRequest = z.infer<typeof portfolioSetupContinueRequestSchema>;

export const portfolioSetupContinueResponseSchema = z.object({
  dtoVersion: z.literal('portfolio-setup-continuity-write-v0.1'),
  snapshotId: z.string().min(1), snapshotGeneration: z.number().int().positive(),
  snapshotState: z.literal('CURRENT'), sessionRevision: z.number().int().nonnegative(), sourceBinding: sourceBindingSchema,
  continuationProfile: z.object({ value: z.literal('PORTFOLIO_LEAD_ENTRY'), version: z.literal(1) }).strict(),
  organizationScopeId: z.string().min(1), nextAuthorizedSurface: z.literal('PORTFOLIO_HOME_BOOTSTRAP'),
  currentness: z.literal('REVALIDATED_AT_WRITE'), createdAt: z.string().datetime(),
}).strict();
export type PortfolioSetupContinueResponse = z.infer<typeof portfolioSetupContinueResponseSchema>;

const fail = (status: number, code: string) => new AppError(status, 'No se pudo continuar Portfolio Setup.', code);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function requestFingerprint(binding: SnapshotMaterialBinding): string {
  // Only material semantics: operation version, authoritative source/profile/scope. No headers or revision.
  return sourceBindingFingerprint(binding);
}

function isRetryable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, meta } = error as { code?: unknown; meta?: { code?: unknown } };
  return code === 'P2034' || code === 'P2002'
    || (code === 'P2010' && (meta?.code === '40001' || meta?.code === '40P01'));
}

/** Dedicated 114F write. All authority reads and writes share a serializable transaction. */
export class PortfolioSetupContinuityWriteService {
  constructor(private readonly db: PrismaClient, private readonly now: () => Date = () => new Date()) {}

  async continue(input: { sessionId: string; ownerUserId: string; idempotencyKey: string;
    request: PortfolioSetupContinueRequest }): Promise<PortfolioSetupContinueResponse> {
    if (!input.ownerUserId) throw fail(401, 'AUTH_REQUIRED');
    const request = portfolioSetupContinueRequestSchema.parse(input.request);
    const keyHash = hash(input.idempotencyKey);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.db.$transaction(async (tx) => {
          // Critical Handoff and session source mutations use this same row for serialization.
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioEntrySession"
            WHERE "id" = ${input.sessionId} FOR UPDATE`);
          const session = await tx.portfolioEntrySession.findUnique({ where: { id: input.sessionId }, select: {
            id: true, ownerUserId: true, ownershipState: true, lifecycleStatus: true, revision: true,
            contextRevision: true, expiresAt: true, expiredAt: true, continuationProfile: true,
            continuationProfileVersion: true, continuationProfileEvidenceRef: true,
          } });
          if (!session || session.ownershipState !== 'CLAIMED' || session.ownerUserId !== input.ownerUserId) {
            throw AppError.notFound('Portfolio Entry session', 'SESSION_NOT_AVAILABLE');
          }
          if (session.expiredAt || session.expiresAt <= this.now()
            || !['HANDOFF_READY', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'CONVERSION_ELIGIBLE'].includes(session.lifecycleStatus)) {
            throw fail(409, 'STALE_SOURCE');
          }
          const latest = await tx.portfolioEntryCriticalHandoff.findFirst({
            where: { sessionId: session.id }, orderBy: { artifactVersion: 'desc' },
            select: { id: true, sessionId: true, artifactVersion: true, schemaVersion: true,
              sourceContextRevision: true, confirmationState: true, confirmedAt: true,
              confirmedByUserId: true, payload: true },
          });
          const expected = request.sourceBinding;
          if (!latest || expected.sessionId !== session.id || latest.sessionId !== session.id
            || latest.id !== expected.criticalHandoffId || latest.artifactVersion !== expected.criticalHandoffVersion
            || latest.sourceContextRevision !== session.contextRevision || expected.contextRevision !== session.contextRevision
            || latest.confirmedAt?.toISOString() !== expected.confirmedAt
            || latest.confirmedByUserId !== input.ownerUserId || latest.confirmationState !== 'confirmed') {
            throw fail(409, 'STALE_SOURCE');
          }
          if (latest.schemaVersion !== PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION
            || latest.schemaVersion !== expected.criticalHandoffSchemaVersion) throw fail(422, 'UNSUPPORTED_SOURCE_VERSION');
          let payload: ReturnType<typeof parseCriticalHandoffPayload>;
          try {
            parseCriticalHandoffLifecycle(latest.confirmationState, latest.confirmedAt, latest.confirmedByUserId);
            payload = parseCriticalHandoffPayload(latest.schemaVersion, latest.payload);
          } catch { throw fail(409, 'STALE_SOURCE'); }
          if (payload.conclusionStatus === 'insufficient_basis') throw fail(409, 'STALE_SOURCE');
          if (expected.starteriaPath && (expected.starteriaPath.projectionVersion !== STARTERIA_PATH_PROJECTION_VERSION
            || (expected.starteriaPath.schemaVersion !== STARTERIA_PATH_SCHEMA_VERSION
              && expected.starteriaPath.schemaVersion !== STARTERIA_PATH_DTO_SCHEMA_VERSION)
            || expected.starteriaPath.boundaryVersion !== BUSINESS_CAPABILITY_BOUNDARY_VERSION)) {
            throw fail(422, 'UNSUPPORTED_SOURCE_VERSION');
          }
          if (expected.starteriaPath) {
            if (expected.starteriaPath.criticalHandoffId !== latest.id
              || expected.starteriaPath.criticalHandoffVersion !== latest.artifactVersion
              || expected.starteriaPath.sourceContextRevision !== session.contextRevision) {
              throw fail(409, 'STALE_SOURCE');
            }
            const path = projectStarteriaPath({
              artifactId: latest.id, artifactVersion: latest.artifactVersion,
              sourceContextRevision: latest.sourceContextRevision,
              conclusionStatus: payload.conclusionStatus, finalReading: payload.finalReading,
              decisionInView: payload.decisionInView, usableNow: payload.usableNow,
              decisionChangingUnknowns: payload.decisionChangingUnknowns, firstMovement: payload.firstMovement,
            }, { schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
              projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
              businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION });
            if ((path.pathStatus !== 'supported' && path.pathStatus !== 'bounded')
              || path.sourceBinding?.artifactId !== latest.id
              || path.sourceBinding?.artifactVersion !== latest.artifactVersion
              || path.sourceBinding?.sourceContextRevision !== session.contextRevision) {
              throw fail(409, 'STALE_SOURCE');
            }
          }
          if (session.continuationProfile !== 'PORTFOLIO_LEAD_ENTRY' || session.continuationProfileVersion !== 1
            || !session.continuationProfileEvidenceRef?.trim()) throw fail(409, 'PROFILE_CONFLICT');
          if (await tx.portfolioEntryConversion.findUnique({ where: { sessionId: session.id }, select: { sessionId: true } })) {
            throw fail(409, 'PROFILE_CONFLICT');
          }

          const scoped = new ScopedPortfolioAccessService(tx);
          const resolution = await scoped.resolveReadableScopes(input.ownerUserId);
          if (resolution.state === 'RESOLVER_FAILURE') throw fail(503, 'SCOPE_VALIDATION_FAILED');
          if (resolution.state === 'ZERO_SCOPES') throw fail(403, 'NO_AUTHORIZED_SCOPE');
          if (resolution.state === 'MULTIPLE_SCOPES' && !request.organizationId) throw fail(409, 'SCOPE_SELECTION_REQUIRED');
          const organizationId = request.organizationId ?? resolution.scopes[0].organizationId;
          if (!resolution.scopes.some((scope) => scope.organizationId === organizationId)) throw fail(403, 'SCOPE_NOT_AUTHORIZED');
          const checked = await scoped.revalidateReadableScope({ userId: input.ownerUserId, organizationId });
          if (checked.state === 'RESOLVER_FAILURE') throw fail(503, 'SCOPE_VALIDATION_FAILED');
          if (checked.state !== 'AUTHORIZED') throw fail(403, 'SCOPE_NOT_AUTHORIZED');
          // Hold the exact membership and grant rows until commit, so a concurrent revoke cannot commit first.
          const authority = await tx.$queryRaw<Array<{ memberId: string; grantId: string }>>(Prisma.sql`
            SELECT m."id" AS "memberId", g."id" AS "grantId"
            FROM "OrganizationMember" m JOIN "OrganizationPortfolioAccessGrant" g
              ON g."userId" = m."userId" AND g."organizationId" = m."organizationId"
            WHERE m."userId" = ${input.ownerUserId} AND m."organizationId" = ${organizationId}
              AND g."capability" = 'portfolio:read' FOR SHARE OF m, g`);
          if (authority.length === 0) throw fail(403, 'SCOPE_NOT_AUTHORIZED');

          const binding: SnapshotMaterialBinding = {
            sessionId: session.id, ownerUserId: input.ownerUserId, sourceContextRevision: session.contextRevision,
            criticalHandoffId: latest.id, criticalHandoffVersion: latest.artifactVersion,
            criticalHandoffSchemaVersion: latest.schemaVersion, criticalHandoffConfirmedAt: latest.confirmedAt!.toISOString(),
            starteriaPath: expected.starteriaPath ? {
              projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
              schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
              boundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
            } : null, continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
            continuationProfileVersion: 1, profileEvidenceRef: session.continuationProfileEvidenceRef!,
            organizationScopeId: organizationId, operation: OPERATION,
          };
          const bindingHash = sourceBindingFingerprint(binding);
          const fingerprint = requestFingerprint(binding);
          const canonicalSourceBinding = expected.starteriaPath ? {
            ...expected, starteriaPath: { ...expected.starteriaPath, ...binding.starteriaPath! },
          } : expected;
          const idempotency = await tx.portfolioEntryApiIdempotency.findUnique({
            where: { operation_scope_idempotencyKey: { operation: OPERATION, scope: session.id, idempotencyKey: keyHash } },
          });
          if (idempotency && idempotency.requestPayloadHash !== fingerprint) throw fail(409, 'IDEMPOTENCY_CONFLICT');
          const all = await tx.portfolioEntryPortfolioContinuation.findMany({
            where: { sessionId: session.id, snapshotFormat: CONTINUATION_114F_FORMAT },
            orderBy: { snapshotGeneration: 'desc' },
          });
          const currentRows = all.filter((row) => row.snapshotState === 'CURRENT');
          if (currentRows.length > 1) throw fail(409, 'INVALID_114F_SNAPSHOT');
          const current = currentRows[0];
          if (current) {
            const parsed = classifyContinuationRow(current);
            if (parsed.kind !== '114F_SNAPSHOT' || current.sourceBindingHash !== sourceBindingFingerprint({
              sessionId: parsed.sessionId, ownerUserId: parsed.ownerUserId,
              sourceContextRevision: parsed.source.contextRevision,
              criticalHandoffId: parsed.source.criticalHandoffId,
              criticalHandoffVersion: parsed.source.criticalHandoffVersion,
              criticalHandoffSchemaVersion: parsed.source.criticalHandoffSchemaVersion!,
              criticalHandoffConfirmedAt: parsed.source.confirmedAt.toISOString(),
              starteriaPath: parsed.source.starteriaPath,
              continuationProfile: parsed.profile.value, continuationProfileVersion: parsed.profile.version,
              profileEvidenceRef: parsed.profile.evidenceRef, organizationScopeId: parsed.scope.organizationId,
              operation: parsed.operation.name,
            })) throw fail(409, 'INVALID_114F_SNAPSHOT');
          }
          if (idempotency) {
            const mappedId = (idempotency.responseSnapshot as { snapshotId?: unknown } | null)?.snapshotId;
            if (typeof mappedId !== 'string' || !current || current.id !== mappedId
              || current.sourceBindingHash !== bindingHash) throw fail(409, 'STALE_SOURCE');
            return response(current, canonicalSourceBinding, session.revision);
          }
          const priorKey = all.find((row) => row.snapshotOperation === OPERATION && row.idempotencyKeyHash === keyHash);
          if (priorKey) throw fail(409, 'IDEMPOTENCY_CONFLICT');
          if (current?.sourceBindingHash === bindingHash && session.revision !== request.expectedSessionRevision) {
            throw fail(409, 'STALE_SESSION_REVISION');
          }
          let selected = current;
          let responseRevision = session.revision;
          if (!selected || selected.sourceBindingHash !== bindingHash) {
            if (session.revision !== request.expectedSessionRevision) throw fail(409, 'STALE_SESSION_REVISION');
            const cas = await tx.portfolioEntrySession.updateMany({
              where: { id: session.id, revision: request.expectedSessionRevision },
              data: { revision: { increment: 1 } },
            });
            if (cas.count !== 1) throw fail(409, 'CONCURRENCY_CONFLICT');
            responseRevision += 1;
            const nextGeneration = (all[0]?.snapshotGeneration ?? 0) + 1;
            if (!Number.isSafeInteger(nextGeneration) || nextGeneration > 2_147_483_647) throw fail(409, 'CONCURRENCY_CONFLICT');
            const carriedProjection = carriedProjectionSchema.parse({
              ...(payload.finalReading?.trim() ? { criticalReading: carried(payload.finalReading, latest.id) } : {}),
              ...(payload.decisionInView?.trim() ? { decisionFrame: carried(payload.decisionInView, latest.id) } : {}),
              ...(payload.firstMovement?.movement.trim() ? { firstMoveSuggestion: {
                ...carried(payload.firstMovement.movement, latest.id), truthClass: 'PROVISIONAL_USER_CONTEXT' as const,
              } } : {}),
            });
            const openItems = openItemsSchema.parse(payload.decisionChangingUnknowns.slice(0, 20).map((item) => ({
              sourceRef: latest.id, kind: 'DOWNSTREAM_NON_BLOCKING' as const,
              description: item.uncertainty.trim().slice(0, 300) || 'Pendiente de revision',
              impact: item.whyItMatters.trim().slice(0, 300),
            })));
            const now = this.now();
            if (current) await tx.portfolioEntryPortfolioContinuation.update({ where: { id: current.id }, data: {
              snapshotState: 'SUPERSEDED', supersededAt: now,
            } });
            const data = {
              sessionId: session.id, continuedByUserId: input.ownerUserId,
              snapshotFormat: CONTINUATION_114F_FORMAT, snapshotGeneration: nextGeneration, snapshotState: 'CURRENT',
              sourceContextRevision: session.contextRevision, criticalHandoffId: latest.id,
              criticalHandoffVersion: latest.artifactVersion, criticalHandoffSchemaVersion: latest.schemaVersion,
              criticalHandoffConfirmedAt: latest.confirmedAt, starteriaPathProjectionVersion: binding.starteriaPath?.projectionVersion ?? null,
              starteriaPathSchemaVersion: binding.starteriaPath?.schemaVersion ?? null,
              starteriaPathBoundaryVersion: binding.starteriaPath?.boundaryVersion ?? null,
              continuationProfile: 'PORTFOLIO_LEAD_ENTRY' as const, continuationProfileVersion: 1,
              profileEvidenceRef: session.continuationProfileEvidenceRef, organizationScopeId: organizationId,
              snapshotOperation: OPERATION, idempotencyKeyHash: keyHash, requestFingerprint: fingerprint,
              sourceBindingHash: bindingHash, carriedProjection: carriedProjection as Prisma.InputJsonValue,
              openItems: openItems as Prisma.InputJsonValue,
            };
            const candidate = classifyContinuationRow({ id: 'candidate', ...data, supersededAt: null, supersededById: null });
            if (candidate.kind !== '114F_SNAPSHOT') throw fail(422, 'INVALID_114F_SNAPSHOT');
            selected = await tx.portfolioEntryPortfolioContinuation.create({ data });
            if (current) await tx.portfolioEntryPortfolioContinuation.update({ where: { id: current.id },
              data: { supersededById: selected.id } });
          }
          await tx.portfolioEntryApiIdempotency.create({ data: {
            operation: OPERATION, scope: session.id, sessionId: session.id, idempotencyKey: keyHash,
            requestPayloadHash: fingerprint, status: 'COMPLETED', responseSnapshot: { snapshotId: selected.id },
            expiresAt: IDEMPOTENCY_NO_EXPIRY,
          } });
          return response(selected, canonicalSourceBinding, responseRevision);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        if (isRetryable(error)) throw fail(409, 'CONCURRENCY_CONFLICT');
        if (error instanceof AppError) throw error;
        throw fail(503, 'UNEXPECTED_ERROR');
      }
    }
    throw fail(409, 'CONCURRENCY_CONFLICT');
  }
}

function carried(text: string, sourceRef: string) {
  return { text: text.trim().slice(0, 500), sourceRef, origin: 'AI_SUGGESTED' as const,
    truthClass: 'CONFIRMED_REPRESENTATION' as const };
}

function response(row: { id: string; snapshotGeneration: number | null; snapshotState: string | null;
  organizationScopeId: string | null; createdAt: Date }, sourceBinding: z.infer<typeof sourceBindingSchema>, sessionRevision: number): PortfolioSetupContinueResponse {
  return portfolioSetupContinueResponseSchema.parse({
    dtoVersion: 'portfolio-setup-continuity-write-v0.1', snapshotId: row.id,
    snapshotGeneration: row.snapshotGeneration, snapshotState: row.snapshotState, sessionRevision,
    sourceBinding, continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 },
    organizationScopeId: row.organizationScopeId, nextAuthorizedSurface: 'PORTFOLIO_HOME_BOOTSTRAP',
    currentness: 'REVALIDATED_AT_WRITE', createdAt: row.createdAt.toISOString(),
  });
}
