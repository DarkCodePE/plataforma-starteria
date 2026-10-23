import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { PortfolioBootstrapService } from './portfolio-bootstrap.service';
import type { PortfolioOrganizationService } from './portfolio-organization.service';
import {
  analyzeBodySchema,
  bootstrapSessionParamsSchema,
  confirmPortfolioOrganizationBodySchema,
  correctProposedMutationBodySchema,
  fromContinuationBodySchema,
  fromPortfolioSetupBodySchema,
  importBatchParamsSchema,
  manualWorkItemBodySchema,
  pasteWorkItemsBodySchema,
  proposedMutationParamsSchema,
  proposedMutationsQuerySchema,
  reviewProposedMutationBodySchema,
  savePortfolioOrganizationProposalBodySchema,
  updateAnchorBodySchema,
  updateImportMappingBodySchema,
  updateWorkItemBodySchema,
  uploadImportBodySchema,
  workItemParamsSchema,
} from './portfolio-bootstrap.schemas';

export class PortfolioBootstrapController {
  constructor(
    private readonly service: PortfolioBootstrapService,
    private readonly organizationService: PortfolioOrganizationService,
  ) {}

  getOrganizationProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.organizationService.getProposal({
        sessionId,
        authenticatedUserId: req.user.id,
        roles: req.user.roles,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  saveOrganizationProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = savePortfolioOrganizationProposalBodySchema.parse(req.body);
      const data = await this.organizationService.saveReviewedProposal({
        sessionId,
        authenticatedUserId: req.user.id,
        roles: req.user.roles,
        permissions: req.user.permissions,
        expectedVersion: body.expectedVersion,
        payload: body.payload,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  confirmOrganizationProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = confirmPortfolioOrganizationBodySchema.parse(req.body);
      const data = await this.organizationService.confirmAndMaterialize({
        sessionId,
        authenticatedUserId: req.user.id,
        roles: req.user.roles,
        permissions: req.user.permissions,
        proposalVersion: body.proposalVersion,
        idempotencyKey: req.get('Idempotency-Key') ?? '',
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  createOrReuseDirect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const data = await this.service.createOrReuseDirect({
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getCurrent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const data = await this.service.getCurrent({
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createOrReuseFromPortfolioSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { snapshotId } = fromPortfolioSetupBodySchema.parse(req.body);
      const data = await this.service.createOrReuseFromPortfolioSetup({ snapshotId, authenticatedUserId: req.user.id });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  createOrReuseFromContinuation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const body = fromContinuationBodySchema.parse(req.body);
      const data = await this.service.createOrReuseFromContinuation({
        portfolioEntryContinuationId: body.portfolioEntryContinuationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        requestId: getRequestId(req),
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.service.getSession({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateAnchor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = updateAnchorBodySchema.parse(req.body);
      const data = await this.service.updateAnchor({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmAnchor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.service.confirmAnchor({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  pasteWorkItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = pasteWorkItemsBodySchema.parse(req.body);
      const data = await this.service.pasteWorkItems({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
        idempotencyKey: req.get('Idempotency-Key') ?? undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  addManualWorkItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = manualWorkItemBodySchema.parse(req.body);
      const data = await this.service.addManualWorkItem({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
        idempotencyKey: req.get('Idempotency-Key') ?? undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  declareNoExistingWork = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.service.declareNoExistingWork({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listWorkItems = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.service.listWorkItems({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  uploadImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = uploadImportBodySchema.parse(req.body);
      const data = await this.service.uploadImport({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, importId } = importBatchParamsSchema.parse(req.params);
      const data = await this.service.getImport({
        sessionId,
        importId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getImportPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, importId } = importBatchParamsSchema.parse(req.params);
      const data = await this.service.getImport({
        sessionId,
        importId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateImportMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, importId } = importBatchParamsSchema.parse(req.params);
      const body = updateImportMappingBodySchema.parse(req.body);
      const data = await this.service.updateImportMapping({
        sessionId,
        importId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  commitImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, importId } = importBatchParamsSchema.parse(req.params);
      const data = await this.service.commitImport({
        sessionId,
        importId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        idempotencyKey: req.get('Idempotency-Key') ?? undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateWorkItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, workItemId } = workItemParamsSchema.parse(req.params);
      const body = updateWorkItemBodySchema.parse(req.body);
      const data = await this.service.updateWorkItem({
        sessionId,
        workItemId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  removeWorkItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, workItemId } = workItemParamsSchema.parse(req.params);
      const data = await this.service.removeWorkItem({
        sessionId,
        workItemId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      analyzeBodySchema.parse(req.body);
      const data = await this.service.analyze({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        idempotencyKey: req.get('Idempotency-Key') ?? undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listProposedMutations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const query = proposedMutationsQuerySchema.parse(req.query);
      const data = await this.service.listProposedMutations({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        status: query.status,
        targetType: query.targetType,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmProposedMutation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, mutationId } = proposedMutationParamsSchema.parse(req.params);
      reviewProposedMutationBodySchema.parse(req.body);
      const data = await this.service.confirmProposedMutation({
        sessionId,
        mutationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  reopenProposedMutationReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, mutationId } = proposedMutationParamsSchema.parse(req.params);
      const body = reviewProposedMutationBodySchema.parse(req.body);
      const data = await this.service.reopenProposedMutationReview({
        sessionId, mutationId, authenticatedUserId: req.user.id, permissions: req.user.permissions, reviewNote: body.reviewNote,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  rejectProposedMutation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, mutationId } = proposedMutationParamsSchema.parse(req.params);
      const body = reviewProposedMutationBodySchema.parse(req.body);
      const data = await this.service.rejectProposedMutation({
        sessionId,
        mutationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        reviewNote: body.reviewNote,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  leaveProposedMutationPending = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, mutationId } = proposedMutationParamsSchema.parse(req.params);
      const body = reviewProposedMutationBodySchema.parse(req.body);
      const data = await this.service.leaveProposedMutationPending({
        sessionId,
        mutationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        reviewNote: body.reviewNote,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  correctProposedMutation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, mutationId } = proposedMutationParamsSchema.parse(req.params);
      const body = correctProposedMutationBodySchema.parse(req.body);
      const data = await this.service.correctProposedMutation({
        sessionId,
        mutationId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        body,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  publishFirstReading = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.service.publishFirstReading({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        idempotencyKey: req.get('Idempotency-Key') ?? undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getLatestReading = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.service.getLatestReading({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

function getRequestId(req: Request): string {
  return (req as Request & { requestId?: string; id?: string }).requestId
    ?? (req as Request & { requestId?: string; id?: string }).id
    ?? 'unknown';
}
