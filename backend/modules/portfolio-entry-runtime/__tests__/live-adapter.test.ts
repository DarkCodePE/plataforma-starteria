import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LivePortfolioEntryAgentAdapter } from '../agent/live-portfolio-entry-agent-adapter';
import { FetchStructuredModelAdapter } from '../model/fetch-structured-model-adapter';
import { portfolioEntryLiveHealth } from '../model/live-health';
import type { StructuredModelAdapter } from '../model/structured-model-adapter';
import type { ModelExecutionResult } from '../model/model-execution-types';
import { createInitialSessionContext } from '../domain/session.types';

describe('Portfolio Entry live adapter', () => {
  it('maps the validated Phase 5 structured response into the Runtime contract', async () => {
    const output = {
      analysis: { initial_entry_state: 'initiative_first', current_frame: 'initiative_first' },
      question_plan: { questions: [], question_count: 0, status: 'no_questions_required', stop_reason: 'sufficient_context' },
    };
    const execution = {
      provider_raw: { output: [] },
      parsed_output: output,
      validated_output: output,
      schema_errors: [],
      execution_metadata: {
        call_id: 'call-1', purpose: 'analysis_turn' as const, provider: 'openai_responses', model: 'gpt-5.6-luna',
        duration_ms: 12, retry_count: 0, seed_support: 'not_requested' as const,
      },
    } as ModelExecutionResult<unknown>;
    const model: StructuredModelAdapter = { generate: vi.fn().mockResolvedValue(execution) };
    const adapter = new LivePortfolioEntryAgentAdapter(model, {
      candidate_id: 'test-live', adapter_mode: 'live_llm_candidate', provider: 'openai_responses', model: 'gpt-5.6-luna',
      prompt_manifest_hash: 'prompt-hash', contract_manifest_hash: 'contract-hash',
    }, {
      prompt_version: '0.2', files: { agent: 'agent.md', skill_01: 'entry-01-intent-detection.md', skill_02: 'entry-02-context-extraction.md', skill_03: 'entry-03-reverse-alignment.md', skill_04: 'entry-04-question-planner.md', handoff: 'handoff.md' },
      file_hashes: {}, prompt_manifest_hash: 'prompt-hash',
    });

    const result = await adapter.analyzeTurn({
      entryId: 'session-turn-1', sessionId: 'session-1', rawInput: 'Entrada corporativa',
      sessionContext: createInitialSessionContext({ initial_mode: 'quick_clarification', quick_question_budget: 3 }),
    });

    expect(result.analysis).toEqual(output.analysis);
    expect(result.question_plan).toEqual(output.question_plan);
    expect(result.modelExecution?.execution_metadata.provider).toBe('openai_responses');
    expect(model.generate).toHaveBeenCalledWith(expect.objectContaining({ providerJsonSchema: expect.any(Object) }));
  });

  it('records requested and provider-reported model metadata from the provider call', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        model: 'gpt-5.6-luna-2026-09-12',
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: '{"ok":true}' }],
        }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });
    const adapter = new FetchStructuredModelAdapter({
      provider: 'openai_responses',
      model: 'gpt-5.6-luna',
      apiKey: 'test-key',
      baseUrl: 'https://provider.test/v1',
      timeoutMs: 1000,
    }, fetchImpl);

    const result = await adapter.generate({
      systemPrompt: 'system',
      userPayload: { input: 'test' },
      outputSchema: z.object({ ok: z.literal(true) }),
      metadata: {
        provider: 'openai_responses',
        model: 'gpt-5.6-luna',
        seed_support: 'not_requested',
      },
      call: { call_id: 'call-1', purpose: 'technical_smoke' },
    });

    expect(result.execution_metadata.requested_model).toBe('gpt-5.6-luna');
    expect(result.execution_metadata.provider_reported_model).toBe('gpt-5.6-luna-2026-09-12');
    expect(result.execution_metadata.model).toBe('gpt-5.6-luna');
  });

  it('supports the isolated critical synthesis purpose without changing existing purposes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        model: 'gpt-5.6-luna-response',
        output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }],
      }),
    });
    const adapter = new FetchStructuredModelAdapter({
      provider: 'openai_responses',
      model: 'gpt-5.6-luna',
      apiKey: 'test-key',
      baseUrl: 'https://provider.test/v1',
      timeoutMs: 1000,
    }, fetchImpl);

    const result = await adapter.generate({
      systemPrompt: 'system',
      userPayload: { snapshot_id: 'snapshot-1' },
      outputSchema: z.object({ ok: z.literal(true) }),
      providerJsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      metadata: { provider: 'openai_responses', model: 'gpt-5.6-luna', seed_support: 'not_requested' },
      call: { call_id: 'call-synthesis', purpose: 'critical_situation_synthesis' },
    });

    const request = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)) as {
      text: { format: { name: string; schema: unknown } };
    };
    expect(result.error_type).toBeUndefined();
    expect(result.execution_metadata.purpose).toBe('critical_situation_synthesis');
    expect(request.text.format.name).toBe('critical_situation_synthesis');
    expect(request.text.format.schema).toEqual({ type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false });
  });

  it.each([401, 403, 404, 429, 500])('keeps provider status %i useful and redacts error messages', async (status) => {
    const secretMarker = 'private-token-must-not-appear';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status,
      text: async () => JSON.stringify({ error: { type: 'invalid_request_error', code: 'invalid_api_key', message: secretMarker } }),
    });
    const adapter = new FetchStructuredModelAdapter({
      provider: 'openai_responses', model: 'gpt-5.6-luna', apiKey: 'test-key',
      baseUrl: 'https://provider.test/v1', timeoutMs: 1000,
    }, fetchImpl);
    const result = await adapter.generate({
      systemPrompt: 'system', userPayload: { input: 'test' },
      outputSchema: z.object({ ok: z.literal(true) }),
      metadata: { provider: 'openai_responses', model: 'gpt-5.6-luna', seed_support: 'not_requested' },
      call: { call_id: 'call-1', purpose: 'technical_smoke' },
    });
    expect(result.technical_error).toContain(`status=${status}`);
    expect(result.technical_error).toContain('endpoint=https://provider.test/v1/responses');
    expect(result.technical_error).toContain('model=gpt-5.6-luna');
    expect(JSON.stringify(result)).not.toContain(secretMarker);
    expect(fetchImpl).toHaveBeenCalledTimes(status === 429 || status === 500 ? 2 : 1);
  });

  it('reports readiness without exposing the API key', () => {
    const health = portfolioEntryLiveHealth({
      PORTFOLIO_ENTRY_PROVIDER: 'openai_responses',
      PORTFOLIO_ENTRY_MODEL: 'gpt-5.6-luna',
      PORTFOLIO_ENTRY_BASE_URL: 'https://api.openai.com/v1',
      PORTFOLIO_ENTRY_API_KEY: 'private-token-must-not-appear',
    });
    expect(health).toEqual({ providerConfigured: 'YES', model: 'gpt-5.6-luna', baseUrlHost: 'api.openai.com', liveAdapterReady: 'YES' });
    expect(JSON.stringify(health)).not.toContain('private-token-must-not-appear');
    expect(portfolioEntryLiveHealth({ PORTFOLIO_ENTRY_PROVIDER: 'openai_responses' }).liveAdapterReady).toBe('NO');
  });
});
