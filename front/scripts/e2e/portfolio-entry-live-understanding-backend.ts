import express from 'express';
import { errorHandler } from '../../../backend/shared/errors/error-handler';
import { requestId } from '../../../backend/shared/middleware/request-id';
import { prisma } from '../../../backend/shared/db/prisma';
import {
  DeterministicPortfolioEntryAgentAdapter,
  type PortfolioEntryLiveUnderstandingSynthesizer,
} from '../../../backend/modules/portfolio-entry/application/portfolio-entry-experimental-session.service';
import { buildPortfolioEntryRouter } from '../../../backend/modules/portfolio-entry/portfolio-entry.router';
import type { CriticalSituationSynthesis } from '../../../backend/modules/portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import { CriticalSituationSynthesisAdapter } from '../../../backend/modules/portfolio-entry-runtime/agent/critical-situation-synthesis-adapter';
import type { StructuredModelAdapter, StructuredModelGenerateInput } from '../../../backend/modules/portfolio-entry-runtime/model/structured-model-adapter';
import type { ModelExecutionResult } from '../../../backend/modules/portfolio-entry-runtime/model/model-execution-types';
import type { CriticalSituationSynthesisAuthorizedSnapshot } from '../../../backend/modules/portfolio-entry-runtime/synthesis/critical-situation-synthesis-input';
import type { PortfolioEntryAgentAdapterV2 } from '../../../backend/modules/portfolio-entry-runtime/agent/portfolio-entry-agent-adapter';

/**
 * Test-only composition root for the real Portfolio Entry router and Prisma
 * repositories. The model boundary is injected here; no production route,
 * environment switch, provider credential, or client request selects output.
 */
const counters = { analysisCalls: 0, synthesisCalls: 0, fakeModelCalls: 0 };
const deterministicAgent = new DeterministicPortfolioEntryAgentAdapter();

class DeterministicSynthesisModelAdapter implements StructuredModelAdapter {
  async generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>> {
    counters.fakeModelCalls += 1;
    const snapshot = input.userPayload as CriticalSituationSynthesisAuthorizedSnapshot;
    const sourceRef = snapshot.source_refs[0] ?? 'session.user_message:test';
    const candidate: CriticalSituationSynthesis = {
      basis_status: 'sufficient',
      situation_model: {
        desired_change: null,
        current_situation: [],
        existing_work_or_assets: [],
        decision_to_enable: null,
        known_evidence: [],
        constraints: [],
        actors_and_authority: [],
        dependencies: [],
        uncertainties: [],
        time_pressure: [],
        existing_alternatives: [],
        material_tensions: [],
      },
      reasoning_metadata: { selected_lenses: [] },
      situation_insight: {
        statement: `Lectura de prueba ${counters.fakeModelCalls} respaldada por el contexto recibido.`,
        support: [sourceRef],
        novelty_type: 'relationship_made_explicit',
        epistemic_role: 'INTERPRETATION',
        status: 'supported',
      },
      material_tensions: [],
      decision_frame: {
        status: 'not_yet_identifiable',
        decision_to_prepare: null,
        decision_authority: 'unknown',
        materially_distinct_paths: [],
        distinguishing_conditions: [],
        timing_or_constraints: [],
        unresolved_basis: [],
      },
      usable_now: [],
      decision_changing_unknowns: [],
      candidate_first_movement: null,
      provenance: [
        provenance('insight', 'situation_insight.statement', sourceRef),
        provenance('authority', 'decision_frame.decision_authority', sourceRef),
      ],
    };
    const parsed = input.outputSchema.safeParse(candidate);
    const metadata: ModelExecutionResult<T>['execution_metadata'] = {
      call_id: input.call.call_id,
      purpose: input.call.purpose,
      provider: input.metadata.provider,
      requested_model: input.metadata.requested_model,
      model: input.metadata.model ?? input.metadata.requested_model ?? 'portfolio-entry-e2e-fake',
      temperature: input.metadata.temperature,
      seed: input.metadata.seed,
      seed_support: input.metadata.seed_support,
      duration_ms: 0,
      retry_count: 0,
    };
    return {
      provider_raw: { deterministic_test_adapter: true },
      parsed_output: candidate,
      validated_output: parsed.success ? parsed.data : null,
      schema_errors: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
      execution_metadata: metadata,
      ...(parsed.success ? {} : { error_type: 'SCHEMA_ERROR' as const }),
    };
  }
}

const synthesisModel = new DeterministicSynthesisModelAdapter();
const synthesisAdapter = new CriticalSituationSynthesisAdapter(synthesisModel);
const agentAdapter: PortfolioEntryAgentAdapterV2 = {
  async analyzeTurn(input) {
    counters.analysisCalls += 1;
    return deterministicAgent.analyzeTurn(input);
  },
};

const liveUnderstandingSynthesizer: PortfolioEntryLiveUnderstandingSynthesizer = {
  async synthesize(input) {
    counters.synthesisCalls += 1;
    const result = await synthesisAdapter.generate({
      authorized_snapshot: input.authorizedSnapshot,
      call_id: `${input.sessionId}-live-understanding-${input.turnIndex}`,
      model_metadata: {
        provider: 'deterministic_test_adapter',
        requested_model: 'portfolio-entry-e2e-fake',
        model: 'portfolio-entry-e2e-fake',
        temperature: 0,
        seed_support: 'not_requested',
      },
    });
    return result.synthesis;
  },
};

function provenance(id: string, claimRef: string, sourceRef: string): CriticalSituationSynthesis['provenance'][number] {
  return {
    id: `test-${id}`,
    claim_ref: claimRef,
    origin: 'AI_INFERRED',
    review_disposition: 'UNREVIEWED',
    source_refs: [sourceRef],
    source_path: null,
    source_text: null,
    recorded_at: null,
  };
}

const app = express();
app.use(express.json());
app.use(requestId);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/__test/portfolio-entry-stats', (req, res, next) => {
  void (async () => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const [turns, handoffCount] = sessionId
      ? await Promise.all([
          prisma.portfolioEntryTurn.findMany({
            where: { sessionId },
            orderBy: { turnIndex: 'asc' },
            select: { inputIntent: true },
          }),
          prisma.portfolioEntryHandoff.count({ where: { sessionId } }),
        ])
      : [[], 0];
    res.json({
      ...counters,
      turnIntents: turns.map((turn) => turn.inputIntent),
      handoffCount,
    });
  })().catch(next);
});
app.use('/api/v1/public/portfolio-entry', buildPortfolioEntryRouter({}, {
  agentAdapter,
  liveUnderstandingSynthesizer,
}));
app.use(errorHandler);

const port = Number(process.env.PORT || 4100);
const server = app.listen(port, '127.0.0.1');
server.on('listening', () => console.log(`[E2E test composition] Portfolio Entry backend listening on ${port}`));

function shutdown() {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
