import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { parseCriticalHandoffLifecycle, parseCriticalHandoffPayload,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { BUSINESS_CAPABILITY_BOUNDARY_VERSION, STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION } from '../portfolio-entry/domain/starteria-path.types';
import { carriedProjectionSchema, classifyContinuationRow, CONTINUATION_114F_FORMAT,
  openItemsSchema, sourceBindingFingerprint } from './portfolio-entry-continuation.data-contract';

export const portfolioSetupHomeArrivalDtoSchema = z.object({
  dtoVersion: z.literal('portfolio-setup-home-arrival-v0.1'),
  snapshotId: z.string().min(1), snapshotGeneration: z.number().int().positive(), sessionId: z.string().min(1),
  organization: z.object({ id: z.string().min(1), name: z.string() }).strict(),
  source: z.object({ contextRevision: z.number().int().nonnegative(),
    criticalHandoffId: z.string().min(1), criticalHandoffVersion: z.number().int().positive() }).strict(),
  continuationProfile: z.object({ value: z.literal('PORTFOLIO_LEAD_ENTRY'), version: z.literal(1) }).strict(),
  carriedContext: carriedProjectionSchema.nullable(), openItems: openItemsSchema,
  currentness: z.literal('REVALIDATED_AT_HOME_ARRIVAL'), bootstrapEligible: z.literal(true),
}).strict();
export type PortfolioSetupHomeArrivalDto = z.infer<typeof portfolioSetupHomeArrivalDtoSchema>;

type ValidatedSnapshot = { dto: PortfolioSetupHomeArrivalDto; carriedContext: z.infer<typeof carriedProjectionSchema> | null };
const unavailable = () => AppError.notFound('Portfolio Setup continuation', 'PORTFOLIO_SETUP_ARRIVAL_NOT_FOUND');
const stale = () => AppError.conflict('La lectura de origen cambió. Revisa la entrada actual.', 'PORTFOLIO_SETUP_ARRIVAL_STALE_SOURCE');
const invalid = () => AppError.conflict('La continuidad ya no es válida.', 'PORTFOLIO_SETUP_ARRIVAL_INVALID_SNAPSHOT');

/** Exact-snapshot consumer validation. Call inside the same transaction as Bootstrap create/reuse. */
export async function validatePortfolioSetupArrival(
  tx: Prisma.TransactionClient, snapshotId: string, userId: string, now = new Date(),
): Promise<ValidatedSnapshot> {
  if (!userId) throw AppError.unauthorized('Autenticación requerida.', 'PORTFOLIO_SETUP_ARRIVAL_AUTH_REQUIRED');
  const row = await tx.portfolioEntryPortfolioContinuation.findUnique({ where: { id: snapshotId } });
  if (!row || row.continuedByUserId !== userId || row.snapshotFormat !== CONTINUATION_114F_FORMAT) throw unavailable();
  const classified = classifyContinuationRow(row);
  if (classified.kind !== '114F_SNAPSHOT') throw invalid();
  if (classified.lifecycle.state !== 'CURRENT' || classified.lifecycle.supersededAt || classified.lifecycle.supersededById) throw stale();
  if (!classified.scope.organizationId || classified.operation.name !== 'PORTFOLIO_SETUP_CONTINUE_V1') throw invalid();
  const expectedHash = sourceBindingFingerprint({
    sessionId: classified.sessionId, ownerUserId: classified.ownerUserId,
    sourceContextRevision: classified.source.contextRevision,
    criticalHandoffId: classified.source.criticalHandoffId,
    criticalHandoffVersion: classified.source.criticalHandoffVersion,
    criticalHandoffSchemaVersion: classified.source.criticalHandoffSchemaVersion ?? '',
    criticalHandoffConfirmedAt: classified.source.confirmedAt.toISOString(),
    starteriaPath: classified.source.starteriaPath,
    continuationProfile: classified.profile.value, continuationProfileVersion: classified.profile.version,
    profileEvidenceRef: classified.profile.evidenceRef,
    organizationScopeId: classified.scope.organizationId, operation: classified.operation.name,
  });
  if (classified.source.bindingHash !== expectedHash) throw invalid();

  // The session row is the serialization point for source mutations. A concurrent source
  // advance cannot pass this gate and commit before Bootstrap's transaction finishes.
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioEntrySession" WHERE "id" = ${classified.sessionId} FOR SHARE`);
  const session = await tx.portfolioEntrySession.findUnique({ where: { id: classified.sessionId }, select: {
    id: true, ownerUserId: true, ownershipState: true, lifecycleStatus: true,
    expiresAt: true, expiredAt: true, contextRevision: true, continuationProfile: true,
    continuationProfileVersion: true, continuationProfileEvidenceRef: true,
  } });
  if (!session || session.ownerUserId !== userId || session.ownershipState !== 'CLAIMED') throw unavailable();
  if (session.expiredAt || session.expiresAt <= now
    || !['HANDOFF_READY', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'CONVERSION_ELIGIBLE'].includes(session.lifecycleStatus)) throw stale();
  if (session.contextRevision !== classified.source.contextRevision) throw stale();
  if (session.continuationProfile !== 'PORTFOLIO_LEAD_ENTRY' || session.continuationProfileVersion !== 1
    || !session.continuationProfileEvidenceRef?.trim()
    || classified.profile.value !== session.continuationProfile
    || classified.profile.version !== session.continuationProfileVersion
    || classified.profile.evidenceRef !== session.continuationProfileEvidenceRef) {
    throw AppError.conflict('El perfil de continuidad cambió.', 'PORTFOLIO_SETUP_ARRIVAL_PROFILE_CONFLICT');
  }
  const handoff = await tx.portfolioEntryCriticalHandoff.findFirst({
    where: { sessionId: session.id }, orderBy: { artifactVersion: 'desc' },
    select: { id: true, sessionId: true, artifactVersion: true, schemaVersion: true,
      sourceContextRevision: true, confirmationState: true, confirmedAt: true,
      confirmedByUserId: true, payload: true },
  });
  if (!handoff || handoff.sessionId !== session.id || handoff.id !== classified.source.criticalHandoffId
    || handoff.artifactVersion !== classified.source.criticalHandoffVersion
    || handoff.schemaVersion !== classified.source.criticalHandoffSchemaVersion
    || handoff.schemaVersion !== PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION
    || handoff.sourceContextRevision !== session.contextRevision
    || handoff.confirmationState !== 'confirmed' || handoff.confirmedByUserId !== userId
    || handoff.confirmedAt?.getTime() !== classified.source.confirmedAt.getTime()) throw stale();
  try {
    parseCriticalHandoffLifecycle(handoff.confirmationState, handoff.confirmedAt, handoff.confirmedByUserId);
    const payload = parseCriticalHandoffPayload(handoff.schemaVersion, handoff.payload);
    if (payload.conclusionStatus === 'insufficient_basis') throw stale();
  } catch { throw stale(); }
  if (classified.source.starteriaPath && (
    classified.source.starteriaPath.projectionVersion !== STARTERIA_PATH_PROJECTION_VERSION
    || classified.source.starteriaPath.schemaVersion !== STARTERIA_PATH_SCHEMA_VERSION
    || classified.source.starteriaPath.boundaryVersion !== BUSINESS_CAPABILITY_BOUNDARY_VERSION)) throw stale();

  const scope = await new ScopedPortfolioAccessService(tx).revalidateReadableScope({
    userId, organizationId: classified.scope.organizationId,
  });
  if (scope.state === 'RESOLVER_FAILURE') throw new AppError(503, 'No se pudo validar el acceso al Portfolio.', 'PORTFOLIO_SETUP_ARRIVAL_SCOPE_VALIDATION_FAILED');
  if (scope.state !== 'AUTHORIZED') throw AppError.forbidden('El acceso a este Portfolio ya no está disponible.', 'PORTFOLIO_SETUP_ARRIVAL_SCOPE_REVOKED');
  const dto = portfolioSetupHomeArrivalDtoSchema.parse({
    dtoVersion: 'portfolio-setup-home-arrival-v0.1', snapshotId: classified.id,
    snapshotGeneration: classified.generation, sessionId: session.id,
    organization: { id: scope.scope.organizationId, name: scope.scope.name },
    source: { contextRevision: session.contextRevision, criticalHandoffId: handoff.id,
      criticalHandoffVersion: handoff.artifactVersion },
    continuationProfile: { value: 'PORTFOLIO_LEAD_ENTRY', version: 1 },
    carriedContext: classified.carriedProjection, openItems: classified.openItems,
    currentness: 'REVALIDATED_AT_HOME_ARRIVAL', bootstrapEligible: true,
  });
  return { dto, carriedContext: classified.carriedProjection };
}

export class PortfolioSetupHomeArrivalService {
  constructor(private readonly db: PrismaClient, private readonly now: () => Date = () => new Date()) {}
  async read(input: { snapshotId: string; userId: string }): Promise<PortfolioSetupHomeArrivalDto> {
    return this.db.$transaction(async (tx) => (await validatePortfolioSetupArrival(tx, input.snapshotId, input.userId, this.now())).dto,
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 });
  }
}
