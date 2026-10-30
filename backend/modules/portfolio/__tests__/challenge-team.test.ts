/**
 * challenge-team.test.ts — ADR-023 unified reto-scoped team model.
 *
 * Pins the PortfolioService team operations:
 *  - ChallengeTeamMember CRUD + the (challengeId,userId) findFirst-guard (#109)
 *  - resolveInitiativeTeam owner/label/inherited derivation (#110)
 *  - per-iniciativa override upsert + the owner-removal guard (#114)
 *  - upsertInitiativeMeta strips the derived team cache fields (#113)
 *  - syncInitiativeProgress derives teamMembers/teamOwner/teamLabel (#113)
 */
import { describe, it, expect, vi } from 'vitest';
import { PortfolioService } from '../portfolio.service';
import { AppError } from '../../../shared/errors/AppError';
import { syncInitiativeProgress } from '../initiative-progress';

function makePrisma(overrides: Record<string, any> = {}) {
  const prisma: any = {
    challenge: { findUnique: vi.fn().mockResolvedValue({ id: 'ch1', status: 'activo_interno', strategicFrontId: 'front1', strategicFront: { id: 'front1', organizationId: 'org1' } }) },
    project: { findUnique: vi.fn().mockResolvedValue({ id: 'p1', organizationId: 'org1' }) },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', organizationId: 'org1' }) },
    organizationMember: { findFirst: vi.fn().mockResolvedValue(null) },
    challengeTeamMember: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ id: 'ctm1' }),
      create: vi.fn().mockResolvedValue({ id: 'ctm1', challengeId: 'ch1', userId: 'u1', role: 'EDITOR', status: 'ACTIVE' }),
      update: vi.fn().mockResolvedValue({ id: 'ctm1', role: 'EDITOR' }),
      delete: vi.fn().mockResolvedValue({ id: 'ctm1' }),
    },
    teamMember: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ id: 'tm1', role: 'EDITOR' }),
      upsert: vi.fn().mockResolvedValue({ id: 'tm1', userId: 'u1', role: 'EDITOR' }),
      delete: vi.fn().mockResolvedValue({ id: 'tm1' }),
    },
    ...overrides,
  };
  prisma.$transaction = vi.fn(async (run: (tx: any) => Promise<unknown>) => run(prisma));
  return prisma;
}

describe('PortfolioService — ChallengeTeamMember CRUD (#109)', () => {
  it('lists the reto team', async () => {
    const prisma = makePrisma({
      challengeTeamMember: { findMany: vi.fn().mockResolvedValue([{ id: 'ctm1', role: 'OWNER' }]) },
    });
    const svc = new PortfolioService(prisma);
    const res = await svc.listChallengeTeam('ch1');
    expect(res).toHaveLength(1);
    expect(prisma.challengeTeamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { challengeId: 'ch1' } }),
    );
  });

  it('throws NotFound listing a team for a missing reto', async () => {
    const prisma = makePrisma({ challenge: { findUnique: vi.fn().mockResolvedValue(null) } });
    const svc = new PortfolioService(prisma);
    await expect(svc.listChallengeTeam('ghost')).rejects.toBeInstanceOf(AppError);
  });

  it('adds a member with userId (defaults role/status)', async () => {
    const prisma = makePrisma();
    const svc = new PortfolioService(prisma);
    await svc.addChallengeTeamMember('ch1', { userId: 'u1' });
    expect(prisma.challengeTeamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ challengeId: 'ch1', userId: 'u1', role: 'VIEWER', status: 'ACTIVE' }),
      }),
    );
  });

  it('adds a free-text label member (userId null)', async () => {
    const prisma = makePrisma();
    const svc = new PortfolioService(prisma);
    await svc.addChallengeTeamMember('ch1', { label: 'Área de Riesgos', role: 'EDITOR' });
    expect(prisma.challengeTeamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ label: 'Área de Riesgos', userId: null, role: 'EDITOR' }) }),
    );
  });

  it('enforces (challengeId,userId) uniqueness via findFirst-guard', async () => {
    const prisma = makePrisma({
      challengeTeamMember: {
        findFirst: vi.fn().mockResolvedValue({ id: 'dup' }),
        create: vi.fn(),
      },
    });
    const svc = new PortfolioService(prisma);
    await expect(svc.addChallengeTeamMember('ch1', { userId: 'u1' })).rejects.toBeInstanceOf(AppError);
    expect(prisma.challengeTeamMember.create).not.toHaveBeenCalled();
  });

  it('updates role/status; throws NotFound when missing', async () => {
    const ok = makePrisma();
    const svc = new PortfolioService(ok);
    await svc.updateChallengeTeamMember('ctm1', { role: 'OWNER' });
    expect(ok.challengeTeamMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ctm1' }, data: { role: 'OWNER' } }),
    );

    const missing = makePrisma({ challengeTeamMember: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(new PortfolioService(missing).updateChallengeTeamMember('x', { role: 'OWNER' })).rejects.toBeInstanceOf(AppError);
  });

  it('removes a member; throws NotFound when missing', async () => {
    const ok = makePrisma();
    await new PortfolioService(ok).removeChallengeTeamMember('ctm1');
    expect(ok.challengeTeamMember.delete).toHaveBeenCalledWith({ where: { id: 'ctm1' } });

    const missing = makePrisma({ challengeTeamMember: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(new PortfolioService(missing).removeChallengeTeamMember('x')).rejects.toBeInstanceOf(AppError);
  });
});

describe('PortfolioService — resolveInitiativeTeam (#110)', () => {
  it('derives owner, inherited count and label', async () => {
    const prisma = makePrisma({
      teamMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'owner', role: 'OWNER', status: 'ACTIVE', inheritedFromChallenge: false, user: { name: 'Ana' } },
          { userId: 'u2', role: 'EDITOR', status: 'ACTIVE', inheritedFromChallenge: true, user: { name: 'Beto' } },
          { userId: 'u3', role: 'VIEWER', status: 'ACTIVE', inheritedFromChallenge: true, user: { name: 'Cira' } },
        ]),
      },
    });
    const res = await new PortfolioService(prisma).resolveInitiativeTeam('p1');
    expect(res.owner).toBe('owner');
    expect(res.inheritedCount).toBe(2);
    expect(res.label).toBe('Equipo de 3 (2 heredados)');
  });

  it('throws NotFound for a missing project', async () => {
    const prisma = makePrisma({ project: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(new PortfolioService(prisma).resolveInitiativeTeam('ghost')).rejects.toBeInstanceOf(AppError);
  });
});

describe('PortfolioService — initiative team override (#114)', () => {
  it('upserts a TeamMember override (inheritedFromChallenge=false)', async () => {
    const prisma = makePrisma();
    await new PortfolioService(prisma).upsertInitiativeTeamMember('p1', 'u1', { role: 'EDITOR' });
    expect(prisma.teamMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_userId: { projectId: 'p1', userId: 'u1' } },
        create: expect.objectContaining({ inheritedFromChallenge: false, role: 'EDITOR' }),
      }),
    );
  });

  it('rejects upsert for a non-existent user', async () => {
    const prisma = makePrisma({ user: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(new PortfolioService(prisma).upsertInitiativeTeamMember('p1', 'ghost', {})).rejects.toBeInstanceOf(AppError);
  });

  it('removes a non-owner override', async () => {
    const prisma = makePrisma();
    await new PortfolioService(prisma).removeInitiativeTeamMember('p1', 'u1');
    expect(prisma.teamMember.delete).toHaveBeenCalled();
  });

  it('refuses to remove the OWNER', async () => {
    const prisma = makePrisma({
      teamMember: { findUnique: vi.fn().mockResolvedValue({ id: 'tm1', role: 'OWNER' }), delete: vi.fn() },
    });
    await expect(new PortfolioService(prisma).removeInitiativeTeamMember('p1', 'owner')).rejects.toBeInstanceOf(AppError);
    expect(prisma.teamMember.delete).not.toHaveBeenCalled();
  });
});

describe('PortfolioService.upsertInitiativeMeta — strips derived team fields (#113)', () => {
  it('never persists client-sent teamMembers/teamOwner/teamLabel', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'meta1' });
    const prisma = makePrisma({
      initiativePortfolioMeta: { findUnique: vi.fn().mockResolvedValue(null), upsert },
      pdfFieldProposal: { findMany: vi.fn().mockResolvedValue([]) },
    });
    await new PortfolioService(prisma).upsertInitiativeMeta('p1', {
      challengeId: 'ch1',
      mentor: 'Ana',
      teamMembers: ['hacker'],
      teamOwner: 'spoof',
      teamLabel: 'spoofed',
    } as any);

    const arg = upsert.mock.calls[0][0];
    expect(arg.create).not.toHaveProperty('teamMembers');
    expect(arg.create).not.toHaveProperty('teamOwner');
    expect(arg.create).not.toHaveProperty('teamLabel');
    expect(arg.update).not.toHaveProperty('teamMembers');
    expect(arg.create.mentor).toBe('Ana');
  });
});

describe('syncInitiativeProgress — derives the team cache (#113)', () => {
  it('writes teamMembers/teamOwner/teamLabel alongside status', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      initiativePortfolioMeta: {
        findMany: vi.fn().mockResolvedValue([{ id: 'm1' }]),
        updateMany,
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({
          step0Status: 'COMPLETED',
          steps: [{ number: 1, status: 'APPROVED' }, { number: 2, status: 'IN_PROGRESS' }],
        }),
      },
      teamMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'owner', role: 'OWNER', status: 'ACTIVE', inheritedFromChallenge: false, user: { name: 'Ana', email: 'a@co' } },
          { userId: 'u2', role: 'EDITOR', status: 'ACTIVE', inheritedFromChallenge: true, user: { name: 'Beto', email: 'b@co' } },
        ]),
      },
    } as any;

    await syncInitiativeProgress(prisma, 'p1');
    const data = updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('en_step_2');
    expect(data.teamOwner).toBe('Ana');
    expect(data.teamLabel).toBe('Equipo de 2 (1 heredado)');
    expect(data.teamMembers).toHaveLength(2);
    expect(data.teamMembers[1]).toMatchObject({ userId: 'u2', inherited: true });
  });
});
