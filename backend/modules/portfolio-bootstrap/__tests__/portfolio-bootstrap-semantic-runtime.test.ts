import { describe, expect, it } from 'vitest';
import {
  createSemanticE1Model,
  loadSemanticE1OrchestratorConfig,
  semanticE1TestCompositionEnabled,
} from '../portfolio-bootstrap-semantic-runtime';

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

  it('enables the network-free model only behind both existing test guards', async () => {
    expect(semanticE1TestCompositionEnabled({
      NODE_ENV: 'test',
      PORTFOLIO_ENTRY_E2E_TEST: 'true',
    })).toBe(true);
    expect(semanticE1TestCompositionEnabled({ NODE_ENV: 'test' })).toBe(false);
    expect(semanticE1TestCompositionEnabled({ PORTFOLIO_ENTRY_E2E_TEST: 'true' })).toBe(false);

    const model = createSemanticE1Model(loadSemanticE1OrchestratorConfig({}), {
      NODE_ENV: 'test',
      PORTFOLIO_ENTRY_E2E_TEST: 'true',
    });
    const output = await model.generate({
      systemPrompt: 'test',
      userPayload: {
        rawInput: 'Somos una cafetería de 4 personas. Nunca hemos probado desayunos para llevar ni pedidos a oficinas.',
        semanticState: null,
      },
      outputSchema: { safeParse: (candidate: unknown) => ({ success: true, data: candidate }) } as any,
      metadata: { provider: 'configured', model: 'configured', seed_support: 'not_requested' },
      call: { call_id: 'kan246-test', purpose: 'bootstrap_semantic_turn' },
    });

    expect(output.validated_output).toMatchObject({
      facts: expect.arrayContaining([
        expect.objectContaining({ conceptId: 'situation', provenance: 'user_declared' }),
        expect.objectContaining({ conceptId: 'pilot_experience', value: false, provenance: 'user_declared' }),
      ]),
      questionPlan: expect.objectContaining({ resolves: ['direction'] }),
      readyForHumanReview: false,
    });
    expect(output.execution_metadata).toMatchObject({
      provider: 'deterministic_test_adapter',
      model: 'portfolio-bootstrap-semantic-e2e-fake',
    });
  });
});
