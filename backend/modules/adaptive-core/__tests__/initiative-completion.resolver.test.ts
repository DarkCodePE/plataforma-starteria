import { describe, expect, it } from 'vitest';
import { InitiativeCompletionResolver } from '../initiative-completion.resolver';
import type { InitiativeAlignmentInput } from '../adaptive-core.types';

function base(overrides: Partial<InitiativeAlignmentInput> = {}): InitiativeAlignmentInput {
  return {
    projectId: 'project-c2b',
    governanceMode: null,
    hasExplicitGovernanceConfig: false,
    challengeId: null,
    strategicFrontId: null,
    ...overrides,
  };
}

describe('InitiativeCompletionResolver', () => {
  const resolver = new InitiativeCompletionResolver();

  it('routes self-initiated methodological completion to owner_completed', () => {
    const alignment = resolver.resolveAlignment(base());
    const routing = resolver.routeCompletion({
      projectId: 'project-c2b',
      cycleId: 'cycle-1',
      methodologicalCompletion: true,
      alignment,
    });

    expect(alignment).toMatchObject({
      alignmentType: 'self_initiated',
      portfolioAligned: false,
      governanceMode: 'owner_governed',
    });
    expect(routing).toMatchObject({
      route: 'owner_completed',
      initiativeCompleted: false,
      portfolioReviewRequired: false,
      lifecycleProjection: 'active',
    });
  });

  it('routes portfolio-governed methodological completion to portfolio_presented', () => {
    const alignment = resolver.resolveAlignment(base({ governanceMode: 'portfolio_governed', hasExplicitGovernanceConfig: true }));
    const routing = resolver.routeCompletion({
      projectId: 'project-c2b',
      cycleId: 'cycle-1',
      methodologicalCompletion: true,
      alignment,
    });

    expect(alignment).toMatchObject({
      alignmentType: 'portfolio_initiative',
      portfolioAligned: true,
      governanceMode: 'portfolio_governed',
    });
    expect(routing).toMatchObject({
      route: 'portfolio_presented',
      initiativeCompleted: false,
      portfolioReviewRequired: true,
      lifecycleProjection: 'presented',
    });
  });

  it('classifies challenge-assigned initiatives as portfolio-aligned', () => {
    const alignment = resolver.resolveAlignment(base({ challengeId: 'challenge-1', strategicFrontId: 'front-1' }));

    expect(alignment).toMatchObject({
      alignmentType: 'challenge_assigned',
      portfolioAligned: true,
      governanceMode: 'portfolio_governed',
      sourceChallengeId: 'challenge-1',
      sourcePortfolioContextId: 'front-1',
    });
  });

  it('does not infer self_initiated when explicit portfolio governance exists without challenge', () => {
    const alignment = resolver.resolveAlignment(base({ governanceMode: 'portfolio_governed', hasExplicitGovernanceConfig: true }));

    expect(alignment.alignmentType).toBe('portfolio_initiative');
    expect(alignment.portfolioAligned).toBe(true);
  });

  it('does not mark currentStep 4 without confirmed Step4 as methodologically complete', () => {
    const alignment = resolver.resolveAlignment(base());
    const routing = resolver.routeCompletion({
      projectId: 'project-c2b',
      cycleId: 'cycle-1',
      methodologicalCompletion: false,
      alignment,
    });

    expect(routing.methodologicalCompletion).toBe(false);
    expect(routing.lifecycleProjection).toBe('active');
    expect(routing.initiativeCompleted).toBe(false);
    expect(routing.portfolioReviewRequired).toBe(false);
  });
});
