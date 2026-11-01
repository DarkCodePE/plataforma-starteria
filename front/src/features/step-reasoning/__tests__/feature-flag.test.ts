import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStepReasoningCopilotEnabled } from '../../../app/services/featureFlags';

describe('Step reasoning QA feature flag', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off by default', () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', '');
    vi.stubEnv('VITE_STEP_REASONING_QA_USER_IDS', 'user-qa');
    expect(isStepReasoningCopilotEnabled('user-qa')).toBe(false);
  });

  it('requires both the build flag and exactly one explicit QA user', () => {
    vi.stubEnv('VITE_STEP_REASONING_COPILOT_ENABLED', 'true');
    vi.stubEnv('VITE_STEP_REASONING_QA_USER_IDS', 'user-qa');
    expect(isStepReasoningCopilotEnabled('user-qa')).toBe(true);
    expect(isStepReasoningCopilotEnabled('user-other')).toBe(false);
    expect(isStepReasoningCopilotEnabled()).toBe(false);

    vi.stubEnv('VITE_STEP_REASONING_QA_USER_IDS', 'user-qa,user-two');
    expect(isStepReasoningCopilotEnabled('user-qa')).toBe(false);
  });
});
