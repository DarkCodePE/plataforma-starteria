import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { AppError } from '../../shared/errors/AppError';
import { authenticate, requirePermission } from '../auth/auth.middleware';
import { challengeOrganization, scopeAllows } from '../portfolio/portfolio-resource-guard';
import { resolvePortfolioScope, resolvePortfolioWriteScope } from '../portfolio/portfolio-scope';
import {
  PortfolioLabRequestService,
  defaultPortfolioLabNotifier,
} from './portfolio-lab-request.service';
import {
  portfolioLabRequestBodySchema,
  portfolioLabRequestParamsSchema,
  portfolioLabTerminalStatusBodySchema,
} from './portfolio-lab-request.schemas';

const read = requirePermission('portfolio:read');
const write = requirePermission('portfolio:write');
const service = new PortfolioLabRequestService(prisma, defaultPortfolioLabNotifier);

function idempotencyKey(req: any): string {
  const value = req.get('Idempotency-Key');
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest('Idempotency-Key requerida.', 'PORTFOLIO_LAB_IDEMPOTENCY_REQUIRED');
  }
  return value.trim();
}

async function organizationFor(req: any, access: 'read' | 'write'): Promise<string> {
  const scope = access === 'write'
    ? await resolvePortfolioWriteScope(prisma, req.user!)
    : await resolvePortfolioScope(prisma, req.user!);
  const organizationId = scope.organizationIds[0];
  if (!organizationId) throw AppError.notFound('Organización', 'PORTFOLIO_RESOURCE_NOT_FOUND');
  return organizationId;
}

async function ownChallenge(req: any, challengeId: string): Promise<string> {
  const resolved = await challengeOrganization(prisma, challengeId);
  const scope = await resolvePortfolioWriteScope(prisma, req.user!);
  if (!resolved.found || !resolved.organizationId || !scopeAllows(scope, resolved)) {
    throw AppError.notFound('Reto', 'PORTFOLIO_RESOURCE_NOT_FOUND');
  }
  return resolved.organizationId;
}

function sanitizeAttempt(attempt: any) {
  const { idempotencyKeyHash: _key, payloadHash: _payload, ...safe } = attempt;
  return safe;
}

function sanitizeRequest(item: any) {
  const {
    idempotencyKeyHash: _key,
    payloadHash: _payload,
    notificationAttempts,
    ...safe
  } = item;
  return {
    ...safe,
    ...(notificationAttempts ? { notificationAttempts: notificationAttempts.map(sanitizeAttempt) } : {}),
  };
}

export const portfolioLabRequestRouter = Router();

portfolioLabRequestRouter.post('/requests', authenticate, write, async (req: any, res, next) => {
  try {
    const body = portfolioLabRequestBodySchema.parse(req.body ?? {});
    const organizationId = await ownChallenge(req, body.challengeId);
    const result = await service.create({
      organizationId,
      actorId: req.user.id,
      ...body,
      idempotencyKey: idempotencyKey(req),
    });
    res.status(result.idempotent || result.deduplicated ? 200 : 201).json({
      success: true,
      data: { ...result, request: sanitizeRequest(result.request) },
    });
  } catch (error) { next(error); }
});

portfolioLabRequestRouter.get('/requests', authenticate, read, async (req: any, res, next) => {
  try {
    const organizationId = await organizationFor(req, 'read');
    const requests = await service.list(organizationId);
    res.json({ success: true, data: requests.map(sanitizeRequest) });
  } catch (error) { next(error); }
});

portfolioLabRequestRouter.get('/requests/:requestId', authenticate, read, async (req: any, res, next) => {
  try {
    const { requestId } = portfolioLabRequestParamsSchema.parse(req.params);
    const organizationId = await organizationFor(req, 'read');
    const result = await service.get(organizationId, requestId);
    res.json({ success: true, data: sanitizeRequest(result) });
  } catch (error) { next(error); }
});

portfolioLabRequestRouter.post('/requests/:requestId/notification-retry', authenticate, write, async (req: any, res, next) => {
  try {
    const { requestId } = portfolioLabRequestParamsSchema.parse(req.params);
    const organizationId = await organizationFor(req, 'write');
    const result = await service.retryNotification({
      organizationId,
      actorId: req.user.id,
      requestId,
      idempotencyKey: idempotencyKey(req),
    });
    res.json({ success: true, data: { ...result, request: sanitizeRequest(result.request) } });
  } catch (error) { next(error); }
});

portfolioLabRequestRouter.patch('/requests/:requestId/status', authenticate, write, async (req: any, res, next) => {
  try {
    const { requestId } = portfolioLabRequestParamsSchema.parse(req.params);
    const { status } = portfolioLabTerminalStatusBodySchema.parse(req.body ?? {});
    const organizationId = await organizationFor(req, 'write');
    const result = await service.transitionStatus({
      organizationId,
      actorId: req.user.id,
      requestId,
      status,
      idempotencyKey: idempotencyKey(req),
    });
    res.json({ success: true, data: { ...result, request: sanitizeRequest(result.request) } });
  } catch (error) { next(error); }
});
