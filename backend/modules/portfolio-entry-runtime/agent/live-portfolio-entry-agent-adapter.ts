import type {
  PortfolioEntryAgentAdapterV2,
  PortfolioEntryAnalyzeTurnInputV2,
  PortfolioEntryAnalyzeTurnOutputV2,
} from './portfolio-entry-agent-adapter';
import type { StructuredModelAdapter } from '../model/structured-model-adapter';
import type { ModelExecutionResult } from '../model/model-execution-types';
import { LiveModelExecutionError } from '../model/live-model-error';
import { portfolioEntryTurnProviderJsonSchema, portfolioEntryTurnWithoutClassificationProviderJsonSchema } from '../model/provider-json-schemas';
import { composeAnalysisSystemPrompt, type ResolvedPromptManifest } from '../prompts/prompt-manifest';
import {
  portfolioEntryTurnOutputV2Schema,
  portfolioEntryTurnOutputWithoutClassificationSchema,
  type PortfolioEntryTurnOutputV2,
} from '../domain/model-output.schema';
import type { PortfolioEntryAnalysisV2 } from '../domain/analysis.schema';
import type { JevClassification, JevClassifier } from './jev-classifier';

export type PortfolioEntryLiveCandidate = {
  candidate_id: string;
  adapter_mode: 'live_llm_candidate';
  provider: string;
  model: string;
  temperature?: number;
  seed?: string | number;
  prompt_manifest_hash: string;
  contract_manifest_hash: string;
  seed_support?: 'provided' | 'unavailable' | 'not_requested';
};

export class LivePortfolioEntryAgentAdapter implements PortfolioEntryAgentAdapterV2 {
  readonly modelExecutions: ModelExecutionResult<PortfolioEntryTurnOutputV2>[] = [];

  constructor(
    private readonly model: StructuredModelAdapter,
    private readonly candidate: PortfolioEntryLiveCandidate,
    private readonly promptManifest: ResolvedPromptManifest,
    private readonly runContext: { repeat_index?: number } = {},
    // ADR-032: con clasificador, Jev es el único que clasifica y el LLM recibe el resultado fijo.
    private readonly classifier?: JevClassifier,
    // Una línea por turno clasificado, para seguir en producción cuántos casos quedan en `unknown`.
    private readonly onClassified?: (event: ClassificationLogEvent) => void,
  ) {}

  async analyzeTurn(input: PortfolioEntryAnalyzeTurnInputV2): Promise<PortfolioEntryAnalyzeTurnOutputV2> {
    const classification = this.classifier
      ? await this.classifier.classify({
        rawInput: input.rawInput,
        priorQuestions: input.sessionContext.previous_questions.map((question) => question.question),
      })
      : undefined;
    const fixedClassification = classification ? resolveClassification(classification, input.priorAnalysis) : undefined;
    if (classification && fixedClassification) {
      this.onClassified?.({
        session_id: input.sessionId,
        follow_up: Boolean(input.priorAnalysis),
        provider: classification.source,
        jev: { frame: classification.frame, primary_intent: classification.primary_intent },
        confidence: classification.confidence,
        applied: fixedClassification,
        duration_ms: classification.duration_ms,
        ...(classification.error ? { error: classification.error } : {}),
      });
    }

    const result = await this.model.generate({
      systemPrompt: composeAnalysisSystemPrompt(this.promptManifest, { classificationProvided: Boolean(fixedClassification) }),
      userPayload: {
        ...(fixedClassification ? { classification: fixedClassification } : {}),
        rawInput: input.rawInput,
        priorAnalysis: input.priorAnalysis,
        sessionContext: input.sessionContext,
        available_question_budget: input.sessionContext.interaction_mode === 'quick_clarification'
          ? Math.max(0, input.sessionContext.quick_question_budget - input.sessionContext.quick_questions_asked)
          : Math.max(0, 2 - input.sessionContext.questions_asked_current_round),
        candidate: safeCandidatePayload(this.candidate),
      },
      outputSchema: fixedClassification ? portfolioEntryTurnOutputWithoutClassificationSchema : portfolioEntryTurnOutputV2Schema,
      providerJsonSchema: fixedClassification
        ? portfolioEntryTurnWithoutClassificationProviderJsonSchema
        : portfolioEntryTurnProviderJsonSchema,
      metadata: {
        ...this.candidate,
        seed_support: this.candidate.seed_support ?? (this.candidate.seed === undefined ? 'not_requested' : 'unavailable'),
      },
      call: {
        call_id: `${input.sessionId}-turn-${input.entryId}`,
        purpose: 'analysis_turn',
        case_id: input.sessionId.split('-').slice(0, 4).join('-'),
        repeat_index: this.runContext.repeat_index,
        turn_index: Number(input.entryId.split('-').at(-1)) || undefined,
      },
    });
    this.modelExecutions.push(result);

    if (!result.validated_output) {
      throw new LiveModelExecutionError('Live model did not produce a schema-valid PortfolioEntry turn output.', result);
    }

    const validated = result.validated_output as unknown as PortfolioEntryAnalyzeTurnOutputV2;
    if (!fixedClassification || !classification) return { ...validated, modelExecution: result };
    return {
      ...validated,
      analysis: { ...validated.analysis, ...fixedClassification },
      modelExecution: { ...result, execution_metadata: { ...result.execution_metadata, classifier: classifierTrace(classification) } },
    };
  }
}

export type ClassificationLogEvent = {
  session_id: string;
  follow_up: boolean;
  provider: JevClassification['source'];
  jev: Pick<JevClassification, 'frame' | 'primary_intent'>;
  confidence: JevClassification['confidence'];
  applied: FixedClassification;
  duration_ms: number;
  error?: string;
};

type FixedClassification = Pick<PortfolioEntryAnalysisV2, 'primary_intent' | 'secondary_intents' | 'initial_entry_state' | 'current_frame'>;

/**
 * - `initial_entry_state` no cambia después del primer turno (prompts/v0.2/agent.md).
 * - En seguimiento, el mensaje suele ser una respuesta corta ("unidades") que no alcanza para
 *   clasificar: si Jev queda debajo del umbral, se conserva la clasificación anterior en vez de
 *   degradarla a `unknown`. Si Jev clasifica con confianza, esa lectura manda.
 */
export function resolveClassification(jev: JevClassification, prior?: PortfolioEntryAnalysisV2): FixedClassification {
  if (!prior) {
    return { initial_entry_state: jev.frame, current_frame: jev.frame, primary_intent: jev.primary_intent, secondary_intents: jev.secondary_intents };
  }
  const intentKnown = jev.primary_intent !== 'unknown';
  return {
    initial_entry_state: prior.initial_entry_state,
    current_frame: jev.frame !== 'unknown' ? jev.frame : prior.current_frame,
    primary_intent: intentKnown ? jev.primary_intent : prior.primary_intent,
    secondary_intents: intentKnown ? jev.secondary_intents : prior.secondary_intents,
  };
}

function classifierTrace(classification: JevClassification) {
  return {
    provider: classification.source,
    model: classification.model,
    confidence: classification.confidence,
    duration_ms: classification.duration_ms,
    ...(classification.error ? { error: classification.error } : {}),
  };
}

function safeCandidatePayload(candidate: PortfolioEntryLiveCandidate): Record<string, unknown> {
  return {
    candidate_id: candidate.candidate_id,
    adapter_mode: candidate.adapter_mode,
    provider: candidate.provider,
    model: candidate.model,
    temperature: candidate.temperature,
    seed: candidate.seed,
    seed_support: candidate.seed_support,
    prompt_manifest_hash: candidate.prompt_manifest_hash,
    contract_manifest_hash: candidate.contract_manifest_hash,
  };
}
