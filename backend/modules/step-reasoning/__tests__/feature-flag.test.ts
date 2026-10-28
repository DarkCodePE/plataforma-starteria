import { afterEach, describe, expect, it } from 'vitest';
import { assertStepReasoningQaEnabled } from '../feature-flag';

describe('Step reasoning server-side QA flag', () => {
  const previousEnabled = process.env.STEP_REASONING_COPILOT_ENABLED;
  const previousUsers = process.env.STEP_REASONING_QA_USER_IDS;

  afterEach(() => {
    if (previousEnabled === undefined) delete process.env.STEP_REASONING_COPILOT_ENABLED;
    else process.env.STEP_REASONING_COPILOT_ENABLED = previousEnabled;
    if (previousUsers === undefined) delete process.env.STEP_REASONING_QA_USER_IDS;
    else process.env.STEP_REASONING_QA_USER_IDS = previousUsers;
  });

  it('fails closed when disabled or when the actor is not allow-listed', () => {
    delete process.env.STEP_REASONING_COPILOT_ENABLED;
    expect(() => assertStepReasoningQaEnabled('user-qa')).toThrowError(expect.objectContaining({ code: 'STEP_REASONING_DISABLED' }));
    process.env.STEP_REASONING_COPILOT_ENABLED = 'true';
    process.env.STEP_REASONING_QA_USER_IDS = 'user-qa';
    expect(() => assertStepReasoningQaEnabled('other-user')).toThrowError(expect.objectContaining({ code: 'STEP_REASONING_QA_ACCOUNT_REQUIRED' }));
    expect(() => assertStepReasoningQaEnabled('user-qa')).not.toThrow();
  });
});
