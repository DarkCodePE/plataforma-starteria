import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trackStarteriaPathEvent } from '../analytics';

describe('125F Starteria Path analytics boundary', () => {
  beforeEach(() => {
    (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
  });

  it('emits only bounded allowlisted values', () => {
    trackStarteriaPathEvent('conversion_submitted', {
      destinationType: 'DEMO', contextShared: false, idempotentReplay: true,
      resultCategory: 'RECEIVED',
      email: 'person@example.org', name: 'Private', organization: 'Private',
      decisionInView: 'Private decision', criticalHandoff: 'Private reading',
      rawConversation: 'Private conversation', provenance: 'Private source',
      provider: 'Private provider', model: 'Private model', idempotencyKey: 'Private key',
      destinationUrl: 'https://private.example.org', error: { secret: 'Private error' },
      experienceState: 'Private free text',
    } as Record<string, unknown>);

    expect((window as unknown as { dataLayer: unknown[] }).dataLayer).toEqual([{
      event: 'conversion_submitted', destinationType: 'DEMO', contextShared: false,
      idempotentReplay: true, resultCategory: 'RECEIVED',
    }]);
  });

  it('never lets dispatch or provider failure interrupt the product', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockImplementation(() => { throw new Error('analytics unavailable'); });
    (window as unknown as { dataLayer?: unknown }).dataLayer = { push: () => { throw new Error('provider unavailable'); } };
    expect(() => trackStarteriaPathEvent('starteria_path_viewed', { experienceState: 'SUPPORTED' })).not.toThrow();
    dispatch.mockRestore();
  });
});
