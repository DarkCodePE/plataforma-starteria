import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod/v3';
import { AppError } from '../../shared/errors/AppError';
import { ConversionSubmissionService, conversionSubmissionSchema } from './application/conversion-submission.service';

const paramsSchema = z.object({ sessionId: z.string().min(1).max(128) }).strict();

export class ConversionSubmissionController {
  constructor(private readonly service: ConversionSubmissionService) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('Autenticación requerida.', 'PORTFOLIO_ENTRY_SESSION_UNAUTHORIZED');
      if (JSON.stringify(req.body ?? {}).length > 8192) {
        throw AppError.badRequest('Solicitud demasiado grande.', 'CONVERSION_SUBMISSION_INVALID');
      }
      const params = paramsSchema.safeParse(req.params);
      const parsed = conversionSubmissionSchema.safeParse(req.body);
      if (!params.success || !parsed.success) {
        throw AppError.badRequest('Solicitud inválida.', 'CONVERSION_SUBMISSION_INVALID');
      }
      const receipt = await this.service.submit(params.data.sessionId, req.user.id, parsed.data);
      res.status(receipt.idempotentReplay ? 200 : 201).json({ success: true, data: receipt });
    } catch (error) {
      next(error instanceof AppError ? error : new AppError(503, 'No pudimos registrar la solicitud.', 'CONVERSION_SUBMISSION_FAILED'));
    }
  };
}
