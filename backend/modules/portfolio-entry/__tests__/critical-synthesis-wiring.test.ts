import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCriticalSituationSynthesisInput } from '../../portfolio-entry-runtime/synthesis/critical-situation-synthesis-input';
import { configuredLiveUnderstandingSynthesizer } from '../portfolio-entry.router';

describe('Critical Handoff synthesizer wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the synthesis timeout (120 s) and does not retry a provider timeout', async () => {
    vi.stubEnv('PORTFOLIO_ENTRY_API_KEY', 'test-key');
    vi.stubEnv('PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT', 'low');
    vi.stubEnv('PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS', '');
    vi.stubEnv('PORTFOLIO_ENTRY_FALLBACK_API_KEY', '');
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    vi.stubGlobal('fetch', fetchImpl);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const result = await runSynthesis();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchImpl.mock.calls[0][1]!.body as string);
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.provider).toEqual({ require_parameters: true });
    expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toContain(120_000);
    expect(result.synthesis).toBeNull();
    expect(result.modelExecution?.technical_error).toContain('Provider timeout');
  });

  it('preserves the effort requirement on synthesis fallback after provider 5xx', async () => {
    vi.stubEnv('PORTFOLIO_ENTRY_API_KEY', 'test-key');
    vi.stubEnv('PORTFOLIO_ENTRY_SYNTHESIS_REASONING_EFFORT', 'medium');
    vi.stubEnv('PORTFOLIO_ENTRY_FALLBACK_API_KEY', 'test-fallback-key');
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: '{}' })));
    vi.stubGlobal('fetch', fetchImpl);
    await runSynthesis();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(JSON.parse(init!.body as string)).toMatchObject({
        reasoning: { effort: 'medium' }, provider: { require_parameters: true },
      });
    }
  });
});

async function runSynthesis() {
  const synthesizer = configuredLiveUnderstandingSynthesizer();
  return synthesizer.synthesizeDetailed!({
    purpose: 'critical_handoff',
    sessionId: 'session-1',
    sessionRevision: 3,
    contextRevision: 2,
    turnIndex: 2,
    sourceTurnId: 'turn-2',
    authorizedSnapshot: normalizeCriticalSituationSynthesisInput({
      snapshot: { snapshot_id: 'snapshot-1', captured_at: '2026-10-23T10:00:00.000Z' },
      user_messages: [{ id: 'm1', turn_index: 1, text: 'Quiero lanzar un servicio preventivo.' }],
    }),
  } as Parameters<NonNullable<typeof synthesizer.synthesizeDetailed>>[0]);
}
