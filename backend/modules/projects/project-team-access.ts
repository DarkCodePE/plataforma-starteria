/**
 * Project authorization for the MVP v1.2 tenant and assignment invariants.
 *
 * - Every role, including admin, is constrained to its canonical organization.
 * - Admin may operate within that tenant, never globally by role alone.
 * - Mentor requires an explicit MentorSession (or an active TeamMember row).
 * - Portfolio Lead assignment is read-only.
 * - Pending team invitations do not expose corporate Project data.
 */
import type { NextFunction, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { AppError } from '../../shared/errors/AppError';

export type ProjectTeamNeed = 'read' | 'write' | 'manage';

const WRITE_ROLES = new Set(['OWNER', 'EDITOR']);

export function assertProjectTeamAccess(input: {
  platformRole: string;
  teamRole: string | null;
  teamStatus?: string | null;
  isAssignedPortfolioLead: boolean;
  isAssignedMentor?: boolean;
  sameOrganization?: boolean;
  need: ProjectTeamNeed;
}): void {
  const {
    platformRole,
    teamRole,
    teamStatus,
    isAssignedPortfolioLead,
    isAssignedMentor = false,
    sameOrganization = true,
    need,
  } = input;

  if (!sameOrganization) {
    throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
  }
  if (platformRole === 'admin') return;

  if (platformRole === 'mentor' && isAssignedMentor) {
    if (need === 'manage') {
      throw AppError.forbidden('Solo el owner de la iniciativa puede hacer esto.', 'PROJECT_OWNER_REQUIRED');
    }
    return;
  }

  if (!teamRole) {
    if (!isAssignedPortfolioLead) throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
    if (need !== 'read') throw AppError.forbidden('Solo el equipo de la iniciativa puede avanzar sus Steps.', 'PROJECT_TEAM_ACCESS_REQUIRED');
    return;
  }
  if (teamStatus === 'PENDING') {
    throw AppError.forbidden('Tu invitacion a esta iniciativa esta pendiente.', 'TEAM_INVITATION_PENDING', {
      hint: 'Acepta la invitacion para acceder al contenido corporativo.',
    });
  }
  if (need === 'write' && !WRITE_ROLES.has(teamRole)) {
    throw AppError.forbidden('Tu rol en el equipo es de solo lectura.', 'PROJECT_TEAM_ROLE_REQUIRED', {
      hint: 'Pide al owner de la iniciativa que te de rol de editor.',
    });
  }
  if (need === 'manage' && teamRole !== 'OWNER') {
    throw AppError.forbidden('Solo el owner de la iniciativa puede hacer esto.', 'PROJECT_OWNER_REQUIRED');
  }
}

export function requireProjectTeamAccess(
  prisma: PrismaClient,
  need: ProjectTeamNeed | ((req: AuthenticatedRequest) => ProjectTeamNeed),
  param = 'id',
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const projectId = req.params[param];
      const { id: userId, role } = req.user!;
      const resolvedNeed = typeof need === 'function' ? need(req) : need;
      const db = prisma as any;
      const [project, user, member, governance, mentorSession] = await Promise.all([
        db.project.findUnique({ where: { id: projectId }, select: { organizationId: true } }),
        db.user.findUnique({ where: { id: userId }, select: { organizationId: true } }),
        db.teamMember.findFirst({ where: { projectId, userId }, select: { role: true, status: true } }),
        db.initiativeGovernance?.findUnique?.({ where: { projectId } }) ?? null,
        role === 'mentor'
          ? db.mentorSession?.findFirst?.({ where: { projectId, mentorId: userId }, select: { id: true } }) ?? null
          : null,
      ]);
      const sameOrganization = Boolean(
        project?.organizationId
        && user?.organizationId
        && project.organizationId === user.organizationId,
      );
      assertProjectTeamAccess({
        platformRole: role,
        teamRole: member?.role ?? null,
        teamStatus: member?.status ?? null,
        isAssignedPortfolioLead: !member && governance?.portfolioLeadUserId === userId,
        isAssignedMentor: Boolean(mentorSession),
        sameOrganization,
        need: resolvedNeed,
      });
      next();
    } catch (err) {
      next(err);
    }
  };
}
