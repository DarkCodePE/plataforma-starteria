import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import type { ApiResponse } from '../../shared/types/api.types';
import { TruthService } from './truth.service';

function actorFrom(req: AuthenticatedRequest) {
  const user = req.user!;
  const effectiveRole = (req as any).projectAuthority?.effectiveRole;
  return { id: user.id, role: effectiveRole ?? user.role, type: 'human' as const };
}

export class TruthController {
  constructor(private service: TruthService) {}

  createSourceRef = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.createSourceRef(req.body, actorFrom(req));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createClaim = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.createClaim(req.body, actorFrom(req));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  attachEvidence = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.attachEvidence(req.body, actorFrom(req));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  recordValidation = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.recordValidation(req.body, actorFrom(req));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getClaimReadiness = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.getClaimReadiness(req.params.projectId, req.params.claimId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createAttentionItem = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.createAttentionItem(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listAttentionItems = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.listAttentionItems(req.params.projectId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  resolveAttentionItem = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.resolveAttentionItem(req.params.projectId, req.params.id, req.body, actorFrom(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createImpactAssertion = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.createImpactAssertion(req.body, actorFrom(req));
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  transitionImpact = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const data = await this.service.transitionImpact(req.params.projectId, req.params.id, req.body, actorFrom(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
