/**
 * projectAccess.test.ts — qué controles de escritura se pintan en una iniciativa.
 *
 * Espeja backend/modules/projects/project-team-access.ts: el swarm de roles en producción
 * encontró que un Viewer (y el sponsor, y el Portfolio Lead) veían todos los controles de
 * edición de Step 0–4 y el backend les respondía 403.
 */
import { describe, it, expect } from 'vitest';
import { canOpenProject, getProjectAccess } from '../projectAccess';
import type { TeamMember } from '../../context/AppContext';

const persona = (role: string) => ({ id: 'u1', email: 'ana@x.com', role: role as never });
const fila = (role: TeamMember['role'], status: TeamMember['status'] = 'Activo'): TeamMember => ({
  id: 't1', userId: 'u1', name: 'Ana', email: '', role, status, initials: 'AN',
});
const conEquipo = (...team: TeamMember[]) => ({ team });

describe('getProjectAccess', () => {
  it('admin edita y gestiona el equipo aunque no sea del equipo', () => {
    expect(getProjectAccess(persona('admin'), conEquipo())).toEqual({ canEdit: true, canManageTeam: true, readOnlyReason: null });
  });

  it('mentor edita pero no gestiona el equipo', () => {
    expect(getProjectAccess(persona('mentor'), conEquipo(fila('Owner', 'Activo')))).toMatchObject({ canEdit: true, canManageTeam: false });
  });

  it('Owner activo edita y gestiona; Editor activo edita y no gestiona', () => {
    expect(getProjectAccess(persona('owner'), conEquipo(fila('Owner')))).toMatchObject({ canEdit: true, canManageTeam: true });
    expect(getProjectAccess(persona('owner'), conEquipo(fila('Editor')))).toMatchObject({ canEdit: true, canManageTeam: false });
  });

  it('Viewer del equipo queda en sólo lectura y se le dice por qué', () => {
    const access = getProjectAccess(persona('owner'), conEquipo(fila('Viewer')));
    expect(access.canEdit).toBe(false);
    expect(access.canManageTeam).toBe(false);
    expect(access.readOnlyReason).toMatch(/Sólo lectura: tu rol en el equipo es Viewer/);
  });

  it('Editor con la invitación pendiente todavía no edita', () => {
    expect(getProjectAccess(persona('owner'), conEquipo(fila('Editor', 'Pendiente')))).toMatchObject({ canEdit: false });
  });

  it('el sponsor (fila Sponsor) sólo lee', () => {
    const access = getProjectAccess(persona('sponsor'), conEquipo(fila('Sponsor')));
    expect(access.canEdit).toBe(false);
    expect(access.readOnlyReason).toMatch(/Sponsor/);
  });

  it('el Portfolio Lead que no es del equipo sólo lee', () => {
    const access = getProjectAccess(persona('portfolio_lead'), conEquipo({ ...fila('Owner'), userId: 'otro' }));
    expect(access.canEdit).toBe(false);
    expect(access.readOnlyReason).toMatch(/Portfolio Lead/);
  });

  it('el Portfolio Lead tampoco edita cuando el equipo no vino cargado', () => {
    expect(getProjectAccess(persona('portfolio_lead'), conEquipo()).canEdit).toBe(false);
  });

  it('sin equipo cargado no se le quitan los controles a un participante (el backend decide)', () => {
    expect(getProjectAccess(persona('owner'), conEquipo()).canEdit).toBe(true);
  });

  it('reconoce a la persona por email cuando la fila no trae userId', () => {
    const access = getProjectAccess(persona('owner'), conEquipo({ ...fila('Viewer'), userId: undefined, email: 'ANA@x.com' }));
    expect(access.canEdit).toBe(false);
  });
});

describe('canOpenProject', () => {
  it('el Portfolio Lead abre la iniciativa que le devolvió el backend aunque no esté en el equipo', () => {
    // Producción, 2026-10-10: el lead veía "Acceso no habilitado… tu perfil sponsor".
    expect(canOpenProject(persona('portfolio_lead'), conEquipo())).toBe(true);
    expect(canOpenProject(persona('portfolio_lead'), conEquipo(fila('Viewer')), 'step')).toBe(true);
    expect(canOpenProject(persona('portfolio_lead'), null)).toBe(false);
  });

  it('el sponsor sólo abre la portada, con la invitación enviada o activa', () => {
    expect(canOpenProject(persona('sponsor'), conEquipo(fila('Sponsor', 'Enviado')))).toBe(true);
    expect(canOpenProject(persona('sponsor'), conEquipo(fila('Sponsor', 'Activo')), 'step')).toBe(false);
    expect(canOpenProject(persona('sponsor'), conEquipo())).toBe(false);
  });

  it('un miembro del equipo abre con la invitación activa', () => {
    expect(canOpenProject(persona('owner'), conEquipo(fila('Editor')))).toBe(true);
    expect(canOpenProject(persona('owner'), conEquipo(fila('Editor', 'Pendiente')))).toBe(false);
    expect(canOpenProject(persona('owner'), conEquipo())).toBe(false);
  });
});
