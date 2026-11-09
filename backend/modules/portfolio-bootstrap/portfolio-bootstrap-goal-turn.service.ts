import { Prisma, type PrismaClient } from '@prisma/client';
import { can, type Permission } from '../../shared/authz/permissions';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { AppError } from '../../shared/errors/AppError';
import { canonicalContextHash, isRetryableContextWriteConflict } from './portfolio-bootstrap-context.service';
import { buildGoalQuestionPlan, type GoalPlanContextReview, type GoalPlanAnchor } from './portfolio-bootstrap-goal-question-planner';
import { portfolioBootstrapGoalTurnBodySchema, type PortfolioBootstrapGoalTurnBody } from './portfolio-bootstrap-goal-turn.schemas';

type GoalAccess = {
  sessionId: string;
  authenticatedUserId: string;
  permissions: ReadonlySet<Permission>;
};

export type GoalTurnDto = {
  id: string;
  sessionId: string;
  version: number;
  actorUserId: string;
  anchorVersion: number;
  contextReviewVersion: number | null;
  questionId: string;
  field: string;
  inputText: string;
  disposition: PortfolioBootstrapGoalTurnBody['disposition'];
  supersedesTurnId: string | null;
  evidence: Array<{ kind: 'user_input'; quote: string; status: 'provisional' }>;
  createdAt: string;
};

export type GoalTurnSnapshot = { version: number; turns: GoalTurnDto[] };
export type GoalTurnAppendResult = { version: number; turn: GoalTurnDto };

const conflict = () => AppError.conflict(
  'La conversación de Objetivo cambió; vuelve a leer el historial antes de continuar.',
  'PORTFOLIO_GOAL_TURN_VERSION_CONFLICT',
);

function toDto(row: any): GoalTurnDto {
  return {
    id: row.id, sessionId: row.bootstrapSessionId, version: row.turnVersion,
    actorUserId: row.actorUserId, anchorVersion: row.anchorVersion,
    contextReviewVersion: row.contextReviewVersion,
    questionId: row.questionId, field: row.field, inputText: row.inputText,
    disposition: row.disposition, supersedesTurnId: row.supersedesTurnId,
    evidence: row.evidenceJson as GoalTurnDto['evidence'],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function currentConfirmedE1(row: any): GoalPlanContextReview | null {
  if (!row || row.status !== 'confirmed' || !row.confirmedSnapshotJson) return null;
  const json = row.confirmedSnapshotJson as { situation?: { value?: unknown } };
  const situation = typeof json.situation?.value === 'string' ? json.situation.value : null;
  return {
    id: row.id, status: 'confirmed', version: row.version,
    effectiveContext: { situation: { value: situation } },
  };
}

export class PortfolioBootstrapGoalTurnService {
  constructor(private readonly prisma: PrismaClient) {}

  async getTurns(input: GoalAccess): Promise<GoalTurnSnapshot> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      await this.requireAuthorized(db, input, 'portfolio:read');
      const rows = await db.portfolioBootstrapGoalTurn.findMany({
        where: { bootstrapSessionId: input.sessionId },
        orderBy: { turnVersion: 'asc' },
        take: 10_000,
      });
      const turns = rows.map(toDto);
      return { version: turns[turns.length - 1]?.version ?? 0, turns };
    });
  }

  async appendTurn(input: GoalAccess & {
    idempotencyKey: string;
    body: PortfolioBootstrapGoalTurnBody;
  }): Promise<GoalTurnAppendResult> {
    const body = portfolioBootstrapGoalTurnBodySchema.parse(input.body);
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 240) {
      throw AppError.badRequest('Falta una Idempotency-Key válida.', 'PORTFOLIO_GOAL_IDEMPOTENCY_REQUIRED');
    }
    const keyHash = canonicalContextHash(input.idempotencyKey);
    const payloadHash = canonicalContextHash({ sessionId: input.sessionId, ...body });
    const write = () => this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireAuthorized(db, input, 'portfolio:write');
      const anchor = session.anchor;
      if (!anchor) throw AppError.conflict('La sesión no tiene Anchor.', 'PORTFOLIO_GOAL_ANCHOR_MISSING');

      // Replays precede the version gate so an uncertain response can return
      // the exact committed turn even after another turn has advanced the ledger.
      const replay = await db.portfolioBootstrapGoalTurn.findUnique({
        where: { bootstrapSessionId_idempotencyKeyHash: {
          bootstrapSessionId: session.id, idempotencyKeyHash: keyHash,
        } },
      });
      if (replay) {
        if (replay.payloadHash !== payloadHash) {
          throw AppError.conflict('Idempotency-Key reutilizada con otro payload.', 'PORTFOLIO_GOAL_IDEMPOTENCY_CONFLICT');
        }
        return { version: replay.turnVersion, turn: toDto(replay) };
      }

      if (['anchor_confirmed', 'anchor_conflicting'].includes(anchor.status)) {
        throw AppError.conflict('Este Anchor requiere revisión humana antes de nuevas respuestas.', 'PORTFOLIO_GOAL_ANCHOR_LOCKED');
      }
      if (anchor.version !== body.expectedAnchorVersion) throw AppError.conflict(
        'El Anchor cambió; recupera la pregunta vigente.',
        'PORTFOLIO_GOAL_ANCHOR_VERSION_CONFLICT',
      );
      const review = currentConfirmedE1(session.contextReview);
      const plan = buildGoalQuestionPlan({
        sessionId: session.id,
        anchor: {
          id: anchor.id, version: anchor.version, status: anchor.status,
          outcomeStatement: anchor.outcomeStatement, contextSummary: anchor.contextSummary,
          decisionToEnable: anchor.decisionToEnable,
          businessSignalStatus: anchor.businessSignalStatus,
          businessSignalValue: anchor.businessSignalValue,
          sourceRefs: anchor.sourceRefs,
        } satisfies GoalPlanAnchor,
        contextReview: review,
      });
      if (plan.contextReviewVersion !== body.expectedContextReviewVersion) throw AppError.conflict(
        'La fuente E1 cambió; recupera la propuesta vigente.',
        'PORTFOLIO_GOAL_CONTEXT_VERSION_CONFLICT',
      );
      if (!plan.activeQuestion || plan.activeQuestion.id !== body.questionId) throw AppError.conflict(
        'La pregunta ya no está activa o no coincide con el contexto actual.',
        'PORTFOLIO_GOAL_QUESTION_STALE',
      );

      const latest = await db.portfolioBootstrapGoalTurn.findFirst({
        where: { bootstrapSessionId: session.id },
        orderBy: { turnVersion: 'desc' },
        select: { turnVersion: true },
      });
      const version = latest?.turnVersion ?? 0;
      if (version !== body.expectedVersion) throw conflict();

      const previous = await db.portfolioBootstrapGoalTurn.findFirst({
        where: { bootstrapSessionId: session.id, questionId: body.questionId },
        orderBy: { turnVersion: 'desc' },
      });
      if ((previous?.id ?? null) !== body.supersedesTurnId) {
        throw AppError.conflict('Ya existe una respuesta a esa pregunta; señala el turno que corriges.', 'PORTFOLIO_GOAL_CORRECTION_REQUIRED');
      }

      const evidence = [{ kind: 'user_input', quote: body.inputText, status: 'provisional' }];
      const created = await db.portfolioBootstrapGoalTurn.create({ data: {
        bootstrapSessionId: session.id, turnVersion: version + 1,
        organizationId: session.organizationId, actorUserId: input.authenticatedUserId,
        anchorVersion: anchor.version, contextReviewId: review?.id ?? null,
        contextReviewVersion: review?.version ?? null,
        questionId: plan.activeQuestion.id, field: plan.activeQuestion.field,
        inputText: body.inputText, disposition: body.disposition,
        supersedesTurnId: body.supersedesTurnId,
        evidenceJson: evidence, idempotencyKeyHash: keyHash, payloadHash,
      } });
      await db.auditLog.create({ data: {
        userId: input.authenticatedUserId,
        resource: 'PortfolioBootstrapGoalTurn',
        resourceId: created.id,
        action: 'portfolio_goal_turn_provisional_recorded',
        details: {
          sessionId: session.id, turnVersion: version + 1,
          anchorVersion: anchor.version, field: plan.activeQuestion.field,
          disposition: body.disposition,
        },
      } });
      return { version: version + 1, turn: toDto(created) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await write(); }
      catch (error) {
        const candidate = error as { code?: string };
        if (candidate.code === 'P2002') {
          // PostgreSQL resolves the uniqueness race only after the winner
          // commits. A same-key retry returns that saved receipt; a different
          // key must retry against the newer version and receive 409.
          const existing = await (this.prisma as any).portfolioBootstrapGoalTurn.findUnique({
            where: { bootstrapSessionId_idempotencyKeyHash: {
              bootstrapSessionId: input.sessionId, idempotencyKeyHash: keyHash,
            } },
          });
          if (existing) {
            // Ensure access again before returning a cross-transaction receipt.
            await this.getTurns(input);
            if (existing.payloadHash !== payloadHash) throw AppError.conflict(
              'Idempotency-Key reutilizada con otro payload.', 'PORTFOLIO_GOAL_IDEMPOTENCY_CONFLICT',
            );
            return { version: existing.turnVersion, turn: toDto(existing) };
          }
          throw conflict();
        }
        if (attempt >= 2 || !isRetryableContextWriteConflict(error)) throw error;
      }
    }
    throw conflict();
  }

  private async requireAuthorized(db: any, input: GoalAccess, capability: Permission): Promise<any> {
    const session = await db.portfolioBootstrapSession.findFirst({
      where: { id: input.sessionId, userId: input.authenticatedUserId },
      include: { anchor: true, contextReview: true },
    });
    if (!session) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
    if (can(input.permissions, capability)) return session;
    const allowed = session.organizationId && await new ScopedPortfolioAccessService(db).canUserAccessPortfolio({
      userId: input.authenticatedUserId,
      organizationId: session.organizationId,
      capability: capability as 'portfolio:read' | 'portfolio:write',
    });
    if (!allowed) throw AppError.forbidden('No tienes permisos sobre esta conversación.', 'PORTFOLIO_GOAL_PERMISSION_REQUIRED');
    return session;
  }
}
