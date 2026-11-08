import {
  FetchStructuredModelAdapter,
  ResilientStructuredModelAdapter,
  loadPortfolioEntryFallbackProviderConfig,
  loadPortfolioEntryProviderConfig,
  type StructuredModelAdapter,
  type StructuredModelGenerateInput,
  type ModelExecutionResult,
} from '../portfolio-entry-runtime';
import {
  PortfolioBootstrapSemanticOrchestratorService,
  type PortfolioBootstrapSemanticOrchestratorConfig,
} from './portfolio-bootstrap-semantic-orchestrator.service';
import type { PortfolioBootstrapSemanticService } from './portfolio-bootstrap-semantic.service';
import { z } from 'zod/v3';

const semanticE1RuntimeConfigSchema = z.object({
  maxInputTokens: z.number().int().min(100).max(100_000),
  maxOutputTokens: z.number().int().min(100).max(20_000),
  maxCallsPerTurn: z.literal(1),
  timeoutMs: z.number().int().min(1).max(120_000),
  questionLimit: z.number().int().min(0).max(20),
  circuitBreakerFailureThreshold: z.number().int().min(1).max(100),
  circuitBreakerCooldownMs: z.number().int().min(1_000).max(3_600_000),
}).strict();

type SemanticE1RuntimeEnv = Partial<Record<
  | 'SEMANTIC_E1_MAX_INPUT_TOKENS'
  | 'SEMANTIC_E1_MAX_OUTPUT_TOKENS'
  | 'SEMANTIC_E1_MAX_CALLS_PER_TURN'
  | 'SEMANTIC_E1_TOTAL_TIMEOUT_MS'
  | 'SEMANTIC_E1_QUESTION_LIMIT'
  | 'SEMANTIC_E1_CIRCUIT_BREAKER_FAILURE_THRESHOLD'
  | 'SEMANTIC_E1_CIRCUIT_BREAKER_COOLDOWN_MS',
  string | undefined
>>;

export function loadSemanticE1OrchestratorConfig(
  env: SemanticE1RuntimeEnv = process.env,
): PortfolioBootstrapSemanticOrchestratorConfig {
  return semanticE1RuntimeConfigSchema.parse({
    maxInputTokens: configuredInteger(env.SEMANTIC_E1_MAX_INPUT_TOKENS, 5_000),
    maxOutputTokens: configuredInteger(env.SEMANTIC_E1_MAX_OUTPUT_TOKENS, 1_200),
    maxCallsPerTurn: configuredInteger(env.SEMANTIC_E1_MAX_CALLS_PER_TURN, 1),
    timeoutMs: configuredInteger(env.SEMANTIC_E1_TOTAL_TIMEOUT_MS, 30_000),
    questionLimit: configuredInteger(env.SEMANTIC_E1_QUESTION_LIMIT, 3),
    circuitBreakerFailureThreshold: configuredInteger(env.SEMANTIC_E1_CIRCUIT_BREAKER_FAILURE_THRESHOLD, 3),
    circuitBreakerCooldownMs: configuredInteger(env.SEMANTIC_E1_CIRCUIT_BREAKER_COOLDOWN_MS, 30_000),
  }) as PortfolioBootstrapSemanticOrchestratorConfig;
}

export const DEFAULT_SEMANTIC_E1_ORCHESTRATOR_CONFIG = loadSemanticE1OrchestratorConfig({});

export function createPortfolioBootstrapSemanticOrchestrator(
  store: PortfolioBootstrapSemanticService,
): PortfolioBootstrapSemanticOrchestratorService {
  const config = loadSemanticE1OrchestratorConfig();
  return new PortfolioBootstrapSemanticOrchestratorService(
    store,
    createSemanticE1Model(config),
    config,
  );
}

type SemanticE1CompositionEnv = {
  NODE_ENV?: string;
  PORTFOLIO_ENTRY_E2E_TEST?: string;
};

export function semanticE1TestCompositionEnabled(
  env: SemanticE1CompositionEnv = process.env,
): boolean {
  return env.NODE_ENV === 'test' && env.PORTFOLIO_ENTRY_E2E_TEST === 'true';
}

export function createSemanticE1Model(
  config: PortfolioBootstrapSemanticOrchestratorConfig,
  env: SemanticE1CompositionEnv = process.env,
): StructuredModelAdapter {
  return semanticE1TestCompositionEnabled(env)
    ? new DeterministicSemanticE1TestModel()
    : new LazyConfiguredSemanticModel(config);
}

/**
 * Network-free model boundary for the existing authenticated E2E composition.
 * Both guards above are required; product and ordinary test processes retain
 * the configured provider path.
 */
class DeterministicSemanticE1TestModel implements StructuredModelAdapter {
  async generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>> {
    const payload = input.userPayload && typeof input.userPayload === 'object'
      ? input.userPayload as Record<string, unknown>
      : {};
    const rawInput = typeof payload.rawInput === 'string' ? payload.rawInput.trim() : '';
    const quote = rawInput.slice(0, 2_000);
    const semanticState = payload.semanticState && typeof payload.semanticState === 'object'
      ? payload.semanticState as Record<string, unknown>
      : null;
    const priorFacts = semanticState && Array.isArray(semanticState.factLedger)
      ? semanticState.factLedger
      : [];
    const isFollowUp = priorFacts.length > 0;
    const explicitNoPilot = /\b(?:nunca|no)\s+(?:hemos\s+)?probado\b/i.test(rawInput);
    const facts = [{
      conceptId: isFollowUp ? 'direction' : 'situation',
      value: rawInput,
      provenance: 'user_declared',
      evidenceRefs: [{ kind: 'user_input', quote }],
      confidence: 1,
      status: 'observed',
    }, ...(!isFollowUp && explicitNoPilot ? [{
      conceptId: 'pilot_experience',
      value: false,
      provenance: 'user_declared',
      evidenceRefs: [{ kind: 'user_input', quote }],
      confidence: 1,
      status: 'observed',
    }] : [])];
    const candidate = {
      facts,
      hypotheses: [],
      dispositions: [],
      questionPlan: isFollowUp ? null : {
        question: '¿Qué resultado concreto queréis conseguir con esta oportunidad?',
        reasonToAsk: 'La situación está descrita, pero falta la dirección que orientará la revisión humana.',
        resolves: ['direction'],
      },
      readyForHumanReview: isFollowUp,
      reason: isFollowUp
        ? 'La situación y la dirección tienen evidencia declarada y pueden pasar a revisión humana.'
        : 'Hay evidencia de la situación y queda una incertidumbre material sobre la dirección.',
    };
    const parsed = input.outputSchema.safeParse(candidate);
    const executionMetadata: ModelExecutionResult<T>['execution_metadata'] = {
      call_id: input.call.call_id,
      purpose: input.call.purpose,
      case_id: input.call.case_id,
      repeat_index: input.call.repeat_index,
      turn_index: input.call.turn_index,
      provider: 'deterministic_test_adapter',
      requested_model: 'portfolio-bootstrap-semantic-e2e-fake',
      model: 'portfolio-bootstrap-semantic-e2e-fake',
      temperature: 0,
      seed_support: 'not_requested',
      duration_ms: 0,
      retry_count: 0,
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      fallback_used: false,
    };
    return {
      provider_raw: { deterministic_test_adapter: true },
      parsed_output: candidate,
      validated_output: parsed.success ? parsed.data : null,
      schema_errors: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
      execution_metadata: executionMetadata,
      ...(parsed.success ? {} : { error_type: 'SCHEMA_ERROR' as const }),
    };
  }
}

class LazyConfiguredSemanticModel implements StructuredModelAdapter {
  private configured: StructuredModelAdapter | null = null;

  constructor(private readonly config: PortfolioBootstrapSemanticOrchestratorConfig) {}

  async generate<T>(input: StructuredModelGenerateInput<T>) {
    return this.adapter().generate(input);
  }

  private adapter(): StructuredModelAdapter {
    if (this.configured) return this.configured;
    const primaryConfig = loadPortfolioEntryProviderConfig();
    const fallbackConfig = loadPortfolioEntryFallbackProviderConfig();
    const providerTimeoutMs = Math.max(1, Math.floor(this.config.timeoutMs / 2));
    this.configured = new ResilientStructuredModelAdapter(
      new FetchStructuredModelAdapter({
        ...primaryConfig,
        timeoutMs: Math.min(primaryConfig.timeoutMs, providerTimeoutMs),
        retryOnTimeout: false,
      }),
      fallbackConfig ? new FetchStructuredModelAdapter({
        ...fallbackConfig,
        timeoutMs: Math.min(fallbackConfig.timeoutMs, providerTimeoutMs),
        retryOnTimeout: false,
      }) : undefined,
    );
    return this.configured;
  }
}

function configuredInteger(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  return Number(raw);
}
