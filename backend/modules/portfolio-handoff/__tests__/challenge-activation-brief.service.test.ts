import { describe, expect, it } from 'vitest';
import { assertConfirmableActivationBriefVersion, normalizeActivationBriefEnvelope } from '../challenge-activation-brief.service';

describe('ChallengeActivationBrief service', () => {
  it('normalizes the governed PL-05 envelope without inventing sources or gaps', () => {
    expect(normalizeActivationBriefEnvelope({ intent: ' Outcome ', scope: ' Scope ' })).toEqual({
      intent: 'Outcome', scope: 'Scope', strategicContextRefs: {}, inheritedContext: {},
      constraintsSnapshot: [], knownGaps: [], sourceRefs: [], provenance: {},
    });
  });

  it('accepts a complete human-reviewable Draft and rejects a technically non-empty but incomplete one', () => {
    const complete = normalizeActivationBriefEnvelope({
      intent: 'Reduce the activation barrier', scope: 'Two related initiatives',
      strategicContextRefs: { objective: 'Improve activation', challengeId: 'challenge-1' },
      inheritedContext: { challengeProblem: 'Users stop early', expectedDeliverable: 'Prioritized recommendation', decisionToEnable: 'Choose first barrier' },
      constraintsSnapshot: [], knownGaps: ['Baseline unknown'], sourceRefs: ['source-1'], provenance: { source: 'PL05_COPILOT' },
    });
    expect(() => assertConfirmableActivationBriefVersion(complete)).not.toThrow();
    expect(() => assertConfirmableActivationBriefVersion(normalizeActivationBriefEnvelope({ intent: 'Only an intent', scope: 'Some scope' }))).toThrowError(/contexto mínimo/i);
  });
});
