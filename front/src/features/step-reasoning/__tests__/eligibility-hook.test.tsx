import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useStepReasoningEligibility,
  useStepReasoningEligibilityState,
} from '../hooks/useStepReasoningEligibility';
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

  it('fails closed for an explicitly denied identity', async () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    vi.mocked(getStepReasoningEligibility).mockResolvedValue({ enabled: false, mode: null });

    const { result } = renderHook(() => useStepReasoningEligibilityState());
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.enabled).toBe(false);
  });

  it('surfaces transient API errors and retries without a page reload', async () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    vi.mocked(getStepReasoningEligibility)
      .mockRejectedValueOnce(new Error('502 from backend'))
      .mockResolvedValueOnce({ enabled: true, mode: 'qa_stub' });

    const { result } = renderHook(() => useStepReasoningEligibilityState());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.enabled).toBe(false);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('allowed'));
    expect(result.current.enabled).toBe(true);
    expect(getStepReasoningEligibility).toHaveBeenCalledTimes(2);
  });

  it('rechecks on browser focus after a transient outage', async () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    vi.mocked(getStepReasoningEligibility)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ enabled: true, mode: 'qa_stub' });

    const { result } = renderHook(() => useStepReasoningEligibilityState());
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.enabled).toBe(true));
  });

  it('never queries the backend when the build flag is disabled', async () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'false');
    const { result } = renderHook(() => useStepReasoningEligibilityState());
    expect(result.current.status).toBe('disabled');
    expect(result.current.enabled).toBe(false);
    expect(getStepReasoningEligibility).not.toHaveBeenCalled();
  });
});
