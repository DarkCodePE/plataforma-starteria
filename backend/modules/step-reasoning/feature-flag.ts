import { AppError } from '../../shared/errors/AppError';

export function assertStepReasoningQaEnabled(userId: string): void {
  if (process.env.STEP_REASONING_COPILOT_ENABLED !== 'true') {
    throw AppError.notFound('Funcionalidad', 'STEP_REASONING_DISABLED');
  }
  const allowlist = (process.env.STEP_REASONING_QA_USER_IDS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowlist.includes(userId)) {
    throw AppError.forbidden('Esta cuenta no está habilitada para el QA del razonador.', 'STEP_REASONING_QA_ACCOUNT_REQUIRED');
  }
}

