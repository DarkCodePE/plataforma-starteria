import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError';
import { portfolioSetupContinueRequestSchema, type PortfolioSetupContinuityWriteService } from './portfolio-setup-continuity-write.service';

const paramsSchema = z.object({ sessionId: z.string().min(1) }).strict();

export class PortfolioSetupContinuityWriteController {
  constructor(private readonly service: PortfolioSetupContinuityWriteService) {}

  continue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Autenticacion requerida.', 'AUTH_REQUIRED');
      const { sessionId } = paramsSchema.parse(req.params);
      const key = req.header('Idempotency-Key');
      if (!key || key.length > 256 || key.trim().length < 8) {
        throw AppError.badRequest('Idempotency-Key requerido.', 'IDEMPOTENCY_KEY_REQUIRED');
      }
      const request = portfolioSetupContinueRequestSchema.parse(req.body);
      const data = await this.service.continue({ sessionId, ownerUserId: req.user.id,
        idempotencyKey: key, request });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };
}
