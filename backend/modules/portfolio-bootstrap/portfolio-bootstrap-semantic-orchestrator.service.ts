import type { Permission } from '../../shared/authz/permissions';
import { AppError } from '../../shared/errors/AppError';
import { z } from 'zod/v3';
import type { StructuredModelAdapter } from '../portfolio-entry-runtime/model/structured-model-adapter';
import {
  portfolioBootstrapSemanticDispositionSchema,
  portfolioBootstrapSemanticFactSchema,
  portfolioBootstrapSemanticHypothesisSchema,
  portfolioBootstrapSemanticTurnInputSchema,
  PortfolioBootstrapSemanticTurnInput,
} from './portfolio-bootstrap-semantic.schemas';
import type {
  SemanticStateDto,
  SemanticTurnResult,
} from './portfolio-bootstrap-semantic.service';
import { canonicalContextHash } from './portfolio-bootstrap-context.service';

const questionPlanSchema = z.object({
  question: z.string().trim().min(1).max(1_000),
  reasonToAsk: z.string().trim().min(1).max(1_000),
  resolves: z.array(z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_.-]*$/)).min(1).max(20),
}).strict();

export const portfolioBootstrapSemanticInferenceSchema = z.object({
  facts: z.array(portfolioBootstrapSemanticFactSchema).max(100),
  hypotheses: z.array(portfolioBootstrapSemanticHypothesisSchema).max(100),
  dispositions: z.array(portfolioBootstrapSemanticDispositionSchema).max(100),
  questionPlan: questionPlanSchema.nullable(),
  readyForHumanReview: z.boolean(),
  reason: z.string().trim().min(1).max(2_000),
}).strict().superRefine((output, context) => {
  output.hypotheses.forEach((hypothesis, index) => {
    if (hypothesis.status !== 'proposed') {
      context.addIssue({
        code: 'custom', path: ['hypotheses', index, 'status'],
        message: 'El proveedor sólo puede proponer hipótesis; no puede aceptarlas ni rechazarlas.',
      });
    }
  });
});

type SemanticInference = z.infer<typeof portfolioBootstrapSemanticInferenceSchema>;

const SEMANTIC_E1_SYSTEM_PROMPT = `Eres el intérprete acotado del contexto E1 de Portfolio Bootstrap.
Devuelve un único objeto JSON que cumpla el schema. Extrae hechos sólo cuando una cita literal del
input los respalda. Mantén hipótesis separadas y siempre proposed. Una negación explícita como
"nunca lo hemos probado" resuelve pilot_experience aunque aparezca dentro de una narración general.
No inventes cifras, equipo, departamentos, KPI ni piloto. unknown y not_applicable requieren una
declaración literal. Propón como máximo una pregunta material; no preguntes por conceptos resueltos,
retirados o ya preguntados. No confirmes E1 ni avances a E2.`;

export interface PortfolioBootstrapSemanticTurnStore {
  getInferenceContext(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<{
    state: SemanticStateDto | null;
    confirmedContext: { version: number; context: unknown; provenance: unknown } | null;
  }>;
  claimInference(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
    requestHash: string;
    expectedVersion: number;
    inputText: string;
    answeredQuestionId: string | null;
    leaseMs: number;
  }): Promise<{ claimed: boolean; result: SemanticTurnResult }>;
  completeInference(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey: string;
    requestHash: string;
  } & PortfolioBootstrapSemanticTurnInput): Promise<SemanticTurnResult>;
}

export interface PortfolioBootstrapSemanticOrchestratorConfig {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCallsPerTurn: 1;
  timeoutMs: number;
  questionLimit: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
}

export interface ProcessPortfolioBootstrapSemanticTurnInput {
  sessionId: string;
  authenticatedUserId: string;
  permissions: ReadonlySet<Permission>;
  idempotencyKey: string;
  expectedVersion: number;
  inputText: string;
  answeredQuestionId: string | null;
}

export interface ProcessPortfolioBootstrapSemanticTurnResult {
  processing: boolean;
  result: SemanticTurnResult;
}

export class PortfolioBootstrapSemanticOrchestratorService {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(
    private readonly store: PortfolioBootstrapSemanticTurnStore,
    private readonly model: StructuredModelAdapter,
    private readonly config: PortfolioBootstrapSemanticOrchestratorConfig,
  ) {}

  async processTurn(
    input: ProcessPortfolioBootstrapSemanticTurnInput,
  ): Promise<ProcessPortfolioBootstrapSemanticTurnResult> {
    const before = await this.store.getInferenceContext(input);
    if (before.state?.activeQuestion && input.answeredQuestionId !== before.state.activeQuestion.id) {
      throw AppError.conflict(
        'La pregunta activa debe identificarse antes de interpretar la respuesta.',
        'PORTFOLIO_SEMANTIC_QUESTION_ACTIVE',
      );
    }
    if (!before.state?.activeQuestion && input.answeredQuestionId) {
      throw AppError.conflict('La pregunta respondida ya no está activa.', 'PORTFOLIO_SEMANTIC_QUESTION_STALE');
    }
    const requestHash = canonicalContextHash({
      expectedVersion: input.expectedVersion,
      inputText: input.inputText,
      answeredQuestionId: input.answeredQuestionId,
    });
    const claim = await this.store.claimInference({
      ...input,
      requestHash,
      leaseMs: this.config.timeoutMs + 10_000,
    });
    if (!claim.claimed) {
      return {
        processing: claim.result.turn.error?.code === 'inference_pending',
        result: claim.result,
      };
    }

    const complete = (turn: Omit<PortfolioBootstrapSemanticTurnInput, 'expectedVersion'>) => (
      this.store.completeInference({
        ...input,
        expectedVersion: claim.result.state.version,
        requestHash,
        ...turn,
        inputText: input.inputText,
      })
    );
    const execution = emptyExecution();
    const state = before.state;
    const userPayload = {
      rawInput: input.inputText,
      answeredQuestionId: input.answeredQuestionId,
      activeQuestion: state?.activeQuestion ?? null,
      semanticState: state ? {
        factLedger: state.factLedger,
        hypotheses: state.hypotheses,
        dispositions: state.dispositions,
        answeredGaps: state.answeredGaps,
        questionHistory: state.questionHistory,
        questionBudget: state.questionBudget,
      } : null,
      confirmedContext: before.confirmedContext,
      remainingQuestionBudget: remainingQuestionBudget(state, this.config.questionLimit),
    };
    const serializedModelInput = `${SEMANTIC_E1_SYSTEM_PROMPT}\n${JSON.stringify(userPayload)}`;
    if (estimateTokens(serializedModelInput) > this.config.maxInputTokens) {
      return {
        processing: false,
        result: await complete(failedTurn({
          code: 'input_budget_exceeded', retryable: false,
          reason: 'El prompt, contexto y estado superan el presupuesto de entrada configurado.', execution,
        })),
      };
    }
    if (this.circuitOpen()) {
      return {
        processing: false,
        result: await complete(failedTurn({
          code: 'provider_circuit_open', retryable: true,
          reason: 'El proveedor está temporalmente pausado por el circuit breaker.', execution,
        })),
      };
    }
    let modelResult;
    let logicalCalls = 0;
    try {
      if (logicalCalls >= this.config.maxCallsPerTurn) throw new Error('Semantic logical call budget exhausted.');
      logicalCalls += 1;
      modelResult = await withDeadline(this.model.generate({
        systemPrompt: SEMANTIC_E1_SYSTEM_PROMPT,
        userPayload,
        outputSchema: portfolioBootstrapSemanticInferenceSchema,
        metadata: { provider: 'configured', model: 'configured', seed_support: 'not_requested' },
        limits: { maxOutputTokens: this.config.maxOutputTokens },
        call: {
          call_id: `bootstrap-semantic-${input.sessionId}-${requestHash.slice(0, 16)}`,
          purpose: 'bootstrap_semantic_turn',
          turn_index: input.expectedVersion + 1,
        },
      }), this.config.timeoutMs);
    } catch {
      this.recordFailure();
      return {
        processing: false,
        result: await complete(failedTurn({
          code: 'provider_unavailable', retryable: true,
          reason: 'El proveedor configurado no está disponible; el turno puede reintentarse.',
          execution,
        })),
      };
    }
    const measuredExecution = executionFrom(modelResult.execution_metadata);
    if (!modelResult.validated_output) {
      this.recordFailure();
      return {
        processing: false,
        result: await complete(failedTurn({
          code: modelResult.error_type === 'SCHEMA_ERROR' ? 'provider_schema_invalid' : 'provider_unavailable',
          retryable: true,
          reason: 'El proveedor no produjo una interpretación aplicable; el turno puede reintentarse.',
          execution: measuredExecution,
        })),
      };
    }

    const validatedInference = portfolioBootstrapSemanticInferenceSchema.safeParse(modelResult.validated_output);
    if (!validatedInference.success) {
      this.recordFailure();
      return {
        processing: false,
        result: await complete(failedTurn({
          code: 'provider_schema_invalid', retryable: true,
          reason: 'La salida estructurada no cumple el contrato semántico E1.',
          execution: measuredExecution,
        })),
      };
    }
    const inference = validatedInference.data;
    const policy = applyDeterministicPolicy({
      inference,
      state,
      rawInput: input.inputText,
      nextVersion: claim.result.state.version + 1,
      questionLimit: this.config.questionLimit,
    });
    const completedTurn = {
      status: 'completed' as const,
      facts: policy.facts,
      hypotheses: policy.hypotheses,
      dispositions: policy.dispositions,
      answeredGaps: policy.answeredGaps,
      answeredQuestionId: input.answeredQuestionId,
      emittedQuestion: policy.emittedQuestion,
      convergence: policy.convergence,
      questionBudget: policy.questionBudget,
      error: null,
      execution: measuredExecution,
      inputText: input.inputText,
    };
    const verifiedTurn = portfolioBootstrapSemanticTurnInputSchema.safeParse({
      expectedVersion: claim.result.state.version,
      ...completedTurn,
    });
    if (!verifiedTurn.success) {
      this.recordFailure();
      return {
        processing: false,
        result: await complete(failedTurn({
          code: 'semantic_output_invalid', retryable: true,
          reason: 'La interpretación no superó la verificación de evidencia y seguridad.',
          execution: measuredExecution,
        })),
      };
    }
    this.recordSuccess();
    return {
      processing: false,
      result: await complete(completedTurn),
    };
  }

  private circuitOpen(): boolean {
    if (this.circuitOpenedAt === null) return false;
    if (Date.now() - this.circuitOpenedAt < this.config.circuitBreakerCooldownMs) return true;
    this.circuitOpenedAt = null;
    this.consecutiveFailures = 0;
    return false;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.config.circuitBreakerFailureThreshold) {
      this.circuitOpenedAt = Date.now();
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
  }
}

function applyDeterministicPolicy(input: {
  inference: SemanticInference;
  state: SemanticStateDto | null;
  rawInput: string;
  nextVersion: number;
  questionLimit: number;
}) {
  const facts = dedupeFacts(input.inference.facts, input.state);
  const hypotheses = dedupeHypotheses(input.inference.hypotheses, input.state);
  const dispositions = dedupeDispositions(input.inference.dispositions, input.state);
  const answeredGaps = [...new Set([
    ...facts.filter((fact) => fact.status !== 'retracted').map((fact) => fact.conceptId),
    ...dispositions.filter((item) => item.disposition === 'not_applicable').map((item) => item.conceptId),
  ])];
  const blockedConcepts = new Set([
    ...(input.state?.answeredGaps ?? []),
    ...(input.state?.dispositions.map((item) => item.conceptId) ?? []),
    ...answeredGaps,
    ...dispositions.map((item) => item.conceptId),
  ]);
  const currentBudget = input.state?.questionBudget ?? { limit: null, used: 0 };
  const limit = currentBudget.limit ?? input.questionLimit;
  const candidateResolves = input.inference.questionPlan?.resolves
    .filter((conceptId) => !blockedConcepts.has(conceptId)) ?? [];
  const repeated = candidateResolves.length > 0 && (input.state?.questionHistory ?? []).some((question) => (
    sameConceptSet(question.resolves, candidateResolves)
  ));
  const unsafeQuestion = input.inference.questionPlan
    ? !questionGroundedForBusiness(
      input.inference.questionPlan as { question: string; reasonToAsk: string },
      input.rawInput,
      dispositions,
      input.state,
    )
    : false;
  const canAsk = Boolean(input.inference.questionPlan)
    && candidateResolves.length > 0
    && !repeated
    && !unsafeQuestion
    && currentBudget.used < limit;
  const emittedQuestion = canAsk && input.inference.questionPlan ? {
    id: `e1-q-${input.nextVersion}-${canonicalContextHash(candidateResolves).slice(0, 12)}`,
    recap: groundedRecap(facts, dispositions, input.rawInput),
    question: input.inference.questionPlan.question,
    reasonToAsk: input.inference.questionPlan.reasonToAsk,
    resolves: [...new Set(candidateResolves)],
  } : null;
  const questionBudget = { limit, used: currentBudget.used + (emittedQuestion ? 1 : 0) };
  const sufficientForReview = hasSufficientEvidenceForHumanReview(input.state, facts);
  const convergence = emittedQuestion ? {
    status: 'question_required' as const,
    reason: input.inference.reason,
  } : input.inference.readyForHumanReview && sufficientForReview ? {
    status: 'ready_for_human_review' as const,
    reason: input.inference.reason,
  } : {
    status: 'budget_checkpoint' as const,
    reason: unsafeQuestion
      ? 'La pregunta propuesta no superó el guardrail de proporcionalidad y no invención.'
      : input.inference.readyForHumanReview && !sufficientForReview
      ? 'La salida no reúne todavía evidencia suficiente de situación y dirección para revisión humana.'
      : candidateResolves.length === 0 || repeated
      ? 'La pregunta propuesta repetía o reabría conceptos ya tratados; se requiere revisión humana.'
      : 'Se alcanzó el presupuesto de preguntas configurado.',
  };
  return { facts, hypotheses, dispositions, answeredGaps, emittedQuestion, convergence, questionBudget };
}

function dedupeFacts(facts: SemanticInference['facts'], state: SemanticStateDto | null) {
  const seen = new Set((state?.factLedger ?? []).map((fact) => factKey(fact)));
  return facts.filter((fact) => {
    const key = factKey(fact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeHypotheses(hypotheses: SemanticInference['hypotheses'], state: SemanticStateDto | null) {
  const seen = new Set((state?.hypotheses ?? []).map((item) => item.hypothesisId));
  return hypotheses.filter((item) => !seen.has(item.hypothesisId) && Boolean(seen.add(item.hypothesisId)));
}

function dedupeDispositions(dispositions: SemanticInference['dispositions'], state: SemanticStateDto | null) {
  const seen = new Set((state?.dispositions ?? []).map((item) => `${item.conceptId}:${item.disposition}`));
  return dispositions.filter((item) => {
    const key = `${item.conceptId}:${item.disposition}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function factKey(fact: { conceptId?: string; value?: unknown; status?: string }): string {
  return canonicalContextHash({ conceptId: fact.conceptId, value: fact.value, status: fact.status });
}

function groundedRecap(
  facts: SemanticInference['facts'],
  dispositions: SemanticInference['dispositions'],
  rawInput: string,
): string {
  const quotes = [...facts.flatMap((fact) => fact.evidenceRefs), ...dispositions.flatMap((item) => item.evidenceRefs)]
    .map((ref) => ref.kind === 'user_input' ? ref.quote : null)
    .filter((quote): quote is string => quote !== null)
    .filter((quote, index, all) => all.indexOf(quote) === index)
    .slice(0, 3);
  const evidence = (quotes.length ? quotes.join(' ') : rawInput.trim()).slice(0, 940);
  return `Entiendo: «${evidence}»`;
}

function failedTurn(input: {
  code: string;
  retryable: boolean;
  reason: string;
  execution: PortfolioBootstrapSemanticTurnInput['execution'];
}): Omit<PortfolioBootstrapSemanticTurnInput, 'expectedVersion'> {
  return {
    inputText: '',
    status: input.retryable ? 'failed_retryable' : 'failed_terminal',
    facts: [], hypotheses: [], dispositions: [], answeredGaps: [], answeredQuestionId: null,
    emittedQuestion: null,
    convergence: {
      status: input.retryable ? 'provider_retryable_failure' : 'safety_stop',
      reason: input.reason,
    },
    questionBudget: { limit: null, used: 0 },
    error: { code: input.code, retryable: input.retryable },
    execution: input.execution,
  };
}

function executionFrom(metadata: {
  provider: string;
  model: string;
  duration_ms: number;
  retry_count: number;
  fallback_used?: boolean;
  usage?: unknown;
}): PortfolioBootstrapSemanticTurnInput['execution'] {
  const usage = metadata.usage && typeof metadata.usage === 'object'
    ? metadata.usage as Record<string, unknown>
    : {};
  const inputTokens = nonNegativeInteger(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = nonNegativeInteger(usage.output_tokens ?? usage.completion_tokens);
  const reportedTotal = nonNegativeInteger(usage.total_tokens);
  return {
    provider: metadata.provider || null,
    model: metadata.model || null,
    durationMs: Math.max(0, Math.round(metadata.duration_ms)),
    inputTokens,
    outputTokens,
    totalTokens: reportedTotal === inputTokens + outputTokens ? reportedTotal : inputTokens + outputTokens,
    retryCount: Math.max(0, Math.round(metadata.retry_count)),
    fallbackUsed: metadata.fallback_used === true,
  };
}

function emptyExecution(): PortfolioBootstrapSemanticTurnInput['execution'] {
  return {
    provider: null, model: null, durationMs: 0,
    inputTokens: 0, outputTokens: 0, totalTokens: 0, retryCount: 0, fallbackUsed: false,
  };
}

function remainingQuestionBudget(state: SemanticStateDto | null, configuredLimit: number): number {
  const budget = state?.questionBudget ?? { limit: configuredLimit, used: 0 };
  return Math.max(0, (budget.limit ?? configuredLimit) - budget.used);
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function nonNegativeInteger(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function sameConceptSet(left: string[], right: string[]): boolean {
  return [...new Set(left)].sort().join('|') === [...new Set(right)].sort().join('|');
}

function questionGroundedForBusiness(
  plan: { question: string; reasonToAsk: string },
  rawInput: string,
  dispositions: SemanticInference['dispositions'],
  state: SemanticStateDto | null,
): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const raw = normalize(rawInput);
  const proposed = normalize(`${plan.question} ${plan.reasonToAsk}`);
  const organizationNotApplicable = [
    ...(state?.dispositions ?? []),
    ...dispositions,
  ].some((item) => item.disposition === 'not_applicable'
    && /^(organization_structure|departments|formal_departments)$/.test(item.conceptId));
  const explicitNoDepartments = /\b(sin|no (?:tenemos|hay|contamos con))\s+(?:los\s+)?departamentos?(?:\s+formales?)?\b/.test(raw);
  const microbusiness = /\b(cafeteria|microempresa|negocio pequeno|empresa pequena)\b|\bsomos\s+\d+\b/.test(raw);
  const asksFormalStructure = /\b(departamentos? formales?|organigramas?|areas? formales?|equipos? formales?)\b/.test(proposed);
  if ((organizationNotApplicable || explicitNoDepartments || microbusiness) && asksFormalStructure) return false;
  const rawNumbers = new Set(raw.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []);
  return (proposed.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).every((number) => rawNumbers.has(number));
}

function hasSufficientEvidenceForHumanReview(
  state: SemanticStateDto | null,
  facts: SemanticInference['facts'],
): boolean {
  const resolved = new Set([
    ...(state?.factLedger ?? []).filter((fact) => fact.status !== 'retracted').map((fact) => fact.conceptId),
    ...facts.filter((fact) => fact.status !== 'retracted').map((fact) => fact.conceptId),
  ]);
  const hasAnchor = ['situation', 'opportunity', 'decision', 'problem'].some((concept) => resolved.has(concept));
  const hasDirection = ['area', 'stakeholder', 'desired_outcome', 'objective', 'direction']
    .some((concept) => resolved.has(concept));
  return hasAnchor && hasDirection;
}

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Semantic provider deadline exceeded.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
