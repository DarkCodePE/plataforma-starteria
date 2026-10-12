import { describe, expect, it } from 'vitest';
import { derivePortfolioAnchorFromPortfolioSetup } from './portfolio-setup-anchor-derivation';

describe('114F Bootstrap anchor', () => {
  it('keeps provisional and suggested context reviewable with field provenance, without legacy sourceSnapshot', () => {
    const derived = derivePortfolioAnchorFromPortfolioSetup({ id: 'snapshot-1', sessionId: 'session-1',
      carriedContext: {
        criticalReading: { text: 'Portfolio may be overloaded', sourceRef: '114d-1', origin: 'AI_INFERRED', truthClass: 'CONFIRMED_REPRESENTATION' },
        decisionFrame: { text: 'Review capacity', sourceRef: '114d-1', origin: 'USER_DECLARED', truthClass: 'PROVISIONAL_USER_CONTEXT' },
        firstMoveSuggestion: { text: 'Inspect work', sourceRef: '114d-1', origin: 'AI_SUGGESTED', truthClass: 'PROVISIONAL_USER_CONTEXT' },
      }, openItems: [],
    });
    expect(derived.status).toBe('anchor_provisional');
    expect(derived.businessSignalStatus).toBe('unknown');
    expect(derived.decisionToEnable).toBe('Review capacity');
    expect(JSON.stringify(derived.sourceRefs)).toContain('AI_SUGGESTED');
    expect(JSON.stringify(derived.sourceRefs)).toContain('PROVISIONAL_USER_CONTEXT');
    expect(JSON.stringify(derived.sourceRefs)).not.toContain('sourceSnapshot');
  });
});
