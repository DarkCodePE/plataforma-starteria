// Swarm de roles en producción (2026-10-10): el rol del equipo no limitaba nada en /projects/:id.
import { describe, expect, it, vi } from 'vitest';
import { assertProjectTeamAccess, requireProjectTeamAccess, type ProjectTeamNeed } from '../project-team-access';

const check = (platformRole: string, teamRole: string | null, need: ProjectTeamNeed, isAssignedPortfolioLead = false) => {
  try {
    assertProjectTeamAccess({ platformRole, teamRole, isAssignedPortfolioLead, need });
    return 'ok';
  } catch (err) {
    return (err as { code: string }).code;
  }
};

describe('assertProjectTeamAccess', () => {
  it.each([
    ['OWNER', 'read', 'ok'], ['OWNER', 'write', 'ok'], ['OWNER', 'manage', 'ok'],
    ['EDITOR', 'read', 'ok'], ['EDITOR', 'write', 'ok'], ['EDITOR', 'manage', 'PROJECT_OWNER_REQUIRED'],
    ['VIEWER', 'read', 'ok'], ['VIEWER', 'write', 'PROJECT_TEAM_ROLE_REQUIRED'], ['VIEWER', 'manage', 'PROJECT_OWNER_REQUIRED'],
  ] as const)('%s en el equipo · %s → %s', (teamRole, need, expected) => {
    expect(check('participante', teamRole, need)).toBe(expected);
  });

  it('el rol de plataforma no sube el del equipo: un sponsor VIEWER no escribe', () => {
    expect(check('sponsor', 'VIEWER', 'write')).toBe('PROJECT_TEAM_ROLE_REQUIRED');
  });

  it('fuera del equipo: el Portfolio Lead asignado sólo lee; el resto, nada', () => {
    expect(check('portfolio_lead', null, 'read', true)).toBe('ok');
    expect(check('portfolio_lead', null, 'write', true)).toBe('PROJECT_TEAM_ACCESS_REQUIRED');
    expect(check('portfolio_lead', null, 'manage', true)).toBe('PROJECT_TEAM_ACCESS_REQUIRED');
    expect(check('participante', null, 'read')).toBe('PROJECT_ACCESS_DENIED');
  });

  it('una invitación pendiente lee, pero no escribe ni gestiona hasta aceptarla', () => {
    const pending = (teamRole: string, need: ProjectTeamNeed) => {
      try {
        assertProjectTeamAccess({ platformRole: 'participante', teamRole, teamStatus: 'PENDING', isAssignedPortfolioLead: false, need });
        return 'ok';
      } catch (err) {
        return (err as { code: string }).code;
      }
    };
    expect(pending('EDITOR', 'read')).toBe('ok');
    expect(pending('EDITOR', 'write')).toBe('TEAM_INVITATION_PENDING');
    expect(pending('OWNER', 'manage')).toBe('TEAM_INVITATION_PENDING');
  });

  it('admin pasa siempre; mentor lee y escribe pero no gestiona el equipo', () => {
    expect(check('admin', null, 'manage')).toBe('ok');
    expect(check('mentor', null, 'write')).toBe('ok');
    expect(check('mentor', null, 'manage')).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('requireProjectTeamAccess', () => {
  const prisma = (teamRole: string | null) => ({
    teamMember: { findFirst: vi.fn().mockResolvedValue(teamRole ? { role: teamRole } : null) },
    initiativeGovernance: { findUnique: vi.fn().mockResolvedValue(null) },
  }) as any;
  const run = async (db: any, need: ProjectTeamNeed, param = 'id') => {
    const next = vi.fn();
    await requireProjectTeamAccess(db, need, param)({ params: { [param]: 'p1' }, user: { id: 'u1', role: 'participante' } } as any, {} as any, next);
    return next.mock.calls[0]?.[0];
  };

  it('lee el rol del equipo del proyecto del parámetro indicado', async () => {
    const db = prisma('EDITOR');
    expect(await run(db, 'write', 'projectId')).toBeUndefined();
    expect(db.teamMember.findFirst).toHaveBeenCalledWith({ where: { projectId: 'p1', userId: 'u1' }, select: { role: true, status: true } });
  });

  it('pasa el error a next en vez de lanzar', async () => {
    expect(await run(prisma('VIEWER'), 'manage')).toMatchObject({ code: 'PROJECT_OWNER_REQUIRED' });
  });
});
