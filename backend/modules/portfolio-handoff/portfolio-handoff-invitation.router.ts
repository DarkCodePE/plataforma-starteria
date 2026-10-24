import { Router, type RequestHandler } from 'express';
import { prisma } from '../../shared/db/prisma';
import { authenticate } from '../auth/auth.middleware';
import { requirePermission } from '../auth/auth.middleware';
import { mailer } from '../../shared/mail/mailer';
import { config } from '../../config';
import { PortfolioHandoffDeliveryService, type HandoffInvitationDeliveryPort } from './application/portfolio-handoff-delivery.service';
import { AppError } from '../../shared/errors/AppError';
import { requirePortfolioResource } from '../portfolio/portfolio-resource-guard';
import { PortfolioHandoffInvitationService } from './application/portfolio-handoff-invitation.service';
import { PrismaPortfolioHandoffAssignmentRepository } from './infrastructure/prisma-portfolio-handoff-assignment.repository';
import { PrismaPortfolioHandoffInvitationRepository } from './infrastructure/prisma-portfolio-handoff-invitation.repository';
import { PrismaPortfolioHandoffDeliveryAttemptRepository } from './infrastructure/prisma-portfolio-handoff-delivery-attempt.repository';
import { PrismaPortfolioHandoffResponseCommandRepository } from './infrastructure/prisma-portfolio-handoff-response-command.repository';
import { PortfolioHandoffResponseService } from './application/portfolio-handoff-response.service';
import { PortfolioHandoffAssignmentError } from './application/portfolio-handoff-assignment.errors';
import { PrismaHandoffSemanticEventRepository, PrismaPortfolioHandoffProjectionRepository } from './infrastructure/prisma-portfolio-handoff-semantic-event.repository';
import { PortfolioHandoffProjector, DurableHandoffEventPort } from './application/portfolio-handoff-semantic-event.projector';
import { PrismaPortfolioHandoffAtomicCommandRepository } from './infrastructure/prisma-portfolio-handoff-atomic-command.repository';
import { PortfolioHandoffBatchDeliveryService } from './application/portfolio-handoff-batch-delivery.service';
import { PrismaPortfolioHandoffDeliveryBatchRepository } from './infrastructure/prisma-portfolio-handoff-delivery-batch.repository';
import { challengeOrganization, scopeAllows } from '../portfolio/portfolio-resource-guard';
import { resolvePortfolioScope } from '../portfolio/portfolio-scope';

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
const semanticEventRepository = new PrismaHandoffSemanticEventRepository(prisma);
const handoffProjector = new PortfolioHandoffProjector(new PrismaPortfolioHandoffProjectionRepository(prisma));
const semanticEventPort = new DurableHandoffEventPort(semanticEventRepository, handoffProjector);
const invitationRepository = new PrismaPortfolioHandoffInvitationRepository(prisma);
const deliveryAttemptRepository = new PrismaPortfolioHandoffDeliveryAttemptRepository(prisma);
const invitationService = new PortfolioHandoffInvitationService({ assignments: assignmentRepository, access: invitationRepository });
const deliveryService = new PortfolioHandoffDeliveryService(assignmentRepository, invitationRepository, deliveryAttemptRepository, {
  async send(message) {
    const delivered = await mailer.send({ ...message, from: config.smtp.from });
    return { delivered };
  },
} satisfies HandoffInvitationDeliveryPort, semanticEventPort);
const deliveryBatchRepository = new PrismaPortfolioHandoffDeliveryBatchRepository(prisma);
const batchDeliveryService = new PortfolioHandoffBatchDeliveryService(deliveryBatchRepository, deliveryBatchRepository, deliveryService);

export const portfolioHandoffInvitationRouter = buildPortfolioHandoffInvitationRouter(invitationService, authenticate, async (token) => {
  await deliveryService.markHandoffInvitationViewed(token);
});

// F-03: enviar o revocar la invitación exige además que la asignación sea de una organización de
// quien escribe; con sólo `portfolio:write` se podía actuar sobre asignaciones de otra organización.
const ownAssignment = requirePortfolioResource(prisma, { kind: 'handoffAssignment', param: 'assignmentId' });

export function buildPortfolioHandoffDeliveryRouter(
  service: PortfolioHandoffDeliveryService,
  auth = authenticate,
  write = requirePermission('portfolio:write'),
  owns: RequestHandler = ownAssignment,
  batchService?: PortfolioHandoffBatchDeliveryService,
): Router {
  const router = Router();
  if (batchService) router.post('/batch/invitations', auth, write, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'HANDOFF_AUTH_REQUIRED');
      const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId.trim() : '';
      const resolved = await challengeOrganization(prisma, challengeId);
      const scope = await resolvePortfolioScope(prisma, req.user);
      if (!resolved.found || !resolved.organizationId || !scopeAllows(scope, resolved)) throw AppError.notFound('Reto', 'PORTFOLIO_RESOURCE_NOT_FOUND');
      const items = Array.isArray(req.body?.items) ? req.body.items.map((item: any) => ({ assignmentId: String(item?.assignmentId ?? ''), expectedVersion: Number(item?.expectedVersion) })) : [];
      const data = await batchService.send({
        organizationId: resolved.organizationId,
        challengeId,
        actorId: req.user.id,
        idempotencyKey: req.get('Idempotency-Key') ?? '',
        items,
        retryOfBatchId: typeof req.body?.retryOfBatchId === 'string' ? req.body.retryOfBatchId : null,
      });
      res.status(data.status === 'COMPLETED' ? 200 : 207).json({ success: true, data });
    } catch (error) { next(error); }
  });
  router.post('/:assignmentId/invitation', auth, write, owns, async (req, res, next) => {
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
  router.post('/:assignmentId/invitation/revoke', auth, write, owns, async (req, res, next) => {
    try { res.json({ success: true, data: await service.revokeHandoffInvitation(req.params.assignmentId) }); }
    catch (error) { next(error); }
  });
  return router;
}

export const portfolioHandoffDeliveryRouter = buildPortfolioHandoffDeliveryRouter(deliveryService, authenticate, requirePermission('portfolio:write'), ownAssignment, batchDeliveryService);

const responseService = new PortfolioHandoffResponseService(assignmentRepository, invitationRepository, new PrismaPortfolioHandoffResponseCommandRepository(prisma), semanticEventPort, () => new Date(), new PrismaPortfolioHandoffAtomicCommandRepository(prisma));
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
  router.post('/:assignmentId/start', auth, async (req, res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized('Autenticacion requerida', 'UNAUTHENTICATED');
      const expectedVersion = Number(req.body?.expectedVersion);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw AppError.badRequest('Version de asignacion invalida', 'STALE_VERSION');
      const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : req.get('Idempotency-Key') ?? '';
      const data = await service.startAssignedWork({ assignmentId: req.params.assignmentId, actor: { id: req.user.id, email: req.user.email }, expectedVersion, idempotencyKey });
      res.json({ success: true, data });
    } catch (error) { next(toHandoffApiError(error)); }
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

function toHandoffApiError(error: unknown): Error {
  if (!(error instanceof PortfolioHandoffAssignmentError)) return error as Error;
  const status = error.code === 'NOT_FOUND' ? 404 : ['STALE_VERSION', 'IDEMPOTENCY_CONFLICT'].includes(error.code) ? 409 : ['FORBIDDEN', 'IDENTITY_MISMATCH'].includes(error.code) ? 403 : 400;
  return new AppError(status, error.message, error.code);
}

function parseExpiry(value: unknown): Date {
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) throw AppError.badRequest('Fecha de expiracion invalida', 'HANDOFF_EXPIRY_INVALID');
  return date;
}
