import { describe, expect, it, vi } from 'vitest';
import { FirstValueP3Service } from '../first-value-p3.service';
import { logger } from '../../../shared/utils/logger';

const input = {
  sessionId: 'session-1', requestId: 'request-1', p2Confirmed: true as const,
  goal: 'Increase qualified B2B sales', context: 'Q4',
  initiatives: [
    { itemId: 'item-1', name: 'Customer outreach', description: 'Contact target accounts' },
    { itemId: 'item-2', name: 'Pricing pilot' },
  ], clarifications: [],
};
const modelResult = {
  relationships: [
    { itemId: 'item-1', disposition: 'DIRECT_CONTRIBUTION', rationale: 'Supports target account outreach.', evidenceRefs: ['goal', 'initiative:item-1'] },
    { itemId: 'item-2', disposition: 'NEEDS_CONTEXT', rationale: 'The supplied context does not explain its role.', evidenceRefs: ['initiative:item-2'] },
  ],
  clarifications: [{ id: 'q-1', affectedItemIds: ['item-1', 'item-2'], question: 'Do Customer outreach and Pricing pilot support the same Q4 goal?', reason: 'The answer could change how both relationships are read.' }],
  summary: 'Customer outreach appears direct; the pricing pilot needs context.',
  processorId: 'openrouter:test-model',
};

function makeService(output = modelResult) {
  const provider = { analyze: vi.fn(async () => output) };
  return { provider, service: new FirstValueP3Service(provider) };
}

describe('FirstValueP3Service', () => {
  it('rejects unconfirmed P2 before invoking provider', async () => {
    const { provider, service } = makeService();
    await expect(service.analyze({ ...input, p2Confirmed: false })).rejects.toMatchObject({ code: 'P3_INPUT_NOT_CONFIRMED' });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('rejects malformed input with a typed failure before provider invocation', async () => {
    const { provider, service } = makeService();
    await expect(service.analyze({ ...input, extra: 'not allowed' })).rejects.toMatchObject({ code: 'P3_INVALID_INPUT' });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('rejects duplicate clarification ids before provider invocation', async () => {
    const { provider, service } = makeService();
    const duplicateClarifications = [
      { id: 'q-1', affectedItemIds: ['item-1'], answer: 'They support the sales goal.' },
      { id: 'q-1', affectedItemIds: ['item-2'], answer: 'They support the sales goal.' },
    ];

    await expect(service.analyze({ ...input, clarifications: duplicateClarifications })).rejects.toMatchObject({ code: 'P3_INVALID_INPUT' });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('rejects credentials embedded in submitted text', async () => {
    const { provider, service } = makeService();
    await expect(service.analyze({ ...input, goal: 'Bearer abcdefghijklmnop123456' })).rejects.toMatchObject({ code: 'P3_INVALID_INPUT' });
    expect(provider.analyze).not.toHaveBeenCalled();
  });

  it('validates input and invokes provider exactly once for confirmed P2', async () => {
    const { provider, service } = makeService();
    const result = await service.analyze(input);
    expect(provider.analyze).toHaveBeenCalledTimes(1);
    expect(result.relationships).toHaveLength(input.initiatives.length);
    expect(result.resultState).toBe('PROVISIONAL');
  });

  it('preserves grouped clarification for multiple items and does not require per-item confirmation', async () => {
    const { service } = makeService();
    const result = await service.analyze(input);
    expect(result.clarifications[0].affectedItemIds).toEqual(['item-1', 'item-2']);
    expect(result.relationships.map((r) => r.itemId)).toEqual(['item-1', 'item-2']);
    expect(result.relationships.every((r) => !('confirmationRequired' in r))).toBe(true);
  });

  it('allows safe retry without retaining business state or invoking canonical writes', async () => {
    const { provider, service } = makeService();
    const first = await service.analyze(input);
    const second = await service.analyze(input);
    expect(provider.analyze).toHaveBeenCalledTimes(2);
    expect(first.analysisId).not.toBe(second.analysisId);
    expect(Object.keys(service)).toEqual(['provider']);
  });

  it.each([
    ['invented item id', { ...modelResult, relationships: [{ ...modelResult.relationships[0], itemId: 'invented' }, modelResult.relationships[1]] }],
    ['unsupported disposition', { ...modelResult, relationships: [{ ...modelResult.relationships[0], disposition: 'SCORE' }, modelResult.relationships[1]] }],
    ['incomplete output', { ...modelResult, relationships: [modelResult.relationships[0]] }],
    ['invalid evidence reference', { ...modelResult, relationships: [{ ...modelResult.relationships[0], evidenceRefs: ['hidden-portfolio'] }, modelResult.relationships[1]] }],
    ['oversized summary', { ...modelResult, summary: 'x'.repeat(2001) }],
    ['oversized processor id', { ...modelResult, processorId: 'x'.repeat(161) }],
    ['too many grouped clarifications', { ...modelResult, clarifications: Array.from({ length: 21 }, (_, i) => ({ ...modelResult.clarifications[0], id: `q-${i}` })) }],
    ['duplicate affected item ids', { ...modelResult, clarifications: [{ ...modelResult.clarifications[0], affectedItemIds: ['item-1', 'item-1'] }] }],
  ])('rejects %s as typed invalid analysis', async (_name, output) => {
    const { service } = makeService(output);
    await expect(service.analyze(input)).rejects.toMatchObject({ code: 'P3_INVALID_ANALYSIS' });
  });

  it('maps provider timeout and unavailability to typed failures', async () => {
    const timedOut = new FirstValueP3Service({ analyze: vi.fn(async () => { throw Object.assign(new Error('timeout'), { code: 'AI_UPSTREAM_TIMEOUT' }); }) });
    const unavailable = new FirstValueP3Service({ analyze: vi.fn(async () => { throw Object.assign(new Error('offline'), { code: 'AI_SERVICE_UNAVAILABLE' }); }) });
    await expect(timedOut.analyze(input)).rejects.toMatchObject({ code: 'P3_PROCESSOR_TIMEOUT' });
    await expect(unavailable.analyze(input)).rejects.toMatchObject({ code: 'P3_PROCESSOR_UNAVAILABLE' });
  });

  it('does not log supplied goal or work text and has no canonical repository dependency', async () => {
    const { service } = makeService();
    const info = vi.spyOn(logger, 'info');
    const warn = vi.spyOn(logger, 'warn');
    await expect(service.analyze(input)).resolves.toBeTruthy();
    const logText = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    expect(logText).not.toContain(input.goal);
    expect(logText).not.toContain(input.initiatives[0].description);
    expect(Object.keys(service)).toEqual(['provider']);
    info.mockRestore();
    warn.mockRestore();
  });
});
