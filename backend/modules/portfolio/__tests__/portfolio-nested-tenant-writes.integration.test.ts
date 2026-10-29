import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PortfolioService } from '../portfolio.service';
import { resolvePortfolioWriteScope } from '../portfolio-scope';

const enabled = process.env.KAN189_DB_E2E === '1';
const databaseUrl = process.env.E2E_DATABASE_URL;

if (enabled) {
  const parsed = databaseUrl ? new URL(databaseUrl) : null;
  const databaseName = parsed?.pathname.replace(/^\//, '');
  if (!parsed || databaseName !== 'starteria_e2e' || !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('KAN-189 requires disposable local PostgreSQL database starteria_e2e.');
  }
}

const suite = enabled ? describe.sequential : describe.skip;
const prisma = new PrismaClient(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
const service = new PortfolioService(prisma);

const ids = {
  orgA: 'kan189-org-a', orgB: 'kan189-org-b',
  userA: 'kan189-user-a', userB: 'kan189-user-b',
  frontA: 'kan189-front-a', frontB: 'kan189-front-b',
  challengeA: 'kan189-challenge-a', challengeB: 'kan189-challenge-b',
  projectA1: 'kan189-project-a1', projectA2: 'kan189-project-a2', projectB: 'kan189-project-b',
};

const tenantBPII = {
  name: 'KAN189 Tenant B Secret Person',
  email: 'kan189-private-b@starteria.test',
};

async function cleanup(): Promise<void> {
  const projectIds = [ids.projectA1, ids.projectA2, ids.projectB];
  const challengeIds = [ids.challengeA, ids.challengeB];
  await prisma.executiveOutput.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.initiativeOverlap.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.initiativePortfolioMeta.deleteMany({
    where: { OR: [{ projectId: { in: projectIds } }, { challengeId: { in: challengeIds } }] },
  });
  await prisma.initiativeGovernance.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.teamMember.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.challengeTeamMember.deleteMany({ where: { challengeId: { in: challengeIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.challenge.deleteMany({ where: { id: { in: challengeIds } } });
  await prisma.strategicFront.deleteMany({ where: { id: { in: [ids.frontA, ids.frontB] } } });
  await prisma.organizationPortfolioAccessGrant.deleteMany({
    where: { OR: [{ userId: ids.userA }, { organizationId: { in: [ids.orgA, ids.orgB] } }] },
  });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.userA, ids.userB] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ids.orgA, ids.orgB] } } });
}

async function writeCounts(): Promise<number[]> {
  return Promise.all([
    prisma.strategicFront.count({ where: { id: { startsWith: 'kan189-' } } }),
    prisma.challenge.count({ where: { id: { in: [ids.challengeA, ids.challengeB] } } }),
    prisma.challengeTeamMember.count({ where: { challengeId: { in: [ids.challengeA, ids.challengeB] } } }),
    prisma.teamMember.count({ where: { projectId: { in: [ids.projectA1, ids.projectA2, ids.projectB] } } }),
    prisma.initiativePortfolioMeta.count({ where: { projectId: { in: [ids.projectA1, ids.projectA2, ids.projectB] } } }),
    prisma.initiativeGovernance.count({ where: { projectId: { in: [ids.projectA1, ids.projectA2, ids.projectB] } } }),
    prisma.initiativeOverlap.count({ where: { challengeId: { in: [ids.challengeA, ids.challengeB] } } }),
    prisma.executiveOutput.count({ where: { challengeId: { in: [ids.challengeA, ids.challengeB] } } }),
  ]);
}

async function expectTenantDenied(write: () => Promise<unknown>): Promise<void> {
  try {
    await write();
    throw new Error('Expected cross-tenant write to be denied');
  } catch (error: any) {
    expect(error).toMatchObject({ code: 'PORTFOLIO_RESOURCE_NOT_FOUND', statusCode: 404 });
    const publicFailure = JSON.stringify({ message: error?.message, code: error?.code, details: error?.details });
    expect(publicFailure).not.toContain(tenantBPII.name);
    expect(publicFailure).not.toContain(tenantBPII.email);
    expect(publicFailure).not.toContain(ids.orgB);
    expect(publicFailure).not.toContain(ids.userB);
  }
}

suite('KAN-189 nested Portfolio writes with PostgreSQL A/B isolation', () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.organization.createMany({
      data: [
        { id: ids.orgA, name: 'KAN189 Organization A', slug: ids.orgA },
        { id: ids.orgB, name: 'KAN189 Organization B', slug: ids.orgB },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: ids.userA, email: 'kan189-user-a@starteria.test', name: 'KAN189 User A',
          role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'KA', skills: [], organizationId: ids.orgA,
        },
        {
          id: ids.userB, email: tenantBPII.email, name: tenantBPII.name,
          role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'KB', skills: [], organizationId: ids.orgB,
        },
      ],
    });
    await prisma.strategicFront.createMany({
      data: [
        { id: ids.frontA, name: 'KAN189 Front A', organizationId: ids.orgA, ownerId: ids.userA },
        { id: ids.frontB, name: 'KAN189 Front B', organizationId: ids.orgB, ownerId: ids.userB },
      ],
    });
    await prisma.challenge.createMany({
      data: [
        { id: ids.challengeA, strategicFrontId: ids.frontA, title: 'KAN189 Challenge A', status: 'activo_interno' },
        { id: ids.challengeB, strategicFrontId: ids.frontB, title: 'KAN189 Challenge B', status: 'activo_interno' },
      ],
    });
    await prisma.project.createMany({
      data: [
        { id: ids.projectA1, name: 'KAN189 Project A1', ownerId: ids.userA, organizationId: ids.orgA },
        { id: ids.projectA2, name: 'KAN189 Project A2', ownerId: ids.userA, organizationId: ids.orgA },
        { id: ids.projectB, name: 'KAN189 Project B Secret', ownerId: ids.userB, organizationId: ids.orgB },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('rejects every documented secondary B identifier with zero writes and zero PII', async () => {
    const before = await writeCounts();
    const authorityA = { organizationId: ids.orgA, actorUserId: ids.userA };
    const attempts: Array<() => Promise<unknown>> = [
      () => service.createStrategicFront({ name: 'Injected B front', organizationId: ids.orgB, ownerId: ids.userA }, authorityA),
      () => service.createStrategicFront({ name: 'Injected B owner', organizationId: ids.orgA, ownerId: ids.userB }, authorityA),
      () => service.updateStrategicFront(ids.frontA, { organizationId: ids.orgB }),
      () => service.updateStrategicFront(ids.frontA, { ownerId: ids.userB }),
      () => service.createChallenge(ids.frontA, { title: 'Injected owner', ownerId: ids.userB }),
      () => service.createChallenge(ids.frontA, { title: 'Injected sponsor', sponsorId: ids.userB }),
      () => service.updateChallenge(ids.challengeA, { ownerId: ids.userB }),
      () => service.updateChallenge(ids.challengeA, { sponsorId: ids.userB }),
      () => service.addChallengeTeamMember(ids.challengeA, { userId: ids.userB }),
      () => service.upsertInitiativeTeamMember(ids.projectA1, ids.userB, {}),
      () => service.upsertInitiativeMeta(ids.projectA1, { challengeId: ids.challengeB }),
      () => service.upsertInitiativeMeta(ids.projectA1, { challengeId: ids.challengeA, strategicFrontId: ids.frontB }),
      () => service.assignInitiativeGovernance(ids.projectA1, ids.userB),
      () => service.createOverlap(ids.challengeA, { initiativeAId: ids.projectB, initiativeBId: ids.projectA2 }),
      () => service.createOverlap(ids.challengeA, { initiativeAId: ids.projectA1, initiativeBId: ids.projectB }),
      () => service.createExecutiveOutput(ids.challengeA, { projectId: ids.projectB }),
      () => service.createExecutiveOutput(ids.challengeA, { projectId: ids.projectA1, initiativeId: ids.projectB }),
    ];

    for (const attempt of attempts) await expectTenantDenied(attempt);

    expect(await writeCounts()).toEqual(before);
    await expect(prisma.strategicFront.findUniqueOrThrow({ where: { id: ids.frontA } }))
      .resolves.toMatchObject({ organizationId: ids.orgA, ownerId: ids.userA });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: ids.userB } }))
      .toMatchObject({ name: tenantBPII.name, email: tenantBPII.email });
  });

  it('keeps valid A/A writes working after enforcing nested tenant checks', async () => {
    await service.addChallengeTeamMember(ids.challengeA, { userId: ids.userA, role: 'VIEWER' });
    await service.upsertInitiativeTeamMember(ids.projectA1, ids.userA, { role: 'OWNER', modulePermissions: [] });
    await service.assignInitiativeGovernance(ids.projectA1, ids.userA);
    await service.createOverlap(ids.challengeA, { initiativeAId: ids.projectA1, initiativeBId: ids.projectA2 });
    const output = await service.createExecutiveOutput(ids.challengeA, { projectId: ids.projectA1 });
    await expectTenantDenied(() => service.updateExecutiveOutput(output.id, { initiativeId: ids.projectB }));

    expect(await prisma.challengeTeamMember.count({ where: { challengeId: ids.challengeA, userId: ids.userA } })).toBe(1);
    expect(await prisma.teamMember.count({ where: { projectId: ids.projectA1, userId: ids.userA } })).toBe(1);
    expect(await prisma.initiativeGovernance.count({ where: { projectId: ids.projectA1, portfolioLeadUserId: ids.userA } })).toBe(1);
    expect(await prisma.initiativeOverlap.count({ where: { challengeId: ids.challengeA } })).toBe(1);
    expect(await prisma.executiveOutput.count({ where: { challengeId: ids.challengeA, projectId: ids.projectA1 } })).toBe(1);
    expect(await prisma.executiveOutput.findUnique({ where: { id: output.id } })).toMatchObject({ initiativeId: null });
  });

  it('does not let secondary memberships or grants widen the canonical tenant', async () => {
    await prisma.organizationMember.create({
      data: { organizationId: ids.orgB, userId: ids.userA, role: 'member' },
    });

    await expect(resolvePortfolioWriteScope(prisma, { id: ids.userA, role: 'portfolio_lead' }))
      .resolves.toEqual({ all: false, organizationIds: [ids.orgA] });

    await prisma.organizationPortfolioAccessGrant.create({
      data: {
        userId: ids.userA,
        organizationId: ids.orgB,
        capability: 'portfolio:write',
        grantedByUserId: ids.userB,
      },
    });

    await expect(resolvePortfolioWriteScope(prisma, { id: ids.userA, role: 'portfolio_lead' }))
      .resolves.toEqual({ all: false, organizationIds: [ids.orgA] });
  });
});
