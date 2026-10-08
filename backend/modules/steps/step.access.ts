// Acceso al proyecto para /api/v1/projects/:projectId/steps*. Mismo criterio que
// ProjectService.getProject (equipo, admin, mentor) más la lectura del Portfolio Lead asignado
// en InitiativeGovernance (§23, como getProjectForRead). Escribir sigue siendo del equipo.
import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { AppError } from '../../shared/errors/AppError';

const READ_METHODS = new Set(['GET', 'HEAD']);

export function requireStepProjectAccess(prisma: PrismaClient) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const { id: userId, role } = req.user!;
      if (role === 'admin' || role === 'mentor') return next();

      const member = await prisma.teamMember.findFirst({ where: { projectId, userId }, select: { id: true } });
      if (member) return next();

      const governance = await (prisma as any).initiativeGovernance.findUnique({ where: { projectId } });
      if (governance?.portfolioLeadUserId !== userId) {
        throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
      }
      if (!READ_METHODS.has((req as unknown as Request).method)) {
        throw AppError.forbidden('Sólo el equipo de la iniciativa puede avanzar sus Steps.', 'PROJECT_TEAM_ACCESS_REQUIRED');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
