/**
 * Controller for the pilot-claim flow (ADR-018).
 *   POST /:pilotCode/claim   (anonymous, rate-limited)  → issue a claim token
 *   POST /consume-claim      (authenticated)            → consume → create Project
 */
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../../shared/types/api.types';
import { AppError } from '../../shared/errors/AppError';
import { pilotCodeParamSchema, claimConsumeBodySchema } from './pilot-claim.schemas';
import { PilotClaimService } from './pilot-claim.service';

export class PilotClaimController {
  constructor(private readonly service: PilotClaimService) {}

  /** POST /api/v1/public/pilot-leads/:pilotCode/claim */
  issue = async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      const { pilotCode } = pilotCodeParamSchema.parse(req.params);
      const data = await this.service.issue(pilotCode, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/public/pilot-leads/consume-claim (requires `authenticate`) */
  consume = async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Inicia sesión para continuar tu iniciativa.');
      const { claimToken } = claimConsumeBodySchema.parse(req.body);
      const data = await this.service.consume(
        claimToken,
        { id: req.user.id, role: req.user.role, email: req.user.email },
        { ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined },
      );
      res.status(data.alreadyExisted ? 200 : 201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
