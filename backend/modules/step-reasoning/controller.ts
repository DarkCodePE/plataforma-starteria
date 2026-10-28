import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { assertStepReasoningQaEnabled } from './feature-flag';
import type { StepReasoningService } from './service';
import type { StepReasoningTurnInput } from './step-reasoning.schemas';
import { AppError } from '../../shared/errors/AppError';
import type { StepReasoningStepNumber } from './context-builder';

function stepNumberOf(value: string): StepReasoningStepNumber {
  const stepNumber = Number(value);
  if (Number.isInteger(stepNumber) && stepNumber >= 0 && stepNumber <= 4) {
    return stepNumber as StepReasoningStepNumber;
  }
  throw AppError.badRequest('El Step solicitado debe estar entre 0 y 4.', 'STEP_REASONING_STEP_INVALID');
}

export class StepReasoningController {
  constructor(private readonly service: StepReasoningService) {}

  getSession = async (req: AuthenticatedRequest<{ id: string; stepNumber: string }>, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      assertStepReasoningQaEnabled(user.id);
      const data = await this.service.loadSession(req.params.id, stepNumberOf(req.params.stepNumber), { id: user.id, role: user.role });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  postTurn = async (req: AuthenticatedRequest<{ id: string; stepNumber: string }, any, StepReasoningTurnInput>, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      assertStepReasoningQaEnabled(user.id);
      const headerRequestId = (req as any).headers?.['x-request-id'];
      const requestId = (req as any).requestId
        ?? (Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId)
        ?? req.body.clientTurnId
        ?? 'step-reasoning-request';
      const data = await this.service.submitTurn(req.params.id, stepNumberOf(req.params.stepNumber), { id: user.id, role: user.role }, req.body, requestId);
      res.status(data.idempotentReplay ? 200 : 201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}

