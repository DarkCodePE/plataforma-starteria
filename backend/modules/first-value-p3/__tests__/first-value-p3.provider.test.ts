import { afterEach, describe, expect, it } from 'vitest';
import { __setFetchImpl } from '../../ai/bridge.service';
import { FirstValueP3Provider } from '../first-value-p3.service';

afterEach(() => __setFetchImpl(null));

describe('FirstValueP3Provider bridge adapter', () => {
  it('calls only the internal P3 AI endpoint with the existing bridge trust headers', async () => {
    const provider = new FirstValueP3Provider();
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    __setFetchImpl(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ relationships: [], clarifications: [], summary: 'test', processorId: 'openrouter:test' }), { status: 200 });
    });
    const input = {
      sessionId: 'session-1', requestId: 'request-1', p2Confirmed: true as const,
      goal: 'Increase sales', initiatives: [{ itemId: 'item-1', name: 'Outreach' }], clarifications: [],
    };

    await provider.analyze(input, { userId: 'lead-1', role: 'portfolio_lead' });

    expect(capturedUrl).toMatch(/\/api\/v1\/ai\/first-value\/p3\/analyze$/);
    expect(capturedInit?.headers).toMatchObject({
      'X-Request-Id': 'request-1',
      'X-Cost-Cap-USD': '0.0500',
      'X-Internal-Token': expect.any(String),
      'X-User-Claims': JSON.stringify({ userId: 'lead-1', role: 'portfolio_lead' }),
    });
    expect(JSON.parse(String(capturedInit?.body))).toMatchObject({ p2Confirmed: true, sessionId: 'session-1' });
  });
});
