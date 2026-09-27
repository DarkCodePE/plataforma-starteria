import { describe, expect, it, vi } from 'vitest';
import { PortfolioHomeReadService } from '../portfolio-home.read-service';

function makePrisma(fronts: any[] = [], reading: any | null = null) {
  const strategicFrontFindMany = vi.fn().mockResolvedValue(fronts);
  const portfolioBootstrapSessionFindFirst = vi.fn().mockResolvedValue(
    reading ? { readings: [reading] } : null,
  );

  return {
    strategicFront: { findMany: strategicFrontFindMany },
    portfolioBootstrapSession: { findFirst: portfolioBootstrapSessionFindFirst },
    spies: { strategicFrontFindMany, portfolioBootstrapSessionFindFirst },
  };
}

function front(overrides: any = {}) {
  return {
    id: 'front-1',
    name: 'Growth',
    status: 'active',
    priority: 'Alta',
    strategicObjective: 'Move the business signal',
    mainKpi: 'Revenue',
    horizon: 'Q4',
    sponsor: 'Sponsor label',
    challenges: [],
    ...overrides,
  };
}

function challenge(overrides: any = {}) {
  return {
    id: 'challenge-1',
    title: 'Reduce friction',
    status: 'publicado',
    challengeOwner: 'Challenge owner',
    selectedPeople: [],
    initiativeMetas: [],
    ...overrides,
  };
}

function initiativeMeta(project: any, overrides: any = {}) {
  return {
    projectId: project?.id ?? 'project-1',
    strategicFrontId: 'front-1',
    challengeId: 'challenge-1',
    estimatedContribution: 'alto',
    alignmentNotes: 'aligned',
    ...overrides,
    project,
  };
}

function project(overrides: any = {}) {
  return {
    id: 'project-1',
    name: 'Initiative one',
    status: 'IN_PROGRESS',
    currentStep: 1,
    step0Status: 'COMPLETED',
    owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
    attentionItems: [],
    decisionRequests: [],
    _count: { evidence: 2 },
    ...overrides,
  };
}

describe('PortfolioHomeReadService', () => {
  const actor = { actorUserId: 'user-1', permissions: new Set<any>() };

  it('composes an authorized Strategic Framing projection with the governed organization only once', async () => {
    const projection = { getProjection: vi.fn().mockResolvedValue({ availability: 'available', totalStateCount: 1, items: [], hasMore: false }) } as any;
    const result = await new PortfolioHomeReadService(makePrisma(), projection).getHome(actor, {
      status: 'available',
      context: {
        actorUserId: 'user-1', authSessionId: 'sid-1', organizationId: 'org-authorized',
        authoritySource: 'scoped', validatedAt: new Date(),
      },
    });

    expect(result.strategicFraming.status).toBe('available');
    expect(projection.getProjection).toHaveBeenCalledOnce();
    expect(projection.getProjection).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-authorized',
      authorizedContext: expect.objectContaining({ organizationId: 'org-authorized' }),
    }));
  });

  it.each([
    ['no_context', { status: 'no_context' }],
    ['context_selection_required', { status: 'context_selection_required' }],
    ['not_authorized', { status: 'not_authorized' }],
  ] as const)('does not query Strategic Framing for %s', async (_name, resolution) => {
    const projection = { getProjection: vi.fn() } as any;
    const result = await new PortfolioHomeReadService(makePrisma(), projection).getHome(actor, resolution);
    expect(result.strategicFraming).toEqual({ status: resolution.status });
    expect(projection.getProjection).not.toHaveBeenCalled();
  });

  it('distinguishes an authorized empty projection from unavailable', async () => {
    const projection = { getProjection: vi.fn().mockResolvedValue({ availability: 'available', totalStateCount: 0, items: [], hasMore: false }) } as any;
    const result = await new PortfolioHomeReadService(makePrisma(), projection).getHome(actor, {
      status: 'available',
      context: {
        actorUserId: 'user-1', authSessionId: 'sid-1', organizationId: 'org-1',
        authoritySource: 'global', validatedAt: new Date(),
      },
    });
    expect(result.strategicFraming.status).toBe('empty');
  });

  it('localizes a genuine Strategic Framing technical failure and preserves canonical Home', async () => {
    const projection = { getProjection: vi.fn().mockRejectedValue(new Error('db down')) } as any;
    const result = await new PortfolioHomeReadService(makePrisma(), projection).getHome(actor, {
      status: 'available',
      context: {
        actorUserId: 'user-1', authSessionId: 'sid-1', organizationId: 'org-1',
        authoritySource: 'global', validatedAt: new Date(),
      },
    });
    expect(result.strategicUnits).toEqual([]);
    expect(result.strategicFraming).toEqual({ status: 'unavailable' });
  });

  it('composes StrategicFront → Challenge → Initiative and PortfolioReading', async () => {
    const prisma = makePrisma(
      [front({ challenges: [challenge({ initiativeMetas: [initiativeMeta(project())] })] })],
      {
        summary: 'Portfolio summary',
        nextBestAction: 'Review the initiative',
        homeState: 'HOME_A',
        publishedAt: new Date('2026-09-19T10:00:00.000Z'),
        primaryAttentionItems: [],
      },
    );

    const result = await new PortfolioHomeReadService(prisma).getHome('user-1');

    expect(result.strategicUnits).toHaveLength(1);
    expect(result.strategicUnits[0].challenges[0].initiatives[0].initiativeId).toBe('project-1');
    expect(result.portfolioReading).toMatchObject({
      summary: 'Portfolio summary',
      strategicUnitCount: 1,
      activeInitiativeCount: 1,
      source: 'portfolio_reading',
    });
    expect(result.recommendations[0]).toMatchObject({
      recommendation: 'Review the initiative',
      requiresHumanConfirmation: true,
    });
  });

  it('returns a stable empty read model for an empty portfolio', async () => {
    const result = await new PortfolioHomeReadService(makePrisma()).getHome('user-1');

    expect(result.strategicUnits).toEqual([]);
    expect(result.attention).toEqual([]);
    expect(result.pendingDecisions).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.portfolioReading.source).toBe('unavailable');
  });

  it('preserves challenges without initiatives and derives invitation visibility factually', async () => {
    const result = await new PortfolioHomeReadService(makePrisma([
      front({
        challenges: [
          challenge(),
          challenge({
            id: 'challenge-2',
            selectedPeople: [{
              id: 'inv-1',
              value: 'person@example.com',
              invitationStatus: 'sent',
              targetType: 'challenge_only',
            }],
          }),
          challenge({
            id: 'challenge-3',
            selectedPeople: [{
              id: 'inv-2',
              value: 'other@example.com',
              invitationStatus: 'declined',
              targetType: 'challenge_only',
            }],
          }),
        ],
      }),
    ])).getHome('user-1');

    expect(result.strategicUnits[0].challenges.map((item) => item.activationVisibility)).toEqual([
      'no_invitation',
      'invitation_pending',
      'invitation_terminal',
    ]);
    expect(result.strategicUnits[0].initiativeSummary.total).toBe(0);
  });

  it('includes only open DecisionRequests without an associated Decision', async () => {
    const pending = {
      id: 'request-pending',
      status: 'pending',
      decision: null,
      authorityUser: { id: 'authority-1', name: 'Authority', email: 'authority@example.com' },
      decisionPackageSnapshotJson: { requestedDecision: 'scale' },
      readinessSnapshotJson: { evidenceCount: 2 },
      recommendationSnapshotJson: { recommendation: 'scale' },
    };
    const resolved = {
      id: 'request-resolved',
      status: 'resolved',
      decision: { id: 'decision-1' },
      authorityUser: { id: 'authority-2', name: 'Other authority' },
    };

    const result = await new PortfolioHomeReadService(makePrisma([
      front({ challenges: [challenge({ initiativeMetas: [initiativeMeta(project({ decisionRequests: [pending, resolved] }))] })] }),
    ])).getHome('user-1');

    expect(result.pendingDecisions).toHaveLength(1);
    expect(result.pendingDecisions[0]).toMatchObject({
      requestId: 'request-pending',
      decisionId: null,
      requestedDecision: 'scale',
      decisionAuthority: { id: 'authority-1' },
    });
  });

  it('keeps expected contribution separate and null when observed/attributed are unavailable', async () => {
    const result = await new PortfolioHomeReadService(makePrisma([
      front({ challenges: [challenge({ initiativeMetas: [initiativeMeta(project())] })] }),
    ])).getHome('user-1');

    expect(result.strategicUnits[0].challenges[0].initiatives[0].contributionSummary).toEqual({
      expected: 'alto',
      observed: null,
      attributed: null,
      derivationSource: 'legacy-derived',
    });
  });

  it('does not infer Decision Authority from Sponsor', async () => {
    const result = await new PortfolioHomeReadService(makePrisma([
      front({ sponsor: 'Sponsor label' }),
    ])).getHome('user-1');

    expect(result.governance.sponsors).toEqual([
      expect.objectContaining({ label: 'Sponsor label', source: 'legacy-derived' }),
    ]);
    expect(result.governance.decisionAuthorities).toEqual([]);
  });

  it('is read-only: it calls only the two read methods and no domain mutation', async () => {
    const prisma = makePrisma([]);
    const forbidden = ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'];
    for (const model of ['project', 'teamMember', 'step', 'initiativeCycle', 'decision', 'challengeInvitation', 'initiativePortfolioMeta']) {
      (prisma as any)[model] = Object.fromEntries(forbidden.map((method) => [method, vi.fn(() => {
        throw new Error(`forbidden mutation: ${model}.${method}`);
      })]));
    }

    await new PortfolioHomeReadService(prisma).getHome('user-1');

    expect(prisma.spies.strategicFrontFindMany).toHaveBeenCalledOnce();
    expect(prisma.spies.portfolioBootstrapSessionFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1' },
    }));
    for (const model of ['project', 'teamMember', 'step', 'initiativeCycle', 'decision', 'challengeInvitation', 'initiativePortfolioMeta']) {
      expect(Object.values((prisma as any)[model]).every((method: any) => method.mock.calls.length === 0)).toBe(true);
    }
  });
});
