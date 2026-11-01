import { afterEach, describe, expect, it } from 'vitest';
import { assertStepReasoningQaEnabled, validateStepReasoningRuntimeConfig } from '../feature-flag';

describe('Step reasoning server-side QA flag', () => {
  const previousEnabled = process.env.STEP_REASONING_COPILOT_ENABLED;
  const previousUsers = process.env.STEP_REASONING_QA_USER_IDS;
  const previousProvider = process.env.STEP_REASONING_PROVIDER_MODE;

  afterEach(() => {
    if (previousEnabled === undefined) delete process.env.STEP_REASONING_COPILOT_ENABLED;
    else process.env.STEP_REASONING_COPILOT_ENABLED = previousEnabled;
    if (previousUsers === undefined) delete process.env.STEP_REASONING_QA_USER_IDS;
    else process.env.STEP_REASONING_QA_USER_IDS = previousUsers;
    if (previousProvider === undefined) delete process.env.STEP_REASONING_PROVIDER_MODE;
    else process.env.STEP_REASONING_PROVIDER_MODE = previousProvider;
  });

  it('fails closed when disabled or when the actor is not allow-listed', () => {
    delete process.env.STEP_REASONING_COPILOT_ENABLED;
    expect(() => assertStepReasoningQaEnabled('user-qa')).toThrowError(expect.objectContaining({ code: 'STEP_REASONING_DISABLED' }));
    process.env.STEP_REASONING_COPILOT_ENABLED = 'true';
    process.env.STEP_REASONING_QA_USER_IDS = 'user-qa';
    process.env.STEP_REASONING_PROVIDER_MODE = 'qa_stub';
    expect(() => assertStepReasoningQaEnabled('other-user')).toThrowError(expect.objectContaining({ code: 'STEP_REASONING_QA_ACCOUNT_REQUIRED' }));
    expect(() => assertStepReasoningQaEnabled('user-qa')).not.toThrow();
  });

  it('rejects multiple identities and a live provider at runtime', () => {
    process.env.STEP_REASONING_COPILOT_ENABLED = 'true';
    process.env.STEP_REASONING_PROVIDER_MODE = 'qa_stub';
    process.env.STEP_REASONING_QA_USER_IDS = 'user-qa,user-two';
    expect(() => validateStepReasoningRuntimeConfig()).toThrow(/exactly one/);

    process.env.STEP_REASONING_QA_USER_IDS = 'user-qa';
    process.env.STEP_REASONING_PROVIDER_MODE = 'live_llm';
    expect(() => validateStepReasoningRuntimeConfig()).toThrow(/only run.*qa_stub/);
  });
});
