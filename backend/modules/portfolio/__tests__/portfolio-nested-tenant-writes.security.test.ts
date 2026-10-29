import { describe, expect, it, vi } from 'vitest';
import { PortfolioService } from '../portfolio.service';

const orgByFront: Record<string, string | null> = { 'front-a': 'org-a', 'front-b': 'org-b' };
const frontByChallenge: Record<string, string> = { 'ch-a': 'front-a', 'ch-b': 'front-b' };
const orgByProject: Record<string, string | null> = { 'p-a': 'org-a', 'p-b': 'org-b', 'p-legacy': null };
const orgByUser: Record<string, string | null> = { 'user-a': 'org-a', 'user-b': 'org-b' };

function makePrisma() {
  const writes = {
    frontCreate: vi.fn(),
    frontUpdate: vi.fn(),
    challengeCreate: vi.fn(),
    challengeTeamCreate: vi.fn(),
    teamUpsert: vi.fn(),
    metaUpsert: vi.fn(),
    overlapCreate: vi.fn(),
    outputUpsert: vi.fn(),
    governanceUpsert: vi.fn(),
  };
  const prisma: any = {
    $transaction: vi.fn(async (run: (tx: any) => Promise<unknown>) => run(prisma)),
    strategicFront: {
      findUnique: vi.fn(async ({ where }: any) => where.id in orgByFront
        ? { id: where.id, organizationId: orgByFront[where.id] }
        : null),
      update: writes.frontUpdate,
      create: writes.frontCreate,
    },
    challenge: {
      findUnique: vi.fn(async ({ where }: any) => {
        const frontId = frontByChallenge[where.id];
        return frontId ? {
          id: where.id,
          strategicFrontId: frontId,
          status: 'activo_interno',
          strategicFront: { id: frontId, organizationId: orgByFront[frontId] },
        } : null;
      }),
      create: writes.challengeCreate,
    },
    project: {
      findUnique: vi.fn(async ({ where }: any) => where.id in orgByProject
        ? { id: where.id, organizationId: orgByProject[where.id] }
        : null),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => where.id in orgByUser
        ? { id: where.id, organizationId: orgByUser[where.id] }
        : null),
    },
    organizationMember: { findFirst: vi.fn(async () => null) },
    challengeTeamMember: {
      findFirst: vi.fn(async () => null),
      create: writes.challengeTeamCreate,
    },
    teamMember: { upsert: writes.teamUpsert },
    initiativePortfolioMeta: {
      findUnique: vi.fn(async () => null),
      upsert: writes.metaUpsert,
    },
    pdfFieldProposal: { findMany: vi.fn(async () => []) },
    initiativeGovernance: { upsert: writes.governanceUpsert },
    initiativeOverlap: { create: writes.overlapCreate },
    executiveOutput: { upsert: writes.outputUpsert },
  };
  return { prisma, writes };
}

async function expectTenantDenial(run: () => Promise<unknown>, write: ReturnType<typeof vi.fn>) {
  await expect(run()).rejects.toMatchObject({ code: 'PORTFOLIO_RESOURCE_NOT_FOUND' });
  expect(write).not.toHaveBeenCalled();
}

describe('KAN-189 — IDs secundarios respetan el tenant dentro de la escritura', () => {
  it('deriva el tenant del frente de la autoridad servidor y rechaza org/owner B', async () => {
    const first = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(first.prisma).createStrategicFront(
        { name: 'Injected B', organizationId: 'org-b', ownerId: 'user-a' },
        { organizationId: 'org-a', actorUserId: 'user-a' },
      ),
      first.writes.frontCreate,
    );

    const second = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(second.prisma).createStrategicFront(
        { name: 'Injected owner', organizationId: 'org-a', ownerId: 'user-b' },
        { organizationId: 'org-a', actorUserId: 'user-a' },
      ),
      second.writes.frontCreate,
    );
  });

  it('no permite mover un frente de A a B mediante organizationId adulterado', async () => {
    const { prisma, writes } = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(prisma).updateStrategicFront('front-a', { organizationId: 'org-b' }),
      writes.frontUpdate,
    );
  });

  it('no permite owner/sponsor de B al crear un reto de A', async () => {
    const { prisma, writes } = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(prisma).createChallenge('front-a', { title: 'Reto A', ownerId: 'user-b' }),
      writes.challengeCreate,
    );
  });

  it('no vincula un usuario de B al equipo de reto o iniciativa de A', async () => {
    const first = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(first.prisma).addChallengeTeamMember('ch-a', { userId: 'user-b' }),
      first.writes.challengeTeamCreate,
    );

    const second = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(second.prisma).upsertInitiativeTeamMember('p-a', 'user-b', { role: 'EDITOR' }),
      second.writes.teamUpsert,
    );
  });

  it('no vincula una iniciativa de A con reto/front de B', async () => {
    const { prisma, writes } = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(prisma).upsertInitiativeMeta('p-a', { challengeId: 'ch-b' } as any),
      writes.metaUpsert,
    );
  });

  it('no crea overlap ni output de un reto A usando proyectos de B', async () => {
    const first = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(first.prisma).createOverlap('ch-a', { initiativeAId: 'p-a', initiativeBId: 'p-b' }),
      first.writes.overlapCreate,
    );

    const second = makePrisma();
    await expectTenantDenial(
      () => new PortfolioService(second.prisma).createExecutiveOutput('ch-a', { projectId: 'p-b' }),
      second.writes.outputUpsert,
    );
  });

  it('no asigna governance de una iniciativa A a un usuario de B', async () => {
    const { prisma, writes } = makePrisma();
    await expectTenantDenial(
      () => (new PortfolioService(prisma) as any).assignInitiativeGovernance('p-a', 'user-b'),
      writes.governanceUpsert,
    );
  });

  it('permite las mismas asociaciones cuando todos los IDs pertenecen a A', async () => {
    const { prisma, writes } = makePrisma();
    writes.challengeTeamCreate.mockResolvedValue({ id: 'member-a' });
    await new PortfolioService(prisma).addChallengeTeamMember('ch-a', { userId: 'user-a' });
    expect(writes.challengeTeamCreate).toHaveBeenCalledOnce();
  });
});
