import { describe, it, expect } from 'vitest';
import { enrichProject, isSameTeamMember } from '../AppContext';

describe('enrichProject — equipo', () => {
  it('usa `teamMembers` del backend cuando no viene `team`', () => {
    const project = enrichProject({
      id: 'p1',
      ownerId: 'u1',
      teamMembers: [
        { id: 't1', userId: 'u1', role: 'OWNER', status: 'ACTIVE' },
        { id: 't2', userId: 'u2', role: 'VIEWER', status: 'PENDING' },
      ],
    }, null);
    expect(project.team.map(member => [member.userId, member.role, member.status])).toEqual([['u1', 'Owner', 'Activo'], ['u2', 'Viewer', 'Pendiente']]);
  });

  it('`team` local sigue teniendo prioridad', () => {
    const project = enrichProject({ id: 'p1', team: [{ id: 'm1', name: 'Ana', role: 'editor' }], teamMembers: [{ id: 't1' }, { id: 't2' }] }, null);
    expect(project.team).toHaveLength(1);
  });
});

describe('isSameTeamMember', () => {
  it('reconoce por userId aunque la fila venga sin email', () => {
    expect(isSameTeamMember({ userId: 'u1', email: '' }, { id: 'u1', email: 'a@x.com' })).toBe(true);
  });
  it('reconoce por email sin distinguir mayúsculas', () => {
    expect(isSameTeamMember({ email: 'A@x.com' }, { email: 'a@x.com' })).toBe(true);
  });
  it('dos filas sin email ni userId no son la misma persona', () => {
    expect(isSameTeamMember({ userId: undefined, email: '' }, { id: undefined, email: '' })).toBe(false);
    expect(isSameTeamMember({ userId: 'u2', email: '' }, { id: 'u1', email: 'a@x.com' })).toBe(false);
  });
});

describe('enrichProject — sponsor', () => {
  const sponsor = { id: 's1', email: 's@x.com', role: 'sponsor' } as any;

  it('la fila propia del sponsor (VIEWER en el backend) es su patrocinio; pendiente = invitada', () => {
    const project = enrichProject({
      id: 'p1',
      teamMembers: [
        { id: 't1', userId: 'o1', role: 'OWNER', status: 'ACTIVE' },
        { id: 't2', userId: 's1', role: 'VIEWER', status: 'PENDING' },
      ],
    }, sponsor);
    expect(project.team.map(member => [member.role, member.status])).toEqual([['Owner', 'Activo'], ['Sponsor', 'Enviado']]);
  });

  it('para otro rol de plataforma, VIEWER sigue siendo Viewer', () => {
    const project = enrichProject({ id: 'p1', teamMembers: [{ id: 't2', userId: 's1', role: 'VIEWER', status: 'ACTIVE' }] }, { ...sponsor, role: 'owner' });
    expect(project.team[0].role).toBe('Viewer');
  });
});
