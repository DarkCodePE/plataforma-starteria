import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ScopedPortfolioAccessService, type ReadablePortfolioScope,
  type ReadableScopeResolution } from '../../shared/authz/scoped-portfolio-access.service';
import { parseCriticalHandoffLifecycle, parseCriticalHandoffPayload,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION } from '../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import { BUSINESS_CAPABILITY_BOUNDARY_VERSION, STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION } from '../portfolio-entry/domain/starteria-path.types';
import { classifyContinuationRow, sourceBindingFingerprint, type ContinuationClassification } from './portfolio-entry-continuation.data-contract';
import { portfolioSetupContinuityDtoSchema, PORTFOLIO_SETUP_CONTINUITY_DTO_VERSION,
  type PortfolioSetupContinuityDto } from './portfolio-setup-continuity.dto';

type ReadSession = {
  id: string; ownerUserId: string | null; ownershipState: string; lifecycleStatus: string;
  expiresAt: Date; expiredAt: Date | null; contextRevision: number;
  continuationProfile: string | null; continuationProfileVersion: number | null;
  continuationProfileEvidenceRef: string | null;
};
type ReadHandoff = {
  id: string; sessionId: string; artifactVersion: number; schemaVersion: string; sourceContextRevision: number;
  confirmationState: string; confirmedAt: Date | null; confirmedByUserId: string | null; payload: unknown;
};
type ReadSnapshot = Parameters<typeof classifyContinuationRow>[0];

export type PortfolioSetupReadView = {
  readSession: (sessionId: string) => Promise<ReadSession | null>;
  readLatestHandoff: (sessionId: string) => Promise<ReadHandoff | null>;
  readCurrentSnapshots: (sessionId: string) => Promise<ReadSnapshot[]>;
  resolveReadableScopes: (userId: string) => Promise<ReadableScopeResolution>;
};
export type PortfolioSetupReadDependencies = {
  withReadView: <T>(sessionId: string, run: (view: PortfolioSetupReadView) => Promise<T>) => Promise<T>;
};

/** Read-only Prisma adapter. No legacy JSON or tenant data is fetched here. */
export function createPortfolioSetupReadDependencies(db: PrismaClient): PortfolioSetupReadDependencies {
  const viewFrom = (reader: Prisma.TransactionClient): PortfolioSetupReadView => {
    const scoped = new ScopedPortfolioAccessService(reader);
    return {
    readSession: (id) => reader.portfolioEntrySession.findUnique({ where: { id }, select: {
      id: true, ownerUserId: true, ownershipState: true, lifecycleStatus: true, expiresAt: true, expiredAt: true,
      contextRevision: true, continuationProfile: true, continuationProfileVersion: true,
      continuationProfileEvidenceRef: true,
    } }),
    readLatestHandoff: (sessionId) => reader.portfolioEntryCriticalHandoff.findFirst({
      where: { sessionId }, orderBy: { artifactVersion: 'desc' }, select: {
        id: true, sessionId: true, artifactVersion: true, schemaVersion: true, sourceContextRevision: true,
        confirmationState: true, confirmedAt: true, confirmedByUserId: true, payload: true,
      },
    }),
    readCurrentSnapshots: (sessionId) => reader.portfolioEntryPortfolioContinuation.findMany({
      where: { sessionId, snapshotState: 'CURRENT', snapshotFormat: { not: null } }, take: 2,
      select: {
        id: true, sessionId: true, continuedByUserId: true, snapshotFormat: true, snapshotGeneration: true,
        snapshotState: true, sourceContextRevision: true, criticalHandoffId: true, criticalHandoffVersion: true,
        criticalHandoffSchemaVersion: true, criticalHandoffConfirmedAt: true,
        starteriaPathProjectionVersion: true, starteriaPathSchemaVersion: true, starteriaPathBoundaryVersion: true,
        continuationProfile: true, continuationProfileVersion: true, profileEvidenceRef: true,
        organizationScopeId: true, snapshotOperation: true, idempotencyKeyHash: true,
        requestFingerprint: true, sourceBindingHash: true, supersededAt: true, supersededById: true,
        carriedProjection: true, openItems: true,
      },
    }),
    resolveReadableScopes: (userId) => scoped.resolveReadableScopes(userId),
    };
  };
  return {
    withReadView: (sessionId, run) => db.$transaction(async (tx) => {
      // Source mutations take the session row as their serialization point.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "PortfolioEntrySession" WHERE "id" = ${sessionId} FOR SHARE`);
      return run(viewFrom(tx));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 }),
  };
}

const lifecycleAllowed = new Set(['HANDOFF_READY', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'CONVERSION_ELIGIBLE']);

export class PortfolioSetupContinuityReadService {
  constructor(private readonly deps: PortfolioSetupReadDependencies, private readonly now: () => Date = () => new Date()) {}

  async read(input: { sessionId: string; ownerUserId: string }): Promise<PortfolioSetupContinuityDto> {
    if (!input.ownerUserId) throw AppError.unauthorized('Autenticacion requerida.', 'PORTFOLIO_SETUP_AUTH_REQUIRED');
    return this.deps.withReadView(input.sessionId, (view) => this.readFromView(input, view));
  }

  private async readFromView(input: { sessionId: string; ownerUserId: string }, view: PortfolioSetupReadView): Promise<PortfolioSetupContinuityDto> {
    const session = await view.readSession(input.sessionId);
    if (!session || session.ownershipState !== 'CLAIMED' || session.ownerUserId !== input.ownerUserId) {
      throw AppError.notFound('Portfolio Entry session', 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND');
    }
    const base = (): PortfolioSetupContinuityDto => ({ dtoVersion: PORTFOLIO_SETUP_CONTINUITY_DTO_VERSION,
      status: 'STALE_SOURCE', scopeState: 'UNRESOLVED', portfolioAccess: { portfolioRead: false }, openItems: [] });
    const done = (value: PortfolioSetupContinuityDto) => portfolioSetupContinuityDtoSchema.parse(value);
    if (session.expiredAt || session.expiresAt <= this.now() || !lifecycleAllowed.has(session.lifecycleStatus)) {
      return done({ ...base(), recovery: { code: 'REVIEW_CRITICAL_HANDOFF' } });
    }

    let handoff: ReadHandoff | null;
    try { handoff = await view.readLatestHandoff(session.id); }
    catch { return done({ ...base(), status: 'ERROR', recovery: { code: 'RETRY_READ' } }); }
    if (!handoff || handoff.sessionId !== session.id || handoff.sourceContextRevision !== session.contextRevision
      || handoff.schemaVersion !== PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION
      || !Number.isSafeInteger(handoff.artifactVersion) || handoff.artifactVersion < 1
      || handoff.confirmationState !== 'confirmed' || handoff.confirmedByUserId !== input.ownerUserId) {
      return done({ ...base(), recovery: { code: 'REVIEW_CRITICAL_HANDOFF' } });
    }
    let payload: ReturnType<typeof parseCriticalHandoffPayload>;
    try {
      parseCriticalHandoffLifecycle(handoff.confirmationState, handoff.confirmedAt, handoff.confirmedByUserId);
      payload = parseCriticalHandoffPayload(handoff.schemaVersion, handoff.payload);
    } catch {
      return done({ ...base(), recovery: { code: 'REVIEW_CRITICAL_HANDOFF' } });
    }
    const sourceBinding: NonNullable<PortfolioSetupContinuityDto['sourceBinding']> = {
      sessionId: session.id, contextRevision: session.contextRevision, criticalHandoffId: handoff.id,
      criticalHandoffVersion: handoff.artifactVersion, criticalHandoffSchemaVersion: handoff.schemaVersion,
      confirmedAt: handoff.confirmedAt!.toISOString(),
    };
    const ownContext: Pick<PortfolioSetupContinuityDto, 'sourceBinding' | 'carriedContext' | 'openItems'> = {
      sourceBinding,
      carriedContext: { ...(payload.finalReading ? { criticalReading: payload.finalReading.slice(0, 500) } : {}),
        ...(payload.decisionInView ? { decisionInView: payload.decisionInView.slice(0, 500) } : {}),
        truthClass: 'CONFIRMED_REPRESENTATION' },
      openItems: payload.decisionChangingUnknowns.slice(0, 20).map((item) => ({
        sourceRef: handoff.id, kind: 'DOWNSTREAM_NON_BLOCKING' as const,
        description: item.uncertainty.slice(0, 300) || 'Pendiente de revision', impact: item.whyItMatters.slice(0, 300),
      })),
    };
    const profile = session.continuationProfile;
    if ((profile !== 'PORTFOLIO_LEAD_ENTRY' && profile !== 'INITIATIVE_ENTRY')
      || session.continuationProfileVersion !== 1 || !session.continuationProfileEvidenceRef?.trim()) {
      return done({ ...base(), ...ownContext, status: 'PROFILE_CONFLICT', recovery: { code: 'REVIEW_PROFILE' } });
    }
    const continuationProfile: NonNullable<PortfolioSetupContinuityDto['continuationProfile']> = {
      value: profile as 'PORTFOLIO_LEAD_ENTRY' | 'INITIATIVE_ENTRY', version: 1, evidence: 'SERVER_OWNED_VERSIONED',
    };
    if (payload.conclusionStatus === 'insufficient_basis') {
      return done({ ...base(), ...ownContext, continuationProfile, status: 'BLOCKED_AUTHORITY',
        recovery: { code: 'REVIEW_CRITICAL_HANDOFF' } });
    }
    if (profile === 'INITIATIVE_ENTRY') {
      return done({ ...base(), ...ownContext, continuationProfile, status: 'BLOCKED_AUTHORITY',
        recovery: { code: 'INITIATIVE_AUTHORITY_REQUIRED' } });
    }

    let rows: ReadSnapshot[];
    try { rows = await view.readCurrentSnapshots(session.id); }
    catch { return done({ ...base(), ...ownContext, continuationProfile, status: 'ERROR', recovery: { code: 'RETRY_READ' } }); }
    if (rows.length > 1) return done({ ...base(), ...ownContext, continuationProfile, status: 'ERROR', recovery: { code: 'INVALID_114F_SNAPSHOT' } });
    const classified = rows[0] ? classifyContinuationRow(rows[0]) : null;
    if (classified?.kind === 'INVALID_114F_SNAPSHOT') {
      return done({ ...base(), ...ownContext, continuationProfile, status: 'ERROR', recovery: { code: 'INVALID_114F_SNAPSHOT' } });
    }
    const current = classified?.kind === '114F_SNAPSHOT' ? classified : null;
    if (current) {
      if (!snapshotMatchesSource(current, session, handoff)) {
        return done({ ...base(), ...ownContext, continuationProfile, status: 'STALE_SOURCE', recovery: { code: 'REVIEW_CRITICAL_HANDOFF' } });
      }
      if (!snapshotBindingIsValid(current)) {
        return done({ ...base(), ...ownContext, continuationProfile, status: 'ERROR', recovery: { code: 'INVALID_114F_SNAPSHOT' } });
      }
      if (current.source.starteriaPath) sourceBinding.starteriaPath = current.source.starteriaPath;
    }

    let resolution: ReadableScopeResolution;
    try { resolution = await view.resolveReadableScopes(input.ownerUserId); }
    catch { return done({ ...base(), ...ownContext, continuationProfile, status: 'SCOPE_VALIDATION_FAILED',
      scopeState: 'VALIDATION_FAILED', recovery: { code: 'RETRY_SCOPE_VALIDATION' } }); }
    if (resolution.state === 'RESOLVER_FAILURE') {
      return done({ ...base(), ...ownContext, continuationProfile, status: 'SCOPE_VALIDATION_FAILED',
        scopeState: 'VALIDATION_FAILED', recovery: { code: 'RETRY_SCOPE_VALIDATION' } });
    }
    const scopes: ReadablePortfolioScope[] = resolution.scopes;
    // A snapshot is never a grant. A revoked stored scope is omitted from public output.
    const snapshotScope = current?.scope.organizationId
      ? scopes.find((scope) => scope.organizationId === current.scope.organizationId) : undefined;
    const chosen = snapshotScope ?? (scopes.length === 1 ? scopes[0] : undefined);
    const status = chosen ? 'READY_AUTHORIZED_SCOPE' : scopes.length > 1 ? 'SELECT_SCOPE'
      : current?.scope.organizationId ? 'NO_AUTHORIZED_SCOPE' : 'READY_PROVISIONAL';
    const output: PortfolioSetupContinuityDto = {
      ...base(), ...ownContext, continuationProfile, status,
      scopeState: resolution.state === 'ZERO_SCOPES' ? 'NONE' : resolution.state === 'ONE_SCOPE' ? 'ONE' : 'MULTIPLE',
      portfolioAccess: { portfolioRead: Boolean(chosen), checkedAt: this.now().toISOString() },
      ...(scopes.length > 0 ? { authorizedScopes: scopes } : {}), ...(chosen ? { currentScope: chosen } : {}),
      ...(snapshotScope && current ? { snapshot: { id: current.id, generation: current.generation,
        format: 'PORTFOLIO_SETUP_114F_V1', ...(current.carriedProjection ? { carriedProjection: current.carriedProjection } : {}) },
        openItems: current.openItems } : {}),
      nextAuthorizedSurface: chosen ? 'PORTFOLIO_HOME_BOOTSTRAP'
        : scopes.length > 1 ? 'SCOPE_SELECTION_REQUIRED' : 'PROVISIONAL_CONTEXT_ESTABLISHMENT',
      ...(!chosen && scopes.length === 0 ? { recovery: { code: 'REQUEST_SCOPED_ACCESS' as const } } : {}),
    };
    return done(output);
  }
}

function snapshotMatchesSource(snapshot: Extract<ContinuationClassification, { kind: '114F_SNAPSHOT' }>,
  session: ReadSession, handoff: ReadHandoff): boolean {
  return snapshot.sessionId === session.id && snapshot.ownerUserId === session.ownerUserId
    && snapshot.lifecycle.state === 'CURRENT' && snapshot.source.contextRevision === session.contextRevision
    && snapshot.source.criticalHandoffId === handoff.id
    && snapshot.source.criticalHandoffVersion === handoff.artifactVersion
    && snapshot.source.criticalHandoffSchemaVersion === handoff.schemaVersion
    && snapshot.source.confirmedAt.getTime() === handoff.confirmedAt?.getTime()
    && snapshot.profile.value === session.continuationProfile
    && snapshot.profile.version === session.continuationProfileVersion
    && snapshot.profile.evidenceRef === session.continuationProfileEvidenceRef
    && (!snapshot.source.starteriaPath || (snapshot.source.starteriaPath.projectionVersion === STARTERIA_PATH_PROJECTION_VERSION
      && snapshot.source.starteriaPath.schemaVersion === STARTERIA_PATH_SCHEMA_VERSION
      && snapshot.source.starteriaPath.boundaryVersion === BUSINESS_CAPABILITY_BOUNDARY_VERSION));
}

function snapshotBindingIsValid(snapshot: Extract<ContinuationClassification, { kind: '114F_SNAPSHOT' }>): boolean {
  return snapshot.source.bindingHash === sourceBindingFingerprint({
    sessionId: snapshot.sessionId, ownerUserId: snapshot.ownerUserId,
    sourceContextRevision: snapshot.source.contextRevision, criticalHandoffId: snapshot.source.criticalHandoffId,
    criticalHandoffVersion: snapshot.source.criticalHandoffVersion,
    criticalHandoffSchemaVersion: snapshot.source.criticalHandoffSchemaVersion ?? '',
    criticalHandoffConfirmedAt: snapshot.source.confirmedAt.toISOString(), starteriaPath: snapshot.source.starteriaPath,
    continuationProfile: snapshot.profile.value, continuationProfileVersion: snapshot.profile.version,
    profileEvidenceRef: snapshot.profile.evidenceRef, organizationScopeId: snapshot.scope.organizationId,
    operation: snapshot.operation.name,
  });
}
