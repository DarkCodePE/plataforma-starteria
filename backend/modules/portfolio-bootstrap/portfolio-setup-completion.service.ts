import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { can, type Permission } from '../../shared/authz/permissions';
import { AppError } from '../../shared/errors/AppError';

type CompletionSummary = { sent: number; unsent: number; failed: number };

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
  }): Promise<{ completed: true; completedAt: string; summary: CompletionSummary }> {
    if (!can(input.permissions, 'portfolio:write')) {
      throw AppError.forbidden('No tienes permiso para finalizar esta configuración.', 'PORTFOLIO_SETUP_COMPLETE_FORBIDDEN');
    }
    if (!input.confirmed) {
      throw AppError.badRequest('Confirma explícitamente que quieres finalizar esta configuración.', 'PORTFOLIO_SETUP_CONFIRMATION_REQUIRED');
    }
    if (!input.idempotencyKey.trim()) {
      throw AppError.badRequest('Falta la clave de idempotencia.', 'IDEMPOTENCY_KEY_REQUIRED');
    }

    return this.prisma.$transaction(async (transaction) => {
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
      if (summary.sent === 0) {
        throw AppError.conflict(
          'Envía al menos una invitación y confirma su recepción SMTP antes de finalizar.',
          'PORTFOLIO_SETUP_DELIVERY_REQUIRED',
        );
      }

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
          return { completed: true as const, completedAt: completed.setupCompletedAt.toISOString(), summary };
        }
      }
      return { completed: true as const, completedAt: completedAt.toISOString(), summary };
    });
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
          outcomeStatement: previous.anchor.outcomeStatement,
          contextSummary: null,
          decisionToEnable: previous.anchor.decisionToEnable,
          businessSignalStatus: previous.anchor.businessSignalValue ? 'suggested' : 'unknown',
          businessSignalValue: previous.anchor.businessSignalValue,
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
