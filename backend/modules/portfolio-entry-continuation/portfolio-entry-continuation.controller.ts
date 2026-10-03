import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { mapPortfolioEntryError } from '../portfolio-entry/portfolio-entry.errors';
import { sessionParamsSchema } from '../portfolio-entry/portfolio-entry.schemas';
import type { PortfolioEntryContinuationService, ReadScopedEntryAccessInput } from './portfolio-entry-continuation.service';
import {
  continuationParamsSchema,
  continuePortfolioEntryBodySchema,
  portfolioContextParamsSchema,
  scopedEntryIdentitySchema,
} from './portfolio-entry-continuation.schemas';

export class PortfolioEntryContinuationController {
  constructor(private readonly service: PortfolioEntryContinuationService) {}

  continueToPortfolio = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const body = continuePortfolioEntryBodySchema.parse(req.body);
      if (!req.user?.id) {
        throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
      }
      const data = await this.service.continueToPortfolio({
        sessionId,
        expectedRevision: body.expectedRevision,
        organizationId: body.organizationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        idempotencyKey: getIdempotencyKey(req),
        requestId: getRequestId(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  listPortfolioContexts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = portfolioContextParamsSchema.parse(req.params);
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
      const data = await this.service.listPortfolioContexts({ sessionId, authenticatedUserId: req.user.id });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  readContinuation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { continuationId } = continuationParamsSchema.parse(req.params);
      if (!req.user?.id) {
        throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
      }
      const data = await this.service.readContinuation({
        continuationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  readPortfolioHomeEntryContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { continuationId } = continuationParamsSchema.parse(req.params);
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
      const data = await this.service.readPortfolioHomeEntryContext({
        continuationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(mapPortfolioEntryError(err));
    }
  };

  authorizeScopedFirstValueEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_ENTRY_CONTINUATION_AUTH_REQUIRED');
      const identity = scopedEntryIdentitySchema.parse(req.body);
      const data = await this.service.authorizeScopedFirstValueEntry({ identity: identity as ReadScopedEntryAccessInput['identity'], authenticatedUserId: req.user.id });
      res.json({ success: true, data });
    } catch (err) { next(mapPortfolioEntryError(err)); }
  };
}

function getIdempotencyKey(req: Request): string | undefined {
  const value = req.header('Idempotency-Key');
  return value && value.trim() ? value.trim() : undefined;
}

function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string; id?: string }).requestId
    ?? (req as Request & { requestId?: string; id?: string }).id
    ?? 'unknown';
}
