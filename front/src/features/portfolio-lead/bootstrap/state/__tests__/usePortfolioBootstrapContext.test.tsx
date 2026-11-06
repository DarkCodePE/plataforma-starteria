import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioBootstrapContextPayload, PortfolioBootstrapContextReview } from '../../services/portfolioBootstrapContextClient';

const getContext = vi.fn();
const saveDraft = vi.fn();
const confirmContext = vi.fn();

vi.mock('../../services/portfolioBootstrapContextClient', async () => {
  const actual = await vi.importActual<typeof import('../../services/portfolioBootstrapContextClient')>('../../services/portfolioBootstrapContextClient');
  return {
    ...actual,
    getPortfolioBootstrapContext: (...args: unknown[]) => getContext(...args),
    savePortfolioBootstrapContextDraft: (...args: unknown[]) => saveDraft(...args),
    confirmPortfolioBootstrapContext: (...args: unknown[]) => confirmContext(...args),
  };
});

import { usePortfolioBootstrapContext } from '../usePortfolioBootstrapContext';

const initial: PortfolioBootstrapContextPayload = {
  situation: { value: 'Situación confirmada', provenance: 'user_declared', sourceRef: { kind: 'user_input' } },
  area: { value: null, provenance: 'unknown' },
  stakeholder: { value: null, provenance: 'unknown' },
  pilotExperience: { value: null, provenance: 'unknown' },
  constraints: [], assumptions: [], gaps: [],
};

function review(overrides: Partial<PortfolioBootstrapContextReview> = {}): PortfolioBootstrapContextReview {
  return {
    id: 'review-1', sessionId: 'session-1', status: 'confirmed', version: 2,
    draft: initial, confirmedSnapshot: initial, effectiveContext: initial,
    hasPendingCorrection: false,
    sourceCompanyContext: null, draftSourceCompanyContext: null,
    confirmedSourceCompanyContext: null, effectiveSourceCompanyContext: null,
    draftProvenance: [], confirmedProvenance: [], effectiveProvenance: [], sourceOutdated: false,
    confirmedBy: 'user-1', confirmedAt: '2026-11-07T00:00:00.000Z',
    createdAt: '2026-11-07T00:00:00.000Z', updatedAt: '2026-11-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('usePortfolioBootstrapContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContext.mockResolvedValue(review());
  });

  it('CA03 loads E1 only after a Bootstrap session exists and re-enters the persisted review', async () => {
    const hook = renderHook(({ sessionId }) => usePortfolioBootstrapContext(sessionId), { initialProps: { sessionId: null as string | null } });
    expect(hook.result.current.status).toBe('idle');
    expect(getContext).not.toHaveBeenCalled();

    hook.rerender({ sessionId: 'session-1' });
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    expect(getContext).toHaveBeenCalledWith('session-1');
    expect(hook.result.current.review?.effectiveContext?.situation.value).toBe('Situación confirmada');
  });

  it('CA03 keeps one Idempotency-Key across a failed draft request and its retry', async () => {
    const corrected = { ...initial, situation: { value: 'Corrección local', provenance: 'user_declared' as const, sourceRef: { kind: 'user_input' as const } } };
    saveDraft.mockRejectedValueOnce(new Error('Respuesta perdida')).mockResolvedValueOnce(review({
      status: 'draft', version: 3, draft: corrected, hasPendingCorrection: true,
    }));
    const hook = renderHook(() => usePortfolioBootstrapContext('session-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => { await expect(hook.result.current.saveDraft(corrected)).rejects.toThrow('Respuesta perdida'); });
    const firstKey = saveDraft.mock.calls[0]?.[2];
    await act(async () => { await hook.result.current.retry(); });

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft.mock.calls[1]?.[2]).toBe(firstKey);
    expect(saveDraft.mock.calls[0]?.[1]).toMatchObject({ expectedVersion: 2, context: corrected });
    expect(hook.result.current.review?.hasPendingCorrection).toBe(true);
  });

  it('CA04 preserves confirmedSnapshot/effectiveContext while a corrected draft awaits reconfirmation', async () => {
    const correction = { ...initial, situation: { value: 'Borrador corregido', provenance: 'user_declared' as const, sourceRef: { kind: 'user_input' as const } } };
    saveDraft.mockResolvedValue(review({
      status: 'draft', version: 3, draft: correction, confirmedSnapshot: initial,
      effectiveContext: initial, hasPendingCorrection: true,
    }));
    const hook = renderHook(() => usePortfolioBootstrapContext('session-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => { await hook.result.current.saveDraft(correction); });

    expect(hook.result.current.review?.draft.situation.value).toBe('Borrador corregido');
    expect(hook.result.current.review?.confirmedSnapshot?.situation.value).toBe('Situación confirmada');
    expect(hook.result.current.review?.effectiveContext?.situation.value).toBe('Situación confirmada');
  });

  it('CA04 confirms with the latest expectedVersion and a stable key without advancing E2', async () => {
    confirmContext.mockResolvedValue(review({ version: 4, status: 'confirmed', hasPendingCorrection: false }));
    getContext.mockResolvedValue(review({ version: 3, status: 'draft', hasPendingCorrection: true }));
    const hook = renderHook(() => usePortfolioBootstrapContext('session-1'));
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));

    await act(async () => { await hook.result.current.confirm(); });

    expect(confirmContext).toHaveBeenCalledWith('session-1', 3, expect.stringMatching(/^portfolio-context-confirm:/));
    expect(hook.result.current.review?.status).toBe('confirmed');
  });
});
