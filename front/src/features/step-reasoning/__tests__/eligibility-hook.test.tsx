import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStepReasoningEligibility } from '../hooks/useStepReasoningEligibility';
import { getStepReasoningEligibility } from '../services/stepReasoningClient';

vi.mock('../services/stepReasoningClient', () => ({
  getStepReasoningEligibility: vi.fn(),
}));

describe('useStepReasoningEligibility', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getStepReasoningEligibility).mockReset();
  });

  it('reflects an effective qa_stub authorization returned by the backend', async () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    vi.mocked(getStepReasoningEligibility).mockResolvedValue({ enabled: true, mode: 'qa_stub' });

    const { result } = renderHook(() => useStepReasoningEligibility());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('fails closed for a denied identity or an unavailable authorization endpoint', async () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    vi.mocked(getStepReasoningEligibility).mockResolvedValueOnce({ enabled: false, mode: null });
    const denied = renderHook(() => useStepReasoningEligibility());
    await waitFor(() => expect(denied.result.current).toBe(false));
    denied.unmount();

    vi.mocked(getStepReasoningEligibility).mockRejectedValueOnce(new Error('unavailable'));
    const unavailable = renderHook(() => useStepReasoningEligibility());
    await waitFor(() => expect(unavailable.result.current).toBe(false));
  });
});
