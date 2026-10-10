// El sponsor aceptaba la invitación sólo en el navegador: no había endpoint (swarm de roles, 2026-10-10).
import { describe, expect, it, vi } from 'vitest';
import { TeamMemberStatus } from '@prisma/client';
import { UserService } from '../user.service';

const makeService = (member: Record<string, unknown> | null) => {
  const prisma = {
    teamMember: {
      findFirst: vi.fn().mockResolvedValue(member),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...member, ...data })),
    },
  } as any;
  return { prisma, service: new UserService(prisma) };
};

describe('UserService.acceptInvitation', () => {
  it('activa la fila propia pendiente', async () => {
    const { prisma, service } = makeService({ id: 'm1', status: TeamMemberStatus.PENDING });
    const result = await service.acceptInvitation('p1', 'u1');
    expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({ where: { projectId: 'p1', userId: 'u1' } });
    expect(result.status).toBe(TeamMemberStatus.ACTIVE);
  });

  it('si ya estaba activa no escribe', async () => {
    const { prisma, service } = makeService({ id: 'm1', status: TeamMemberStatus.ACTIVE });
    await service.acceptInvitation('p1', 'u1');
    expect(prisma.teamMember.update).not.toHaveBeenCalled();
  });

  it('sin invitación propia responde 404', async () => {
    const { service } = makeService(null);
    await expect(service.acceptInvitation('p1', 'u1')).rejects.toMatchObject({ code: 'TEAM_INVITATION_NOT_FOUND' });
  });
});
