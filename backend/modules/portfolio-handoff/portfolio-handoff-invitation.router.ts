import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { authenticate } from '../auth/auth.middleware';
import { requirePermission } from '../auth/auth.middleware';
import { mailer } from '../../shared/mail/mailer';
import { PortfolioHandoffDeliveryService, type HandoffInvitationDeliveryPort } from './application/portfolio-handoff-delivery.service';
import { AppError } from '../../shared/errors/AppError';
import { PortfolioHandoffInvitationService } from './application/portfolio-handoff-invitation.service';
import { PrismaPortfolioHandoffAssignmentRepository } from './infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaPortfolioHandoffInvitationRepository } from './infrastructure/prisma-portfolio-handoff-invitation.repository';
import { PrismaPortfolioHandoffDeliveryAttemptRepository } from './infrastructure/prisma-portfolio-handoff-delivery-attempt.repository';
import { PrismaPortfolioHandoffResponseCommandRepository } from './infrastructure/prisma-portfolio-handoff-response-command.repository';
import { PortfolioHandoffResponseService } from './application/portfolio-handoff-response.service';

export function buildPortfolioHandoffInvitationRouter(service: PortfolioHandoffInvitationService, auth = authenticate, onViewed?: (token: string) => Promise<void>): Router {
  const router = Router();

  router.get('/:token', async (req, res, next) => {
    try {
      if (onViewed) await onViewed(req.params.token);
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
const deliveryAttemptRepository = new PrismaPortfolioHandoffDeliveryAttemptRepository(prisma);
const invitationService = new PortfolioHandoffInvitationService({ assignments: assignmentRepository, access: invitationRepository });
const deliveryService = new PortfolioHandoffDeliveryService(assignmentRepository, invitationRepository, deliveryAttemptRepository, {
  async send(message) {
    const delivered = await mailer.send(message);
    return { delivered };
  },
} satisfies HandoffInvitationDeliveryPort);

export const portfolioHandoffInvitationRouter = buildPortfolioHandoffInvitationRouter(invitationService, authenticate, async (token) => {
  await deliveryService.markHandoffInvitationViewed(token);
});

export function buildPortfolioHandoffDeliveryRouter(service: PortfolioHandoffDeliveryService, auth = authenticate, write = requirePermission('portfolio:write')): Router {
  const router = Router();
  router.post('/:assignmentId/invitation', auth, write, async (req, res, next) => {
    try {
      const data = await service.sendHandoffInvitation({
        assignmentId: req.params.assignmentId,
        idempotencyKey: typeof req.get('Idempotency-Key') === 'string' ? req.get('Idempotency-Key')! : '',
        expiresAt: req.body?.expiresAt ? parseExpiry(req.body.expiresAt) : null,
        title: typeof req.body?.title === 'string' ? req.body.title : undefined,
        whyItMatters: typeof req.body?.whyItMatters === 'string' ? req.body.whyItMatters : undefined,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  });
  router.post('/:assignmentId/invitation/revoke', auth, write, async (req, res, next) => {
    try { res.json({ success: true, data: await service.revokeHandoffInvitation(req.params.assignmentId) }); }
    catch (error) { next(error); }
  });
  return router;
}

export const portfolioHandoffDeliveryRouter = buildPortfolioHandoffDeliveryRouter(deliveryService);

const responseService = new PortfolioHandoffResponseService(assignmentRepository, invitationRepository, new PrismaPortfolioHandoffResponseCommandRepository(prisma));
export function buildPortfolioHandoffResponseRouter(service: PortfolioHandoffResponseService, auth = authenticate, portfolioWrite = requirePermission('portfolio:write')): Router {
  const router = Router();
  router.post('/:assignmentId/accept', auth, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'UNAUTHENTICATED');
      const data = await service.acceptHandoffAssignment({ assignmentId: req.params.assignmentId, actor: { id: req.user.id, email: req.user.email }, expectedVersion: Number(req.body?.expectedVersion), idempotencyKey: req.get('Idempotency-Key') ?? '' });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  });
  router.post('/:assignmentId/reject', auth, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'UNAUTHENTICATED');
      const data = await service.rejectHandoffAssignment({ assignmentId: req.params.assignmentId, actor: { id: req.user.id, email: req.user.email }, reason: req.body?.reason, expectedVersion: Number(req.body?.expectedVersion), idempotencyKey: req.get('Idempotency-Key') ?? '' });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  });
  router.post('/:assignmentId/rejection-response', auth, portfolioWrite, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'UNAUTHENTICATED');
      const data = await service.recordPortfolioRejectionResponse({ assignmentId: req.params.assignmentId, actorId: req.user.id, response: typeof req.body?.response === 'string' ? req.body.response : '', idempotencyKey: req.get('Idempotency-Key') ?? '' });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  });
  return router;
}
export const portfolioHandoffResponseRouter = buildPortfolioHandoffResponseRouter(responseService);

function parseExpiry(value: unknown): Date {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw AppError.badRequest('Fecha de expiracion invalida', 'HANDOFF_EXPIRY_INVALID');
  return date;
}
