import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { FirstValueP3Service } from './first-value-p3.service';

export class FirstValueP3Controller {
  constructor(private readonly service: FirstValueP3Service) {}

  analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Autenticación requerida.');
      const role = req.user.roles.find((item) => item === 'portfolio_lead' || item === 'admin') ?? req.user.role;
      const data = await this.service.analyze(req.body, { userId: req.user.id, role });
      res.json({ success: true, data });
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && 'code' in error) {
        const typed = error as { statusCode: number; code: string; message: string };
        next(new AppError(typed.statusCode, typed.message, typed.code));
        return;
      }
      next(error);
    }
  };
}
