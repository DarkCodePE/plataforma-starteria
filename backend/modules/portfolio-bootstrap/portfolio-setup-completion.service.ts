import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { can, type Permission } from '../../shared/authz/permissions';
import { AppError } from '../../shared/errors/AppError';
import { LAB_RECIPIENTS } from '../portfolio-lab/portfolio-lab-request.service';

type CompletionSummary = { sent: number; unsent: number; failed: number };
type LabCompletionSummary = { notified: number };
export type PortfolioSetupCompletionRoute = 'TEAM_SENT' | 'LAB_NOTIFIED' | 'BOTH';
type CompletionResult = {
  completed: true;
  completedAt: string;
  completionRoute: PortfolioSetupCompletionRoute;
  summary: CompletionSummary;
  labSummary: LabCompletionSummary;
};

export class PortfolioSetupCompletionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async complete(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    confirmed: boolean;
    idempotencyKey: string;
  }): Promise<CompletionResult> {
    if (!can(input.permissions, 'portfolio:write')) {
      throw AppError.forbidden('No tienes permiso para finalizar esta configuración.', 'PORTFOLIO_SETUP_COMPLETE_FORBIDDEN');
    }
    if (!input.confirmed) {
      throw AppError.badRequest('Confirma explícitamente que quieres finalizar esta configuración.', 'PORTFOLIO_SETUP_CONFIRMATION_REQUIRED');
    }
    if (!input.idempotencyKey.trim()) {
      throw AppError.badRequest('Falta la clave de idempotencia.', 'IDEMPOTENCY_KEY_REQUIRED');
    }

    return withSerializableRetry(() => this.prisma.$transaction(async (transaction) => {
      const db = transaction as any;
      const actor = await db.user.findUnique({
        where: { id: input.authenticatedUserId },
        select: { id: true, organizationId: true },
      });
      if (!actor) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_SETUP_AUTH_REQUIRED');

      const session = await db.portfolioBootstrapSession.findFirst({
        where: {
          id: input.sessionId,
          userId: input.authenticatedUserId,
          organizationId: actor.organizationId,
        },
        include: { anchor: true, organizationMaterializations: true },
      });
      if (!session) throw AppError.notFound('Configuración de Portfolio', 'PORTFOLIO_SETUP_NOT_FOUND');
      const challengeIds = canonicalChallengeIds(session.organizationMaterializations);
      if (challengeIds.length === 0) {
        throw AppError.conflict('La configuración todavía no tiene un frente y un reto canónicos.', 'PORTFOLIO_SETUP_STRUCTURE_REQUIRED');
      }

      if (session.setupCompletedAt) {
        const audit = await db.auditLog.findFirst({
          where: {
            userId: input.authenticatedUserId,
            action: 'portfolio_setup_completed',
            resource: 'portfolio_setup',
            resourceId: session.id,
          },
          orderBy: { createdAt: 'desc' },
          select: { details: true },
        });
        const snapshot = completionSnapshot(audit?.details);
        if (snapshot) {
          return { completed: true as const, completedAt: session.setupCompletedAt.toISOString(), ...snapshot };
        }
      }

      const assignments = await db.portfolioHandoffAssignment.findMany({
        where: {
          organizationId: actor.organizationId,
          challengeId: { in: challengeIds },
        },
        include: {
          briefVersion: { select: { id: true, status: true, challengeId: true } },
          deliveryAttempts: { orderBy: { attemptedAt: 'desc' } },
        },
      });
      const summary = summarizeAssignments(assignments, challengeIds);
      const labRequests = await db.portfolioLabRequest.findMany({
        where: {
          organizationId: actor.organizationId,
          requesterId: input.authenticatedUserId,
          challengeId: { in: challengeIds },
          status: { notIn: ['CLOSED', 'NOT_PROCEEDING', 'CANCELLED'] },
          notificationStatus: 'NOTIFIED',
        },
        include: {
          briefVersion: {
            select: { id: true, organizationId: true, challengeId: true, briefId: true, status: true },
          },
          notificationAttempts: {
            where: { status: 'ACCEPTED' },
            select: { status: true, acceptedRecipients: true },
          },
        },
      });
      const labRequestIds = eligibleLabRequestIds(
        labRequests,
        actor.organizationId,
        input.authenticatedUserId,
        challengeIds,
      );
      const labSummary = { notified: labRequestIds.length };
      if (summary.sent === 0 && labSummary.notified === 0) {
        throw AppError.conflict(
          'Envía al menos una invitación y confirma su recepción SMTP antes de finalizar.',
          'PORTFOLIO_SETUP_DELIVERY_REQUIRED',
        );
      }

      const completionRoute = routeFor(summary, labSummary);
      const completedAt = session.setupCompletedAt ?? this.now();
      if (!session.setupCompletedAt) {
        const claimed = await db.portfolioBootstrapSession.updateMany({
          where: {
            id: session.id,
            userId: input.authenticatedUserId,
            organizationId: actor.organizationId,
            setupCompletedAt: null,
          },
          data: {
            setupCompletedAt: completedAt,
            setupCompletedByActorId: input.authenticatedUserId,
            setupCompletionIdempotencyKey: input.idempotencyKey.trim(),
          },
        });
        if (claimed.count === 1) {
          await this.audit(db, input.authenticatedUserId, 'portfolio_setup_completed', session.id, {
            organizationId: actor.organizationId,
            summary,
            labSummary,
            labRequestIds,
            completionRoute,
          });
        } else {
          const completed = await db.portfolioBootstrapSession.findFirst({
            where: {
              id: session.id,
              userId: input.authenticatedUserId,
              organizationId: actor.organizationId,
              setupCompletedAt: { not: null },
            },
            select: { setupCompletedAt: true },
          });
          if (!completed?.setupCompletedAt) {
            throw AppError.conflict('La configuraciÃ³n cambiÃ³ durante el cierre.', 'PORTFOLIO_SETUP_COMPLETION_CONFLICT');
          }
          return {
            completed: true as const,
            completedAt: completed.setupCompletedAt.toISOString(),
            completionRoute,
            summary,
            labSummary,
          };
        }
      }
      return {
        completed: true as const,
        completedAt: completedAt.toISOString(),
        completionRoute,
        summary,
        labSummary,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }));
  }

  async openAdditionalFront(input: {
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
  }): Promise<any> {
    if (!can(input.permissions, 'portfolio:write')) {
      throw AppError.forbidden('No tienes permiso para preparar otro frente.', 'PORTFOLIO_SETUP_FRONT_FORBIDDEN');
    }
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw AppError.badRequest('Falta la clave de idempotencia.', 'IDEMPOTENCY_KEY_REQUIRED');
    }

    const rootDb = this.prisma as any;
    const actor = await rootDb.user.findUnique({
      where: { id: input.authenticatedUserId },
      select: { id: true, organizationId: true },
    });
    if (!actor) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_SETUP_AUTH_REQUIRED');

    const sessionId = additionalFrontSessionId(input.authenticatedUserId, actor.organizationId, idempotencyKey);
    const run = async () => this.prisma.$transaction(async (transaction) => {
      const db = transaction as any;
      const replay = await db.portfolioBootstrapSession.findFirst({
        where: {
          id: sessionId,
          userId: input.authenticatedUserId,
          organizationId: actor.organizationId,
        },
        include: { anchor: true },
      });
      if (replay) return emptyBootstrapDto(replay, replay.anchor);

      const previous = await db.portfolioBootstrapSession.findFirst({
        where: {
          userId: input.authenticatedUserId,
          organizationId: actor.organizationId,
          setupCompletedAt: { not: null },
          organizationMaterializations: { some: {} },
        },
        orderBy: { setupCompletedAt: 'desc' },
        include: { anchor: true, organizationMaterializations: true },
      });
      if (!previous?.anchor) {
        throw AppError.conflict('Finaliza primero la configuración actual.', 'PORTFOLIO_SETUP_COMPLETED_CONTEXT_REQUIRED');
      }

      const created = await db.portfolioBootstrapSession.create({
        data: {
          id: sessionId,
          userId: input.authenticatedUserId,
          organizationId: actor.organizationId,
          sourceContinuationId: null,
          status: 'awaiting_anchor_review',
          bootstrapPhase: 'B1_ANCHOR',
          existingWorkStatus: 'unknown',
        },
      });
      const anchor = await db.portfolioAnchor.create({
        data: {
          bootstrapSessionId: created.id,
          outcomeStatement: '',
          contextSummary: null,
          decisionToEnable: null,
          businessSignalStatus: 'unknown',
          businessSignalValue: null,
          status: 'anchor_insufficient',
          sourceRefs: {
            organizationalContextReference: {
              sourceBootstrapSessionId: previous.id,
              contextSummary: previous.anchor.contextSummary,
              outcomeStatement: previous.anchor.outcomeStatement,
              decisionToEnable: previous.anchor.decisionToEnable,
              businessSignalStatus: previous.anchor.businessSignalStatus,
              businessSignalValue: previous.anchor.businessSignalValue,
              priorSourceRefs: previous.anchor.sourceRefs,
              reviewStatus: 'reference_only',
            },
          },
          provenanceStatus: 'extracted',
          confirmedBy: null,
          confirmedAt: null,
          version: 1,
        },
      });
      await this.audit(db, input.authenticatedUserId, 'portfolio_setup_additional_front_opened', created.id, {
        organizationId: actor.organizationId,
        organizationalContextReferenceFrom: previous.id,
        creationIntentHash: sessionId,
      });
      return emptyBootstrapDto(created, anchor);
    });

    try {
      return await run();
    } catch (error) {
      // The deterministic id is the durable idempotency boundary. If two
      // requests for the same user intent race, the committed winner is the
      // only session that can own this id.
      const replay = await rootDb.portfolioBootstrapSession.findFirst({
        where: { id: sessionId, userId: input.authenticatedUserId, organizationId: actor.organizationId },
        include: { anchor: true },
      });
      if (replay) return emptyBootstrapDto(replay, replay.anchor);
      throw error;
    }
  }

  private audit(db: any, userId: string, action: string, resourceId: string, details: unknown) {
    return db.auditLog.create({ data: { userId, action, resource: 'portfolio_setup', resourceId, details } });
  }
}

function additionalFrontSessionId(userId: string, organizationId: string | null, idempotencyKey: string): string {
  const digest = createHash('sha256')
    .update(`${userId}\u0000${organizationId ?? ''}\u0000${idempotencyKey}`)
    .digest('hex')
    .slice(0, 32);
  return `portfolio-additional-${digest}`;
}

function canonicalChallengeIds(materializations: any[]): string[] {
  const ids = new Set<string>();
  for (const materialization of materializations ?? []) {
    const mappings = materialization?.canonicalMappings;
    if (!mappings || typeof mappings !== 'object' || !Array.isArray(mappings.challenges)) continue;
    for (const challenge of mappings.challenges) {
      if (typeof challenge?.canonicalId === 'string' && challenge.canonicalId) ids.add(challenge.canonicalId);
    }
  }
  return [...ids];
}

function summarizeAssignments(assignments: any[], challengeIds: string[]): CompletionSummary {
  let sent = 0;
  let unsent = 0;
  let failed = 0;
  for (const assignment of assignments ?? []) {
    if (!challengeIds.includes(assignment.briefVersion?.challengeId ?? assignment.challengeId ?? challengeIds[0])) continue;
    const succeeded = (assignment.deliveryAttempts ?? []).some((attempt: any) => attempt.status === 'SUCCEEDED');
    const hasFailed = !succeeded && (assignment.deliveryAttempts ?? []).some((attempt: any) => attempt.status === 'FAILED');
    const exactBrief = assignment.targetKind !== 'CHALLENGE'
      || (assignment.briefVersion?.status === 'CONFIRMED' && challengeIds.includes(assignment.briefVersion.challengeId));
    if (succeeded && exactBrief && ['SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'STARTED'].includes(assignment.state)) sent += 1;
    else if (hasFailed) failed += 1;
    else if (assignment.state === 'CREATED') unsent += 1;
  }
  return { sent, unsent, failed };
}

function eligibleLabRequestIds(
  requests: any[],
  organizationId: string | null,
  requesterId: string,
  challengeIds: string[],
): string[] {
  const requestIds: string[] = [];
  for (const request of requests ?? []) {
    if (request.organizationId !== organizationId) continue;
    if (request.requesterId !== requesterId) continue;
    if (!challengeIds.includes(request.challengeId)) continue;
    if (['CLOSED', 'NOT_PROCEEDING', 'CANCELLED'].includes(request.status)) continue;
    if (request.notificationStatus !== 'NOTIFIED') continue;
    const version = request.briefVersion;
    if (!version
      || version.id !== request.briefVersionId
      || version.briefId !== request.briefId
      || version.organizationId !== organizationId
      || version.challengeId !== request.challengeId
      || version.status !== 'CONFIRMED') continue;
    const acceptedRecipients = new Set<string>((request.notificationAttempts ?? [])
      .filter((attempt: any) => attempt.status === 'ACCEPTED')
      .flatMap((attempt: any) => attempt.acceptedRecipients ?? [])
      .map((recipient: string) => recipient.toLowerCase()));
    if (!LAB_RECIPIENTS.every((recipient) => acceptedRecipients.has(recipient))) continue;
    requestIds.push(request.id);
  }
  return requestIds;
}

function completionSnapshot(details: unknown): Pick<CompletionResult, 'completionRoute' | 'summary' | 'labSummary'> | null {
  if (!details || typeof details !== 'object') return null;
  const value = details as Record<string, any>;
  if (!['TEAM_SENT', 'LAB_NOTIFIED', 'BOTH'].includes(value.completionRoute)) return null;
  if (!value.summary || typeof value.summary.sent !== 'number'
    || typeof value.summary.unsent !== 'number' || typeof value.summary.failed !== 'number') return null;
  if (!value.labSummary || typeof value.labSummary.notified !== 'number') return null;
  return {
    completionRoute: value.completionRoute,
    summary: value.summary,
    labSummary: value.labSummary,
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw lastError;
}

function routeFor(
  summary: CompletionSummary,
  labSummary: LabCompletionSummary,
): PortfolioSetupCompletionRoute {
  if (summary.sent > 0 && labSummary.notified > 0) return 'BOTH';
  if (labSummary.notified > 0) return 'LAB_NOTIFIED';
  return 'TEAM_SENT';
}

function emptyBootstrapDto(session: any, anchor: any) {
  return {
    sourceContinuation: null,
    bootstrapSession: {
      id: session.id,
      userId: session.userId,
      organizationId: session.organizationId,
      sourceContinuationId: session.sourceContinuationId ?? null,
      status: session.status,
      bootstrapPhase: session.bootstrapPhase,
      existingWorkStatus: session.existingWorkStatus,
      setupCompletedAt: session.setupCompletedAt?.toISOString?.() ?? null,
      setupCompletedByActorId: session.setupCompletedByActorId ?? null,
      createdAt: session.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: session.updatedAt?.toISOString?.() ?? new Date().toISOString(),
    },
    anchor: anchor ? {
      ...anchor,
      createdAt: anchor.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: anchor.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      confirmedAt: anchor.confirmedAt?.toISOString?.() ?? null,
    } : null,
    importBatches: [], workItems: [], proposedMutations: [], latestAnalysisRun: null,
    strategicConnections: [], advancementConditions: [], latestReading: null,
  };
}
