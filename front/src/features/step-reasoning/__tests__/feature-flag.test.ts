import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStepReasoningCopilotCandidate } from '../../../app/services/featureFlags';

describe('Step reasoning frontend rollout flag', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off by default and never evaluates user identity in the browser', () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', '');
    expect(isStepReasoningCopilotCandidate()).toBe(false);
  });

  it('only permits the frontend to ask the backend for effective eligibility', () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    expect(isStepReasoningCopilotCandidate()).toBe(true);
  });
});
