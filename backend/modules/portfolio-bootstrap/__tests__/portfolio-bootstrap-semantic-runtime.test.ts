import { describe, expect, it } from 'vitest';
import { loadSemanticE1OrchestratorConfig } from '../portfolio-bootstrap-semantic-runtime';

describe('semantic E1 runtime configuration', () => {
  it('loads validated defaults and explicit operational budgets', () => {
    expect(loadSemanticE1OrchestratorConfig({})).toEqual({
      maxInputTokens: 5_000,
      maxOutputTokens: 1_200,
      maxCallsPerTurn: 1,
      timeoutMs: 30_000,
      questionLimit: 3,
      circuitBreakerFailureThreshold: 3,
      circuitBreakerCooldownMs: 30_000,
    });
    expect(loadSemanticE1OrchestratorConfig({
      SEMANTIC_E1_MAX_INPUT_TOKENS: '7000',
      SEMANTIC_E1_MAX_OUTPUT_TOKENS: '900',
      SEMANTIC_E1_TOTAL_TIMEOUT_MS: '12000',
      SEMANTIC_E1_QUESTION_LIMIT: '2',
      SEMANTIC_E1_CIRCUIT_BREAKER_FAILURE_THRESHOLD: '4',
      SEMANTIC_E1_CIRCUIT_BREAKER_COOLDOWN_MS: '45000',
    })).toMatchObject({
      maxInputTokens: 7_000, maxOutputTokens: 900, maxCallsPerTurn: 1,
      timeoutMs: 12_000, questionLimit: 2,
      circuitBreakerFailureThreshold: 4, circuitBreakerCooldownMs: 45_000,
    });
  });

  it('rejects unsafe or unsupported budgets instead of silently coercing them', () => {
    expect(() => loadSemanticE1OrchestratorConfig({ SEMANTIC_E1_MAX_CALLS_PER_TURN: '2' })).toThrow();
    expect(() => loadSemanticE1OrchestratorConfig({ SEMANTIC_E1_TOTAL_TIMEOUT_MS: '0' })).toThrow();
    expect(() => loadSemanticE1OrchestratorConfig({ SEMANTIC_E1_QUESTION_LIMIT: '-1' })).toThrow();
  });
});
