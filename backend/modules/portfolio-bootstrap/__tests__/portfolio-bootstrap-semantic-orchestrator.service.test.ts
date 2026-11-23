import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../../shared/utils/logger';
import type { Permission } from '../../../shared/authz/permissions';
import type { ModelExecutionResult } from '../../portfolio-entry-runtime/model/model-execution-types';
import type { StructuredModelAdapter } from '../../portfolio-entry-runtime/model/structured-model-adapter';
import {
  PortfolioBootstrapSemanticOrchestratorService,
  portfolioBootstrapSemanticInferenceSchema,
  type PortfolioBootstrapSemanticTurnStore,
} from '../portfolio-bootstrap-semantic-orchestrator.service';
import { portfolioBootstrapSemanticProviderJsonSchema } from '../portfolio-bootstrap-semantic-provider-schema';
import { emptySemanticStateProjection, type SemanticStateDto, type SemanticTurnResult } from '../portfolio-bootstrap-semantic.service';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(model.generate).toHaveBeenCalledWith(expect.objectContaining({
      outputSchema: portfolioBootstrapSemanticInferenceSchema,
      providerJsonSchema: portfolioBootstrapSemanticProviderJsonSchema,
      preserveProviderNulls: true,
      requireProviderParameters: true,
      limits: { maxOutputTokens: 800 },
    }));
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
    expect(logger.warn).not.toHaveBeenCalled();
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

  it('guides an explicit retry away from the previous material dead end', async () => {
    const store = fakeStore();
    const retryClaim = turnResult('failed_retryable');
    retryClaim.turn.attempt = 2;
    vi.mocked(store.claimInference).mockResolvedValue({ claimed: true, result: retryClaim });
    const model = fakeModelFailure();
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    await service.processTurn(command('Necesitamos completar la interpretación sin inventar evidencia.'));

    expect(model.generate).toHaveBeenCalledOnce();
    expect(vi.mocked(model.generate).mock.calls[0][0].systemPrompt).toContain(
      'REINTENTO EXPLÍCITO DEL MISMO TURNO',
    );
    expect(vi.mocked(model.generate).mock.calls[0][0].systemPrompt).toContain(
      'readyForHumanReview=false, synthesis=null y questionPlan=null',
    );
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

  it('turns fabricated evidence into a retryable failure and logs only safe post-policy schema paths', async () => {
    const store = fakeStore();
    const fabricatedQuote = 'tenemos 50 personas';
    const userText = 'Somos una cafetería pequeña.';
    const model = fakeModel({
      facts: [fact('team_size', '50 personas', fabricatedQuote)],
      hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: synthesis(['team_size']),
      readyForHumanReview: true, reason: 'Supuestamente suficiente.',
    });
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, config);

    await service.processTurn(command(userText));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable', facts: [], hypotheses: [], answeredGaps: [],
      error: { code: 'semantic_output_invalid', retryable: true },
    }));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'portfolio_bootstrap_semantic_schema_invalid',
      validationStage: 'semantic_turn',
      issues: expect.arrayContaining([
        { path: 'facts.0.evidenceRefs.0.quote', category: 'custom' },
      ]),
      inputTokens: 20,
      outputTokens: 10,
      totalTokens: 30,
    }), 'portfolio_bootstrap_semantic_schema_invalid');
    const logged = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(logged).not.toContain(fabricatedQuote);
    expect(logged).not.toContain(userText);
    expect(logged).not.toContain('session-1');
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

  it('does not trust provider convergence when accumulated evidence is empty or only partial', async () => {
    const emptyStore = fakeStore();
    const emptyModel = fakeModel({
      facts: [], hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: synthesis(['situation']),
      readyForHumanReview: true, reason: 'El proveedor dice que basta.',
    });
    await new PortfolioBootstrapSemanticOrchestratorService(emptyStore, emptyModel, config)
      .processTurn(command('Quiero explorar una idea.'));
    expect(emptyStore.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      convergence: expect.objectContaining({ status: 'question_required' }),
    }));

    const partialStore = fakeStore();
    const partialModel = fakeModel({
      facts: [fact('situation', 'Hay colas', 'Hay colas')],
      hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: synthesis(['situation']),
      readyForHumanReview: true, reason: 'El proveedor dice que basta.',
    });
    await new PortfolioBootstrapSemanticOrchestratorService(partialStore, partialModel, config)
      .processTurn(command('Hay colas.'));
    expect(partialStore.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      convergence: expect.objectContaining({ status: 'question_required' }),
    }));
  });

  it('allows review only after an evidence-bound anchor and direction are accumulated', async () => {
    const store = fakeStore(semanticState({
      factLedger: [{
        ...fact('situation', 'Hay colas', 'Hay colas'), turnId: 'turn-0', semanticVersion: 1,
      }],
      answeredGaps: ['situation'],
    }));
    const model = fakeModel({
      facts: [fact('desired_outcome', 'reducir la espera', 'reducir la espera')],
      hypotheses: [
        startingPoint('need', ['situation', 'desired_outcome']),
        mainUncertainty('No está claro qué origina las colas.', ['situation']),
      ],
      dispositions: [], questionPlan: null,
      synthesis: synthesis(['situation', 'desired_outcome']),
      readyForHumanReview: true, reason: 'Hay situación y dirección suficientes para revisión humana.',
    });
    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Queremos reducir la espera.'));
    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      convergence: expect.objectContaining({ status: 'ready_for_human_review' }),
    }));
  });

  it('does not enable review until the interpretation distinguishes the starting point and its main uncertainty', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('problem', 'Los pedidos se retrasan', 'Los pedidos se retrasan'),
        fact('desired_outcome', 'reducir los retrasos', 'reducir los retrasos'),
      ],
      hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: {
        ...synthesis(['problem', 'desired_outcome']),
        summary: 'Hay retrasos y se quieren reducir.',
      },
      readyForHumanReview: true,
      reason: 'El proveedor intentó cerrar sin interpretar la naturaleza ni la incertidumbre.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Los pedidos se retrasan y queremos reducir los retrasos.'));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.status).toBe('failed_retryable');
    expect(persisted.error).toEqual({ code: 'semantic_interpretation_incomplete', retryable: true });
    expect(persisted.convergence.status).toBe('provider_retryable_failure');
  });

  it('does not treat a peripheral unknown as the main uncertainty', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('problem', 'Los pedidos se retrasan', 'Los pedidos se retrasan'),
        fact('desired_outcome', 'reducir los retrasos', 'reducir los retrasos'),
      ],
      hypotheses: [startingPoint('need', ['problem', 'desired_outcome'])],
      dispositions: [{
        conceptId: 'stakeholder', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'No sabemos qué área está afectada' }],
      }],
      questionPlan: null,
      synthesis: synthesis(['problem', 'desired_outcome']),
      readyForHumanReview: true,
      reason: 'El proveedor confundió un dato periférico desconocido con la incertidumbre principal.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Los pedidos se retrasan, queremos reducir los retrasos. No sabemos qué área está afectada.'));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
    }));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'portfolio_bootstrap_semantic_policy_incomplete',
      incompleteReason: 'premature_review_without_material_exit',
      attempt: 1,
      providerFactsCount: 2,
      providerHypothesesCount: 1,
      providerHasQuestionPlan: false,
      providerHasSynthesis: true,
      providerReadyForHumanReview: true,
    }), 'portfolio_bootstrap_semantic_policy_incomplete');
  });

  it('fails retryably when review is claimed without a main uncertainty after generic gaps were already resolved', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      answeredGaps: ['material_subject', 'decision_to_enable'],
      questionBudget: { limit: 3, used: 1 },
    }));
    const model = fakeModel({
      facts: [
        fact('weekend_demand', 'alta demanda los fines de semana', 'alta demanda los fines de semana'),
        fact('weekday_capacity', 'capacidad disponible entre semana', 'capacidad disponible entre semana'),
        fact('validation_intent', 'validar una propuesta para los días laborables', 'validar una propuesta para los días laborables'),
      ],
      hypotheses: [startingPoint('opportunity', ['weekend_demand', 'weekday_capacity', 'validation_intent'])],
      dispositions: [], questionPlan: null,
      synthesis: synthesis(['weekend_demand', 'weekday_capacity', 'validation_intent']),
      readyForHumanReview: true,
      reason: 'El proveedor intentó cerrar sin identificar la incertidumbre principal.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command(
        'Hay alta demanda los fines de semana, capacidad disponible entre semana y queremos validar una propuesta para los días laborables.',
        1,
      ));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      facts: [],
      hypotheses: [],
      dispositions: [],
      emittedQuestion: null,
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
      convergence: expect.objectContaining({ status: 'provider_retryable_failure' }),
    }));
  });

  it('preserves governed checkpoints for exhausted budget or a repeated provider question during premature review', async () => {
    const input = 'Hay alta demanda los fines de semana, capacidad disponible entre semana y queremos validar una propuesta para los días laborables.';
    const facts = [
      fact('weekend_demand', 'alta demanda los fines de semana', 'alta demanda los fines de semana'),
      fact('weekday_capacity', 'capacidad disponible entre semana', 'capacidad disponible entre semana'),
      fact('validation_intent', 'validar una propuesta para los días laborables', 'validar una propuesta para los días laborables'),
    ];
    const hypotheses = [startingPoint('opportunity', ['weekend_demand', 'weekday_capacity', 'validation_intent'])];

    const exhaustedStore = fakeStore(semanticState({
      version: 1,
      answeredGaps: ['material_subject', 'decision_to_enable'],
      questionBudget: { limit: 3, used: 3 },
    }));
    await new PortfolioBootstrapSemanticOrchestratorService(exhaustedStore, fakeModel({
      facts, hypotheses, dispositions: [], questionPlan: null,
      synthesis: synthesis(['weekend_demand', 'weekday_capacity', 'validation_intent']),
      readyForHumanReview: true,
      reason: 'El proveedor intentó cerrar cuando el presupuesto ya estaba agotado.',
    }), config).processTurn(command(input, 1));

    const repeatedStore = fakeStore(semanticState({
      version: 1,
      answeredGaps: ['material_subject', 'decision_to_enable'],
      questionBudget: { limit: 3, used: 1 },
      questionHistory: [{
        id: 'question-main-uncertainty', recap: 'La oportunidad sigue abierta.',
        question: '¿Qué incertidumbre necesitas despejar?', reasonToAsk: 'Delimitar la decisión.',
        resolves: ['main_uncertainty'], turnId: 'turn-1', semanticVersion: 1,
      }],
    }));
    await new PortfolioBootstrapSemanticOrchestratorService(repeatedStore, fakeModel({
      facts, hypotheses, dispositions: [],
      questionPlan: {
        question: '¿Qué incertidumbre necesitas despejar?',
        reasonToAsk: 'Delimitar la decisión.',
        resolves: ['main_uncertainty'],
      },
      synthesis: synthesis(['weekend_demand', 'weekday_capacity', 'validation_intent']),
      readyForHumanReview: true,
      reason: 'El proveedor repitió una pregunta ya tratada.',
    }), config).processTurn(command(input, 1));

    for (const store of [exhaustedStore, repeatedStore]) {
      expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed',
        error: null,
        emittedQuestion: null,
        convergence: expect.objectContaining({ status: 'budget_checkpoint' }),
      }));
    }
  });

  it('fails retryably when an incomplete interpretation has no material question even if the model does not claim readiness', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('problem', 'Los pedidos se retrasan', 'Los pedidos se retrasan'),
        fact('desired_outcome', 'reducir los retrasos', 'reducir los retrasos'),
      ],
      hypotheses: [], dispositions: [], questionPlan: null, synthesis: null,
      readyForHumanReview: false,
      reason: 'El proveedor omitió la interpretación y tampoco propuso una aclaración material.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Los pedidos se retrasan y queremos reducir los retrasos.'));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
    }));
  });

  it('emits a material fallback when the missing main uncertainty is paired with a question that cannot be emitted', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'desired_outcome']), turnId: 'turn-1', semanticVersion: 1 },
      ],
      answeredGaps: ['opportunity', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [fact(
        'solution',
        'probar una propuesta entre semana',
        'Todavía no sabemos qué alternativa tendrá demanda suficiente.',
      )],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Qué propuesta quieres probar entre semana?',
        reasonToAsk: 'Concretar la alternativa antes de decidir.',
        resolves: ['solution'],
      },
      synthesis: null,
      readyForHumanReview: false,
      reason: 'El proveedor mantuvo abierta la alternativa, pero omitió la incertidumbre principal.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Todavía no sabemos qué alternativa tendrá demanda suficiente.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      error: null,
      emittedQuestion: expect.objectContaining({ resolves: ['main_uncertainty'] }),
      convergence: expect.objectContaining({ status: 'question_required' }),
    }));
  });

  it('fails retryably when sufficient accumulated evidence produces no material next step', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'desired_outcome']), turnId: 'turn-1', semanticVersion: 1 },
        { ...mainUncertainty(
          'No está claro qué alternativa tendrá demanda suficiente.',
          ['opportunity', 'desired_outcome'],
        ), turnId: 'turn-1', semanticVersion: 1 },
      ],
      answeredGaps: ['opportunity', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [fact(
        'solution',
        'probar una propuesta entre semana',
        'Queremos validar una propuesta específica para los días laborables.',
      )],
      hypotheses: [], dispositions: [], questionPlan: null, synthesis: null,
      readyForHumanReview: false,
      reason: 'La evidencia acumulada es suficiente, pero el proveedor no produjo una salida material.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Queremos validar una propuesta específica para los días laborables.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
      emittedQuestion: null,
      convergence: expect.objectContaining({ status: 'provider_retryable_failure' }),
    }));
  });

  it('fails retryably when a safe novel provider question is suppressed without producing a material next step', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'desired_outcome']), turnId: 'turn-1', semanticVersion: 1 },
        { ...mainUncertainty(
          'No está claro qué alternativa tendrá demanda suficiente.',
          ['opportunity', 'desired_outcome'],
        ), turnId: 'turn-1', semanticVersion: 1 },
      ],
      answeredGaps: ['opportunity', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [fact(
        'solution',
        'probar una propuesta entre semana',
        'Queremos validar una propuesta específica para los días laborables.',
      )],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Qué evidencia indicaría que la propuesta merece continuar?',
        reasonToAsk: 'Delimitar una señal antes de decidir.',
        resolves: ['validation_evidence'],
      },
      synthesis: null,
      readyForHumanReview: false,
      reason: 'El proveedor propuso una pregunta adicional, pero no produjo una salida material.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Queremos validar una propuesta específica para los días laborables.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
      emittedQuestion: null,
      convergence: expect.objectContaining({ status: 'provider_retryable_failure' }),
    }));
  });

  it('fails retryably when the provider only re-emits interpretations already present in semantic state', async () => {
    const priorStartingPoint = startingPoint('opportunity', ['opportunity', 'desired_outcome']);
    const priorMainUncertainty = mainUncertainty(
      'No está claro qué alternativa tendrá demanda suficiente.',
      ['opportunity', 'desired_outcome'],
    );
    const priorDisposition = {
      conceptId: 'delivery_channel', disposition: 'unknown' as const, provenance: 'user_declared' as const,
      evidenceRefs: [{ kind: 'user_input' as const, quote: 'El canal todavía no está decidido.' }],
    };
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...priorStartingPoint, turnId: 'turn-1', semanticVersion: 1 },
        { ...priorMainUncertainty, turnId: 'turn-1', semanticVersion: 1 },
      ],
      dispositions: [{ ...priorDisposition, turnId: 'turn-1', semanticVersion: 1 }],
      answeredGaps: ['opportunity', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [fact(
        'solution',
        'probar una propuesta entre semana',
        'Queremos validar una propuesta específica para los días laborables.',
      )],
      hypotheses: [priorStartingPoint, priorMainUncertainty],
      dispositions: [priorDisposition], questionPlan: null, synthesis: null,
      readyForHumanReview: false,
      reason: 'El proveedor repitió interpretaciones existentes sin producir una salida material.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Queremos validar una propuesta específica para los días laborables.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      hypotheses: [],
      dispositions: [],
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
      convergence: expect.objectContaining({ status: 'provider_retryable_failure' }),
    }));
  });

  it('preserves governed checkpoints outside the active-facts-only retry pattern', async () => {
    const sufficientState = (overrides: Partial<SemanticStateDto> = {}) => semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'desired_outcome']), turnId: 'turn-1', semanticVersion: 1 },
        { ...mainUncertainty(
          'No está claro qué alternativa tendrá demanda suficiente.',
          ['opportunity', 'desired_outcome'],
        ), turnId: 'turn-1', semanticVersion: 1 },
      ],
      answeredGaps: ['opportunity', 'desired_outcome'],
      ...overrides,
    });
    const baseInput = 'Queremos validar una propuesta específica para los días laborables.';
    const activeFact = () => fact('solution', 'probar una propuesta entre semana', baseInput);
    const fixtures = [
      {
        id: 'repeated-question',
        state: sufficientState({
          questionHistory: [{
            id: 'question-solution', recap: 'La alternativa sigue abierta.',
            question: '¿Qué propuesta quieres probar?', reasonToAsk: 'Concretar la alternativa.',
            resolves: ['solution'], turnId: 'turn-0', semanticVersion: 1,
          }],
        }),
        input: baseInput,
        output: {
          facts: [activeFact()], hypotheses: [], dispositions: [],
          questionPlan: {
            question: '¿Qué propuesta quieres probar?', reasonToAsk: 'Concretar la alternativa.',
            resolves: ['solution'],
          },
          synthesis: null, readyForHumanReview: false, reason: 'La pregunta repite un concepto tratado.',
        },
      },
      {
        id: 'unsafe-question',
        state: sufficientState(),
        input: `Somos una cafetería pequeña. ${baseInput}`,
        output: {
          facts: [fact('solution', 'probar una propuesta entre semana', baseInput)], hypotheses: [], dispositions: [],
          questionPlan: {
            question: '¿Qué departamentos formales asumirán el trabajo?',
            reasonToAsk: 'Identificar el organigrama formal.', resolves: ['organization_owners'],
          },
          synthesis: null, readyForHumanReview: false, reason: 'La pregunta no es proporcional al negocio.',
        },
      },
      {
        id: 'budget-exhausted',
        state: sufficientState({ questionBudget: { limit: 3, used: 3 } }),
        input: baseInput,
        output: {
          facts: [activeFact()], hypotheses: [], dispositions: [], questionPlan: null, synthesis: null,
          readyForHumanReview: false, reason: 'El presupuesto de preguntas está agotado.',
        },
      },
      {
        id: 'new-hypothesis',
        state: sufficientState(),
        input: baseInput,
        output: {
          facts: [activeFact()],
          hypotheses: [mainUncertainty('Podría existir otra restricción comercial.', ['solution'])],
          dispositions: [], questionPlan: null, synthesis: null,
          readyForHumanReview: false, reason: 'El turno añadió una hipótesis revisable.',
        },
      },
      {
        id: 'new-disposition',
        state: sufficientState(),
        input: baseInput,
        output: {
          facts: [activeFact()], hypotheses: [],
          dispositions: [{
            conceptId: 'delivery_channel', disposition: 'unknown', provenance: 'user_declared' as const,
            evidenceRefs: [{ kind: 'user_input' as const, quote: baseInput }],
          }],
          questionPlan: null, synthesis: null,
          readyForHumanReview: false, reason: 'El turno añadió una incógnita explícita.',
        },
      },
    ];

    for (const fixture of fixtures) {
      const store = fakeStore(fixture.state);
      await new PortfolioBootstrapSemanticOrchestratorService(store, fakeModel(fixture.output), config)
        .processTurn(command(fixture.input, 1));
      const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
      expect({ id: fixture.id, status: persisted.status, convergence: persisted.convergence.status }).toEqual({
        id: fixture.id,
        status: 'completed',
        convergence: 'budget_checkpoint',
      });
    }
  });

  it('lands the restaurant case directly and suppresses a non-material extra question', async () => {
    const input = 'El restaurante tiene alta demanda y capacidad limitada los fines de semana, pero necesita incrementar las ventas entre semana.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('business_signal', 'alta demanda los fines de semana', 'alta demanda'),
        fact('constraint', 'capacidad limitada los fines de semana', 'capacidad limitada los fines de semana'),
        fact('desired_outcome', 'incrementar las ventas entre semana', 'incrementar las ventas entre semana'),
      ],
      hypotheses: [
        startingPoint('opportunity', ['business_signal', 'desired_outcome']),
        mainUncertainty('No está claro qué frena la demanda entre semana ni qué palanca conviene validar.', ['business_signal', 'constraint', 'desired_outcome']),
      ],
      dispositions: [],
      questionPlan: {
        question: '¿Cuántas mesas tiene el restaurante?',
        reasonToAsk: 'Añadir un dato operativo que no cambia la interpretación actual.',
        resolves: ['table_count'],
      },
      synthesis: {
        summary: 'La oportunidad no consiste en captar más demanda el fin de semana, sino en corregir el desequilibrio comercial entre días.',
        situation: 'La demanda del fin de semana ya tensiona la capacidad disponible, mientras los días laborables tienen margen comercial.',
        intention: 'Aumentar las ventas entre semana sin agravar la limitación de capacidad del fin de semana.',
        mainUncertainty: 'Qué explica la menor demanda entre semana y qué palanca merece validarse primero.',
        directionForE2: 'Definir un objetivo de crecimiento entre semana que no presuponga todavía una solución.',
        evidenceConceptIds: ['business_signal', 'constraint', 'desired_outcome'],
      },
      readyForHumanReview: true,
      reason: 'La oportunidad, el propósito y la incertidumbre material están suficientemente delimitados.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.emittedQuestion).toBeNull();
    expect(persisted.convergence).toMatchObject({
      status: 'ready_for_human_review',
      synthesis: {
        summary: expect.stringContaining('desequilibrio comercial'),
        mainUncertainty: expect.stringContaining('menor demanda entre semana'),
        directionForE2: expect.stringContaining('no presuponga todavía una solución'),
      },
    });
    const systemPrompt = vi.mocked(model.generate).mock.calls[0][0].systemPrompt;
    expect(systemPrompt).toContain('necesidad, oportunidad, exploración o iniciativa existente');
    expect(systemPrompt).toContain('una sola pregunta material por turno');
  });

  it('asks one material question when the restaurant situation lacks the intended change', async () => {
    const input = 'El restaurante tiene alta demanda y capacidad limitada los fines de semana.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('business_signal', 'alta demanda los fines de semana', 'alta demanda'),
        fact('constraint', 'capacidad limitada los fines de semana', 'capacidad limitada los fines de semana'),
      ],
      hypotheses: [startingPoint('need', ['business_signal', 'constraint'])],
      dispositions: [],
      questionPlan: {
        question: '¿Qué cambio os gustaría conseguir fuera de los fines de semana?',
        reasonToAsk: 'La respuesta delimita el propósito material antes de preparar la dirección para E2.',
        resolves: ['desired_outcome'],
      },
      synthesis: null,
      readyForHumanReview: false,
      reason: 'La situación está delimitada, pero falta el cambio que se quiere conseguir.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.convergence.status).toBe('question_required');
    expect(persisted.convergence.synthesis).toBeNull();
    expect(persisted.emittedQuestion).toMatchObject({
      question: expect.stringContaining('Qué cambio'),
      resolves: ['desired_outcome'],
    });
  });

  it('logs only safe structured diagnostics for an invalid provider schema response', async () => {
    const secretMarker = 'raw-user-or-provider-text-must-not-be-logged';
    const store = fakeStore();
    const model: StructuredModelAdapter = {
      generate: vi.fn().mockResolvedValue({
        ...execution(null),
        provider_raw: {
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output_text: secretMarker,
          usage: { input_tokens: 320, output_tokens: 900, total_tokens: 1_220 },
        },
        parsed_output: {
          facts: [], hypotheses: [], dispositions: [],
          synthesis: null, readyForHumanReview: false, reason: secretMarker,
        },
        validated_output: null,
        schema_errors: [`questionPlan: ${secretMarker}`],
        error_type: 'SCHEMA_ERROR' as const,
        execution_metadata: {
          ...execution(null).execution_metadata,
          usage: { input_tokens: 320, output_tokens: 900, total_tokens: 1_220 },
        },
      }),
    };

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('El texto del usuario tampoco debe aparecer en logs.'));

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      event: 'portfolio_bootstrap_semantic_schema_invalid',
      validationStage: 'adapter',
      issues: [{ path: 'questionPlan', category: 'invalid_type' }],
      completionStatus: 'incomplete',
      incompleteReason: 'max_output_tokens',
      inputTokens: 320,
      outputTokens: 900,
      totalTokens: 1_220,
    }), 'portfolio_bootstrap_semantic_schema_invalid');
    const logged = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    expect(logged).not.toContain(secretMarker);
    expect(logged).not.toContain('El texto del usuario');
    expect(logged).not.toContain('session-1');
  });

  it('redacts an unknown provider incomplete reason from schema diagnostics', async () => {
    const secretReason = 'provider-detail-must-not-be-logged';
    const store = fakeStore();
    const model: StructuredModelAdapter = {
      generate: vi.fn().mockResolvedValue({
        ...execution(null),
        provider_raw: { status: 'incomplete', incomplete_details: { reason: secretReason } },
        parsed_output: {},
        validated_output: null,
        schema_errors: ['facts: Required'],
        error_type: 'SCHEMA_ERROR' as const,
      }),
    };

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Entrada no registrable.'));

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      incompleteReason: 'unknown',
    }), 'portfolio_bootstrap_semantic_schema_invalid');
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain(secretReason);
  });

  it('asks a material clarification for a generic committee intention instead of enabling review', async () => {
    const input = 'Tengo que preparar comité y explicar qué decisiones necesita el portafolio';
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('decision', 'preparar comité', 'preparar comité'),
        fact('intention', 'explicar decisiones', 'explicar qué decisiones necesita el portafolio'),
      ],
      hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: synthesis(['decision', 'intention']),
      readyForHumanReview: true, reason: 'El proveedor confundió intención con contexto material.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.convergence.status).toBe('question_required');
    expect(persisted.convergence.synthesis).toBeNull();
    expect(persisted.emittedQuestion?.question.toLowerCase()).toContain('qué trabajo, problema u oportunidad');
  });

  it('suppresses a peripheral provider question when context is insufficient', async () => {
    const input = 'Tenemos retrasos operativos.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [fact('problem', 'retrasos operativos', 'retrasos operativos')],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Cuántas personas hay en el equipo?',
        reasonToAsk: 'Completar un dato operativo periférico.',
        resolves: ['team_size'],
      },
      synthesis: null,
      readyForHumanReview: false,
      reason: 'Falta contexto material.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.emittedQuestion).toBeNull();
    expect(persisted.convergence.status).toBe('budget_checkpoint');
  });

  it('allows a complete cafeteria opportunity to reach a grounded landing synthesis in one turn', async () => {
    const input = 'Somos una cafetería pequeña, queremos vender desayunos para crecer sin ampliar el local y necesitamos validar el interés y los recursos.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('opportunity', 'vender desayunos', 'vender desayunos'),
        fact('desired_outcome', 'crecer sin ampliar el local', 'crecer sin ampliar el local'),
        fact('uncertainty', 'interés y recursos', 'validar el interés y los recursos'),
      ],
      hypotheses: [startingPoint('opportunity', ['opportunity', 'desired_outcome'])],
      dispositions: [], questionPlan: null,
      synthesis: synthesis(['opportunity', 'desired_outcome', 'uncertainty']),
      readyForHumanReview: true, reason: 'Existe contexto material suficiente.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.emittedQuestion).toBeNull();
    expect(persisted.convergence).toMatchObject({
      status: 'ready_for_human_review',
      synthesis: { evidenceConceptIds: ['opportunity', 'desired_outcome', 'uncertainty'] },
    });
  });

  it('keeps an unknown operational cause explicit and asks for material context without inventing it', async () => {
    const input = 'Tenemos retrasos operativos recurrentes y no conocemos la causa principal.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [fact('problem', 'retrasos operativos recurrentes', 'retrasos operativos recurrentes')],
      hypotheses: [],
      dispositions: [{
        conceptId: 'root_cause', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'no conocemos la causa principal' }],
      }],
      questionPlan: {
        question: '¿En qué parte del trabajo se producen los retrasos y qué decisión necesitáis poder tomar?',
        reasonToAsk: 'Delimita la situación sin suponer una causa.',
        resolves: ['affected_work', 'decision_to_enable'],
      },
      readyForHumanReview: false,
      reason: 'La necesidad está declarada, pero falta delimitar el trabajo afectado.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.facts).toEqual([expect.objectContaining({ conceptId: 'problem' })]);
    expect(persisted.hypotheses).toEqual([]);
    expect(persisted.dispositions).toEqual([expect.objectContaining({ conceptId: 'root_cause', disposition: 'unknown' })]);
    expect(persisted.convergence).toMatchObject({ status: 'question_required', synthesis: null });
    expect(persisted.emittedQuestion?.question).toContain('qué decisión');
  });

  it('preserves exploration uncertainty without inventing an initiative or solution', async () => {
    const input = 'Queremos explorar oportunidades de crecimiento, sin iniciativa ni solución definida.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('opportunity', 'oportunidades de crecimiento', 'oportunidades de crecimiento'),
        fact('intention', 'explorar oportunidades', 'explorar oportunidades'),
      ],
      hypotheses: [startingPoint('exploration', ['opportunity', 'intention'])],
      dispositions: [{
        conceptId: 'solution', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'sin iniciativa ni solución definida' }],
      }],
      questionPlan: null,
      synthesis: {
        ...synthesis(['opportunity', 'intention']),
        situation: 'Se está explorando dónde podría existir crecimiento.',
        intention: 'Descubrir oportunidades antes de definir una iniciativa.',
        mainUncertainty: 'No existe todavía una iniciativa ni una solución definida.',
        directionForE2: 'Definir un objetivo de exploración sin presuponer una solución.',
      },
      readyForHumanReview: true,
      reason: 'La exploración y su incertidumbre están suficientemente delimitadas para revisión humana.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.hypotheses).toEqual([
      expect.objectContaining({ hypothesisId: 'starting_point.exploration', provenance: 'copilot_inferred' }),
    ]);
    expect(persisted.dispositions).toEqual([expect.objectContaining({ conceptId: 'solution', disposition: 'unknown' })]);
    expect(persisted.convergence).toMatchObject({
      status: 'ready_for_human_review',
      synthesis: {
        mainUncertainty: 'No existe todavía una iniciativa ni una solución definida.',
        directionForE2: 'Definir un objetivo de exploración sin presuponer una solución.',
      },
    });
  });

  it('recognizes existing work without presenting it as a new opportunity or defining its E2 objective', async () => {
    const input = 'Ya existe una iniciativa para repartir a oficinas, pero no sabemos si el problema está en la propuesta o en el canal; queremos decidir qué revisar primero.';
    const store = fakeStore();
    const model = fakeModel({
      facts: [
        fact('existing_work', 'iniciativa para repartir a oficinas', 'existe una iniciativa para repartir a oficinas'),
        fact('decision_to_enable', 'decidir qué revisar primero', 'decidir qué revisar primero'),
        fact('uncertainty', 'propuesta o canal', 'no sabemos si el problema está en la propuesta o en el canal'),
      ],
      hypotheses: [startingPoint('existing_initiative', ['existing_work', 'decision_to_enable'])],
      dispositions: [], questionPlan: null,
      synthesis: {
        summary: 'El punto de partida es una iniciativa existente que necesita reenfocar su aprendizaje.',
        situation: 'El reparto a oficinas ya está planteado como iniciativa, pero todavía no está claro dónde se encuentra el bloqueo.',
        intention: 'Decidir qué aspecto revisar antes de seguir desarrollando la iniciativa.',
        mainUncertainty: 'Si el bloqueo principal está en la propuesta ofrecida o en el canal utilizado.',
        directionForE2: 'Formular un objetivo de revisión sin redefinir ni validar automáticamente la iniciativa.',
        evidenceConceptIds: ['existing_work', 'decision_to_enable', 'uncertainty'],
      },
      readyForHumanReview: true,
      reason: 'El trabajo existente, la decisión y la incertidumbre están delimitados.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config).processTurn(command(input));

    const persisted = vi.mocked(store.completeInference).mock.calls[0][0];
    expect(persisted.hypotheses).toEqual([
      expect.objectContaining({ hypothesisId: 'starting_point.existing_initiative' }),
    ]);
    expect(persisted.convergence).toMatchObject({
      status: 'ready_for_human_review',
      synthesis: {
        summary: expect.stringContaining('iniciativa existente'),
        directionForE2: expect.stringContaining('sin redefinir ni validar automáticamente'),
      },
    });
  });

  it('uses the latest corrected interpretation after reentry instead of reviving an older classification', async () => {
    const store = fakeStore(semanticState({
      version: 2,
      factLedger: [
        { ...fact('business_signal', 'hay demanda sin atender', 'hay demanda sin atender'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-2', semanticVersion: 2 },
      ],
      hypotheses: [
        { ...startingPoint('need', ['business_signal']), turnId: 'turn-1', semanticVersion: 1 },
        { ...mainUncertainty('No está claro si existe capacidad.', ['business_signal']), turnId: 'turn-1', semanticVersion: 1 },
        { ...startingPoint('opportunity', ['business_signal', 'desired_outcome']), turnId: 'turn-2', semanticVersion: 2 },
        { ...mainUncertainty('No está claro qué explica la menor demanda entre semana.', ['desired_outcome']), turnId: 'turn-2', semanticVersion: 2 },
      ],
      answeredGaps: ['business_signal', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [], hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: {
        ...synthesis(['business_signal', 'desired_outcome']),
        summary: 'La corrección vigente sitúa el caso como una oportunidad comercial entre semana.',
        mainUncertainty: 'Qué explica la menor demanda entre semana.',
      },
      readyForHumanReview: true,
      reason: 'La interpretación corregida conserva evidencia suficiente tras la reentrada.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Quiero retomar la revisión.', 2));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      convergence: expect.objectContaining({ status: 'ready_for_human_review' }),
    }));
  });

  it('persists a corrected main uncertainty even when the hypothesis identifier already exists', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'desired_outcome']), turnId: 'turn-1', semanticVersion: 1 },
        { ...mainUncertainty('No está claro si existe demanda.', ['opportunity']), turnId: 'turn-1', semanticVersion: 1 },
      ],
      answeredGaps: ['opportunity', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [],
      hypotheses: [mainUncertainty('La duda principal es qué frena la demanda entre semana.', ['opportunity', 'desired_outcome'])],
      dispositions: [], questionPlan: null,
      synthesis: {
        ...synthesis(['opportunity', 'desired_outcome']),
        mainUncertainty: 'Qué frena la demanda entre semana.',
      },
      readyForHumanReview: true,
      reason: 'La corrección concreta la incertidumbre principal.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('La duda principal es qué frena la demanda entre semana.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      hypotheses: [expect.objectContaining({
        hypothesisId: 'main_uncertainty',
        statement: 'La duda principal es qué frena la demanda entre semana.',
      })],
    }));
  });

  it('does not reuse an historical unknown after the same material concept is resolved', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'desired_outcome']), turnId: 'turn-1', semanticVersion: 1 },
      ],
      dispositions: [{
        conceptId: 'solution', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'no sabemos la solución' }],
        turnId: 'turn-1', semanticVersion: 1,
      }],
      answeredGaps: ['opportunity', 'desired_outcome'],
    }));
    const model = fakeModel({
      facts: [fact('solution', 'probar desayunos', 'La solución que queremos probar son desayunos')],
      hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: synthesis(['opportunity', 'desired_outcome', 'solution']),
      readyForHumanReview: true,
      reason: 'El proveedor reutilizó una incertidumbre histórica que ya se resolvió.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('La solución que queremos probar son desayunos.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable',
      error: { code: 'semantic_interpretation_incomplete', retryable: true },
    }));
  });

  it('does not ground a synthesis in a fact retracted by the latest correction', async () => {
    const store = fakeStore(semanticState({
      version: 1,
      factLedger: [
        { ...fact('opportunity', 'crecer entre semana', 'crecer entre semana'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('desired_outcome', 'aumentar ventas', 'aumentar ventas'), turnId: 'turn-1', semanticVersion: 1 },
        { ...fact('direction', 'comprender la demanda semanal', 'comprender la demanda semanal'), turnId: 'turn-1', semanticVersion: 1 },
      ],
      hypotheses: [
        { ...startingPoint('opportunity', ['opportunity', 'direction']), turnId: 'turn-1', semanticVersion: 1 },
        { ...mainUncertainty('No está claro qué explica la demanda semanal.', ['opportunity']), turnId: 'turn-1', semanticVersion: 1 },
      ],
      answeredGaps: ['opportunity', 'desired_outcome', 'direction'],
    }));
    const model = fakeModel({
      facts: [{
        ...fact('desired_outcome', 'aumentar ventas', 'Retiro el objetivo de aumentar ventas'),
        status: 'retracted',
      }],
      hypotheses: [], dispositions: [], questionPlan: null,
      synthesis: synthesis(['opportunity', 'desired_outcome']),
      readyForHumanReview: true,
      reason: 'El proveedor intentó reutilizar evidencia retirada.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('Retiro el objetivo de aumentar ventas.', 1));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      convergence: expect.objectContaining({ status: 'budget_checkpoint', synthesis: null }),
    }));
  });

  it('does not count unknown anchor and direction dispositions as sufficient evidence', async () => {
    const store = fakeStore();
    const model = fakeModel({
      facts: [], hypotheses: [],
      dispositions: [
        {
          conceptId: 'situation', disposition: 'unknown', provenance: 'user_declared',
          evidenceRefs: [{ kind: 'user_input', quote: 'no sé la situación' }],
        },
        {
          conceptId: 'stakeholder', disposition: 'unknown', provenance: 'user_declared',
          evidenceRefs: [{ kind: 'user_input', quote: 'ni a quién afecta' }],
        },
      ],
      questionPlan: null,
      synthesis: synthesis(['situation', 'stakeholder']),
      readyForHumanReview: true, reason: 'El proveedor propone revisar con incógnitas.',
    });

    await new PortfolioBootstrapSemanticOrchestratorService(store, model, config)
      .processTurn(command('No sé la situación ni a quién afecta.'));

    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      convergence: expect.objectContaining({ status: 'question_required' }),
    }));
  });

  it('blocks formal-department questions when they do not change the E1 interpretation', async () => {
    const smallStore = fakeStore();
    const smallModel = fakeModel({
      facts: [], hypotheses: [],
      dispositions: [{
        conceptId: 'organization_structure', disposition: 'not_applicable', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'negocio sin departamentos formales' }],
      }],
      questionPlan: {
        question: '¿Qué departamentos formales asumirán el trabajo?',
        reasonToAsk: 'Necesito identificar las áreas formales responsables.',
        resolves: ['organization_owners'],
      },
      readyForHumanReview: false, reason: 'Falta responsable.',
    });
    await new PortfolioBootstrapSemanticOrchestratorService(smallStore, smallModel, config)
      .processTurn(command('Somos un negocio sin departamentos formales.'));
    expect(smallStore.completeInference).toHaveBeenCalledWith(expect.objectContaining({ emittedQuestion: null }));

    const corporateStore = fakeStore();
    const corporateModel = fakeModel({
      facts: [fact('business_profile', 'empresa corporativa', 'empresa corporativa')],
      hypotheses: [], dispositions: [],
      questionPlan: {
        question: '¿Qué departamentos formales asumirán el trabajo?',
        reasonToAsk: 'Necesito identificar las áreas formales responsables.',
        resolves: ['organization_owners'],
      },
      readyForHumanReview: false, reason: 'Falta responsable.',
    });
    await new PortfolioBootstrapSemanticOrchestratorService(corporateStore, corporateModel, config)
      .processTurn(command('Somos una empresa corporativa con departamentos formales.'));
    expect(corporateStore.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      emittedQuestion: null,
      convergence: expect.objectContaining({ status: 'budget_checkpoint' }),
    }));
  });

  it('enforces the total provider deadline and records a retryable safe failure', async () => {
    const store = fakeStore();
    const model: StructuredModelAdapter = { generate: vi.fn(() => new Promise<never>(() => undefined)) };
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, { ...config, timeoutMs: 10 });

    await service.processTurn(command('Necesitamos entender una situación.'));

    expect(model.generate).toHaveBeenCalledOnce();
    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_retryable', error: { code: 'provider_unavailable', retryable: true },
    }));
  });

  it('budgets the complete serialized prompt, confirmed context and accumulated ledger', async () => {
    const store = fakeStore();
    vi.mocked(store.getInferenceContext).mockResolvedValue({
      state: null,
      confirmedContext: {
        version: 4,
        context: { notes: 'contexto '.repeat(400) },
        provenance: [],
      },
    });
    const model = fakeModelFailure();
    const service = new PortfolioBootstrapSemanticOrchestratorService(store, model, {
      ...config,
      maxInputTokens: 200,
    });

    await service.processTurn(command('Turno corto.'));

    expect(model.generate).not.toHaveBeenCalled();
    expect(store.completeInference).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed_terminal',
      error: { code: 'input_budget_exceeded', retryable: false },
    }));
  });

  it('scores 5/5 fixture-conditional semantic decisions without network or live spend', async () => {
    const cases = [
      {
        id: 'cafeteria-negative-pilot',
        input: 'Somos una cafetería y nunca hemos probado pedidos a oficinas.',
        output: {
          facts: [fact('pilot_experience', 'none', 'nunca hemos probado pedidos a oficinas')],
          hypotheses: [], dispositions: [],
          questionPlan: { question: '¿Qué situación queréis mejorar?', reasonToAsk: 'Falta el foco.', resolves: ['situation'] },
          readyForHumanReview: false, reason: 'Falta situación.',
        },
        passes: (turn: any) => turn.answeredGaps.includes('pilot_experience')
          && turn.emittedQuestion?.resolves.join('|') === 'situation',
      },
      {
        id: 'multi-concept',
        input: 'Queremos reducir colas para clientes del mediodía.',
        output: {
          facts: [
            fact('situation', 'reducir colas', 'reducir colas'),
            fact('desired_outcome', 'clientes del mediodía', 'clientes del mediodía'),
          ],
          hypotheses: [
            startingPoint('need', ['situation', 'desired_outcome']),
            mainUncertainty('No está claro qué provoca las colas.', ['situation']),
          ],
          dispositions: [], questionPlan: null,
          synthesis: synthesis(['situation', 'desired_outcome']),
          readyForHumanReview: true, reason: 'Suficiente para revisión.',
        },
        passes: (turn: any) => turn.answeredGaps.length === 2
          && turn.convergence.status === 'ready_for_human_review',
      },
      {
        id: 'corporate-formal-structure',
        input: 'Somos una empresa corporativa con departamentos formales.',
        output: {
          facts: [fact('business_profile', 'corporate', 'empresa corporativa')],
          hypotheses: [], dispositions: [],
          questionPlan: {
            question: '¿Qué departamentos formales asumirán el trabajo?',
            reasonToAsk: 'Identificar áreas responsables.', resolves: ['organization_owners'],
          },
          readyForHumanReview: false, reason: 'Falta responsable.',
        },
        passes: (turn: any) => turn.emittedQuestion === null
          && turn.convergence.status === 'budget_checkpoint',
      },
      {
        id: 'unknown-retires-question',
        input: 'No sé cómo se organizaría.',
        output: {
          facts: [], hypotheses: [],
          dispositions: [{
            conceptId: 'organization_structure', disposition: 'unknown', provenance: 'user_declared',
            evidenceRefs: [{ kind: 'user_input', quote: 'No sé' }],
          }],
          questionPlan: {
            question: '¿Cómo se organizaría?', reasonToAsk: 'Completar estructura.', resolves: ['organization_structure'],
          },
          readyForHumanReview: false, reason: 'Incógnita declarada.',
        },
        passes: (turn: any) => turn.emittedQuestion === null && turn.dispositions[0]?.disposition === 'unknown',
      },
      {
        id: 'no-invention',
        input: 'Somos una cafetería.',
        output: {
          facts: [fact('team_size', '50', 'somos 50 personas')],
          hypotheses: [], dispositions: [], questionPlan: null,
          synthesis: synthesis(['team_size']),
          readyForHumanReview: true, reason: 'Suficiente.',
        },
        passes: (turn: any) => turn.status === 'failed_retryable'
          && turn.error?.code === 'semantic_output_invalid' && turn.facts.length === 0,
      },
    ];
    const results: Array<{ id: string; passed: boolean }> = [];
    for (const fixture of cases) {
      const store = fakeStore();
      await new PortfolioBootstrapSemanticOrchestratorService(store, fakeModel(fixture.output), config)
        .processTurn(command(fixture.input));
      results.push({
        id: fixture.id,
        passed: fixture.passes(vi.mocked(store.completeInference).mock.calls[0][0]),
      });
    }

    expect({
      measurementScope: 'fixture_conditional',
      networkCalls: 0,
      cases: results.length,
      passed: results.filter((result) => result.passed).length,
      results,
    }).toEqual({
      measurementScope: 'fixture_conditional',
      networkCalls: 0,
      cases: 5,
      passed: 5,
      results: cases.map((fixture) => ({ id: fixture.id, passed: true })),
    });
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
    conceptId, value, provenance: 'user_declared' as const,
    evidenceRefs: [{ kind: 'user_input' as const, quote }],
    confidence: 1, status: 'observed' as const,
  };
}

function startingPoint(
  kind: 'need' | 'opportunity' | 'exploration' | 'existing_initiative',
  supportConceptIds: string[],
) {
  return {
    hypothesisId: `starting_point.${kind}`,
    statement: `El punto de partida se interpreta como ${kind}.`,
    provenance: 'copilot_inferred' as const,
    supportConceptIds,
    confidence: 0.8,
    status: 'proposed' as const,
  };
}

function mainUncertainty(statement: string, supportConceptIds: string[]) {
  return {
    hypothesisId: 'main_uncertainty', statement,
    provenance: 'copilot_inferred' as const,
    supportConceptIds,
    confidence: 0.7,
    status: 'proposed' as const,
  };
}

function synthesis(evidenceConceptIds: string[]) {
  return {
    summary: 'Una lectura útil del punto de partida.',
    situation: 'Existe una situación material declarada.',
    intention: 'La persona quiere poder decidir cómo avanzar.',
    mainUncertainty: 'La evidencia pendiente sigue explícita.',
    directionForE2: 'Definir un objetivo provisional sin asumir resultados.',
    evidenceConceptIds,
  };
}
