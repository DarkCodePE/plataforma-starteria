import { afterEach, describe, expect, it } from 'vitest';

const originalEnv = { ...process.env };

describe('release metadata', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports only allowlisted non-secret release identity and effective flags', async () => {
    process.env.STARTERIA_RELEASE_SHA = '17b3e4934d3fa58adbffc398222101b621b0c8bb';
    process.env.STARTERIA_RELEASE_VERSION = '0.0.1';
    process.env.PORTFOLIO_ENTRY_RUNTIME_MODE = 'live';
    process.env.SEMANTIC_E1_ENABLED = 'false';
    process.env.PORTFOLIO_GOAL_E2_LEDGER_ENABLED = 'false';
    process.env.PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED = 'false';
    process.env.PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED = 'false';
    process.env.HANDOFF_EMAIL_TRANSPORT_MODE = 'disabled';
    process.env.HANDOFF_EMAIL_PILOT_ENABLED = 'false';
    process.env.JWT_SECRET = 'must-never-be-reported';

    const { getReleaseMetadata } = await import('../release-metadata');
    const metadata = getReleaseMetadata();

    expect(metadata).toEqual({
      sourceSha: '17b3e4934d3fa58adbffc398222101b621b0c8bb',
      version: '0.0.1',
      flags: {
        PORTFOLIO_ENTRY_RUNTIME_MODE: 'live',
        SEMANTIC_E1_ENABLED: false,
        PORTFOLIO_GOAL_E2_LEDGER_ENABLED: false,
        PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED: false,
        PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED: false,
        HANDOFF_EMAIL_TRANSPORT_MODE: 'disabled',
        HANDOFF_EMAIL_PILOT_ENABLED: false,
      },
    });
    expect(JSON.stringify(metadata)).not.toContain('must-never-be-reported');
  });

  it('fails closed for invalid release identity and boolean values', async () => {
    process.env.STARTERIA_RELEASE_SHA = 'mutable-tag';
    process.env.PORTFOLIO_GOAL_E2_LEDGER_ENABLED = 'yes';
    const { getReleaseMetadata } = await import('../release-metadata');

    expect(() => getReleaseMetadata()).toThrow(/STARTERIA_RELEASE_SHA/);
  });
});
