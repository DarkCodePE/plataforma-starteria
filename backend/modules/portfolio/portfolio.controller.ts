import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { PortfolioService } from './portfolio.service';
import { ApiResponse } from '../../shared/types/api.types';
import { PortfolioHomeReadService } from './portfolio-home.read-service';
import type { PortfolioContextAuthorityService } from '../../shared/portfolio-context/portfolio-context-authority.service';
import { AppError } from '../../shared/errors/AppError';
import {
  dryRunProjectionReadFailure,
  shouldFailStrategicFrontProjectionRead,
} from '../copilot/application/copilot-dry-run-failure-injection';

export class PortfolioController {
  constructor(
    private service: PortfolioService,
    private readonly homeReadService?: PortfolioHomeReadService,
    private readonly portfolioContextAuthority?: PortfolioContextAuthorityService,
  ) {}

  getHome = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      if (!this.homeReadService || !req.user?.id) {
        throw new Error('Portfolio Home read service is not configured');
      }
      const actorUser = req.user as unknown as NonNullable<Express.Request['user']>;
      if (hasExplicitOrganizationScope(req)) {
        throw AppError.forbidden('La organizacion debe resolverse desde el contexto autorizado.', 'PORTFOLIO_SCOPE_FORBIDDEN');
      }
      const contextResolution = this.portfolioContextAuthority
        ? await this.portfolioContextAuthority.resolve({
          actorUserId: req.user.id,
          authSessionId: actorUser.authSessionId,
          permissions: actorUser.permissions,
        })
        : { status: 'no_context' as const };
      const data = await this.homeReadService.getHome({
        actorUserId: actorUser.id,
        permissions: actorUser.permissions,
      }, contextResolution);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Strategic Fronts ────────────────────────────────────────────────────────

  listStrategicFronts = async (
    _req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      if (shouldFailStrategicFrontProjectionRead()) {
        throw dryRunProjectionReadFailure();
      }
      const data = await this.service.listStrategicFronts();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createStrategicFront = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createStrategicFront(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateStrategicFront = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateStrategicFront(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  deleteStrategicFront = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      await this.service.deleteStrategicFront(req.params.id);
      res.json({ success: true, data: { message: 'Frente estrategico eliminado' } });
    } catch (err) {
      next(err);
    }
  };

  // ─── Challenges ──────────────────────────────────────────────────────────────

  listChallenges = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listChallenges(req.params.frontId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createChallenge = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createChallenge(req.params.frontId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateChallenge = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateChallenge(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  activateOpenCall = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.activateOpenCall(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  publishChallenge = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.publishChallenge(req.params.id);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Invitations ─────────────────────────────────────────────────────────────

  addInvitation = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.addInvitation(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateInvitation = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateInvitation(req.params.invId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Squad Members ────────────────────────────────────────────────────────────

  addSquadMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.addSquadMember(req.params.id, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateSquadMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateSquadMember(req.params.memberId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Challenge Team Members (ADR-023) ──────────────────────────────────────────

  listChallengeTeam = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listChallengeTeam(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  addChallengeTeamMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.addChallengeTeamMember(req.params.challengeId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateChallengeTeamMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateChallengeTeamMember(req.params.memberId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  removeChallengeTeamMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      await this.service.removeChallengeTeamMember(req.params.memberId);
      res.json({ success: true, data: { id: req.params.memberId } });
    } catch (err) {
      next(err);
    }
  };

  // ─── Initiative Team (resolution + override, #110/#114) ─────────────────────────

  getInitiativeTeam = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.resolveInitiativeTeam(req.params.projectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  upsertInitiativeTeamMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.upsertInitiativeTeamMember(
        req.params.projectId,
        req.params.userId,
        req.body,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  removeInitiativeTeamMember = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      await this.service.removeInitiativeTeamMember(req.params.projectId, req.params.userId);
      res.json({ success: true, data: { projectId: req.params.projectId, userId: req.params.userId } });
    } catch (err) {
      next(err);
    }
  };

  // ─── Initiatives ──────────────────────────────────────────────────────────────

  listInitiatives = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listInitiativesForChallenge(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getInitiativeMeta = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.getInitiativeMeta(req.params.projectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  upsertInitiativeMeta = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.upsertInitiativeMeta(req.params.projectId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Overlaps ─────────────────────────────────────────────────────────────────

  listOverlaps = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listOverlaps(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createOverlap = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createOverlap(req.params.challengeId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  // ─── Executive Outputs ────────────────────────────────────────────────────────

  listExecutiveOutputs = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.listExecutiveOutputs(req.params.challengeId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createExecutiveOutput = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.createExecutiveOutput(req.params.challengeId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateExecutiveOutput = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ) => {
    try {
      const data = await this.service.updateExecutiveOutput(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}

function hasExplicitOrganizationScope(req: AuthenticatedRequest): boolean {
  const query = req.query as Record<string, unknown>;
  return ['organizationId', 'orgId', 'organization'].some((key) => query[key] !== undefined);
}
