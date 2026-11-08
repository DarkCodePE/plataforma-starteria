import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { can, type Permission } from '../../shared/authz/permissions';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { AppError } from '../../shared/errors/AppError';
import {
  canonicalContextHash,
  companyEntryFingerprint,
  isRetryableContextWriteConflict,
} from './portfolio-bootstrap-context.service';
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
  attempt: number;
  attempts: unknown[];
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

type AppendSemanticTurnInput = {
  sessionId: string;
  authenticatedUserId: string;
  permissions: ReadonlySet<Permission>;
  idempotencyKey: string;
  requestHash?: string;
  replaceFailedRetryable?: boolean;
} & PortfolioBootstrapSemanticTurnInput;

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
  if (current.activeQuestion && turn.answeredQuestionId !== current.activeQuestion.id) {
    throw AppError.conflict('La pregunta activa debe resolverse antes de cerrarla o sustituirla.', 'PORTFOLIO_SEMANTIC_QUESTION_ACTIVE');
  }
  if (turn.emittedQuestion && current.questionHistory.some((question) => (
    question.id === turn.emittedQuestion?.id || equivalentResolves(question, turn.emittedQuestion)
  ))) {
    throw AppError.conflict('La pregunta ya fue presentada.', 'PORTFOLIO_SEMANTIC_QUESTION_REPEATED');
  }
  if (turn.emittedQuestion && current.answeredGaps.some((gap) => turn.emittedQuestion?.resolves.includes(gap))) {
    throw AppError.conflict('La pregunta repite un concepto ya resuelto.', 'PORTFOLIO_SEMANTIC_QUESTION_REPEATED');
  }
  if (turn.emittedQuestion && current.activeQuestion && equivalentResolves(current.activeQuestion, turn.emittedQuestion)
    && turn.answeredQuestionId !== current.activeQuestion.id) {
    throw AppError.conflict('La pregunta repite el mismo concepto activo.', 'PORTFOLIO_SEMANTIC_QUESTION_REPEATED');
  }
  const dispositions = turn.dispositions ?? [];
  const unknownConcepts = new Set(dispositions
    .filter((item) => item.disposition === 'unknown')
    .map((item) => item.conceptId));
  const retractedConcepts = new Set(turn.facts
    .filter((item) => item.status === 'retracted')
    .map((item) => item.conceptId));
  const groundedResolutions = new Set([
    ...turn.facts.filter((item) => item.status !== 'retracted').map((item) => item.conceptId),
    ...dispositions.filter((item) => item.disposition === 'not_applicable').map((item) => item.conceptId),
  ]);
  if (turn.answeredGaps.some((gap) => unknownConcepts.has(gap))) {
    throw AppError.conflict('Un concepto desconocido no puede marcarse como resuelto.', 'PORTFOLIO_SEMANTIC_UNKNOWN_RESOLUTION_CONFLICT');
  }
  if (turn.answeredGaps.some((gap) => !current.answeredGaps.includes(gap) && !groundedResolutions.has(gap))) {
    throw AppError.conflict('Un gap nuevo requiere evidencia grounded en el mismo turno.', 'PORTFOLIO_SEMANTIC_ANSWERED_GAP_UNGROUNDED');
  }
  const expectedBudgetUsed = current.questionBudget.used + (turn.emittedQuestion ? 1 : 0);
  const configuredLimit = current.questionBudget.limit ?? turn.questionBudget.limit;
  if (turn.questionBudget.used !== expectedBudgetUsed
    || (current.questionBudget.limit !== null && turn.questionBudget.limit !== current.questionBudget.limit)
    || (current.questionBudget.used > 0 && turn.questionBudget.limit !== current.questionBudget.limit)) {
    throw AppError.conflict('El presupuesto de preguntas sólo puede avanzar de forma monotónica.', 'PORTFOLIO_SEMANTIC_QUESTION_BUDGET_INVALID');
  }
  const decorate = <T extends object>(item: T): T & { turnId: string; semanticVersion: number } => ({
    ...item, turnId: identity.turnId, semanticVersion: identity.semanticVersion,
  });
  return {
    factLedger: [...current.factLedger, ...turn.facts.map(decorate)],
    hypotheses: [...current.hypotheses, ...turn.hypotheses.map(decorate)],
    dispositions: [...current.dispositions, ...dispositions.map(decorate)],
    answeredGaps: union(current.answeredGaps, turn.answeredGaps)
      .filter((gap) => !unknownConcepts.has(gap) && !retractedConcepts.has(gap)),
    questionHistory: turn.emittedQuestion
      ? [...current.questionHistory, decorate(turn.emittedQuestion)]
      : current.questionHistory,
    answeredQuestionIds: turn.answeredQuestionId
      ? union(current.answeredQuestionIds, [turn.answeredQuestionId])
      : current.answeredQuestionIds,
    activeQuestion: turn.emittedQuestion,
    convergence: turn.convergence,
    questionBudget: { limit: configuredLimit, used: expectedBudgetUsed },
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

  async getInferenceContext(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<{
    state: SemanticStateDto | null;
    confirmedContext: { version: number; context: unknown; provenance: unknown } | null;
  }> {
    const snapshot = await this.getState(input);
    const review = await (this.prisma as any).portfolioBootstrapContextReview.findUnique({
      where: { bootstrapSessionId: input.sessionId },
      select: { id: true },
    });
    const confirmedVersion = review ? await (this.prisma as any).portfolioBootstrapContextReviewVersion.findFirst({
      where: { reviewId: review.id, action: 'confirmed' },
      orderBy: { version: 'desc' },
      select: { version: true, snapshotJson: true },
    }) : null;
    const confirmedSnapshot = confirmedVersion?.snapshotJson as {
      status?: unknown; context?: unknown; provenance?: unknown;
    } | null;
    return {
      state: snapshot.state,
      confirmedContext: confirmedVersion && confirmedSnapshot?.status === 'confirmed' ? {
        version: confirmedVersion.version,
        context: confirmedSnapshot.context,
        provenance: confirmedSnapshot.provenance ?? null,
      } : null,
    };
  }

  async appendTurn(input: AppendSemanticTurnInput): Promise<SemanticTurnResult> {
    return (await this.appendTurnDetailed(input)).result;
  }

  async claimInference(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
    requestHash: string;
    expectedVersion: number;
    inputText: string;
    answeredQuestionId: string | null;
    leaseMs: number;
  }): Promise<{ claimed: boolean; result: SemanticTurnResult }> {
    const pending = (expectedVersion: number): AppendSemanticTurnInput => ({
      sessionId: input.sessionId,
      authenticatedUserId: input.authenticatedUserId,
      permissions: input.permissions,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      expectedVersion,
      inputText: input.inputText,
      status: 'failed_retryable',
      facts: [], hypotheses: [], dispositions: [], answeredGaps: [], answeredQuestionId: null,
      emittedQuestion: null,
      convergence: { status: 'provider_retryable_failure', reason: 'Inferencia en curso.' },
      questionBudget: { limit: null, used: 0 },
      error: { code: 'inference_pending', retryable: true },
      execution: {
        provider: null, model: null, durationMs: 0,
        inputTokens: 0, outputTokens: 0, totalTokens: 0, retryCount: 0, fallbackUsed: false,
      },
    });
    const initial = await this.appendTurnDetailed(pending(input.expectedVersion));
    if (initial.wrote) return { claimed: true, result: initial.result };
    if (initial.result.turn.status !== 'failed_retryable') return { claimed: false, result: initial.result };
    const persistedTurn = await (this.prisma as any).portfolioBootstrapSemanticTurn.findUnique({
      where: { id: initial.result.turn.id },
      select: { updatedAt: true },
    });
    const pendingAge = Date.now() - new Date(persistedTurn?.updatedAt ?? initial.result.turn.createdAt).getTime();
    if (initial.result.turn.error?.code === 'inference_pending' && pendingAge < input.leaseMs) {
      return { claimed: false, result: initial.result };
    }
    const reclaimed = await this.appendTurnDetailed({
      ...pending(initial.result.state.version),
      replaceFailedRetryable: true,
    });
    return { claimed: reclaimed.wrote, result: reclaimed.result };
  }

  async completeInference(input: AppendSemanticTurnInput & { requestHash: string }): Promise<SemanticTurnResult> {
    return (await this.appendTurnDetailed({ ...input, replaceFailedRetryable: true })).result;
  }

  private async appendTurnDetailed(input: AppendSemanticTurnInput): Promise<{
    result: SemanticTurnResult;
    wrote: boolean;
  }> {
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
    const payloadHash = input.requestHash ?? canonicalContextHash(parsed);
    const write = () => this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorize(db, session, input.authenticatedUserId, input.permissions, 'portfolio:write');
      let state = await db.portfolioBootstrapSemanticState.findUnique({ where: { bootstrapSessionId: session.id } });
      let existingTurn = state
        ? await this.findTurnByKey(db, state.id, input.idempotencyKey)
        : null;
      if (existingTurn && input.requestHash && existingTurn.payloadHash !== payloadHash) {
        throw AppError.conflict('Idempotency-Key reutilizada con otro payload.', 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_CONFLICT');
      }
      if (existingTurn?.payloadHash === payloadHash
        && !(input.replaceFailedRetryable && existingTurn.status === 'failed_retryable')) {
        return { result: existingTurn.responseJson as SemanticTurnResult, wrote: false };
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
      existingTurn = existingTurn ?? await this.findTurnByKey(db, state.id, input.idempotencyKey);
      if (existingTurn && input.requestHash && existingTurn.payloadHash !== payloadHash) {
        throw AppError.conflict('Idempotency-Key reutilizada con otro payload.', 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_CONFLICT');
      }
      if (existingTurn?.payloadHash === payloadHash
        && !(input.replaceFailedRetryable && existingTurn.status === 'failed_retryable')) {
        return { result: existingTurn.responseJson as SemanticTurnResult, wrote: false };
      }
      if (existingTurn && (existingTurn.status !== 'failed_retryable' || existingTurn.inputText !== parsed.inputText)) {
        throw AppError.conflict('Idempotency-Key reutilizada para otro turno lógico.', 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_CONFLICT');
      }
      if (state.version !== parsed.expectedVersion) throw this.versionConflict();
      await this.validateEvidenceRefs(db, session, input.authenticatedUserId, parsed.facts);

      const turnId = existingTurn?.id ?? randomUUID();
      const attempt = (existingTurn?.attempt ?? 0) + 1;
      const priorAttempts = existingTurn
        ? [...(existingTurn.attemptsJson ?? []), this.attemptSnapshot(existingTurn)]
        : [];
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
        attempt,
        attempts: priorAttempts,
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
        createdAt: new Date(existingTurn?.createdAt ?? now).toISOString(),
      };
      const response: SemanticTurnResult = { state: stateDto, turn: turnDto };
      const turnData = {
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
        attempt,
        attemptsJson: priorAttempts,
        idempotencyKeyHash: canonicalContextHash(input.idempotencyKey),
        payloadHash,
        responseJson: response,
        createdAt: now,
        updatedAt: now,
      };
      if (existingTurn) {
        const updated = await db.portfolioBootstrapSemanticTurn.updateMany({
          where: { id: existingTurn.id, status: 'failed_retryable', attempt: existingTurn.attempt },
          data: {
            semanticVersion: turnData.semanticVersion,
            status: turnData.status,
            factsJson: turnData.factsJson,
            hypothesesJson: turnData.hypothesesJson,
            dispositionsJson: turnData.dispositionsJson,
            answeredGapsJson: turnData.answeredGapsJson,
            answeredQuestionId: turnData.answeredQuestionId,
            emittedQuestionJson: turnData.emittedQuestionJson,
            convergenceJson: turnData.convergenceJson,
            questionBudgetJson: turnData.questionBudgetJson,
            errorJson: turnData.errorJson,
            provider: turnData.provider,
            model: turnData.model,
            durationMs: turnData.durationMs,
            inputTokens: turnData.inputTokens,
            outputTokens: turnData.outputTokens,
            totalTokens: turnData.totalTokens,
            retryCount: turnData.retryCount,
            fallbackUsed: turnData.fallbackUsed,
            attempt: turnData.attempt,
            attemptsJson: turnData.attemptsJson,
            payloadHash: turnData.payloadHash,
            responseJson: turnData.responseJson,
            updatedAt: now,
          },
        });
        if (updated.count !== 1) throw this.versionConflict();
      } else {
        await db.portfolioBootstrapSemanticTurn.create({ data: turnData });
      }
      await db.auditLog.create({ data: {
        userId: input.authenticatedUserId,
        action: parsed.status === 'completed' ? 'portfolio_bootstrap_semantic_turn_completed' : 'portfolio_bootstrap_semantic_turn_failed',
        resource: 'PortfolioBootstrapSemanticTurn',
        resourceId: turnId,
        details: { sessionId: session.id, semanticVersion, status: parsed.status },
      } });
      return { result: response, wrote: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 });

    try {
      return await this.withSerializableRetry(write);
    } catch (error) {
      return { result: await this.reconcileWriteConflict(input, payloadHash, error), wrote: false };
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
      attempt: turn.attempt ?? 1,
      attempts: turn.attemptsJson ?? [],
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

  private async findTurnByKey(db: any, stateId: string, key: string): Promise<any | null> {
    return db.portfolioBootstrapSemanticTurn.findUnique({ where: {
      semanticStateId_idempotencyKeyHash: {
        semanticStateId: stateId,
        idempotencyKeyHash: canonicalContextHash(key),
      },
    } });
  }

  private attemptSnapshot(turn: any): unknown {
    return {
      attempt: turn.attempt ?? 1,
      semanticVersion: turn.semanticVersion,
      status: turn.status,
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
      recordedAt: new Date(turn.updatedAt ?? turn.createdAt).toISOString(),
    };
  }

  private async validateEvidenceRefs(
    db: any,
    session: any,
    actorId: string,
    facts: PortfolioBootstrapSemanticFact[],
  ): Promise<void> {
    const refs = facts.flatMap((fact) => fact.evidenceRefs);
    const contextRefs = refs.filter((ref) => ref.kind === 'context_review_field');
    if (contextRefs.length) {
      const review = await db.portfolioBootstrapContextReview.findUnique({
        where: { bootstrapSessionId: session.id },
        select: { id: true },
      });
      if (!review) throw this.invalidEvidence('No existe el ContextReview citado.');
      for (const fact of facts) {
        for (const ref of fact.evidenceRefs) {
          if (ref.kind !== 'context_review_field') continue;
          const historical = await db.portfolioBootstrapContextReviewVersion.findUnique({
            where: { reviewId_version: { reviewId: review.id, version: ref.reviewVersion } },
            select: { action: true, snapshotJson: true },
          });
          const snapshot = historical?.snapshotJson as { status?: unknown; context?: unknown } | undefined;
          const evidenceValue = ownPathValue(snapshot?.context, ref.fieldPath);
          if (!historical || historical.action !== 'confirmed' || snapshot?.status !== 'confirmed'
            || evidenceValue === MISSING_PATH
            || canonicalContextHash(evidenceValue) !== canonicalContextHash(fact.value)) {
            throw this.invalidEvidence('La referencia a ContextReview no coincide con un valor del snapshot confirmado.');
          }
        }
      }
    }

    const companyRefs = refs.filter((ref) => ref.kind === 'company_context_entry');
    if (!companyRefs.length) return;
    if (!session.organizationId) throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { organizationId: true } });
    if (actor?.organizationId !== session.organizationId) throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    for (const ref of companyRefs) {
      if (ref.kind !== 'company_context_entry') continue;
      const company = await db.company.findFirst({ where: {
        id: ref.companyId,
        organizationId: session.organizationId,
        scope: 'ORGANIZATION',
        deletedAt: null,
      } });
      if (!company) throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
      if (company.status !== 'ACTIVE') throw AppError.conflict('La empresa fuente ya no está activa.', 'COMPANY_CONTEXT_UNAVAILABLE');
      const membership = await db.companyMembership.findFirst({
        where: { companyId: company.id, userId: actorId, status: 'APPROVED' },
        select: { id: true },
      });
      if (!membership) throw AppError.forbidden('No tienes acceso de lectura a esta empresa.', 'COMPANY_ACCESS_DENIED');
      const version = await db.companyContextVersion.findFirst({ where: {
        id: ref.versionId,
        companyId: company.id,
        status: 'PUBLISHED',
      }, select: { snapshotJson: true } });
      const entries = Array.isArray((version?.snapshotJson as any)?.entries)
        ? (version.snapshotJson as any).entries
        : [];
      if (!version || !entries.some((entry: any) => companyEntryFingerprint(entry) === ref.entryFingerprint)) {
        throw this.invalidEvidence('La referencia Company no coincide con el snapshot publicado.');
      }
    }
  }

  private invalidEvidence(message: string): AppError {
    return new AppError(422, message, 'PORTFOLIO_SEMANTIC_EVIDENCE_INVALID');
  }

  private async replay(db: any, stateId: string, key: string, payloadHash: string): Promise<SemanticTurnResult | null> {
    const turn = await this.findTurnByKey(db, stateId, key);
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

const MISSING_PATH = Symbol('missing_path');

function ownPathValue(value: unknown, path: string): unknown | typeof MISSING_PATH {
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (!segment || forbidden.has(segment) || !current || typeof current !== 'object'
      || !Object.prototype.hasOwnProperty.call(current, segment)) return MISSING_PATH;
    current = (current as Record<string, unknown>)[segment];
  }
  return current === undefined ? MISSING_PATH : current;
}
