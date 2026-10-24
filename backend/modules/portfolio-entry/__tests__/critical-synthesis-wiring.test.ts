import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCriticalSituationSynthesisInput } from '../../portfolio-entry-runtime/synthesis/critical-situation-synthesis-input';
import { configuredLiveUnderstandingSynthesizer } from '../portfolio-entry.router';

describe('Critical Handoff synthesizer wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the synthesis timeout (90 s) and does not retry a provider timeout', async () => {
    vi.stubEnv('PORTFOLIO_ENTRY_API_KEY', 'test-key');
    vi.stubEnv('PORTFOLIO_ENTRY_SYNTHESIS_TIMEOUT_MS', '');
    vi.stubEnv('PORTFOLIO_ENTRY_FALLBACK_API_KEY', '');
    const fetchImpl = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    });
    vi.stubGlobal('fetch', fetchImpl);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const synthesizer = configuredLiveUnderstandingSynthesizer();
    const result = await synthesizer.synthesizeDetailed!({
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

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy.mock.calls.map((call) => call[1])).toContain(90_000);
    expect(result.synthesis).toBeNull();
    expect(result.modelExecution?.technical_error).toContain('Provider timeout');
  });
});
