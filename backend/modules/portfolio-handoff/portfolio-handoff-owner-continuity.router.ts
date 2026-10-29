import { Router, type RequestHandler } from 'express';
import { prisma } from '../../shared/db/prisma';
import { AppError } from '../../shared/errors/AppError';
import { authenticate } from '../auth/auth.middleware';
import { PortfolioHandoffOwnerContinuityService } from './application/portfolio-handoff-owner-continuity.service';
import { PrismaPortfolioHandoffAssignmentRepository } from './infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaPortfolioHandoffOwnerContinuityRepository } from './infrastructure/prisma-portfolio-handoff-owner-continuity.repository';
import { ownerPostStartContinuitySchema } from './portfolio-handoff-owner-continuity.schemas';

type ContinuityResolver = Pick<PortfolioHandoffOwnerContinuityService, 'resolve'>;

export function buildPortfolioHandoffOwnerContinuityRouter(
  service: ContinuityResolver,
  auth: RequestHandler = authenticate,
): Router {
  const router = Router();
  router.get('/:assignmentId/post-start-continuity', auth, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'UNAUTHENTICATED');
      const data = await service.resolve(req.params.assignmentId, { id: req.user.id, email: req.user.email });
      if (data.outcome === 'ACCESS_DENIED') {
        throw AppError.forbidden('No tienes acceso a la continuidad de este encargo.', 'OWNER_CONTINUITY_ACCESS_DENIED');
      }
      res.json({ success: true, data: ownerPostStartContinuitySchema.parse(data) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

const continuityService = new PortfolioHandoffOwnerContinuityService(
  new PrismaPortfolioHandoffAssignmentRepository(prisma),
  new PrismaPortfolioHandoffOwnerContinuityRepository(prisma),
);

export const portfolioHandoffOwnerContinuityRouter = buildPortfolioHandoffOwnerContinuityRouter(continuityService);

