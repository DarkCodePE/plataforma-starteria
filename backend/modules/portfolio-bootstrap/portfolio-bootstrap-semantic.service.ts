import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { can, type Permission } from '../../shared/authz/permissions';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { AppError } from '../../shared/errors/AppError';
import { canonicalContextHash, isRetryableContextWriteConflict } from './portfolio-bootstrap-context.service';
import {
  portfolioBootstrapSemanticTurnInputSchema,
  semanticE1Enabled,
  type PortfolioBootstrapSemanticConvergence,
  type PortfolioBootstrapSemanticDisposition,
  type PortfolioBootstrapSemanticFact,
  type PortfolioBootstrapSemanticHypothesis,
  type PortfolioBootstrapSemanticQuestion,
  type PortfolioBootstrapSemanticQuestionBudget,
  type PortfolioBootstrapSemanticTurnInput,
} from './portfolio-bootstrap-semantic.schemas';

type LedgerFact = PortfolioBootstrapSemanticFact & { turnId: string; semanticVersion: number };
type LedgerHypothesis = PortfolioBootstrapSemanticHypothesis & { turnId: string; semanticVersion: number };
type LedgerDisposition = PortfolioBootstrapSemanticDisposition & { turnId: string; semanticVersion: number };
type QuestionHistoryItem = PortfolioBootstrapSemanticQuestion & { turnId: string; semanticVersion: number };

export interface SemanticStateProjection {
  factLedger: LedgerFact[];
  hypotheses: LedgerHypothesis[];
  dispositions: LedgerDisposition[];
  answeredGaps: string[];
  questionHistory: QuestionHistoryItem[];
  answeredQuestionIds: string[];
  activeQuestion: PortfolioBootstrapSemanticQuestion | null;
  convergence: PortfolioBootstrapSemanticConvergence;
  questionBudget: PortfolioBootstrapSemanticQuestionBudget;
}

type ProjectionTurn = Pick<PortfolioBootstrapSemanticTurnInput,
  'status' | 'facts' | 'hypotheses' | 'answeredGaps' | 'answeredQuestionId'
  | 'emittedQuestion' | 'convergence' | 'questionBudget'> & {
    dispositions?: PortfolioBootstrapSemanticDisposition[];
  };

export interface SemanticStateDto extends SemanticStateProjection {
  id: string;
  sessionId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SemanticTurnDto {
  id: string;
  semanticVersion: number;
  organizationId: string | null;
  actorUserId: string;
  inputText: string;
  status: PortfolioBootstrapSemanticTurnInput['status'];
  facts: PortfolioBootstrapSemanticFact[];
  hypotheses: PortfolioBootstrapSemanticHypothesis[];
  dispositions: PortfolioBootstrapSemanticDisposition[];
  answeredGaps: string[];
  answeredQuestionId: string | null;
  emittedQuestion: PortfolioBootstrapSemanticQuestion | null;
  convergence: PortfolioBootstrapSemanticConvergence;
  questionBudget: PortfolioBootstrapSemanticQuestionBudget;
  error: { code: string; retryable: boolean } | null;
  execution: {
    provider: string | null;
    model: string | null;
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    retryCount: number;
    fallbackUsed: boolean;
  };
  createdAt: string;
}

export interface SemanticTurnResult {
  state: SemanticStateDto;
  turn: SemanticTurnDto;
}

export function emptySemanticStateProjection(): SemanticStateProjection {
  return {
    factLedger: [], hypotheses: [], dispositions: [], answeredGaps: [],
    questionHistory: [], answeredQuestionIds: [], activeQuestion: null,
    convergence: { status: 'question_required', reason: 'Aún no existe un turno semántico.' },
    questionBudget: { limit: null, used: 0 },
  };
}

export function applySemanticTurnProjection(
  current: SemanticStateProjection,
  turn: ProjectionTurn,
  identity: { turnId: string; semanticVersion: number },
): SemanticStateProjection {
  if (turn.status !== 'completed') {
    return { ...current, convergence: turn.convergence };
  }
  if (turn.answeredQuestionId && current.activeQuestion?.id !== turn.answeredQuestionId) {
    throw AppError.conflict('La pregunta respondida ya no está activa.', 'PORTFOLIO_SEMANTIC_QUESTION_STALE');
  }
  if (turn.emittedQuestion && current.questionHistory.some((question) => question.id === turn.emittedQuestion?.id)) {
    throw AppError.conflict('La pregunta ya fue presentada.', 'PORTFOLIO_SEMANTIC_QUESTION_REPEATED');
  }
  if (turn.emittedQuestion && current.activeQuestion && equivalentResolves(current.activeQuestion, turn.emittedQuestion)) {
    throw AppError.conflict('La pregunta repite el mismo concepto activo.', 'PORTFOLIO_SEMANTIC_QUESTION_REPEATED');
  }
  const dispositions = turn.dispositions ?? [];
  const unknownConcepts = new Set(dispositions
    .filter((item) => item.disposition === 'unknown')
    .map((item) => item.conceptId));
  if (turn.answeredGaps.some((gap) => unknownConcepts.has(gap))) {
    throw AppError.conflict('Un concepto desconocido no puede marcarse como resuelto.', 'PORTFOLIO_SEMANTIC_UNKNOWN_RESOLUTION_CONFLICT');
  }
  const decorate = <T extends object>(item: T): T & { turnId: string; semanticVersion: number } => ({
    ...item, turnId: identity.turnId, semanticVersion: identity.semanticVersion,
  });
  return {
    factLedger: [...current.factLedger, ...turn.facts.map(decorate)],
    hypotheses: [...current.hypotheses, ...turn.hypotheses.map(decorate)],
    dispositions: [...current.dispositions, ...dispositions.map(decorate)],
    answeredGaps: union(current.answeredGaps, turn.answeredGaps),
    questionHistory: turn.emittedQuestion
      ? [...current.questionHistory, decorate(turn.emittedQuestion)]
      : current.questionHistory,
    answeredQuestionIds: turn.answeredQuestionId
      ? union(current.answeredQuestionIds, [turn.answeredQuestionId])
      : current.answeredQuestionIds,
    activeQuestion: turn.emittedQuestion,
    convergence: turn.convergence,
    questionBudget: turn.questionBudget,
  };
}

export class PortfolioBootstrapSemanticService {
  constructor(private readonly prisma: PrismaClient) {}

  async getState(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<{ enabled: boolean; state: SemanticStateDto | null; turns: SemanticTurnDto[] }> {
    const db = this.prisma as any;
    const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
    await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:read');
    const state = await db.portfolioBootstrapSemanticState.findUnique({
      where: { bootstrapSessionId: session.id },
      include: { turns: { orderBy: { semanticVersion: 'asc' } } },
    });
    return {
      enabled: semanticE1Enabled(),
      state: state ? this.stateDto(state) : null,
      turns: state ? state.turns.map((turn: any) => this.turnDto(turn)) : [],
    };
  }

  async appendTurn(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
  } & PortfolioBootstrapSemanticTurnInput): Promise<SemanticTurnResult> {
    if (!input.idempotencyKey.trim()) {
      throw AppError.badRequest('Falta Idempotency-Key.', 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_REQUIRED');
    }
    const parsed = portfolioBootstrapSemanticTurnInputSchema.parse({
      expectedVersion: input.expectedVersion,
      inputText: input.inputText,
      status: input.status,
      facts: input.facts,
      hypotheses: input.hypotheses,
      dispositions: input.dispositions,
      answeredGaps: input.answeredGaps,
      answeredQuestionId: input.answeredQuestionId,
      emittedQuestion: input.emittedQuestion,
      convergence: input.convergence,
      questionBudget: input.questionBudget,
      error: input.error,
      execution: input.execution,
    });
    const payloadHash = canonicalContextHash(parsed);
    const write = () => this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:write');
      let state = await db.portfolioBootstrapSemanticState.findUnique({ where: { bootstrapSessionId: session.id } });
      if (state) {
        const replay = await this.replay(db, state.id, input.idempotencyKey, payloadHash);
        if (replay) return replay;
      }
      if (!state) {
        if (parsed.expectedVersion !== 0) throw this.versionConflict();
        const empty = emptySemanticStateProjection();
        state = await db.portfolioBootstrapSemanticState.create({ data: {
          bootstrapSessionId: session.id,
          version: 0,
          factLedgerJson: empty.factLedger,
          hypothesesJson: empty.hypotheses,
          dispositionsJson: empty.dispositions,
          answeredGapsJson: empty.answeredGaps,
          questionHistoryJson: empty.questionHistory,
          answeredQuestionIdsJson: empty.answeredQuestionIds,
          activeQuestionJson: null,
          convergenceJson: empty.convergence,
          questionBudgetJson: empty.questionBudget,
        } });
      }
      const replay = await this.replay(db, state.id, input.idempotencyKey, payloadHash);
      if (replay) return replay;
      if (state.version !== parsed.expectedVersion) throw this.versionConflict();

      const turnId = randomUUID();
      const semanticVersion = state.version + 1;
      const now = new Date();
      const nextProjection = applySemanticTurnProjection(this.projection(state), parsed, { turnId, semanticVersion });
      const changed = await db.portfolioBootstrapSemanticState.updateMany({
        where: { id: state.id, version: parsed.expectedVersion },
        data: {
          version: semanticVersion,
          factLedgerJson: nextProjection.factLedger,
          hypothesesJson: nextProjection.hypotheses,
          dispositionsJson: nextProjection.dispositions,
          answeredGapsJson: nextProjection.answeredGaps,
          questionHistoryJson: nextProjection.questionHistory,
          answeredQuestionIdsJson: nextProjection.answeredQuestionIds,
          activeQuestionJson: nextProjection.activeQuestion ?? Prisma.JsonNull,
          convergenceJson: nextProjection.convergence,
          questionBudgetJson: nextProjection.questionBudget,
          updatedAt: now,
        },
      });
      if (changed.count !== 1) throw this.versionConflict();

      const stateDto: SemanticStateDto = {
        id: state.id, sessionId: session.id, version: semanticVersion,
        ...nextProjection,
        createdAt: new Date(state.createdAt).toISOString(), updatedAt: now.toISOString(),
      };
      const turnDto: SemanticTurnDto = {
        id: turnId,
        semanticVersion,
        organizationId: session.organizationId ?? null,
        actorUserId: input.authenticatedUserId,
        inputText: parsed.inputText,
        status: parsed.status,
        facts: parsed.facts,
        hypotheses: parsed.hypotheses,
        dispositions: parsed.dispositions,
        answeredGaps: parsed.answeredGaps,
        answeredQuestionId: parsed.answeredQuestionId,
        emittedQuestion: parsed.emittedQuestion,
        convergence: parsed.convergence,
        questionBudget: parsed.questionBudget,
        error: parsed.error ? { code: parsed.error.code!, retryable: parsed.error.retryable! } : null,
        execution: {
          provider: parsed.execution.provider ?? null,
          model: parsed.execution.model ?? null,
          durationMs: parsed.execution.durationMs!,
          inputTokens: parsed.execution.inputTokens!,
          outputTokens: parsed.execution.outputTokens!,
          totalTokens: parsed.execution.totalTokens!,
          retryCount: parsed.execution.retryCount!,
          fallbackUsed: parsed.execution.fallbackUsed!,
        },
        createdAt: now.toISOString(),
      };
      const response: SemanticTurnResult = { state: stateDto, turn: turnDto };
      await db.portfolioBootstrapSemanticTurn.create({ data: {
        id: turnId,
        semanticStateId: state.id,
        semanticVersion,
        organizationId: session.organizationId ?? null,
        actorUserId: input.authenticatedUserId,
        inputText: parsed.inputText,
        status: parsed.status,
        factsJson: parsed.facts,
        hypothesesJson: parsed.hypotheses,
        dispositionsJson: parsed.dispositions,
        answeredGapsJson: parsed.answeredGaps,
        answeredQuestionId: parsed.answeredQuestionId,
        emittedQuestionJson: parsed.emittedQuestion ?? Prisma.JsonNull,
        convergenceJson: parsed.convergence,
        questionBudgetJson: parsed.questionBudget,
        errorJson: parsed.error ?? Prisma.JsonNull,
        provider: parsed.execution.provider,
        model: parsed.execution.model,
        durationMs: parsed.execution.durationMs,
        inputTokens: parsed.execution.inputTokens,
        outputTokens: parsed.execution.outputTokens,
        totalTokens: parsed.execution.totalTokens,
        retryCount: parsed.execution.retryCount,
        fallbackUsed: parsed.execution.fallbackUsed,
        idempotencyKeyHash: canonicalContextHash(input.idempotencyKey),
        payloadHash,
        responseJson: response,
        createdAt: now,
      } });
      await db.auditLog.create({ data: {
        userId: input.authenticatedUserId,
        action: parsed.status === 'completed' ? 'portfolio_bootstrap_semantic_turn_completed' : 'portfolio_bootstrap_semantic_turn_failed',
        resource: 'PortfolioBootstrapSemanticTurn',
        resourceId: turnId,
        details: { sessionId: session.id, semanticVersion, status: parsed.status },
      } });
      return response;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });

    try {
      return await this.withSerializableRetry(write);
    } catch (error) {
      return this.reconcileWriteConflict(input, payloadHash, error);
    }
  }

  private projection(state: any): SemanticStateProjection {
    return {
      factLedger: state.factLedgerJson ?? [],
      hypotheses: state.hypothesesJson ?? [],
      dispositions: state.dispositionsJson ?? [],
      answeredGaps: state.answeredGapsJson ?? [],
      questionHistory: state.questionHistoryJson ?? [],
      answeredQuestionIds: state.answeredQuestionIdsJson ?? [],
      activeQuestion: state.activeQuestionJson ?? null,
      convergence: state.convergenceJson,
      questionBudget: state.questionBudgetJson,
    };
  }

  private stateDto(state: any): SemanticStateDto {
    return {
      id: state.id,
      sessionId: state.bootstrapSessionId,
      version: state.version,
      ...this.projection(state),
      createdAt: new Date(state.createdAt).toISOString(),
      updatedAt: new Date(state.updatedAt).toISOString(),
    };
  }

  private turnDto(turn: any): SemanticTurnDto {
    return {
      id: turn.id,
      semanticVersion: turn.semanticVersion,
      organizationId: turn.organizationId ?? null,
      actorUserId: turn.actorUserId,
      inputText: turn.inputText,
      status: turn.status,
      facts: turn.factsJson ?? [],
      hypotheses: turn.hypothesesJson ?? [],
      dispositions: turn.dispositionsJson ?? [],
      answeredGaps: turn.answeredGapsJson ?? [],
      answeredQuestionId: turn.answeredQuestionId ?? null,
      emittedQuestion: turn.emittedQuestionJson ?? null,
      convergence: turn.convergenceJson,
      questionBudget: turn.questionBudgetJson,
      error: turn.errorJson ?? null,
      execution: {
        provider: turn.provider ?? null,
        model: turn.model ?? null,
        durationMs: turn.durationMs,
        inputTokens: turn.inputTokens,
        outputTokens: turn.outputTokens,
        totalTokens: turn.totalTokens,
        retryCount: turn.retryCount,
        fallbackUsed: turn.fallbackUsed,
      },
      createdAt: new Date(turn.createdAt).toISOString(),
    };
  }

  private async replay(db: any, stateId: string, key: string, payloadHash: string): Promise<SemanticTurnResult | null> {
    const turn = await db.portfolioBootstrapSemanticTurn.findUnique({ where: {
      semanticStateId_idempotencyKeyHash: { semanticStateId: stateId, idempotencyKeyHash: canonicalContextHash(key) },
    } });
    if (!turn) return null;
    if (turn.payloadHash !== payloadHash) {
      throw AppError.conflict('Idempotency-Key reutilizada con otro payload.', 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_CONFLICT');
    }
    return turn.responseJson as SemanticTurnResult;
  }

  private async reconcileWriteConflict(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
  }, payloadHash: string, error: unknown): Promise<SemanticTurnResult> {
    const code = (error as { code?: string }).code;
    const reconcilable = code === 'P2002' || code === 'PORTFOLIO_SEMANTIC_VERSION_CONFLICT'
      || isRetryableContextWriteConflict(error);
    if (!reconcilable) throw error;
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:write');
      const state = await db.portfolioBootstrapSemanticState.findUnique({ where: { bootstrapSessionId: session.id } });
      if (state) {
        const replay = await this.replay(db, state.id, input.idempotencyKey, payloadHash);
        if (replay) return replay;
      }
      throw this.versionConflict();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10_000 });
  }

  private async requireOwnedSession(db: any, sessionId: string, userId: string): Promise<any> {
    const session = await db.portfolioBootstrapSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, userId: true, organizationId: true },
    });
    if (!session) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
    return session;
  }

  private async authorize(
    db: any,
    session: any,
    userId: string,
    permissions: ReadonlySet<Permission>,
    capability: Permission,
  ): Promise<void> {
    if (can(permissions, capability)) return;
    const allowed = session.organizationId && await new ScopedPortfolioAccessService(db).canUserAccessPortfolio({
      userId,
      organizationId: session.organizationId,
      capability: capability as 'portfolio:read' | 'portfolio:write',
    });
    if (!allowed) {
      throw AppError.forbidden('No tienes permiso Portfolio para este contexto.', capability === 'portfolio:read'
        ? 'PORTFOLIO_BOOTSTRAP_READ_REQUIRED' : 'PORTFOLIO_BOOTSTRAP_WRITE_REQUIRED');
    }
  }

  private versionConflict(): AppError {
    return AppError.conflict('La versión semántica cambió; vuelve a leer antes de reintentar.', 'PORTFOLIO_SEMANTIC_VERSION_CONFLICT');
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === 1 || !isRetryableContextWriteConflict(error)) throw error;
      }
    }
    throw AppError.conflict('No fue posible serializar el turno semántico.', 'PORTFOLIO_SEMANTIC_RETRY_EXHAUSTED');
  }
}

function union(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right])];
}

function equivalentResolves(left: PortfolioBootstrapSemanticQuestion, right: PortfolioBootstrapSemanticQuestion): boolean {
  return [...new Set(left.resolves)].sort().join('|') === [...new Set(right.resolves)].sort().join('|');
}
