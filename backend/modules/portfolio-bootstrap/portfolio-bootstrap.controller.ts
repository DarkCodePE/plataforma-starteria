import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { PortfolioBootstrapService } from './portfolio-bootstrap.service';
import type { PortfolioOrganizationService } from './portfolio-organization.service';
import type { PortfolioSetupCompletionService } from './portfolio-setup-completion.service';
import type { PortfolioBootstrapContextService } from './portfolio-bootstrap-context.service';
import type { PortfolioBootstrapSemanticService } from './portfolio-bootstrap-semantic.service';
import type { PortfolioBootstrapSemanticOrchestratorService } from './portfolio-bootstrap-semantic-orchestrator.service';
import type { PortfolioBootstrapGoalTurnService } from './portfolio-bootstrap-goal-turn.service';
import { portfolioBootstrapGoalTurnBodySchema } from './portfolio-bootstrap-goal-turn.schemas';
import { buildContextProjection } from './portfolio-bootstrap-context-projection';
import { buildGoalQuestionPlan } from './portfolio-bootstrap-goal-question-planner';
import {
  portfolioBootstrapSemanticTurnRequestSchema,
  semanticE1Enabled,
} from './portfolio-bootstrap-semantic.schemas';
import {
  analyzeBodySchema,
  advancementConditionParamsSchema,
  bootstrapSessionParamsSchema,
  completePortfolioSetupBodySchema,
  confirmPortfolioBootstrapContextBodySchema,
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
  savePortfolioBootstrapContextDraftBodySchema,
  updateAnchorBodySchema,
  updateAdvancementConditionDispositionBodySchema,
  updateImportMappingBodySchema,
  updateWorkItemBodySchema,
  uploadImportBodySchema,
  workItemParamsSchema,
} from './portfolio-bootstrap.schemas';

export class PortfolioBootstrapController {
  constructor(
    private readonly service: PortfolioBootstrapService,
    private readonly organizationService: PortfolioOrganizationService,
    private readonly completionService: PortfolioSetupCompletionService,
    private readonly contextService: PortfolioBootstrapContextService,
    private readonly semanticService: PortfolioBootstrapSemanticService,
    private readonly semanticOrchestrator: PortfolioBootstrapSemanticOrchestratorService,
    private readonly goalTurnService: PortfolioBootstrapGoalTurnService,
  ) {}

  submitSemanticTurn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      if (!semanticE1Enabled()) {
        throw new AppError(503, 'La interpretación semántica E1 no está habilitada.', 'PORTFOLIO_SEMANTIC_DISABLED');
      }
      const idempotencyKey = req.get('Idempotency-Key') ?? '';
      if (!idempotencyKey.trim()) {
        throw AppError.badRequest('Falta Idempotency-Key.', 'PORTFOLIO_SEMANTIC_IDEMPOTENCY_REQUIRED');
      }
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = portfolioBootstrapSemanticTurnRequestSchema.parse(req.body);
      const output = await this.semanticOrchestrator.processTurn({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        idempotencyKey,
        expectedVersion: body.expectedVersion,
        inputText: body.inputText,
        answeredQuestionId: body.answeredQuestionId,
      });
      res.status(output.processing ? 202 : 200).json({ success: true, data: output.result });
    } catch (error) { next(error); }
  };

  /**
   * Read-only E2 plan. Existing service access checks govern session and
   * confirmed ContextReview ownership. No provider, updateAnchor or confirm.
   */
  getGoalTurns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.goalTurnService.getTurns({
        sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  appendGoalTurn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = portfolioBootstrapGoalTurnBodySchema.parse(req.body);
      const data = await this.goalTurnService.appendTurn({
        sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions,
        idempotencyKey: req.get('Idempotency-Key') ?? '', body,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  getGoalQuestionPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const access = { sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions };
      const session = await this.service.getSession(access);
      if (!session.anchor) throw AppError.conflict('La sesión no tiene objetivo para revisar.', 'PORTFOLIO_GOAL_ANCHOR_MISSING');
      const review = await this.contextService.getContext(access);
      // An E1 correction not yet reconfirmed is not a safe source for new E2 questions.
      const confirmedContext = review?.status === 'confirmed' && !review.hasPendingCorrection
        ? review : null;
      const plan = buildGoalQuestionPlan({
        sessionId,
        anchor: {
          id: session.anchor.id,
          version: session.anchor.version,
          status: session.anchor.status,
          outcomeStatement: session.anchor.outcomeStatement,
          contextSummary: session.anchor.contextSummary,
          decisionToEnable: session.anchor.decisionToEnable,
          businessSignalValue: session.anchor.businessSignalValue,
          businessSignalStatus: session.anchor.businessSignalStatus,
          sourceRefs: session.anchor.sourceRefs,
        },
        contextReview: confirmedContext ? {
          id: confirmedContext.id,
          status: confirmedContext.status,
          version: confirmedContext.version,
          effectiveContext: confirmedContext.effectiveContext ? {
            situation: { value: confirmedContext.effectiveContext.situation.value },
          } : null,
        } : null,
      });
      res.json({ success: true, data: plan });
    } catch (err) { next(err); }
  };

  getContextProposals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      // Both reads enforce the same owner/tenant access as the governed E1 sources.
      const access = {
        sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions,
      };
      const review = await this.contextService.getContext(access);
      const semantic = await this.semanticService.getState(access);
      // Only pass the exact, read-only fields used by the projection.
      // This keeps governed DTOs independent from the candidate input contract
      // without casts or changes to canonical persistence.
      const projectionInput = {
        review: review ? {
          id: review.id,
          sessionId: review.sessionId,
          version: review.version,
          draft: {
            situation: {
              value: review.draft.situation.value,
              provenance: review.draft.situation.provenance,
              sourceRef: review.draft.situation.sourceRef
                ? { kind: review.draft.situation.sourceRef.kind }
                : undefined,
            },
            pilotExperience: { value: review.draft.pilotExperience.value },
            gaps: review.draft.gaps,
          },
        } : null,
        semantic: {
          state: semantic.state ? {
            dispositions: semantic.state.dispositions.map((item) => ({
              conceptId: item.conceptId,
              disposition: item.disposition,
            })),
            factLedger: semantic.state.factLedger.map((fact) => ({
              conceptId: fact.conceptId,
              value: fact.value,
              provenance: fact.provenance,
              status: fact.status,
              turnId: fact.turnId,
              semanticVersion: fact.semanticVersion,
              evidenceRefs: fact.evidenceRefs.map((ref) => (
                ref.kind === 'user_input'
                  ? { kind: ref.kind, quote: ref.quote }
                  : { kind: ref.kind }
              )),
            })),
          } : null,
          turns: semantic.turns.map((turn) => ({ id: turn.id, inputText: turn.inputText })),
        },
      } satisfies Parameters<typeof buildContextProjection>[0];
      res.json({ success: true, data: buildContextProjection(projectionInput) });
    } catch (error) { next(error); }
  };

  getSemanticContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.semanticService.getState({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  getContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.contextService.getContext({
        sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  saveContextDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const idempotencyKey = req.get('Idempotency-Key') ?? '';
      if (!idempotencyKey.trim()) throw AppError.badRequest('Falta Idempotency-Key.', 'PORTFOLIO_CONTEXT_IDEMPOTENCY_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = savePortfolioBootstrapContextDraftBodySchema.parse(req.body);
      const data = await this.contextService.saveDraft({
        sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions,
        idempotencyKey,
        expectedVersion: body.expectedVersion!,
        context: body.context!,
        sourceCompanyContext: body.sourceCompanyContext ? {
          companyId: body.sourceCompanyContext.companyId!,
          versionId: body.sourceCompanyContext.versionId!,
          versionNumber: body.sourceCompanyContext.versionNumber!,
        } : null,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  confirmContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const idempotencyKey = req.get('Idempotency-Key') ?? '';
      if (!idempotencyKey.trim()) throw AppError.badRequest('Falta Idempotency-Key.', 'PORTFOLIO_CONTEXT_IDEMPOTENCY_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const body = confirmPortfolioBootstrapContextBodySchema.parse(req.body);
      const data = await this.contextService.confirm({
        sessionId, authenticatedUserId: req.user.id, permissions: req.user.permissions,
        idempotencyKey, expectedVersion: body.expectedVersion,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  getE5Eligibility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const data = await this.organizationService.getE5Eligibility({
        sessionId,
        authenticatedUserId: req.user.id,
        roles: req.user.roles,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  updateAdvancementConditionDisposition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const { sessionId, conditionId } = advancementConditionParamsSchema.parse(req.params);
      const body = updateAdvancementConditionDispositionBodySchema.parse(req.body);
      const data = await this.organizationService.updateAdvancementConditionDisposition({
        sessionId,
        conditionId,
        authenticatedUserId: req.user.id,
        roles: req.user.roles,
        permissions: req.user.permissions,
        disposition: body.disposition!,
        expectedVersion: body.expectedVersion!,
        reason: body.reason!,
        evidenceRefs: body.evidenceRefs!,
        idempotencyKey: req.get('Idempotency-Key') ?? '',
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  completeSetup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_SETUP_AUTH_REQUIRED');
      const { sessionId } = bootstrapSessionParamsSchema.parse(req.params);
      const { confirmed } = completePortfolioSetupBodySchema.parse(req.body);
      const data = await this.completionService.complete({
        sessionId,
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        confirmed,
        idempotencyKey: req.get('Idempotency-Key') ?? '',
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

  openAdditionalFront = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_SETUP_AUTH_REQUIRED');
      const data = await this.completionService.openAdditionalFront({
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
        idempotencyKey: req.get('Idempotency-Key') ?? '',
      });
      res.json({ success: true, data });
    } catch (error) { next(error); }
  };

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

  listResumable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.id) throw AppError.unauthorized('No autorizado.', 'PORTFOLIO_BOOTSTRAP_AUTH_REQUIRED');
      const data = await this.service.listResumable({
        authenticatedUserId: req.user.id,
        permissions: req.user.permissions,
      });
      res.json({ success: true, data });
    } catch (err) { next(err); }
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
