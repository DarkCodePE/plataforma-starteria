import { describe, expect, it, vi } from 'vitest';
import type { Permission } from '../../../shared/authz/permissions';
import type { ModelExecutionResult } from '../../portfolio-entry-runtime/model/model-execution-types';
import type { StructuredModelAdapter } from '../../portfolio-entry-runtime/model/structured-model-adapter';
import {
  PortfolioBootstrapSemanticOrchestratorService,
  type PortfolioBootstrapSemanticTurnStore,
} from '../portfolio-bootstrap-semantic-orchestrator.service';
import { emptySemanticStateProjection, type SemanticStateDto, type SemanticTurnResult } from '../portfolio-bootstrap-semantic.service';

const permissions = new Set<Permission>(['portfolio:read', 'portfolio:write']);
const config = {
  maxInputTokens: 2_000,
  maxOutputTokens: 800,
  maxCallsPerTurn: 1 as const,
  timeoutMs: 5_000,
  questionLimit: 3,
  circuitBreakerFailureThreshold: 3,
  circuitBreakerCooldownMs: 30_000,
};

describe('PortfolioBootstrapSemanticOrchestratorService', () => {
  it('resolves a cafeteria negative cross-field fact and never asks pilot experience again', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [{
        conceptId: 'pilot_experience', value: 'none', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'nunca hemos probado pedidos a oficinas' }],
        confidence: 1, status: 'observed',
      }],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Qué situación concreta os gustaría mejorar primero?',
        reasonToAsk: 'Permite formular un objetivo sin asumir métricas ni departamentos.',
        resolves: ['situation'],
      },
      readyForHumanReview: false,
      reason: 'Falta concretar la situación prioritaria.',
    });
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    const output = await service.processTurn(command('Somos una cafetería pequeña y nunca hemos probado pedidos a oficinas.'));

    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      answeredGaps: ['pilot_experience'],
      emittedQuestion: expect.objectContaining({ resolves: ['situation'] }),
      convergence: expect.objectContaining({ status: 'question_required' }),
    }));
    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.emittedQuestion?.resolves).not.toContain('pilot_experience');
    expect(persisted.emittedQuestion?.recap).toContain('nunca hemos probado pedidos a oficinas');
    expect(output.processing).toBe(false);
  });

  it('keeps unknown separate, resolves multiple evidenced concepts and suppresses repeated questions', async () => {
    const state = semanticState({
      version: 2,
      dispositions: [{
        conceptId: 'organization_structure', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'No lo sé' }], turnId: 'turn-1', semanticVersion: 1,
      }],
      answeredGaps: ['pilot_experience'],
    });
    const store = fakeStore(state);
    const model = fakeModel({
      facts: [
        fact('situation', 'Queremos reducir las colas', 'Queremos reducir las colas'),
        fact('stakeholder', 'clientes del mediodía', 'clientes del mediodía'),
      ],
      hypotheses: [],
      dispositions: [],
      questionPlan: {
        question: '¿Cómo se organizan los departamentos?', reasonToAsk: 'Completar estructura.',
        resolves: ['organization_structure'],
      },
      readyForHumanReview: false,
      reason: 'La estructura sigue desconocida.',
    });
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    await service.processTurn(command('Queremos reducir las colas de clientes del mediodía.', 2));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.answeredGaps).toEqual(['situation', 'stakeholder']);
    expect(persisted.emittedQuestion).toBeNull();
    expect(persisted.convergence.status).toBe('budget_checkpoint');
  });

  it('persists a retryable safe failure with measured usage when the provider fails', async () => {
    const store = fakeStore();
    const model = fakeModelFailure();
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    await service.processTurn(command('Queremos entender el problema de reparto.'));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable', facts: [], hypotheses: [], dispositions: [], answeredGaps: [],
      emittedQuestion: null,
      error: { code: 'provider_unavailable', retryable: true },
      convergence: expect.objectContaining({ status: 'provider_retryable_failure' }),
      execution: expect.objectContaining({ durationMs: 321, retryCount: 1, fallbackUsed: true }),
    }));
  });

  it('returns the durable in-flight result without issuing a second model call', async () => {
    const store = fakeStore();
    vi.mocked(store.claimInference).mockResolvedValue({ claimed: false, result: turnResult('failed_retryable') });
    const model = fakeModelFailure();
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    const output = await service.processTurn(command('Mismo doble click.'));

    expect(output.processing).toBe(true);
    expect(model.generate).not.toHaveBeenCalled();
    expect(store.completeInference).not.toHaveBeenCalled();
  });

  it('fails closed before the provider when the configured input budget is exceeded', async () => {
    const store = fakeStore();
    const model = fakeModelFailure();
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, { ...config, maxInputTokens: 2 });

    await service.processTurn(command('Este texto supera claramente dos tokens estimados.'));

    expect(model.generate).not.toHaveBeenCalled();
    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_terminal',
      error: { code: 'input_budget_exceeded', retryable: false },
      convergence: expect.objectContaining({ status: 'safety_stop' }),
    }));
  });

  it('turns fabricated evidence into a retryable validation failure without persisting facts', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [fact('team_size', '50 personas', 'tenemos 50 personas')],
      hypotheses: [], dispositions: [], questionPlan: null,
      readyForHumanReview: true, reason: 'Supuestamente suficiente.',
    });
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    await service.processTurn(command('Somos una cafetería pequeña.'));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable', facts: [], hypotheses: [], answeredGaps: [],
      error: { code: 'semantic_output_invalid', retryable: true },
    }));
  });

  it('suppresses formal-department questions for an explicitly small business', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [fact('business_profile', 'cafetería pequeña', 'cafetería pequeña')],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Qué departamento formal y qué equipo se encargarán?',
        reasonToAsk: 'Necesito completar el organigrama.',
        resolves: ['organization_structure'],
      },
      readyForHumanReview: false, reason: 'Falta estructura.',
    });
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    await service.processTurn(command('Somos una cafetería pequeña.'));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed', emittedQuestion: null,
      convergence: expect.objectContaining({ status: 'budget_checkpoint' }),
    }));
  });
});

function command(inputText: string, expectedVersion = 0) {
  return {
    sessionId: 'session-1', authenticatedUserId: 'user-1', permissions,
    idempotencyKey: 'turn-key', expectedVersion, inputText, answeredQuestionId: null,
  };
}

function fakeStore(state: SemanticStateDto | null = null): PortfolioBootstrapSemanticTurnStore {
  const claim = turnResult('failed_retryable', state?.version ?? 1);
  return {
    getInferenceContext: vi.fn().mockResolvedValue({
      state,
      confirmedContext: { version: 3, context: { situation: 'Confirmada' }, provenance: [] },
    }),
    claimInference: vi.fn().mockResolvedValue({ claimed: true, result: claim }),
    completeInference: vi.fn().mockImplementation(async (input) => turnResult(input.status, input.expectedVersion + 1)),
  };
}

function fakeModel(output: unknown): StructuredModelAdapter {
  return { generate: vi.fn().mockResolvedValue(execution(output)) };
}

function fakeModelFailure(): StructuredModelAdapter {
  return { generate: vi.fn().mockResolvedValue({
    ...execution(null), validated_output: null, error_type: 'TECHNICAL_ERROR', technical_error: 'Provider timeout',
    execution_metadata: { ...execution(null).execution_metadata, duration_ms: 321, retry_count: 1, fallback_used: true },
  }) };
}

function execution(output: unknown): ModelExecutionResult<unknown> {
  return {
    provider_raw: null, parsed_output: output, validated_output: output, schema_errors: [],
    execution_metadata: {
      call_id: 'call-1', purpose: 'analysis_turn', provider: 'fake-provider', model: 'fake-model',
      requested_model: 'fake-model', seed_support: 'not_requested', duration_ms: 12, retry_count: 0,
      usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 }, fallback_used: false,
    },
  };
}

function semanticState(overrides: Partial<SemanticStateDto> = {}): SemanticStateDto {
  return {
    id: 'semantic-1', sessionId: 'session-1', version: 0,
    ...emptySemanticStateProjection(), createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function turnResult(status: 'completed' | 'failed_retryable' | 'failed_terminal', version = 1): SemanticTurnResult {
  const state = semanticState({ version });
  return {
    state,
    turn: {
      id: 'turn-1', semanticVersion: version, organizationId: 'org-1', actorUserId: 'user-1', inputText: 'raw',
      status, attempt: 1, attempts: [], facts: [], hypotheses: [], dispositions: [], answeredGaps: [],
      answeredQuestionId: null, emittedQuestion: null,
      convergence: { status: 'provider_retryable_failure', reason: 'inference pending' },
      questionBudget: { limit: 3, used: 0 }, error: { code: 'inference_pending', retryable: true },
      execution: { provider: null, model: null, durationMs: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, retryCount: 0, fallbackUsed: false },
      createdAt: new Date(0).toISOString(),
    },
  };
}

function fact(conceptId: string, value: string, quote: string) {
  return {
    conceptId, value, provenance: 'user_declared', evidenceRefs: [{ kind: 'user_input', quote }],
    confidence: 1, status: 'observed',
  };
}
