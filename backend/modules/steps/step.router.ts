import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { StepController } from './step.controller';
import { StepService } from './step.service';
import { requireStepProjectAccess } from './step.access';
import { validate } from '../../shared/middleware/validate';
import { updateStepStatusSchema, updateModuleSchema, requestSessionSchema } from './step.schemas';

import { authenticate } from '../auth/auth.middleware';
import { requireEntitlement } from '../billing/entitlement.middleware';
const service = new StepService(prisma);
const controller = new StepController(service);

export const stepRouter = Router();

stepRouter.use(authenticate);
stepRouter.use('/:projectId/steps', requireStepProjectAccess(prisma));

stepRouter.get('/:projectId/steps', controller.getAll);
stepRouter.get('/:projectId/steps/:number', controller.getByNumber);
stepRouter.patch('/:projectId/steps/:number', validate(updateStepStatusSchema), controller.updateStatus);
stepRouter.get('/:projectId/steps/:number/data', controller.getData);
stepRouter.put('/:projectId/steps/:number/data', controller.saveData);
stepRouter.patch(
  '/:projectId/steps/:number/modules/:moduleId',
  validate(updateModuleSchema),
  controller.updateModule
);
stepRouter.post('/:projectId/steps/:number/ai-review', controller.submitAiReview);
// PRD-005 / issue #85: `mentor_credit` call site. Booking a mentor session
// consumes one credit — metered in shadow mode (never blocks until
// BILLING_ENFORCEMENT_ENABLED flips), and the per-project ledger
// (Project.mentorCredits) is decremented in the service.
stepRouter.post(
  '/:projectId/steps/:number/session',
  requireEntitlement('mentor_credit'),
  validate(requestSessionSchema),
  controller.requestSession
);
