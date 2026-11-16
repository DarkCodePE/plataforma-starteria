import type { Permission } from '../shared/authz/permissions';
import {
  PortfolioBootstrapSemanticOrchestratorService,
  type PortfolioBootstrapSemanticTurnStore,
} from '../modules/portfolio-bootstrap/portfolio-bootstrap-semantic-orchestrator.service';
import {
  createSemanticE1Model,
  loadSemanticE1OrchestratorConfig,
} from '../modules/portfolio-bootstrap/portfolio-bootstrap-semantic-runtime';
import {
  emptySemanticStateProjection,
  type SemanticStateDto,
  type SemanticTurnResult,
} from '../modules/portfolio-bootstrap/portfolio-bootstrap-semantic.service';

const permissions = new Set<Permission>(['portfolio:read', 'portfolio:write']);
const config = loadSemanticE1OrchestratorConfig();
const store = inMemoryStore();
const orchestrator = new PortfolioBootstrapSemanticOrchestratorService(
  store,
  createSemanticE1Model(config, { NODE_ENV: 'production' }),
  config,
);

const output = await orchestrator.processTurn({
  sessionId: 'semantic-e1-provider-preflight',
  authenticatedUserId: 'semantic-e1-provider-preflight',
  permissions,
  idempotencyKey: 'semantic-e1-provider-preflight-v1',
  expectedVersion: 0,
  inputText: 'Nuestro restaurante tiene alta demanda los fines de semana y capacidad disponible entre semana. Queremos aumentar las ventas entre semana sin asumir todavía una solución. Necesitamos comprender qué propuesta valorarían los clientes en esos días y qué evidencia deberíamos validar antes de decidir.',
  answeredQuestionId: null,
});

const turn = output.result.turn;
const startingPoint = turn.hypotheses.some((item) => item.hypothesisId.startsWith('starting_point.'));
const mainUncertainty = turn.hypotheses.some((item) => item.hypothesisId === 'main_uncertainty')
  || turn.facts.some((item) => item.conceptId === 'uncertainty');
const hasNextStep = Boolean(turn.emittedQuestion) || Boolean(turn.convergence.synthesis);
if (
  output.processing
  || turn.status !== 'completed'
  || !turn.execution.provider
  || turn.execution.provider === 'deterministic_test_adapter'
  || !turn.execution.model
  || turn.execution.totalTokens <= 0
  || turn.facts.length === 0
  || !startingPoint
  || !mainUncertainty
  || !hasNextStep
) {
  throw new Error(`Semantic E1 provider preflight failed: status=${turn.status} code=${turn.error?.code ?? 'none'}`);
}

process.stdout.write(`${JSON.stringify({
  provider: turn.execution.provider,
  model: turn.execution.model,
  inputTokens: turn.execution.inputTokens,
  outputTokens: turn.execution.outputTokens,
  totalTokens: turn.execution.totalTokens,
  retryCount: turn.execution.retryCount,
  fallbackUsed: turn.execution.fallbackUsed,
  convergence: turn.convergence.status,
  emittedQuestion: Boolean(turn.emittedQuestion),
  synthesis: Boolean(turn.convergence.synthesis),
})}\n`);

function inMemoryStore(): PortfolioBootstrapSemanticTurnStore {
  const initialState = semanticState(0);
  return {
    getInferenceContext: async () => ({ state: null, confirmedContext: null }),
    claimInference: async () => ({ claimed: true, result: turnResult(initialState) }),
    completeInference: async (input) => {
      const state = semanticState(input.expectedVersion + 1);
      return {
        state,
        turn: {
          id: 'semantic-e1-provider-preflight-turn',
          semanticVersion: state.version,
          organizationId: null,
          actorUserId: 'semantic-e1-provider-preflight',
          inputText: input.inputText,
          status: input.status,
          attempt: 1,
          attempts: [],
          facts: input.facts,
          hypotheses: input.hypotheses,
          dispositions: input.dispositions,
          answeredGaps: input.answeredGaps,
          answeredQuestionId: input.answeredQuestionId,
          emittedQuestion: input.emittedQuestion,
          convergence: input.convergence,
          questionBudget: input.questionBudget,
          error: input.error
            ? { code: input.error.code!, retryable: input.error.retryable! }
            : null,
          execution: input.execution,
          createdAt: new Date(0).toISOString(),
        },
      } as SemanticTurnResult;
    },
  };
}

function semanticState(version: number): SemanticStateDto {
  return {
    id: 'semantic-e1-provider-preflight-state',
    sessionId: 'semantic-e1-provider-preflight',
    version,
    ...emptySemanticStateProjection(),
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function turnResult(state: SemanticStateDto): SemanticTurnResult {
  return {
    state,
    turn: {
      id: 'semantic-e1-provider-preflight-claim',
      semanticVersion: state.version,
      organizationId: null,
      actorUserId: 'semantic-e1-provider-preflight',
      inputText: 'provider preflight',
      status: 'failed_retryable',
      attempt: 1,
      attempts: [],
      facts: [],
      hypotheses: [],
      dispositions: [],
      answeredGaps: [],
      answeredQuestionId: null,
      emittedQuestion: null,
      convergence: { status: 'provider_retryable_failure', reason: 'Inference pending.' },
      questionBudget: { limit: config.questionLimit, used: 0 },
      error: { code: 'inference_pending', retryable: true },
      execution: {
        provider: null,
        model: null,
        durationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        retryCount: 0,
        fallbackUsed: false,
      },
      createdAt: new Date(0).toISOString(),
    },
  };
}
