import { AppError } from '../../shared/errors/AppError';
import { resolveStepReasoningProviderMode } from './qa-stub';

const QA_USER_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export type StepReasoningQaConfig =
  | { enabled: false; userId: null }
  | { enabled: true; userId: string };

export function validateStepReasoningRuntimeConfig(): StepReasoningQaConfig {
  const rawEnabled = process.env.STEP_REASONING_COPILOT_ENABLED;
  if (rawEnabled !== undefined && rawEnabled !== 'true' && rawEnabled !== 'false') {
    throw new Error('STEP_REASONING_COPILOT_ENABLED must be true or false.');
  }
  if (rawEnabled !== 'true') return { enabled: false, userId: null };

  if (resolveStepReasoningProviderMode() !== 'qa_stub') {
    throw new Error('Step reasoning QA can only run with STEP_REASONING_PROVIDER_MODE=qa_stub.');
  }
  const allowlist = (process.env.STEP_REASONING_QA_USER_IDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (allowlist.length !== 1 || !QA_USER_ID_PATTERN.test(allowlist[0])) {
    throw new Error('Step reasoning QA requires exactly one valid synthetic user ID.');
  }
  return { enabled: true, userId: allowlist[0] };
}

export function assertStepReasoningQaEnabled(userId: string): void {
  const config = validateStepReasoningRuntimeConfig();
  if (!config.enabled) {
    throw AppError.notFound('Funcionalidad', 'STEP_REASONING_DISABLED');
  }
  if (config.userId !== userId) {
    throw AppError.forbidden('Esta cuenta no está habilitada para el QA del razonador.', 'STEP_REASONING_QA_ACCOUNT_REQUIRED');
  }
}

