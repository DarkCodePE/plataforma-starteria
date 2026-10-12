import { Router, type RequestHandler } from 'express';
import { prisma } from '../../shared/db/prisma';
import { authenticate } from '../auth/auth.middleware';
import { PortfolioBootstrapController } from './portfolio-bootstrap.controller';
import { PortfolioBootstrapService } from './portfolio-bootstrap.service';

export interface PortfolioBootstrapRouterDeps {
  authenticate?: RequestHandler;
  service?: PortfolioBootstrapService;
}

export function buildPortfolioBootstrapRouter(deps: PortfolioBootstrapRouterDeps = {}): Router {
  const router = Router();
  const auth = deps.authenticate ?? authenticate;
  const controller = new PortfolioBootstrapController(
    deps.service ?? new PortfolioBootstrapService(prisma),
  );

  router.post('/sessions/from-continuation', auth, controller.createOrReuseFromContinuation);
  router.post('/sessions/from-portfolio-setup-continuity', auth, controller.createOrReuseFromPortfolioSetup);
  router.get('/sessions/:sessionId', auth, controller.getSession);
  router.patch('/sessions/:sessionId/anchor', auth, controller.updateAnchor);
  router.post('/sessions/:sessionId/anchor/confirm', auth, controller.confirmAnchor);
  router.post('/sessions/:sessionId/work-items/paste', auth, controller.pasteWorkItems);
  router.post('/sessions/:sessionId/work-items/manual', auth, controller.addManualWorkItem);
  router.post('/sessions/:sessionId/work-items/none', auth, controller.declareNoExistingWork);
  router.get('/sessions/:sessionId/work-items', auth, controller.listWorkItems);
  router.post('/sessions/:sessionId/imports', auth, controller.uploadImport);
  router.get('/sessions/:sessionId/imports/:importId/preview', auth, controller.getImportPreview);
  router.patch('/sessions/:sessionId/imports/:importId/mapping', auth, controller.updateImportMapping);
  router.post('/sessions/:sessionId/imports/:importId/commit', auth, controller.commitImport);
  router.get('/sessions/:sessionId/imports/:importId', auth, controller.getImport);
  router.patch('/sessions/:sessionId/work-items/:workItemId', auth, controller.updateWorkItem);
  router.delete('/sessions/:sessionId/work-items/:workItemId', auth, controller.removeWorkItem);
  router.post('/sessions/:sessionId/analyze', auth, controller.analyze);
  router.get('/sessions/:sessionId/proposed-mutations', auth, controller.listProposedMutations);
  router.patch('/sessions/:sessionId/proposed-mutations/:mutationId', auth, controller.correctProposedMutation);
  router.post('/sessions/:sessionId/proposed-mutations/:mutationId/confirm', auth, controller.confirmProposedMutation);
  router.post('/sessions/:sessionId/proposed-mutations/:mutationId/reject', auth, controller.rejectProposedMutation);
  router.post('/sessions/:sessionId/proposed-mutations/:mutationId/review', auth, controller.leaveProposedMutationPending);
  router.post('/sessions/:sessionId/readings', auth, controller.publishFirstReading);
  router.get('/sessions/:sessionId/readings/latest', auth, controller.getLatestReading);

  return router;
}

export const portfolioBootstrapRouter = buildPortfolioBootstrapRouter();
