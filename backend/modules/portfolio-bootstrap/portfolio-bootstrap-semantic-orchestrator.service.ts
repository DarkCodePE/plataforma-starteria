import type { Permission } from '../../shared/authz/permissions';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';
import { z } from 'zod/v3';
import type { StructuredModelAdapter } from '../portfolio-entry-runtime/model/structured-model-adapter';
import {
  portfolioBootstrapLandingSynthesisSchema,
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
import { portfolioBootstrapSemanticProviderJsonSchema } from './portfolio-bootstrap-semantic-provider-schema';

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
  synthesis: portfolioBootstrapLandingSynthesisSchema.nullable().optional(),
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
  if (output.readyForHumanReview && !output.synthesis) {
    context.addIssue({ code: 'custom', path: ['synthesis'], message: 'La revisión humana requiere una síntesis de aterrizaje.' });
  }
  if (!output.readyForHumanReview && output.synthesis) {
    context.addIssue({ code: 'custom', path: ['synthesis'], message: 'Una salida insuficiente no puede anticipar una síntesis final.' });
  }
});

type SemanticInference = z.infer<typeof portfolioBootstrapSemanticInferenceSchema>;

const SEMANTIC_E1_SYSTEM_PROMPT = `Eres el intérprete acotado del contexto E1 de Portfolio Bootstrap.
Tu trabajo es comprender el punto de partida y el propósito del usuario, no extraer palabras ni rellenar
una plantilla. Devuelve un único objeto JSON que cumpla el schema y sigue este orden de razonamiento:

1. Distingue si el punto de partida es una necesidad, oportunidad, exploración o iniciativa existente.
   Registra exactamente una clasificación como hipótesis proposed, con hypothesisId
   starting_point.need, starting_point.opportunity, starting_point.exploration o
   starting_point.existing_initiative. Susténtala sólo con supportConceptIds de hechos declarados.
2. Identifica qué quiere poder comprender, decidir o cambiar el usuario. No confundas una actividad
   genérica (por ejemplo, preparar un comité) con el asunto material que debe abordar.
3. Identifica la incertidumbre principal que condiciona el siguiente paso. Si no está declarada,
   formúlala como hipótesis proposed con hypothesisId main_uncertainty y supportConceptIds trazables.
4. Decide suficiencia por el significado acumulado, nunca por longitud, palabras clave o número de
   turnos. Si naturaleza, situación, propósito e incertidumbre están suficientemente delimitados,
   finaliza en este turno aunque sea el primero.
5. Formula como máximo una sola pregunta material por turno, únicamente si la respuesta puede cambiar
   la clasificación, el propósito, la incertidumbre principal o la dirección provisional. No preguntes
   por detalles útiles para E2 o la ejecución cuando E1 ya puede interpretarse.

Extrae hechos sólo cuando una cita literal del input los respalda. Para esos hechos usa provenance
user_declared y evidenceRefs de kind user_input. Reserva provenance source_extracted exclusivamente para
hechos del confirmedContext y usa sólo context_review_field o company_context_entry como evidencia.
En cada turno, cuando el rawInput actual los declare, usa al menos un conceptId de ancla canónico:
situation, opportunity, problem, need, existing_work, initiative o business_signal; y usa al menos un
conceptId de dirección canónico: desired_outcome, objective, direction, decision_to_enable,
concrete_decision o intention. Si esos roles ya existen activos en semanticState.factLedger, reutiliza
sus conceptIds para el grounding y no reemitas los hechos de turnos anteriores como facts nuevos.
Mantén hipótesis separadas y siempre proposed. Una negación explícita como "nunca lo hemos probado" resuelve pilot_experience aunque aparezca
dentro de una narración general. No inventes cifras, equipo, departamentos, KPI, causas, demanda,
recursos, resultados ni soluciones validadas. unknown y not_applicable requieren una declaración literal.
No preguntes por conceptos resueltos, retirados o ya preguntados. No confirmes E1, no definas el objetivo
ni avances a E2. readyForHumanReview sólo puede ser true si existe una situación material, una dirección
concreta, una clasificación trazable y una incertidumbre principal explícita. En ese caso produce
synthesis: una interpretación específica del caso, no una paráfrasis ni una plantilla genérica, que
explique la relación entre situación, intención, incertidumbre y dirección provisional para E2, enlazada
a evidenceConceptIds. Si falta información que pueda cambiar esa interpretación, synthesis debe ser null
y debes formular la única aclaración material necesaria.`;

const SEMANTIC_E1_RETRY_RECOVERY_PROMPT = `REINTENTO EXPLÍCITO DEL MISMO TURNO.
La salida anterior fue descartada porque no dejó una pregunta material ni una síntesis trazable.
Reevalúa el estado acumulado junto con el input actual y no repitas ese punto muerto: si la evidencia
ya delimita situación, dirección, clasificación e incertidumbre principal, devuelve
readyForHumanReview=true y una synthesis sustentada sólo por evidenceConceptIds activos; en hypotheses
incluye ambas hipótesis proposed: exactamente una starting_point.* y exactamente una main_uncertainty,
aunque la synthesis vuelva a expresar la incertidumbre. En el reintento reutiliza los conceptIds activos
de semanticState.factLedger para conservar ancla y dirección.
No reemitas como facts nuevos hechos que sólo procedan de turnos anteriores: añade facts únicamente cuando
su evidencia esté permitida por el rawInput actual o confirmedContext.
Los supportConceptIds deben referenciar únicamente conceptIds activos, emitidos
en facts o presentes en semanticState; no inventes identificadores para sostener las hipótesis. Si todavía
falta información capaz de cambiar la interpretación, devuelve readyForHumanReview=false, synthesis=null
y una questionPlan material y no repetida. Mientras quede presupuesto, no devuelvas a la vez
readyForHumanReview=false, synthesis=null y questionPlan=null.`;

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
    const systemPrompt = claim.result.turn.attempt > 1
      ? `${SEMANTIC_E1_SYSTEM_PROMPT}\n\n${SEMANTIC_E1_RETRY_RECOVERY_PROMPT}`
      : SEMANTIC_E1_SYSTEM_PROMPT;
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
    const serializedModelInput = `${systemPrompt}\n${JSON.stringify(userPayload)}`;
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
        systemPrompt,
        userPayload,
        outputSchema: portfolioBootstrapSemanticInferenceSchema,
        providerJsonSchema: portfolioBootstrapSemanticProviderJsonSchema,
        preserveProviderNulls: true,
        requireProviderParameters: true,
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
      if (modelResult.error_type === 'SCHEMA_ERROR') {
        logSchemaValidationFailure({
          validationStage: 'adapter',
          providerRaw: modelResult.provider_raw,
          parsedOutput: modelResult.parsed_output,
          schemaErrors: modelResult.schema_errors,
          execution: measuredExecution,
        });
      }
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
      logSchemaValidationFailure({
        validationStage: 'orchestrator',
        providerRaw: modelResult.provider_raw,
        issues: validatedInference.error.issues,
        execution: measuredExecution,
      });
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
    if (policy.interpretationIncomplete) {
      logger.warn({
        event: 'portfolio_bootstrap_semantic_policy_incomplete',
        incompleteReason: policy.incompleteReason,
        attempt: claim.result.turn.attempt,
        providerFactsCount: inference.facts.length,
        providerHypothesesCount: inference.hypotheses.length,
        providerDispositionsCount: inference.dispositions.length,
        providerHasQuestionPlan: inference.questionPlan !== null,
        providerHasSynthesis: inference.synthesis != null,
        providerReadyForHumanReview: inference.readyForHumanReview,
        acceptedFactsCount: policy.facts.length,
        acceptedHypothesesCount: policy.hypotheses.length,
        acceptedDispositionsCount: policy.dispositions.length,
        hasAnchor: policy.materialEvidence.hasAnchor,
        hasDirection: policy.materialEvidence.hasDirection,
        hasStartingPoint: policy.materialEvidence.hasStartingPoint,
        hasMainUncertainty: policy.materialEvidence.hasMainUncertainty,
        questionBudgetLimit: policy.questionBudget.limit,
        questionBudgetUsed: policy.questionBudget.used,
        inputTokens: measuredExecution.inputTokens,
        outputTokens: measuredExecution.outputTokens,
        totalTokens: measuredExecution.totalTokens,
      }, 'portfolio_bootstrap_semantic_policy_incomplete');
      this.recordFailure();
      return {
        processing: false,
        result: await complete(failedTurn({
          code: 'semantic_interpretation_incomplete',
          retryable: true,
          reason: 'El modelo no produjo una pregunta o síntesis material trazable; el turno puede reintentarse.',
          execution: measuredExecution,
        })),
      };
    }
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
      // The provider output passed its own schema, but the final governed turn did not.
      // Log only the schema issue paths/categories; never the user text or provider payload.
      logSchemaValidationFailure({
        validationStage: 'semantic_turn',
        providerRaw: modelResult.provider_raw,
        issues: verifiedTurn.error.issues,
        execution: measuredExecution,
      });
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
  const materialEvidence = materialEvidenceStatus(input.state, facts, hypotheses, dispositions);
  const sufficientForReview = materialEvidence.hasAnchor
    && materialEvidence.hasDirection
    && materialEvidence.hasStartingPoint
    && materialEvidence.hasMainUncertainty;
  const proposedQuestionPlan = sufficientForReview ? null : input.inference.questionPlan;
  const providerQuestionPlan = proposedQuestionPlan
    && questionCanChangeInterpretation(proposedQuestionPlan.resolves, materialEvidence)
    ? proposedQuestionPlan
    : null;
  const candidateResolves = providerQuestionPlan?.resolves
    .filter((conceptId) => !blockedConcepts.has(conceptId)) ?? [];
  const providerRepeated = candidateResolves.length > 0 && (input.state?.questionHistory ?? []).some((question) => (
    sameConceptSet(question.resolves, candidateResolves)
  ));
  const providerUnsafe = providerQuestionPlan
    ? !questionGroundedForBusiness(
      providerQuestionPlan as { question: string; reasonToAsk: string },
      input.rawInput,
      dispositions,
      input.state,
    )
    : false;
  const providerCanAsk = Boolean(providerQuestionPlan)
    && candidateResolves.length > 0
    && !providerRepeated
    && !providerUnsafe
    && currentBudget.used < limit;
  const incompleteCoreWithoutProviderQuestion = !proposedQuestionPlan
    && materialEvidence.hasAnchor
    && materialEvidence.hasDirection
    && materialEvidence.hasStartingPoint
    && !materialEvidence.hasMainUncertainty;
  const coreFallbackRequired = Boolean(proposedQuestionPlan)
    && !providerCanAsk
    && materialEvidence.hasStartingPoint
    && !materialEvidence.hasMainUncertainty;
  const fallbackPlan = !sufficientForReview
    && ((!proposedQuestionPlan && !incompleteCoreWithoutProviderQuestion) || coreFallbackRequired)
    ? materialClarificationPlan(input.rawInput, materialEvidence)
    : null;
  const fallbackResolves = fallbackPlan?.resolves.filter((conceptId) => !blockedConcepts.has(conceptId)) ?? [];
  const questionPlan = providerCanAsk ? providerQuestionPlan : fallbackPlan;
  const resolves = providerCanAsk ? candidateResolves : fallbackResolves;
  const repeated = resolves.length > 0 && (input.state?.questionHistory ?? []).some((question) => (
    sameConceptSet(question.resolves, resolves)
  ));
  const unsafeQuestion = providerUnsafe && !fallbackPlan;
  const canAsk = Boolean(questionPlan)
    && resolves.length > 0
    && !repeated
    && !unsafeQuestion
    && currentBudget.used < limit;
  const emittedQuestion = canAsk && questionPlan ? {
    id: `e1-q-${input.nextVersion}-${canonicalContextHash(resolves).slice(0, 12)}`,
    recap: groundedRecap(facts, dispositions, input.rawInput),
    question: questionPlan.question,
    reasonToAsk: questionPlan.reasonToAsk,
    resolves: [...new Set(resolves)],
  } : null;
  const questionBudget = { limit, used: currentBudget.used + (emittedQuestion ? 1 : 0) };
  const synthesis = input.inference.synthesis ?? null;
  const activeFactConcepts = new Set(latestFactsByConcept(input.state?.factLedger ?? [], facts)
    .filter((fact) => fact.status !== 'retracted')
    .map((fact) => fact.conceptId));
  const synthesisGrounded = synthesis ? synthesis.evidenceConceptIds.every((conceptId) => (
    activeFactConcepts.has(conceptId)
  )) : false;
  const groundedReviewReady = input.inference.readyForHumanReview
    && sufficientForReview
    && synthesisGrounded;
  const rawQuestionPlan = input.inference.questionPlan;
  const rawQuestionRepeated = Boolean(rawQuestionPlan)
    && (input.state?.questionHistory ?? []).some((question) => (
      sameConceptSet(question.resolves, rawQuestionPlan?.resolves ?? [])
    ));
  const rawQuestionUnsafe = rawQuestionPlan
    ? !questionGroundedForBusiness(
      rawQuestionPlan as { question: string; reasonToAsk: string },
      input.rawInput,
      dispositions,
      input.state,
    )
    : false;
  const providerReturnedNoMaterialNextStep = facts.length > 0
    && facts.every((fact) => fact.status !== 'retracted')
    && hypotheses.length === 0
    && dispositions.length === 0
    && input.inference.synthesis == null
    && !input.inference.readyForHumanReview
    && (rawQuestionPlan === null || (!rawQuestionRepeated && !rawQuestionUnsafe));
  const retryableEmptyCheckpoint = sufficientForReview
    && currentBudget.used < limit
    && providerReturnedNoMaterialNextStep;
  const prematureReviewWithoutMaterialExit = input.inference.readyForHumanReview
    && !sufficientForReview
    && currentBudget.used < limit
    && rawQuestionPlan === null;
  const incompleteReason = !canAsk
    && materialEvidence.hasAnchor
    && materialEvidence.hasDirection
    && !materialEvidence.hasStartingPoint
    ? 'missing_starting_point_without_question' as const
    : !canAsk && materialEvidence.hasAnchor && materialEvidence.hasDirection && !materialEvidence.hasMainUncertainty
    ? 'missing_main_uncertainty_without_question' as const
    : !canAsk && prematureReviewWithoutMaterialExit
    ? 'premature_review_without_material_exit' as const
    : !canAsk && materialEvidence.hasAnchor && materialEvidence.hasDirection && retryableEmptyCheckpoint
    ? 'material_evidence_without_next_step' as const
    : null;
  const interpretationIncomplete = incompleteReason !== null;
  const convergence = emittedQuestion ? {
    status: 'question_required' as const,
    reason: input.inference.reason,
    synthesis: null,
  } : groundedReviewReady ? {
    status: 'ready_for_human_review' as const,
    reason: input.inference.reason,
    synthesis,
  } : {
    status: 'budget_checkpoint' as const,
    reason: unsafeQuestion
      ? 'La pregunta propuesta no superó el guardrail de proporcionalidad y no invención.'
      : input.inference.readyForHumanReview && !sufficientForReview
      ? 'La salida no reúne todavía situación, dirección, naturaleza e incertidumbre principal trazables para revisión humana.'
      : resolves.length === 0 || repeated
      ? 'La pregunta propuesta repetía o reabría conceptos ya tratados; se requiere revisión humana.'
      : 'Se alcanzó el presupuesto de preguntas configurado.',
    synthesis: null,
  };
  return {
    facts, hypotheses, dispositions, answeredGaps, emittedQuestion, convergence, questionBudget,
    interpretationIncomplete, incompleteReason, materialEvidence,
  };
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
  const previousById = new Map((state?.hypotheses ?? []).map((item) => [item.hypothesisId, item]));
  const seenThisTurn = new Set<string>();
  return hypotheses.filter((item) => {
    if (seenThisTurn.has(item.hypothesisId)) return false;
    seenThisTurn.add(item.hypothesisId);
    const previous = previousById.get(item.hypothesisId);
    if (!previous) return true;
    if (!isInterpretationHypothesis(item.hypothesisId)) return false;
    return hypothesisKey(previous) !== hypothesisKey(item);
  });
}

function isInterpretationHypothesis(hypothesisId: string): boolean {
  return hypothesisId === 'main_uncertainty' || hypothesisId.startsWith('starting_point.');
}

function hypothesisKey(hypothesis: {
  hypothesisId?: string;
  statement?: string;
  supportConceptIds?: string[];
  confidence?: number;
  status?: string;
}): string {
  return canonicalContextHash({
    hypothesisId: hypothesis.hypothesisId,
    statement: hypothesis.statement,
    supportConceptIds: hypothesis.supportConceptIds,
    confidence: hypothesis.confidence,
    status: hypothesis.status,
  });
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

function logSchemaValidationFailure(input: {
  validationStage: 'adapter' | 'orchestrator' | 'semantic_turn';
  providerRaw: unknown;
  parsedOutput?: unknown;
  schemaErrors?: string[];
  issues?: z.ZodIssue[];
  execution: PortfolioBootstrapSemanticTurnInput['execution'];
}): void {
  const parsed = input.issues
    ? { success: false as const, error: { issues: input.issues } }
    : portfolioBootstrapSemanticInferenceSchema.safeParse(input.parsedOutput);
  const adapterIssues = (input.schemaErrors ?? []).slice(0, 20).map((entry) => {
    const rawPath = entry.split(':', 1)[0]?.trim() ?? '';
    return {
      path: /^[a-z0-9_.[\]-]{1,240}$/i.test(rawPath) ? rawPath : '$',
      category: 'adapter_schema_error',
    };
  });
  let issues: Array<{ path: string; category: string }>;
  if (parsed.success) {
    issues = adapterIssues.length ? adapterIssues : [{ path: '$', category: 'adapter_schema_error' }];
  } else {
    issues = parsed.error.issues.slice(0, 20).map((issue) => ({
      path: issue.path.length ? issue.path.map(String).join('.') : '$',
      category: issue.code,
    }));
  }
  const completion = safeProviderCompletion(input.providerRaw);
  logger.warn({
    event: 'portfolio_bootstrap_semantic_schema_invalid',
    validationStage: input.validationStage,
    issues,
    completionStatus: completion.status,
    incompleteReason: completion.incompleteReason,
    inputTokens: input.execution.inputTokens,
    outputTokens: input.execution.outputTokens,
    totalTokens: input.execution.totalTokens,
  }, 'portfolio_bootstrap_semantic_schema_invalid');
}

function safeProviderCompletion(providerRaw: unknown): {
  status: string;
  incompleteReason: string | null;
} {
  if (!providerRaw || typeof providerRaw !== 'object') {
    return { status: 'unknown', incompleteReason: null };
  }
  const record = providerRaw as Record<string, unknown>;
  const allowedStatuses = new Set(['completed', 'incomplete', 'failed', 'cancelled', 'in_progress', 'queued']);
  const status = typeof record.status === 'string' && allowedStatuses.has(record.status)
    ? record.status
    : 'unknown';
  const details = record.incomplete_details && typeof record.incomplete_details === 'object'
    ? record.incomplete_details as Record<string, unknown>
    : null;
  const rawReason = details?.reason;
  const allowedReasons = new Set(['max_output_tokens', 'content_filter']);
  let incompleteReason: string | null = null;
  if (typeof rawReason === 'string') {
    incompleteReason = allowedReasons.has(rawReason) ? rawReason : 'unknown';
  }
  return { status, incompleteReason };
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

function materialEvidenceStatus(
  state: SemanticStateDto | null,
  facts: SemanticInference['facts'],
  hypotheses: SemanticInference['hypotheses'],
  dispositions: SemanticInference['dispositions'],
) {
  const activeFacts = latestFactsByConcept(state?.factLedger ?? [], facts);
  const resolved = new Set(activeFacts
    .filter((fact) => fact.status !== 'retracted')
    .map((fact) => fact.conceptId));
  const dispositionConcepts = new Set([
    ...(state?.dispositions ?? []).map((item) => item.conceptId),
    ...dispositions.map((item) => item.conceptId),
  ]);
  const groundedConcepts = new Set([...resolved, ...dispositionConcepts]);
  const priorHypotheses = (state?.hypotheses ?? [])
    .filter((hypothesis) => hypothesis.status !== 'rejected')
    .filter((hypothesis) => hypothesis.supportConceptIds.length > 0
      && hypothesis.supportConceptIds.every((conceptId) => groundedConcepts.has(conceptId)));
  const currentHypotheses = hypotheses
    .filter((hypothesis) => hypothesis.status !== 'rejected')
    .filter((hypothesis) => hypothesis.supportConceptIds.length > 0
      && hypothesis.supportConceptIds.every((conceptId) => groundedConcepts.has(conceptId)));
  const hasAnchor = ['situation', 'opportunity', 'problem', 'need', 'existing_work', 'initiative', 'business_signal']
    .some((concept) => resolved.has(concept));
  const hasDirection = ['desired_outcome', 'objective', 'direction', 'decision_to_enable', 'concrete_decision', 'intention']
    .some((concept) => resolved.has(concept));
  const currentStartingPoints = currentHypotheses.filter((hypothesis) => hypothesis.hypothesisId.startsWith('starting_point.'));
  const priorStartingPoints = latestSemanticHypotheses(
    priorHypotheses.filter((hypothesis) => hypothesis.hypothesisId.startsWith('starting_point.')),
  );
  const startingPointSource = currentStartingPoints.length > 0 ? currentStartingPoints : priorStartingPoints;
  const startingPoints = new Set(startingPointSource
    .map((hypothesis) => /^starting_point\.(need|opportunity|exploration|existing_initiative)$/.exec(hypothesis.hypothesisId)?.[1])
    .filter((kind): kind is string => Boolean(kind)));
  const hasStartingPoint = startingPoints.size === 1;
  const materialUnknownConcepts = new Set(['main_uncertainty', 'uncertainty', 'root_cause', 'solution']);
  const hasExplicitUncertainty = ['uncertainty', 'main_uncertainty']
    .some((concept) => resolved.has(concept))
    || [...(state?.dispositions ?? []), ...dispositions].some((item) => (
      item.disposition === 'unknown'
      && materialUnknownConcepts.has(item.conceptId)
      && !resolved.has(item.conceptId)
    ));
  const currentMainUncertainty = currentHypotheses.filter((hypothesis) => hypothesis.hypothesisId === 'main_uncertainty');
  const priorMainUncertainty = latestSemanticHypotheses(
    priorHypotheses.filter((hypothesis) => hypothesis.hypothesisId === 'main_uncertainty'),
  );
  const hasMainUncertainty = hasExplicitUncertainty
    || (currentMainUncertainty.length > 0 ? currentMainUncertainty : priorMainUncertainty).length === 1;
  return { hasAnchor, hasDirection, hasStartingPoint, hasMainUncertainty };
}

function latestFactsByConcept(
  priorFacts: SemanticStateDto['factLedger'],
  currentFacts: SemanticInference['facts'],
) {
  const latest = new Map<string, SemanticStateDto['factLedger'][number] | SemanticInference['facts'][number]>();
  for (const fact of priorFacts) {
    const previous = latest.get(fact.conceptId) as SemanticStateDto['factLedger'][number] | undefined;
    if (!previous || fact.semanticVersion >= (previous.semanticVersion ?? 0)) latest.set(fact.conceptId, fact);
  }
  for (const fact of currentFacts) latest.set(fact.conceptId, fact);
  return [...latest.values()];
}

function latestSemanticHypotheses<T extends { semanticVersion?: number }>(hypotheses: T[]): T[] {
  if (hypotheses.length === 0) return [];
  const latestVersion = Math.max(...hypotheses.map((hypothesis) => hypothesis.semanticVersion ?? 0));
  return hypotheses.filter((hypothesis) => (hypothesis.semanticVersion ?? 0) === latestVersion);
}

function materialClarificationPlan(rawInput: string, evidence: {
  hasAnchor: boolean;
  hasDirection: boolean;
  hasStartingPoint: boolean;
  hasMainUncertainty: boolean;
}) {
  const committee = /\b(comit[eé]|portafolio|decisiones?)\b/i.test(rawInput);
  if (evidence.hasAnchor && !evidence.hasDirection) {
    return {
      question: '¿Qué decisión o cambio concreto te gustaría poder orientar a partir de esta situación?',
      reasonToAsk: 'La situación está descrita, pero falta la dirección que permitirá convertirla en un objetivo provisional.',
      resolves: ['decision_to_enable'],
    };
  }
  if (evidence.hasAnchor && evidence.hasDirection
    && evidence.hasStartingPoint && !evidence.hasMainUncertainty) {
    return {
      question: '¿Cuál es la incertidumbre principal que necesitas despejar antes de decidir el siguiente paso?',
      reasonToAsk: 'Distinguir la duda central evita cerrar E1 con una solución o una conclusión todavía no sustentada.',
      resolves: ['main_uncertainty'],
    };
  }
  if (evidence.hasAnchor && evidence.hasDirection) return null;
  return {
    question: committee
      ? '¿Qué trabajo, problema u oportunidad debe quedar claro y qué decisión concreta debería poder tomar el comité?'
      : '¿Qué situación, problema u oportunidad concreta quieres abordar y qué te gustaría poder decidir después?',
    reasonToAsk: 'Esta información cambia la interpretación del punto de partida y evita cerrar E1 con una intención genérica.',
    resolves: ['material_subject', 'decision_to_enable'],
  };
}

function questionCanChangeInterpretation(resolves: string[], evidence: {
  hasAnchor: boolean;
  hasDirection: boolean;
  hasStartingPoint: boolean;
  hasMainUncertainty: boolean;
}): boolean {
  const missingMaterialConcepts = new Set<string>();
  if (!evidence.hasAnchor) {
    ['material_subject', 'affected_work', 'situation', 'opportunity', 'problem', 'need', 'existing_work', 'initiative', 'business_signal']
      .forEach((concept) => missingMaterialConcepts.add(concept));
  }
  if (!evidence.hasDirection) {
    ['desired_outcome', 'objective', 'direction', 'decision_to_enable', 'concrete_decision', 'intention']
      .forEach((concept) => missingMaterialConcepts.add(concept));
  }
  if (!evidence.hasStartingPoint) {
    ['starting_point', 'starting_point_kind', 'material_subject', 'affected_work', 'root_cause']
      .forEach((concept) => missingMaterialConcepts.add(concept));
  }
  if (!evidence.hasMainUncertainty) {
    ['main_uncertainty', 'uncertainty', 'root_cause', 'solution']
      .forEach((concept) => missingMaterialConcepts.add(concept));
  }
  return resolves.some((conceptId) => missingMaterialConcepts.has(conceptId));
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
