export type ReleaseMetadata = {
  sourceSha: string;
  version: string;
  flags: {
    PORTFOLIO_ENTRY_RUNTIME_MODE: 'live' | 'deterministic';
    SEMANTIC_E1_ENABLED: boolean;
    PORTFOLIO_GOAL_E2_LEDGER_ENABLED: boolean;
    PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED: boolean;
    PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED: boolean;
    HANDOFF_EMAIL_TRANSPORT_MODE: 'disabled' | 'sandbox' | 'pilot';
    HANDOFF_EMAIL_PILOT_ENABLED: boolean;
  };
};

function portfolioEntryRuntimeMode(): 'live' | 'deterministic' {
  const value = process.env.PORTFOLIO_ENTRY_RUNTIME_MODE || 'live';
  if (value === 'live' || value === 'deterministic') return value;
  throw new Error('PORTFOLIO_ENTRY_RUNTIME_MODE must be live or deterministic');
}

function booleanFlag(name: string): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function releaseSha(): string {
  const value = process.env.STARTERIA_RELEASE_SHA?.trim();
  if (!value) return 'unknown';
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error('STARTERIA_RELEASE_SHA must be a full lowercase 40-character commit SHA');
  }
  return value;
}

function handoffMode(): 'disabled' | 'sandbox' | 'pilot' {
  const value = process.env.HANDOFF_EMAIL_TRANSPORT_MODE || 'disabled';
  if (value === 'disabled' || value === 'sandbox' || value === 'pilot') return value;
  throw new Error('HANDOFF_EMAIL_TRANSPORT_MODE must be disabled, sandbox or pilot');
}

export function getReleaseMetadata(): ReleaseMetadata {
  return {
    sourceSha: releaseSha(),
    version: process.env.STARTERIA_RELEASE_VERSION?.trim() || '0.0.0-dev',
    flags: {
      PORTFOLIO_ENTRY_RUNTIME_MODE: portfolioEntryRuntimeMode(),
      SEMANTIC_E1_ENABLED: booleanFlag('SEMANTIC_E1_ENABLED'),
      PORTFOLIO_GOAL_E2_LEDGER_ENABLED: booleanFlag('PORTFOLIO_GOAL_E2_LEDGER_ENABLED'),
      PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED: booleanFlag('PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED'),
      PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED: booleanFlag('PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED'),
      HANDOFF_EMAIL_TRANSPORT_MODE: handoffMode(),
      HANDOFF_EMAIL_PILOT_ENABLED: booleanFlag('HANDOFF_EMAIL_PILOT_ENABLED'),
    },
  };
}
