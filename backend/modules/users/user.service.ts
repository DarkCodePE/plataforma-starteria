import { PrismaClient, TeamRole, TeamMemberStatus } from '@prisma/client';
import { rolesForUser } from '../../shared/authz/permissions';
import { AppError } from '../../shared/errors/AppError';
import { User, Role } from '../../shared/types';
import { UpdateProfileInput, InviteMemberInput } from './user.schemas';

// La API recibe 'Owner' | 'Editor' | 'Viewer' (user.schemas.ts); el enum de Prisma es OWNER | EDITOR | VIEWER.
// Pasarlo crudo daba 500 al invitar o cambiar de rol.
export function toTeamRole(role: string): TeamRole {
  const upper = role.toUpperCase();
  if (upper === TeamRole.OWNER || upper === TeamRole.EDITOR || upper === TeamRole.VIEWER) return upper as TeamRole;
  throw AppError.badRequest(`Rol de equipo desconocido: ${role}`, 'INVALID_TEAM_ROLE');
}

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw AppError.notFound('Usuario', 'USER_NOT_FOUND', { hint: 'Verifica el correo o el ID.' });
    }

    return user as unknown as User;
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return user as unknown as User;
  }

  /**
   * ADR-029: lista de usuarios para la administración de roles.
   *
   * Devuelve `roles` (el conjunto) además de `role`, porque la pantalla administra
   * el conjunto. Selecciona campos EXPLÍCITOS: devolver la fila entera de Prisma
   * filtraría el hash de contraseña y el estado de bloqueo de cuenta — es el mismo
   * defecto que ya apareció en `updatePlatformRole` y que su test fija.
   */
  async listUsers(limit = 200): Promise<Array<{
    id: string; name: string; email: string; role: Role; roles: Role[]; initials: string;
  }>> {
    const users = await this.prisma.user.findMany({
      take: Math.min(Math.max(limit, 1), 500),
      orderBy: [{ name: 'asc' }],
      select: { id: true, name: true, email: true, role: true, roles: true, initials: true },
    });

    // Fase 1: una fila sin migrar tiene `roles` vacío. Se normaliza aquí para que la
    // UI nunca pinte un usuario "sin roles" cuando en realidad tiene su rol escalar.
    return users.map((u) => ({ ...u, roles: [...rolesForUser(u)] }));
  }

  /**
   * ADR-028: asigna un rol de plataforma. Es la operación más sensible del sistema
   * porque concede privilegios, así que sólo la alcanza `requireRole('admin')` en el
   * router y además:
   *
   * - un admin NO puede cambiar su propio rol (evita la auto-degradación que dejaría
   *   el sistema sin ningún admin);
   * - al cambiarlo se revocan los refresh tokens del usuario objetivo, porque `refresh`
   *   relee `user.role` de la base y sin revocar el cambio no aterriza hasta que el
   *   usuario decida renovar.
   *
   * Queda un desfase residual: el access token en curso sigue siendo válido hasta que
   * expire (`JWT_EXPIRES_IN`, 15 min por defecto). Es la misma propiedad que ADR-004 ya
   * documentaba para cualquier cambio de rol.
   */
  /**
   * ADR-028: asignar UN rol. Se conserva por compatibilidad y delega en la
   * versión de conjunto — un rol es el conjunto de un elemento.
   */
  async updatePlatformRole(actorId: string, targetUserId: string, role: Role): Promise<User> {
    return this.updatePlatformRoles(actorId, targetUserId, [role]);
  }

  /**
   * ADR-029: asignar el CONJUNTO de roles de plataforma.
   *
   * Es lo que hace posible pertenecer a las dos superficies con un solo login:
   * `['participante','portfolio_lead']` conserva el dashboard y añade el portafolio.
   *
   * Escribe las DOS columnas de la fase 1. `role` (escalar) recibe el primero del
   * conjunto y queda como rol PRIMARIO: sirve de etiqueta de presentación y de
   * respaldo para las filas sin migrar. Mientras exista `role` hay dos fuentes de
   * verdad, así que este método es el ÚNICO sitio que las escribe — mantenerlas
   * coherentes desde un solo punto es lo que impide que se desincronicen (#160
   * retira la columna y con ella este acoplamiento).
   */
  async updatePlatformRoles(actorId: string, targetUserId: string, roles: Role[]): Promise<User> {
    const conjunto = [...new Set(roles)];
    if (conjunto.length === 0) {
      throw AppError.badRequest(
        'Un usuario necesita al menos un rol de plataforma.',
        'EMPTY_ROLE_SET',
        { hint: 'Envía al menos un rol en `roles`.' },
      );
    }

    if (actorId === targetUserId) {
      throw AppError.forbidden(
        'No puedes cambiar tu propio rol de plataforma.',
        'CANNOT_CHANGE_OWN_ROLE',
        { hint: 'Pídeselo a otro administrador.' },
      );
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw AppError.notFound('Usuario', 'USER_NOT_FOUND', { hint: 'Verifica el ID.' });
    }

    // `select` explícito, NO la fila entera: devolverla filtra `passwordHash`,
    // `googleId` y el estado de bloqueo de cuenta en la respuesta HTTP.
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      // Las DOS columnas, en la misma escritura: `role` es el primario (etiqueta
      // + respaldo de fase 1) y `roles` es la autorización real. Escribirlas
      // juntas es lo que impide que se desincronicen mientras coexistan (#160).
      data: { role: conjunto[0], roles: conjunto },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: true,
        initials: true,
        skills: true,
        cohortId: true,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return updated as unknown as User;
  }

  async getTeam(projectId: string) {
    const members = await this.prisma.teamMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, initials: true } } },
    });

    return members;
  }

  async inviteMember(projectId: string, data: InviteMemberInput) {
    const existing = await this.prisma.teamMember.findFirst({
      where: { projectId, user: { email: data.email } },
    });

    if (existing) {
      throw AppError.conflict('Este usuario ya es miembro del equipo.', 'TEAM_MEMBER_ALREADY_EXISTS', { hint: 'Quizás quieras cambiar su rol en lugar de agregarlo.' });
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      const initials = (data.name || data.email)
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      user = await this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash: '',
          name: data.name || data.email.split('@')[0],
          initials,
          // ADR-029: las dos columnas de la fase 1, para que ninguna fila nazca sin `roles`.
          role: 'participante',
          roles: ['participante'],
          skills: [],
        },
      });
    }

    const member = await this.prisma.teamMember.create({
      data: {
        projectId,
        userId: user.id,
        role: toTeamRole(data.role),
        status: TeamMemberStatus.PENDING,
      },
    });

    return member;
  }

  async updateMemberRole(projectId: string, memberId: string, newRole: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario sea parte del equipo.' });
    }

    const role = toTeamRole(newRole);
    if (member.role === TeamRole.OWNER && role !== TeamRole.OWNER) {
      throw AppError.badRequest('No se puede quitar el rol de owner.', 'CANNOT_DEMOTE_OWNER', { hint: 'Transfiere primero el ownership a otro miembro.' });
    }

    const updated = await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role },
    });

    return updated;
  }

  async removeMember(projectId: string, memberId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw AppError.notFound('Miembro del equipo', 'TEAM_MEMBER_NOT_FOUND', { hint: 'Verifica que el usuario sea parte del equipo.' });
    }

    if (member.role === TeamRole.OWNER) {
      throw AppError.badRequest('No se puede eliminar al owner del proyecto.', 'CANNOT_REMOVE_OWNER', { hint: 'Transfiere primero el ownership a otro miembro.' });
    }

    await this.prisma.teamMember.delete({ where: { id: memberId } });
  }
}
