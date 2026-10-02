import { describe, expect, it, vi } from 'vitest';
import { JevClassifier, JEV_THRESHOLDS, type JevClassification } from '../agent/jev-classifier';
import { LivePortfolioEntryAgentAdapter, resolveClassification } from '../agent/live-portfolio-entry-agent-adapter';
import type { StructuredModelAdapter } from '../model/structured-model-adapter';
import type { ModelExecutionResult } from '../model/model-execution-types';
import { createInitialSessionContext } from '../domain/session.types';
import type { PortfolioEntryAnalysisV2 } from '../domain/analysis.schema';

// ADR-032 / KAN-77.

function jevResponse(answers: Record<string, unknown>) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answers, model: 'jev-1.13.0' }) });
}

const confident = {
  entry_state: { choice: 'portfolio_first', confidence: 0.95 },
  primary_intent: { choice: 'portfolio_prioritization', confidence: 1 },
  also_portfolio_reporting: { score: 0.98 },
  also_strategic_goal: { score: 0.83 },
};

describe('JevClassifier', () => {
  it('takes Jev choices above the thresholds and only strongly supported secondary intents', async () => {
    const fetchImpl = jevResponse(confident);
    const result = await new JevClassifier({ apiKey: 'k', fetchImpl }).classify({ rawInput: 'Tengo 25 iniciativas...' });

    expect(result).toMatchObject({
      frame: 'portfolio_first',
      primary_intent: 'portfolio_prioritization',
      secondary_intents: ['portfolio_reporting'],
      source: 'jev',
    });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.state).toContain('Tengo 25 iniciativas');
    expect(Object.keys(body.questions)).toEqual(expect.arrayContaining(['entry_state', 'primary_intent', 'also_portfolio_reporting']));
    expect(body.questions).not.toHaveProperty('also_unknown');
  });

  it('turns low confidence into unknown instead of guessing (entry-01 ID-02, ID-03)', async () => {
    const result = await new JevClassifier({
      apiKey: 'k',
      fetchImpl: jevResponse({
        entry_state: { choice: 'problem_first', confidence: JEV_THRESHOLDS.entryState - 0.1 },
        primary_intent: { choice: 'strategic_goal', confidence: JEV_THRESHOLDS.primaryIntent - 0.1 },
        also_portfolio_reporting: { score: 0.99 },
      }),
    }).classify({ rawInput: 'Necesito ordenar esto.' });

    expect(result).toMatchObject({ frame: 'unknown', primary_intent: 'unknown', secondary_intents: [] });
  });

  it('never throws: when Jev is down the turn continues with everything unknown', async () => {
    const result = await new JevClassifier({ apiKey: 'k', fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNRESET')) })
      .classify({ rawInput: 'x' });

    expect(result).toMatchObject({ frame: 'unknown', primary_intent: 'unknown', source: 'jev_unavailable', error: 'ECONNRESET' });
  });

  it('gives Jev the questions already asked when the message is a follow-up answer', async () => {
    const fetchImpl = jevResponse(confident);
    await new JevClassifier({ apiKey: 'k', fetchImpl }).classify({ rawInput: 'unidades', priorQuestions: ['¿Los 200 son unidades o ingresos?'] });

    const { state } = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(state).toContain('¿Los 200 son unidades o ingresos?');
    expect(state).toContain('Nuevo mensaje del usuario: unidades');
  });
});

describe('resolveClassification', () => {
  const prior = {
    initial_entry_state: 'strategy_first', current_frame: 'strategy_first', primary_intent: 'strategic_goal', secondary_intents: [],
  } as unknown as PortfolioEntryAnalysisV2;
  const jev: JevClassification = { frame: 'unknown', primary_intent: 'unknown', secondary_intents: [], confidence: { frame: 0.3, primary_intent: 0.3 }, source: 'jev', duration_ms: 1 };

  it('keeps the initial entry state and the prior reading when a short answer cannot be classified', () => {
    expect(resolveClassification(jev, prior)).toEqual({
      initial_entry_state: 'strategy_first', current_frame: 'strategy_first', primary_intent: 'strategic_goal', secondary_intents: [],
    });
  });

  it('lets a confident reclassification move the current frame but never the initial one', () => {
    const moved = resolveClassification({ ...jev, frame: 'reporting_first', primary_intent: 'portfolio_reporting' }, prior);
    expect(moved).toMatchObject({ initial_entry_state: 'strategy_first', current_frame: 'reporting_first', primary_intent: 'portfolio_reporting' });
  });
});

describe('LivePortfolioEntryAgentAdapter with Jev', () => {
  it('classifies with Jev only: the LLM gets it fixed and its schema has no classification fields', async () => {
    const llmOutput = {
      analysis: { entry_id: 'e', extracted_context: { portfolio_size: 25 } },
      question_plan: { questions: [], question_count: 0 },
    };
    const model: StructuredModelAdapter = {
      generate: vi.fn().mockResolvedValue({
        provider_raw: {}, parsed_output: llmOutput, validated_output: llmOutput, schema_errors: [],
        execution_metadata: { call_id: 'c', purpose: 'analysis_turn', provider: 'openai_responses', model: 'gpt-5.6-luna', duration_ms: 5, retry_count: 0, seed_support: 'not_requested' },
      } as ModelExecutionResult<unknown>),
    };
    const classifier = new JevClassifier({ apiKey: 'k', fetchImpl: jevResponse(confident) });
    const adapter = new LivePortfolioEntryAgentAdapter(model, {
      candidate_id: 't', adapter_mode: 'live_llm_candidate', provider: 'openai_responses', model: 'gpt-5.6-luna',
      prompt_manifest_hash: 'h', contract_manifest_hash: 'c',
    }, {
      prompt_version: '0.2', files: { agent: 'agent.md', skill_01: 'entry-01-intent-detection.md', skill_02: 'entry-02-context-extraction.md', skill_03: 'entry-03-reverse-alignment.md', skill_04: 'entry-04-question-planner.md', handoff: 'handoff.md' },
      file_hashes: {}, prompt_manifest_hash: 'h',
    }, {}, classifier);

    const result = await adapter.analyzeTurn({
      entryId: 's-turn-1', sessionId: 's', rawInput: 'Tengo 25 iniciativas...',
      sessionContext: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    });

    const call = vi.mocked(model.generate).mock.calls[0][0];
    const schema = call.providerJsonSchema as { properties: { analysis: { properties: Record<string, unknown> } } };
    expect(Object.keys(schema.properties.analysis.properties)).not.toContain('primary_intent');
    expect(Object.keys(schema.properties.analysis.properties)).not.toContain('current_frame');
    expect(call.userPayload).toMatchObject({ classification: { primary_intent: 'portfolio_prioritization', current_frame: 'portfolio_first' } });
    expect(call.systemPrompt).toContain('decided outside of you');
    expect(call.systemPrompt).not.toContain('Classify the user\'s primary intent');

    expect(result.analysis).toMatchObject({
      initial_entry_state: 'portfolio_first',
      current_frame: 'portfolio_first',
      primary_intent: 'portfolio_prioritization',
      secondary_intents: ['portfolio_reporting'],
      extracted_context: { portfolio_size: 25 },
    });
    expect(result.modelExecution?.execution_metadata.classifier).toMatchObject({ provider: 'jev', model: 'jev-1.13.0' });
  });

  it('reports each classified turn without the user text', async () => {
    const llmOutput = { analysis: { entry_id: 'e', extracted_context: {} }, question_plan: { questions: [], question_count: 0 } };
    const model: StructuredModelAdapter = {
      generate: vi.fn().mockResolvedValue({
        provider_raw: {}, parsed_output: llmOutput, validated_output: llmOutput, schema_errors: [],
        execution_metadata: { call_id: 'c', purpose: 'analysis_turn', provider: 'openai_responses', model: 'm', duration_ms: 5, retry_count: 0, seed_support: 'not_requested' },
      } as ModelExecutionResult<unknown>),
    };
    const onClassified = vi.fn();
    const adapter = new LivePortfolioEntryAgentAdapter(model, {
      candidate_id: 't', adapter_mode: 'live_llm_candidate', provider: 'openai_responses', model: 'm',
      prompt_manifest_hash: 'h', contract_manifest_hash: 'c',
    }, {
      prompt_version: '0.2', files: { agent: 'agent.md', skill_01: 'entry-01-intent-detection.md', skill_02: 'entry-02-context-extraction.md', skill_03: 'entry-03-reverse-alignment.md', skill_04: 'entry-04-question-planner.md', handoff: 'handoff.md' },
      file_hashes: {}, prompt_manifest_hash: 'h',
    }, {}, new JevClassifier({ apiKey: 'k', fetchImpl: jevResponse(confident) }), onClassified);

    await adapter.analyzeTurn({
      entryId: 's-turn-1', sessionId: 's', rawInput: 'texto privado del usuario',
      sessionContext: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    });

    expect(onClassified).toHaveBeenCalledOnce();
    const event = onClassified.mock.calls[0][0];
    expect(event).toMatchObject({ session_id: 's', follow_up: false, provider: 'jev', applied: { primary_intent: 'portfolio_prioritization' } });
    expect(JSON.stringify(event)).not.toContain('texto privado');
  });
});

describe('JevClassifier.classifyRaw', () => {
  it('returns Jev choices without thresholds, for calibration', async () => {
    const result = await new JevClassifier({
      apiKey: 'k',
      fetchImpl: jevResponse({ entry_state: { choice: 'problem_first', confidence: 0.2 }, primary_intent: { choice: 'strategic_goal', confidence: 0.3 } }),
    }).classifyRaw('x');
    expect(result).toEqual({ frame: { choice: 'problem_first', confidence: 0.2 }, primary_intent: { choice: 'strategic_goal', confidence: 0.3 } });
  });

  it('throws when Jev fails, so a calibration never runs on gaps', async () => {
    await expect(new JevClassifier({ apiKey: 'k', fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 429 }) }).classifyRaw('x'))
      .rejects.toThrow('Jev HTTP 429');
  });
});
