/* ------------------------------------------------------------------ */
/*  featureFlags.ts - Read-only feature flag utility (TASK-009, ADR-005) */
/*                                                                      */
/*  V1 is intentionally minimal: a single env-driven flag for the PDF   */
/*  auto-rellenado capability. Per-user whitelisting lives in the       */
/*  backend (TASK-009 plan §15); the frontend only reads.               */
/* ------------------------------------------------------------------ */

/**
 * Returns whether a feature flag is enabled for the current build / user.
 *
 * Currently only `feature.pdfAutofill` is supported. Defaults to `false`
 * in production. To enable in staging/local, set:
 *   VITE_FEATURE_PDF_AUTOFILL=true
 *
 * The `userId` parameter is accepted to match the public API documented in
 * TASK-009 §5, but is not used in V1 — server-side whitelist handling will
 * be wired in a follow-up. // TODO(TASK-009-phase-2): per-user whitelist
 */
export function isEnabled(flagId: string, _userId?: string): boolean {
  if (flagId === 'feature.pdfAutofill') {
    const raw = readFlagEnv('VITE_FEATURE_PDF_AUTOFILL');
    return raw === 'true' || raw === '1';
  }
  if (flagId === 'feature.portfolioCopilot') {
    const raw = readFlagEnv('VITE_PORTFOLIO_COPILOT_ENABLED');
    return raw === 'true' || raw === '1';
  }
  if (flagId === 'feature.stepReasoningCopilot') {
    const enabled = readFlagEnv('VITE_STEP_REASONING_COPILOT_ENABLED');
    return enabled === 'true' || enabled === '1';
  }
  return false;
}

function readFlagEnv(key: string): string | undefined {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return viteEnv?.[key] ?? (typeof process !== 'undefined' ? process.env[key] : undefined);
}

/** Convenience helper for the PDF autofill flag (most-used path). */
export const isPdfAutofillEnabled = (userId?: string): boolean =>
  isEnabled('feature.pdfAutofill', userId);

/** Portfolio Copilot (copilot-first vertical). Default off; see docs/implementation/copilot-first-rollout-plan.md. */
export const isPortfolioCopilotEnabled = (userId?: string): boolean =>
  isEnabled('feature.portfolioCopilot', userId);

/** Coarse build gate only. Effective authorization is always returned by the backend. */
export const isStepReasoningCopilotCandidate = (): boolean =>
  isEnabled('feature.stepReasoningCopilot');
