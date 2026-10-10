import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { PortfolioEntrySessionError } from '../portfolio-entry-sessions/application/portfolio-entry-session-errors';
import { AppError } from '../../shared/errors/AppError';
import { mapPortfolioEntryError } from '../portfolio-entry/portfolio-entry.errors';
import { StarteriaPathError, StarteriaPathService } from './application/starteria-path.service';

const sessionParamsSchema = z.object({ sessionId: z.string().min(1) }).strict();

export class StarteriaPathController {
  constructor(private readonly service: StarteriaPathService) {}

  read = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = sessionParamsSchema.parse(req.params);
      const ownerUserId = req.user?.id;
      if (!ownerUserId) {
        next(AppError.unauthorized('Autenticacion requerida.', 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED'));
        return;
      }

      const data = await this.service.getStarteriaPathForOwnedSession({ sessionId, ownerUserId });
      res.json({ success: true, data });
    } catch (error) {
      next(mapStarteriaPathError(error));
    }
  };
}

function mapStarteriaPathError(error: unknown): AppError | unknown {
  if (error instanceof PortfolioEntrySessionError
    && (error.code === 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND' || error.code === 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED')) {
    // Keep missing and non-owned session responses indistinguishable.
    return AppError.notFound('Portfolio Entry session', 'PORTFOLIO_ENTRY_SESSION_NOT_FOUND');
  }
  if (error instanceof StarteriaPathError) {
    if (error.code === 'STARTERIA_PATH_HANDOFF_NOT_FOUND') {
      return AppError.notFound('Critical Handoff', 'CRITICAL_HANDOFF_NOT_FOUND');
    }
    if (error.code === 'STARTERIA_PATH_READ_FAILED') {
      return new AppError(503, 'Starteria Path could not be read.', 'STARTERIA_PATH_READ_FAILED');
    }
    if (error.code === 'STARTERIA_PATH_PROJECTION_FAILED') {
      return new AppError(503, 'Starteria Path could not be projected.', 'PATH_PROJECTION_FAILED');
    }
  }

  const mapped = mapPortfolioEntryError(error);
  if (mapped !== error) return mapped;
  return new AppError(503, 'Starteria Path could not be read.', 'STARTERIA_PATH_READ_FAILED');
}
