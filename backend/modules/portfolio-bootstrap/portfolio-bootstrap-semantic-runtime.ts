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

export const DEFAULT_SEMANTIC_E1_ORCHESTRATOR_CONFIG: PortfolioBootstrapSemanticOrchestratorConfig = {
  maxInputTokens: 5_000,
  maxOutputTokens: 1_200,
  maxCallsPerTurn: 1,
  timeoutMs: 30_000,
  questionLimit: 3,
  circuitBreakerFailureThreshold: 3,
  circuitBreakerCooldownMs: 30_000,
};

export function createPortfolioBootstrapSemanticOrchestrator(
  store: PortfolioBootstrapSemanticService,
): PortfolioBootstrapSemanticOrchestratorService {
  return new PortfolioBootstrapSemanticOrchestratorService(
    store,
    new LazyConfiguredSemanticModel(),
    DEFAULT_SEMANTIC_E1_ORCHESTRATOR_CONFIG,
  );
}

class LazyConfiguredSemanticModel implements StructuredModelAdapter {
  private configured: StructuredModelAdapter | null = null;

  async generate<T>(input: StructuredModelGenerateInput<T>) {
    return this.adapter().generate(input);
  }

  private adapter(): StructuredModelAdapter {
    if (this.configured) return this.configured;
    const primaryConfig = loadPortfolioEntryProviderConfig();
    const fallbackConfig = loadPortfolioEntryFallbackProviderConfig();
    this.configured = new ResilientStructuredModelAdapter(
      new FetchStructuredModelAdapter({ ...primaryConfig, timeoutMs: DEFAULT_SEMANTIC_E1_ORCHESTRATOR_CONFIG.timeoutMs }),
      fallbackConfig ? new FetchStructuredModelAdapter({
        ...fallbackConfig,
        timeoutMs: Math.min(fallbackConfig.timeoutMs, DEFAULT_SEMANTIC_E1_ORCHESTRATOR_CONFIG.timeoutMs),
      }) : undefined,
    );
    return this.configured;
  }
}
