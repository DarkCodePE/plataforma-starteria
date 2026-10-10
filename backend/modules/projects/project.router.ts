import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { validate } from '../../shared/middleware/validate';
import { createProjectSchema, updateProjectSchema, updateStep0Schema, updateSponsorDataSchema } from './project.schemas';
import { AdaptiveCoreController } from '../adaptive-core/adaptive-core.controller';
import { AdaptiveCoreService } from '../adaptive-core/adaptive-core.service';
import { MissionReviewReadService } from '../adaptive-core/mission-review.read-service';
import { resolveCopilotMode, type CopilotIntentMode } from '../copilot/application/copilot-intent-modes';
import { checkpointResponseSchema, confirmBriefSchema, confirmCriticalChangeTransitionSchema, criticalChangeSchema, decisionAuthorityQuerySchema, decisionReadinessQuerySchema, decisionRequestCreateSchema, organizationalDecisionSchema } from '../adaptive-core/adaptive-core.schemas';

import { authenticate } from '../auth/auth.middleware';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { requireEntitlement } from '../billing/entitlement.middleware';
import { requireProjectTeamAccess } from './project-team-access';
const service = new ProjectService(prisma);
const controller = new ProjectController(service);
const adaptiveCoreService = new AdaptiveCoreService(prisma);
const adaptiveCoreController = new AdaptiveCoreController(adaptiveCoreService);
const missionReview = new MissionReviewReadService(prisma);

export const projectRouter = Router();
// Escribir la iniciativa es del OWNER o EDITOR; archivarla, del OWNER (project-team-access.ts).
const canWrite = requireProjectTeamAccess(prisma, 'write');
const canManage = requireProjectTeamAccess(prisma, 'manage');

projectRouter.use(authenticate);

projectRouter.get('/', controller.list);
// PRD-005 / ADR-020: gate project creation on the plan's `project_create` limit
// (resource count = the user's active, non-archived projects). Shadow mode by default.
projectRouter.post(
  '/',
  requireEntitlement('project_create', {
    resourceCount: (req) =>
      prisma.project.count({ where: { ownerId: req.user!.id, isArchived: false } }),
  }),
  validate(createProjectSchema),
  controller.create,
);
projectRouter.get('/:id', controller.getById);
projectRouter.patch('/:id', canWrite, validate(updateProjectSchema), controller.update);
projectRouter.delete('/:id', canManage, controller.archive);
projectRouter.get('/:id/step0', controller.getStep0);
projectRouter.patch('/:id/step0', canWrite, validate(updateStep0Schema), controller.updateStep0);
projectRouter.get('/:id/adaptive-core', adaptiveCoreController.get);
// Modos del Copilot por intención (E2E Job-Driven §20): lectura del estado persistido, igual en
// todos los canales.
projectRouter.get('/:id/copilot-mode/:mode', async (req, res, next) => {
  try {
    const mode = req.params.mode as CopilotIntentMode;
    if (!['orient', 'work_with_me', 'unblock'].includes(mode)) {
      res.status(400).json({ success: false, error: { code: 'COPILOT_MODE_INVALID', message: 'Modo desconocido.' } });
      return;
    }
    const user = (req as AuthenticatedRequest).user!;
    const state = await adaptiveCoreService.getState(req.params.id, user.id, user.role);
    res.json({ success: true, data: resolveCopilotMode(req.params.id, mode, state as any) });
  } catch (err) {
    next(err);
  }
});

// Mission Review (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §18): lectura previa a Step 0.
projectRouter.get('/:id/mission-review', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    res.json({ success: true, data: await missionReview.get(req.params.id, user.id, user.role) });
  } catch (err) {
    next(err);
  }
});
projectRouter.get('/:id/adaptive-core/decision-readiness', validate(decisionReadinessQuerySchema, 'query'), adaptiveCoreController.getDecisionReadiness);
projectRouter.get('/:id/adaptive-core/decision-authority', validate(decisionAuthorityQuerySchema, 'query'), adaptiveCoreController.getDecisionAuthority);
projectRouter.get('/:id/adaptive-core/completion-routing', adaptiveCoreController.getCompletionRouting);
projectRouter.get('/:id/adaptive-core/history', adaptiveCoreController.getHistory);
projectRouter.get('/:id/adaptive-core/decision-requests', adaptiveCoreController.listDecisionRequests);
projectRouter.get('/:id/adaptive-core/decision-requests/:requestId', adaptiveCoreController.getDecisionRequest);
projectRouter.post('/:id/adaptive-core/decision-requests', canWrite, validate(decisionRequestCreateSchema), adaptiveCoreController.createDecisionRequest);
projectRouter.post('/:id/adaptive-core/decision-requests/:requestId/decide', validate(organizationalDecisionSchema), adaptiveCoreController.decideDecisionRequest);
projectRouter.get('/:id/adaptive-core/decisions', adaptiveCoreController.listDecisions);
projectRouter.get('/:id/adaptive-core/decisions/:decisionId', adaptiveCoreController.getDecision);
projectRouter.get('/:id/adaptive-core/continuation-routes', adaptiveCoreController.listContinuationRoutes);
projectRouter.post('/:id/adaptive-core/checkpoints/confirm', canWrite, validate(checkpointResponseSchema), adaptiveCoreController.confirmCheckpoint);
projectRouter.post('/:id/adaptive-core/critical-change', canWrite, validate(criticalChangeSchema), adaptiveCoreController.registerCriticalChange);
projectRouter.post('/:id/adaptive-core/critical-change/:criticalChangeId/transition/confirm', canWrite, validate(confirmCriticalChangeTransitionSchema), adaptiveCoreController.confirmCriticalChangeTransition);
projectRouter.post('/:id/adaptive-core/step0/brief/confirm', canWrite, validate(confirmBriefSchema), adaptiveCoreController.confirmStep0Brief);
projectRouter.post('/:id/adaptive-core/step1/output/confirm', canWrite, validate(confirmBriefSchema), adaptiveCoreController.confirmStep1Output);
projectRouter.post('/:id/adaptive-core/step2/output/confirm', canWrite, validate(confirmBriefSchema), adaptiveCoreController.confirmStep2Output);
projectRouter.post('/:id/adaptive-core/step3/output/confirm', canWrite, validate(confirmBriefSchema), adaptiveCoreController.confirmStep3Output);
projectRouter.post('/:id/adaptive-core/step4/output/confirm', canWrite, validate(confirmBriefSchema), adaptiveCoreController.confirmStep4Output);
projectRouter.patch('/:id/position', controller.updatePosition);
projectRouter.patch('/:id/sponsor-data', validate(updateSponsorDataSchema), controller.updateSponsorData);
