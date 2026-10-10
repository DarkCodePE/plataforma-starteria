// Acceso a una iniciativa según el rol en su equipo (TeamMember.role). Lo encontró el swarm de roles
// en producción (2026-10-10): las rutas de /api/v1/projects/:id sólo comprobaban que fueras miembro,
// así que un VIEWER (o un sponsor, que entra como VIEWER) editaba la descripción, Step 0 y los Steps,
// y cualquier usuario autenticado gestionaba el equipo de cualquier proyecto.
//
//   read   → cualquier miembro, y el Portfolio Lead asignado en InitiativeGovernance (§23).
//   write  → OWNER o EDITOR: el trabajo de la iniciativa (Steps, checkpoints, datos del proyecto).
//   manage → OWNER: el equipo y archivar.
// admin pasa siempre; mentor lee y escribe como antes, pero no gestiona el equipo.
import type { NextFunction, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { AppError } from '../../shared/errors/AppError';

export type ProjectTeamNeed = 'read' | 'write' | 'manage';

const WRITE_ROLES = new Set(['OWNER', 'EDITOR']);

export function assertProjectTeamAccess(input: {
  platformRole: string;
  teamRole: string | null;
  isAssignedPortfolioLead: boolean;
  need: ProjectTeamNeed;
}): void {
  const { platformRole, teamRole, isAssignedPortfolioLead, need } = input;
  if (platformRole === 'admin') return;
  if (platformRole === 'mentor' && need !== 'manage') return;

  if (!teamRole) {
    if (!isAssignedPortfolioLead) throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
    if (need !== 'read') throw AppError.forbidden('Sólo el equipo de la iniciativa puede avanzar sus Steps.', 'PROJECT_TEAM_ACCESS_REQUIRED');
    return;
  }
  if (need === 'write' && !WRITE_ROLES.has(teamRole)) {
    throw AppError.forbidden('Tu rol en el equipo es de sólo lectura.', 'PROJECT_TEAM_ROLE_REQUIRED', {
      hint: 'Pide al owner de la iniciativa que te dé rol de editor.',
    });
  }
  if (need === 'manage' && teamRole !== 'OWNER') {
    throw AppError.forbidden('Sólo el owner de la iniciativa puede hacer esto.', 'PROJECT_OWNER_REQUIRED');
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
      if (role === 'admin' || (role === 'mentor' && resolvedNeed !== 'manage')) return next();

      const member = await prisma.teamMember.findFirst({ where: { projectId, userId }, select: { role: true } });
      const isAssignedPortfolioLead = !member && Boolean(
        (await (prisma as any).initiativeGovernance.findUnique({ where: { projectId } }))?.portfolioLeadUserId === userId,
      );
      assertProjectTeamAccess({ platformRole: role, teamRole: member?.role ?? null, isAssignedPortfolioLead, need: resolvedNeed });
      next();
    } catch (err) {
      next(err);
    }
  };
}
