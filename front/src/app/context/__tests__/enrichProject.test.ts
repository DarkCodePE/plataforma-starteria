import { describe, it, expect } from 'vitest';
import { enrichProject } from '../AppContext';

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
