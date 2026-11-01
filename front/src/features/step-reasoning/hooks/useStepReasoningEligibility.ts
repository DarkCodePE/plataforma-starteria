import { useCallback, useEffect, useState } from 'react';
import { isStepReasoningCopilotCandidate } from '../../../app/services/featureFlags';
import { getStepReasoningEligibility } from '../services/stepReasoningClient';

export type StepReasoningEligibilityStatus =
  | 'checking'
  | 'allowed'
  | 'denied'
  | 'unavailable'
  | 'disabled';

interface StepReasoningEligibilityState {
  enabled: boolean;
  status: StepReasoningEligibilityStatus;
}

/**
 * The browser reflects the backend decision; it never authorizes a user.
 *
 * Distinguish a definitive 200/denied from an unavailable API. A failed
 * request should not permanently hide the conversation after a backend outage.
 */
export function useStepReasoningEligibilityState(): StepReasoningEligibilityState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StepReasoningEligibilityState>(() => ({
    enabled: false,
    status: isStepReasoningCopilotCandidate() ? 'checking' : 'disabled',
  }));
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!isStepReasoningCopilotCandidate()) {
      setState({ enabled: false, status: 'disabled' });
      return () => { cancelled = true; };
    }

    setState({ enabled: false, status: 'checking' });
    void getStepReasoningEligibility()
      .then(eligibility => {
        if (cancelled) return;
        const allowed = eligibility.enabled === true && eligibility.mode === 'qa_stub';
        setState({ enabled: allowed, status: allowed ? 'allowed' : 'denied' });
      })
      .catch(() => {
        if (!cancelled) setState({ enabled: false, status: 'unavailable' });
      });
    return () => { cancelled = true; };
  }, [attempt]);

  // Recover after a transient backend/network outage without requiring a full
  // reload (which can independently fail if the refresh cookie is missing).
  useEffect(() => {
    if (state.status !== 'unavailable') return;
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [state.status, retry]);

  return { ...state, retry };
}

/** Backwards-compatible boolean surface used by Steps 1-4. */
export function useStepReasoningEligibility(): boolean {
  return useStepReasoningEligibilityState().enabled;
}
