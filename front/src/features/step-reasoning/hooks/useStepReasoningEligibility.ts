import { useEffect, useState } from 'react';
import { isStepReasoningCopilotCandidate } from '../../../app/services/featureFlags';
import { getStepReasoningEligibility } from '../services/stepReasoningClient';

/** The browser only reflects the backend decision; it does not inspect identity. */
export function useStepReasoningEligibility(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isStepReasoningCopilotCandidate()) {
      setEnabled(false);
      return () => { cancelled = true; };
    }

    void getStepReasoningEligibility()
      .then((eligibility) => {
        if (!cancelled) setEnabled(eligibility.enabled && eligibility.mode === 'qa_stub');
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });

    return () => { cancelled = true; };
  }, []);

  return enabled;
}
