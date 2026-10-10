// 'Viewer' llegaba crudo al enum de Prisma (VIEWER) y el cambio de rol / la invitación daban 500.
import { describe, expect, it, vi } from 'vitest';
import { TeamRole } from '@prisma/client';
import { UserService, toTeamRole } from '../user.service';

describe('toTeamRole', () => {
  it('normaliza el rol de la API al enum', () => {
    expect(toTeamRole('Viewer')).toBe(TeamRole.VIEWER);
    expect(toTeamRole('Editor')).toBe(TeamRole.EDITOR);
    expect(toTeamRole('OWNER')).toBe(TeamRole.OWNER);
  });
  it('rechaza un rol desconocido con 400', () => {
    expect(() => toTeamRole('Sponsor')).toThrowError(expect.objectContaining({ code: 'INVALID_TEAM_ROLE' }));
  });
});

describe('UserService.updateMemberRole', () => {
  const service = (current: string) => {
    const prisma = {
      teamMember: {
        findFirst: vi.fn().mockResolvedValue({ id: 'm1', projectId: 'p1', role: current }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm1', ...data })),
      },
    } as any;
    return { prisma, svc: new UserService(prisma) };
  };

  it('guarda el rol con el valor del enum', async () => {
    const { prisma, svc } = service('VIEWER');
    await svc.updateMemberRole('p1', 'm1', 'Editor');
    expect(prisma.teamMember.update).toHaveBeenCalledWith(expect.objectContaining({ data: { role: TeamRole.EDITOR } }));
  });

  it('no deja al proyecto sin owner', async () => {
    const { svc } = service('OWNER');
    await expect(svc.updateMemberRole('p1', 'm1', 'Viewer')).rejects.toMatchObject({ code: 'CANNOT_DEMOTE_OWNER' });
  });
});
