/**
 * create-initiative-team.test.ts — ADR-023 #111.
 *
 * Pins the create-iniciativa materialization: when an iniciativa is created from a reto,
 * the reto's ChallengeTeamMember roster (real Users) is snapshotted into TeamMember rows
 * marked inheritedFromChallenge=true, deduping the owner and using skipDuplicates.
 */
import { describe, it, expect, vi } from 'vitest';
import { ProjectService } from '../project.service';

function makeTx(overrides: Record<string, any> = {}) {
  return {
    project: {
      create: vi.fn().mockResolvedValue({ id: 'newproj', steps: [], teamMembers: [], evidence: [] }),
    },
    challenge: {
      findUnique: vi.fn().mockResolvedValue({ id: 'ch1', strategicFrontId: 'sf1' }),
    },
    initiativePortfolioMeta: {
      upsert: vi.fn().mockResolvedValue({ id: 'meta1' }),
      create: vi.fn().mockResolvedValue({ id: 'meta1' }),
    },
    challengeTeamMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    teamMember: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  } as any;
}

function makePrisma(tx: any, overrides: Record<string, any> = {}) {
  return {
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) },
    challenge: { findUnique: vi.fn().mockResolvedValue({
      id: 'ch1',
      strategicFrontId: 'sf1',
      strategicFront: { organizationId: 'org-1' },
    }) },
    organizationMember: { findMany: vi.fn().mockResolvedValue([]) },
    organizationPortfolioAccessGrant: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  } as any;
}

const baseData = { name: 'Mi Iniciativa', description: 'd' } as any;

describe('ProjectService.createProject — team materialization (#111)', () => {
  it('materializes inherited TeamMembers from the reto, excluding the owner', async () => {
    const tx = makeTx({
      challengeTeamMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'owner', role: 'OWNER', status: 'ACTIVE' }, // == creating user → must be excluded
          { userId: 'u2', role: 'EDITOR', status: 'ACTIVE' },
          { userId: 'u3', role: 'VIEWER', status: 'PENDING' },
        ]),
      },
    });
    const svc = new ProjectService(makePrisma(tx));

    await svc.createProject('owner', { ...baseData, challengeId: 'ch1' });

    expect(tx.initiativePortfolioMeta.upsert).toHaveBeenCalled();
    expect(tx.teamMember.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    const data = tx.teamMember.createMany.mock.calls[0][0].data;
    // owner excluded → only u2 + u3 materialized, all marked inherited
    expect(data).toHaveLength(2);
    expect(data.map((d: any) => d.userId).sort()).toEqual(['u2', 'u3']);
    expect(data.every((d: any) => d.inheritedFromChallenge === true)).toBe(true);
    expect(data.every((d: any) => d.projectId === 'newproj')).toBe(true);
  });

  it('does not call createMany when the reto team is empty (owner-only iniciativa)', async () => {
    const tx = makeTx(); // challengeTeamMember.findMany → []
    const svc = new ProjectService(makePrisma(tx));
    await svc.createProject('owner', { ...baseData, challengeId: 'ch1' });
    expect(tx.initiativePortfolioMeta.upsert).toHaveBeenCalled();
    expect(tx.teamMember.createMany).not.toHaveBeenCalled();
  });

  it('skips reto linking + materialization entirely without challengeId', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx));
    await svc.createProject('owner', baseData);
    expect(tx.challenge.findUnique).not.toHaveBeenCalled();
    expect(tx.initiativePortfolioMeta.upsert).not.toHaveBeenCalled();
    expect(tx.teamMember.createMany).not.toHaveBeenCalled();
  });

  it('persists the actor tenant for a standalone initiative', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx, {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-owner' }) },
    }));

    await svc.createProject('owner', baseData);

    expect(tx.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-owner' }),
    }));
  });

  it('persists and authorizes the Challenge tenant for a legacy challengeId link', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx, {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-legacy' }) },
      challenge: { findUnique: vi.fn().mockResolvedValue({
        id: 'ch1',
        strategicFrontId: 'sf1',
        strategicFront: { organizationId: 'org-legacy' },
      }) },
    }));

    await svc.createProject('owner', { ...baseData, challengeId: 'ch1' });

    expect(tx.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-legacy',
        currentStep: 0,
        step0Status: 'IN_PROGRESS',
      }),
    }));
  });

  it('rejects a legacy challengeId link outside the actor tenant', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx, {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-owner' }) },
      challenge: { findUnique: vi.fn().mockResolvedValue({
        id: 'foreign-challenge',
        strategicFrontId: 'foreign-front',
        strategicFront: { organizationId: 'org-foreign' },
      }) },
    }));

    await expect(svc.createProject('owner', { ...baseData, challengeId: 'foreign-challenge' }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_RESOURCE_NOT_FOUND', statusCode: 404 });
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it('rejects a legacy challengeId when the referenced reto no longer exists', async () => {
    const tx = makeTx({ challenge: { findUnique: vi.fn().mockResolvedValue(null) } });
    const svc = new ProjectService(makePrisma(tx, {
      challenge: { findUnique: vi.fn().mockResolvedValue(null) },
    }));

    await expect(svc.createProject('owner', { ...baseData, challengeId: 'gone' }))
      .rejects.toMatchObject({ code: 'CHALLENGE_NOT_FOUND', statusCode: 404 });
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it('rejects a legacy challengeId whose tenant cannot be established', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx, {
      challenge: { findUnique: vi.fn().mockResolvedValue({
        id: 'legacy-unscoped',
        strategicFrontId: 'front-unscoped',
        strategicFront: { organizationId: null },
      }) },
    }));

    await expect(svc.createProject('owner', { ...baseData, challengeId: 'legacy-unscoped' }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_RESOURCE_NOT_FOUND', statusCode: 404 });
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it('persists the tenant and inherited roster from an authorized V2 Challenge link', async () => {
    const tx = makeTx({
      challengeTeamMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'owner', role: 'OWNER', status: 'ACTIVE' },
          { userId: 'u2', role: 'EDITOR', status: 'ACTIVE' },
        ]),
      },
    });
    const linkedChallenge = {
      id: 'ch-v2', status: 'recibiendo_iniciativas', strategicFrontId: 'sf-v2',
      type: 'exploracion', title: 'Reto V2', name: 'Reto V2', whatWeWantToMove: null,
      objective: null, successCriteria: null, description: null, challengeOwner: null,
      assignedSquad: [],
      strategicFront: {
        organizationId: 'org-1', whyNow: null, target: null, sponsor: null,
        strategicObjective: null, mainKpi: null,
      },
    };
    const svc = new ProjectService(makePrisma(tx, {
      challenge: { findUnique: vi.fn().mockResolvedValue(linkedChallenge) },
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) },
      organizationMember: { findMany: vi.fn().mockResolvedValue([]) },
      organizationPortfolioAccessGrant: { findMany: vi.fn().mockResolvedValue([]) },
    }));

    await svc.createProject('owner', { ...baseData, challengeLink: { challengeId: 'ch-v2', createdFrom: 'challenge' } });

    expect(tx.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org-1' }),
    }));
    expect(tx.teamMember.createMany).toHaveBeenCalledWith({
      data: [{
        projectId: 'newproj', userId: 'u2', role: 'EDITOR', status: 'ACTIVE',
        inheritedFromChallenge: true,
      }],
      skipDuplicates: true,
    });
  });

  it('rejects a V2 Challenge link outside the actor tenant without creating a Project', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx, {
      challenge: { findUnique: vi.fn().mockResolvedValue({
        id: 'foreign-challenge', status: 'recibiendo_iniciativas', strategicFrontId: 'foreign-front',
        assignedSquad: [], strategicFront: { organizationId: 'org-foreign' },
      }) },
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) },
      organizationMember: { findMany: vi.fn().mockResolvedValue([]) },
      organizationPortfolioAccessGrant: { findMany: vi.fn().mockResolvedValue([]) },
    }));

    await expect(svc.createProject('owner', { ...baseData, challengeLink: { challengeId: 'foreign-challenge', createdFrom: 'challenge' } }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_RESOURCE_NOT_FOUND', statusCode: 404 });
    expect(tx.project.create).not.toHaveBeenCalled();
  });

  it('rejects a V2 Challenge link whose tenant cannot be established', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx, {
      challenge: { findUnique: vi.fn().mockResolvedValue({
        id: 'v2-unscoped', status: 'recibiendo_iniciativas', strategicFrontId: 'front-unscoped',
        assignedSquad: [], strategicFront: { organizationId: null },
      }) },
    }));

    await expect(svc.createProject('owner', { ...baseData, challengeLink: { challengeId: 'v2-unscoped', createdFrom: 'challenge' } }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_RESOURCE_NOT_FOUND', statusCode: 404 });
    expect(tx.project.create).not.toHaveBeenCalled();
  });
});
