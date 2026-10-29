import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';
import { FetchStructuredModelAdapter } from '../model/fetch-structured-model-adapter';
import {
  loadCriticalSynthesisProviderConfig,
  loadPortfolioEntryProviderConfig,
  type PortfolioEntryProviderConfig,
} from '../model/provider-config';

const env = { PORTFOLIO_ENTRY_API_KEY: 'test-key' } as NodeJS.ProcessEnv;

function abortingFetch() {
  return vi.fn(async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });
}

function generate(config: PortfolioEntryProviderConfig, fetchImpl: typeof fetch) {
  return new FetchStructuredModelAdapter(config, fetchImpl).generate({
    systemPrompt: 'system',
    userPayload: { snapshot_id: 'snapshot-1' },
    outputSchema: z.object({ ok: z.literal(true) }),
    metadata: { provider: 'openai_responses', model: 'gpt-5.6-luna', seed_support: 'not_requested' },
    call: { call_id: 'call-synthesis', purpose: 'critical_situation_synthesis' },
  });
}

describe('Critical synthesis timeout', () => {
  it('gives the synthesis its own 90 s limit without retrying timeouts, leaving turns at 30 s', () => {
    expect(loadPortfolioEntryProviderConfig(env)).toMatchObject({ timeoutMs: 30_000 });
    expect(loadPortfolioEntryProviderConfig(env).retryOnTimeout).toBeUndefined();
    expect(loadCriticalSynthesisProviderConfig(env)).toMatchObject({ timeoutMs: 120_000, retryOnTimeout: false });
  });

  it('reads PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS and rejects invalid values', () => {
    expect(loadCriticalSynthesisProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS: '75000' }).timeoutMs).toBe(75_000);
    expect(() => loadCriticalSynthesisProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS: '0' }))
      .toThrow('PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS must be positive.');
  });

  it('does not retry a timeout when retryOnTimeout is false', async () => {
    const fetchImpl = abortingFetch();
    const result = await generate({ ...loadCriticalSynthesisProviderConfig(env), timeoutMs: 1000 }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.error_type).toBe('TECHNICAL_ERROR');
    expect(result.technical_error).toContain('Provider timeout');
    expect(result.execution_metadata.retry_count).toBe(0);
  });

  it('keeps retrying timeouts once by default', async () => {
    const fetchImpl = abortingFetch();
    await generate({ ...loadPortfolioEntryProviderConfig(env), timeoutMs: 1000 }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('still retries provider 5xx when retryOnTimeout is false', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => '{"error":"busy"}' })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] }),
      });
    const result = await generate({ ...loadCriticalSynthesisProviderConfig(env), timeoutMs: 1000 }, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.error_type).toBeUndefined();
    expect(result.validated_output).toEqual({ ok: true });
  });
});
