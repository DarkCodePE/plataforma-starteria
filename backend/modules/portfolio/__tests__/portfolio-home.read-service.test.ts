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

describe('PortfolioHomeReadService — aprendizajes (E2E Job-Driven §23)', () => {
  it('expone lo que el portfolio aprendió de las últimas decisiones', async () => {
    const learnings = [{
      decisionId: 'd1', projectId: 'p1', challengeId: 'c1', strategicFrontId: 'f1', outcome: 'scale',
      learning: 'La visibilidad reduce retrabajo', nextAction: 'Planificar el escalamiento', coverageBefore: 'sin_cobertura',
      coverageAfter: 'cobertura_suficiente', suggestedReformulation: null, decidedAt: new Date('2026-10-04T12:00:00Z'),
      project: { name: 'Tablero comercial' }, challenge: { title: 'Reducir retrabajo' },
    }];
    const prisma = {
      strategicFront: { findMany: vi.fn().mockResolvedValue([]) },
      portfolioLearning: { findMany: vi.fn().mockResolvedValue(learnings) },
    };
    const home = await new PortfolioHomeReadService(prisma as any).getHome('u1');
    expect(home.learnings).toEqual([expect.objectContaining({
      decisionId: 'd1', initiativeName: 'Tablero comercial', challengeTitle: 'Reducir retrabajo', outcome: 'scale',
      coverageAfter: 'cobertura_suficiente', decidedAt: '2026-10-04T12:00:00.000Z',
    })]);
  });

  it('sin el modelo devuelve una lista vacía', async () => {
    const home = await new PortfolioHomeReadService({ strategicFront: { findMany: vi.fn().mockResolvedValue([]) } } as any).getHome('u1');
    expect(home.learnings).toEqual([]);
  });
});
