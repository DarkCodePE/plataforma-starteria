/**
 * projectAccess.ts — qué puede hacer la persona dentro de UNA iniciativa, según su fila
 * en el equipo (TeamMember.role).
 *
 * Es el espejo de lo que pinta el front de `backend/modules/projects/project-team-access.ts`:
 *   read   → cualquier miembro, y el Portfolio Lead asignado.
 *   write  → Owner o Editor con la invitación activa (Steps, checkpoints, datos del proyecto).
 *   manage → Owner (el equipo).
 * admin pasa siempre; mentor lee y escribe, pero no gestiona el equipo.
 *
 * Como `can()`, esto decide qué se PINTA: el servidor sigue siendo quien autoriza. Antes un
 * Viewer, un sponsor o el Portfolio Lead veían todos los controles de edición y recibían 403
 * al usarlos.
 *
 * Vive fuera de AppContext a propósito: las páginas lo llaman con el proyecto que tienen en
 * mano (a veces traído por getById, no de la lista del contexto) y los tests que mockean
 * AppContext no lo pierden.
 */
import type { Project, TeamMember, User } from '../context/AppContext';

/**
 * ¿Esta fila del equipo es la persona? El equipo que manda el backend trae userId y no email;
 * el que arma el front (borradores, invitaciones) trae email.
 */
export function isSameTeamMember(member: Pick<TeamMember, 'userId' | 'email'>, person: { id?: string; email?: string }): boolean {
  if (person.id && member.userId === person.id) return true;
  return !!person.email && !!member.email && member.email.toLowerCase() === person.email.toLowerCase();
}

export interface ProjectAccess {
  /** Puede escribir el trabajo de la iniciativa: Steps, checkpoints, datos del proyecto. */
  canEdit: boolean;
  /** Puede gestionar el equipo (invitar, cambiar roles, quitar). */
  canManageTeam: boolean;
  /** Aviso para la vista de sólo lectura; `null` cuando puede editar. */
  readOnlyReason: string | null;
}

const FULL_ACCESS: ProjectAccess = { canEdit: true, canManageTeam: true, readOnlyReason: null };

export function getProjectAccess(
  user: Pick<User, 'id' | 'email' | 'role'> | null | undefined,
  project: Pick<Project, 'team'> | null | undefined,
): ProjectAccess {
  if (!user || !project) return { canEdit: false, canManageTeam: false, readOnlyReason: null };
  if (user.role === 'admin') return FULL_ACCESS;
  if (user.role === 'mentor') return { canEdit: true, canManageTeam: false, readOnlyReason: null };

  const team = Array.isArray(project.team) ? project.team : [];
  const member = team.find(item => isSameTeamMember(item, user));

  if (!member) {
    // Sin equipo cargado no hay con qué decidir (borradores locales, respuestas parciales):
    // no se le quitan los controles a quien la creó; el backend responde si no corresponde.
    if (team.length === 0 && user.role !== 'portfolio_lead' && user.role !== 'sponsor') return FULL_ACCESS;
    return {
      canEdit: false,
      canManageTeam: false,
      readOnlyReason: user.role === 'portfolio_lead'
        ? 'Sólo lectura: como Portfolio Lead revisas esta iniciativa; la edita su equipo.'
        : 'Sólo lectura: no formas parte del equipo de esta iniciativa.',
    };
  }

  const active = member.status === 'Activo';
  const canEdit = active && (member.role === 'Owner' || member.role === 'Editor');
  if (canEdit) return { canEdit: true, canManageTeam: member.role === 'Owner', readOnlyReason: null };

  return {
    canEdit: false,
    canManageTeam: false,
    readOnlyReason: !active && (member.role === 'Owner' || member.role === 'Editor')
      ? 'Sólo lectura: tu invitación al equipo todavía no está activa. Acéptala para poder editar.'
      : member.role === 'Sponsor'
        ? 'Sólo lectura: participas como Sponsor de esta iniciativa.'
        : 'Sólo lectura: tu rol en el equipo es Viewer. Para editar, pide al owner de la iniciativa que te dé rol de editor.',
  };
}
