import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { authenticate } from '../auth/auth.middleware';
import { AppError } from '../../shared/errors/AppError';
import { PortfolioHandoffInvitationService } from './application/portfolio-handoff-invitation.service';
import { PrismaPortfolioHandoffAssignmentRepository } from './infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaPortfolioHandoffInvitationRepository } from './infrastructure/prisma-portfolio-handoff-invitation.repository';

export function buildPortfolioHandoffInvitationRouter(service: PortfolioHandoffInvitationService, auth = authenticate): Router {
  const router = Router();

  router.get('/:token', async (req, res, next) => {
    try {
      const data = await service.readInvitationByToken(req.params.token);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  });

  router.post('/claim', auth, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'HANDOFF_AUTH_REQUIRED');
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (token.length < 32 || token.length > 200) throw AppError.badRequest('Token de invitacion invalido', 'HANDOFF_INVITATION_TOKEN_INVALID');
      const data = await service.claimInvitedIdentity(token, { id: req.user.id, email: req.user.email });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  });

  return router;
}

const assignmentRepository = new PrismaPortfolioHandoffAssignmentRepository(prisma);
const invitationRepository = new PrismaPortfolioHandoffInvitationRepository(prisma);
export const portfolioHandoffInvitationRouter = buildPortfolioHandoffInvitationRouter(new PortfolioHandoffInvitationService({ assignments: assignmentRepository, access: invitationRepository }));
