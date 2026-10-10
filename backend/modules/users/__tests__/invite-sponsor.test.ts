// La invitación de sponsor desde la iniciativa quedaba sólo en el navegador (2026-10-10): ahora se
// persiste. No hay rol de equipo SPONSOR, así que el sponsor es una fila VIEWER pendiente.
import { describe, expect, it, vi } from 'vitest';
import { TeamMemberStatus, TeamRole } from '@prisma/client';
import { UserService } from '../user.service';

const makeService = (existingUser: Record<string, unknown> | null) => {
  const prisma = {
    teamMember: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm1', ...data })),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(existingUser),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'u-new', ...data })),
    },
  } as any;
  return { prisma, service: new UserService(prisma) };
};

describe('UserService.inviteMember como Sponsor', () => {
  it('crea la fila VIEWER pendiente y, si no hay cuenta, la crea con rol sponsor', async () => {
    const { prisma, service } = makeService(null);
    const member = await service.inviteMember('p1', { email: 'sp@x.com', role: 'Sponsor' });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ role: 'sponsor', roles: ['sponsor'] });
    expect(member).toMatchObject({ projectId: 'p1', userId: 'u-new', role: TeamRole.VIEWER, status: TeamMemberStatus.PENDING });
  });

  it('a una cuenta existente no le cambia el rol de plataforma', async () => {
    const { prisma, service } = makeService({ id: 'u1', role: 'participante', roles: ['participante'] });
    const member = await service.inviteMember('p1', { email: 'ana@x.com', role: 'Sponsor' });
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(member).toMatchObject({ userId: 'u1', role: TeamRole.VIEWER });
  });

  it('un Editor sigue entrando como EDITOR con cuenta participante', async () => {
    const { prisma, service } = makeService(null);
    const member = await service.inviteMember('p1', { email: 'ed@x.com', role: 'Editor' });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ role: 'participante' });
    expect(member).toMatchObject({ role: TeamRole.EDITOR });
  });
});
