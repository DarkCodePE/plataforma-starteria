import { describe, expect, it } from 'vitest';
import { projectBootstrapHome } from '../bootstrapHomeProjection';
import { makeBootstrap, makeBootstrapWithProposedMutations, makeBootstrapWithWorkItems } from '../../testing/bootstrapFixtures';

describe('projectBootstrapHome', () => {
  it.each([
    ['anchor_insufficient', 'HOME_A'],
    ['anchor_provisional', 'HOME_A'],
    ['anchor_conflicting', 'HOME_A'],
    ['anchor_sufficient', 'HOME_B'],
    ['anchor_confirmed', 'HOME_B'],
  ] as const)('maps %s to %s when there is no work intake', (anchorStatus, homeState) => {
    expect(projectBootstrapHome(makeBootstrap(anchorStatus))?.homeState).toBe(homeState);
  });

  it('keeps HOME_A primary action away from object-first labels', () => {
    const projection = projectBootstrapHome(makeBootstrap('anchor_insufficient'));

    expect(projection?.nextAction.id).toBe('complete_portfolio_anchor');
    expect(projection?.nextAction.label.toLowerCase()).not.toContain('crear frente');
    expect(projection?.nextAction.label.toLowerCase()).not.toContain('crear reto');
    expect(projection?.nextAction.label.toLowerCase()).not.toContain('step 0');
  });

  it('uses bring existing work as HOME_B next action and never routes to legacy start', () => {
    const projection = projectBootstrapHome(makeBootstrap('anchor_confirmed'));

    expect(projection?.nextAction.id).toBe('bring_existing_work');
    expect(projection?.nextAction.label).toBe('Traer trabajo existente');
    expect(JSON.stringify(projection)).not.toContain('/portfolio/iniciar');
  });

  it('maps provisional work intake to HOME_C without claiming alignment', () => {
    const projection = projectBootstrapHome(makeBootstrapWithWorkItems());

    expect(projection?.homeState).toBe('HOME_C');
    expect(projection?.nextAction.id).toBe('review_proposed_structure');
    expect(projection?.workItems[0].status).toBe('detected');
    expect(JSON.stringify(projection)).not.toContain('confirmed_alignment');
  });

  it('summarizes proposed structure without canonicalizing it', () => {
    const projection = projectBootstrapHome(makeBootstrapWithProposedMutations());

    expect(projection?.homeState).toBe('HOME_C');
    expect(projection?.analysisSummary.total).toBe(2);
    expect(projection?.analysisSummary.strategicConnections).toBe(1);
    expect(projection?.analysisSummary.advancementConditions).toBe(1);
    expect(projection?.analysisSummary.hardBlockingNow).toBe(0);
    expect(projection?.analysisSummary.reviewLater).toBe(1);
    expect(projection?.analysisSummary.carryToBrief).toBe(1);
    expect(projection?.proposedMutations.every((mutation) => mutation.status === 'proposed')).toBe(true);
    expect(JSON.stringify(projection)).not.toContain('confirmed_alignment');
  });

  it('distinguishes an explicit hard blocker from review-later gaps', () => {
    const data = makeBootstrapWithProposedMutations();
    data.proposedMutations[1] = {
      ...data.proposedMutations[1],
      proposedValue: { ...(data.proposedMutations[1].proposedValue as Record<string, unknown>), severity: 'blocking' },
    };

    const projection = projectBootstrapHome(data);

    expect(projection?.analysisSummary.hardBlockingNow).toBe(1);
    expect(projection?.analysisSummary.carryToBrief).toBe(0);
    expect(projection?.analysisSummary.reviewLater).toBe(1);
  });

  it('maps explicit no-existing-work to HOME_C-ready state without fake items', () => {
    const data = makeBootstrap('anchor_confirmed');
    data.bootstrapSession.existingWorkStatus = 'no_existing_work';
    data.bootstrapSession.bootstrapPhase = 'B3_PROVISIONAL_STRUCTURING';
    data.bootstrapSession.status = 'awaiting_structuring';

    const projection = projectBootstrapHome(data);

    expect(projection?.homeState).toBe('HOME_C');
    expect(projection?.workItems).toEqual([]);
    expect(projection?.existingWorkStatus).toBe('no_existing_work');
  });
});
