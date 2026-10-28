import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { FetchStructuredModelAdapter } from '../model/fetch-structured-model-adapter';
import { loadCriticalSynthesisProviderConfig, loadPortfolioEntryProviderConfig } from '../model/provider-config';

const env = { PORTFOLIO_ENTRY_API_KEY: 'test-key' };

async function captureBody(config: ReturnType<typeof loadCriticalSynthesisProviderConfig>) {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ output_text: '{"ok":true}' })));
  const result = await new FetchStructuredModelAdapter(config, fetchImpl).generate({
    systemPrompt: 'system', userPayload: {}, outputSchema: z.object({ ok: z.literal(true) }),
    metadata: { provider: config.provider, model: config.model, seed_support: 'not_requested' },
    call: { call_id: 'reasoning-test', purpose: 'critical_situation_synthesis' },
  });
  expect(result.validated_output).toEqual({ ok: true });
  return JSON.parse(fetchImpl.mock.calls[0][1]!.body as string);
}

describe('Critical synthesis reasoning effort', () => {
  it('defaults only synthesis to low and requires parameter support', async () => {
    const body = await captureBody(loadCriticalSynthesisProviderConfig(env));
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.provider).toEqual({ require_parameters: true });
  });

  it.each(['low', 'medium', 'high'])('sends configured effort %s', async (effort) => {
    const body = await captureBody(loadCriticalSynthesisProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT: effort }));
    expect(body.reasoning).toEqual({ effort });
    expect(body.provider).toEqual({ require_parameters: true });
  });

  it.each(['none', '', '   '])('omits both parameters when explicitly disabled with %j', async (effort) => {
    const body = await captureBody(loadCriticalSynthesisProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT: effort }));
    expect(body).not.toHaveProperty('reasoning');
    expect(body).not.toHaveProperty('provider');
  });

  it.each(['invalid', 'LOW', 'minimal', '0'])('rejects invalid configuration %j at load time', (effort) => {
    expect(() => loadCriticalSynthesisProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT: effort }))
      .toThrow('PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT must be low, medium, high, none or empty.');
  });

  it('keeps copilot and other regular calls unchanged even with synthesis effort configured', async () => {
    const config = loadPortfolioEntryProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT: 'high' });
    expect(await captureBody(config)).toEqual({
      model: config.model,
      input: [{ role: 'system', content: 'system' }, { role: 'user', content: '{}' }],
      text: { format: { type: 'json_object' } },
    });
    expect(() => loadPortfolioEntryProviderConfig({ ...env, PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT: 'invalid' })).not.toThrow();
  });
});
