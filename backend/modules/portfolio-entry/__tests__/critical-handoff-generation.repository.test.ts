import { describe, expect, it } from 'vitest';
import { InMemoryCriticalHandoffGenerationRepository } from '../infrastructure/in-memory-critical-handoff-generation.repository';

describe('InMemoryCriticalHandoffGenerationRepository', () => {
  const startedAt = new Date('2026-10-24T12:00:00.000Z');

  it('lets only one concurrent caller claim a session and source revision', async () => {
    const repository = new InMemoryCriticalHandoffGenerationRepository();
    const claim = () => repository.claim({
      sessionId: 'session-1', sourceContextRevision: 4, expectedSessionRevision: 8,
      now: startedAt, maxDurationMs: 180_000,
    });

    const results = await Promise.all([claim(), claim()]);

    expect(results.filter((result) => result.claimed)).toHaveLength(1);
    expect(results[0].generation.id).toBe(results[1].generation.id);
    expect(results.map((result) => result.generation.attempt)).toEqual([1, 1]);
  });

  it('marks an old generation stale before allowing a retry', async () => {
    const repository = new InMemoryCriticalHandoffGenerationRepository();
    await repository.claim({ sessionId: 'session-1', sourceContextRevision: 4,
      expectedSessionRevision: 8, now: startedAt, maxDurationMs: 180_000 });

    const retried = await repository.claim({ sessionId: 'session-1', sourceContextRevision: 4,
      expectedSessionRevision: 8, now: new Date(startedAt.getTime() + 180_001), maxDurationMs: 180_000 });

    expect(retried.claimed).toBe(true);
    expect(retried.generation).toMatchObject({ status: 'GENERATING', attempt: 2, startedAt: new Date(startedAt.getTime() + 180_001) });
  });

  it('allows FAILED generations to be claimed again with an incremented attempt', async () => {
    const repository = new InMemoryCriticalHandoffGenerationRepository();
    await repository.claim({ sessionId: 'session-1', sourceContextRevision: 4,
      expectedSessionRevision: 8, now: startedAt, maxDurationMs: 180_000 });
    await repository.markFailed('session-1', 4, 'provider_timeout', new Date(startedAt.getTime() + 1000));

    const retry = await repository.claim({ sessionId: 'session-1', sourceContextRevision: 4,
      expectedSessionRevision: 8, now: new Date(startedAt.getTime() + 2000), maxDurationMs: 180_000 });

    expect(retry.claimed).toBe(true);
    expect(retry.generation).toMatchObject({ status: 'GENERATING', attempt: 2, failureClass: null });
  });
});
