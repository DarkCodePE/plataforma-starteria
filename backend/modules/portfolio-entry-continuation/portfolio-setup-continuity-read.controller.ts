import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod/v3';
import { AppError } from '../../shared/errors/AppError';
import type { PortfolioSetupContinuityReadService } from './portfolio-setup-continuity-read.service';

const paramsSchema = z.object({ sessionId: z.string().min(1) }).strict();

export class PortfolioSetupContinuityReadController {
  constructor(private readonly service: PortfolioSetupContinuityReadService) {}

  read = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = paramsSchema.parse(req.params);
      if (!req.user?.id) throw AppError.unauthorized('Autenticacion requerida.', 'PORTFOLIO_SETUP_AUTH_REQUIRED');
      const data = await this.service.read({ sessionId, ownerUserId: req.user.id });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
