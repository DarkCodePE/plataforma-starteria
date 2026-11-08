import {
  FetchStructuredModelAdapter,
  ResilientStructuredModelAdapter,
  loadPortfolioEntryFallbackProviderConfig,
  loadPortfolioEntryProviderConfig,
  type StructuredModelAdapter,
  type StructuredModelGenerateInput,
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
    new LazyConfiguredSemanticModel(config),
    config,
  );
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
