import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { AdaptiveCoreService } from './adaptive-core.service';

export class AdaptiveCoreController {
  constructor(private service: AdaptiveCoreService) {}

  get = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getState(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmCheckpoint = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmCheckpoint(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  activateInitiativeCycle = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.activateInitiativeCycle(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  registerCriticalChange = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.registerCriticalChange(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmCriticalChangeTransition = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmCriticalChangeTransition(req.params.id, user.id, user.role, req.params.criticalChangeId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getDecisionReadiness = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getDecisionReadiness(req.params.id, user.id, user.role, String(req.query.decisionType) as any);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getDecisionAuthority = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getDecisionAuthority(req.params.id, user.id, user.role, String(req.query.decisionType) as any);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getCompletionRouting = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getInitiativeCompletionRouting(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getInitiativeHistory(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  createDecisionRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.createDecisionRequest(req.params.id, user.id, user.role, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listDecisionRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.listDecisionRequests(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getDecisionRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getDecisionRequest(req.params.id, user.id, user.role, req.params.requestId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  decideDecisionRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.decideDecisionRequest(req.params.id, user.id, user.role, req.params.requestId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listDecisions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.listDecisions(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getDecision = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getDecision(req.params.id, user.id, user.role, req.params.decisionId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listContinuationRoutes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.listContinuationRoutes(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmStep0Brief = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmStep0Brief(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmStep1Output = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmStep1Output(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmStep2Output = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmStep2Output(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmStep3Output = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmStep3Output(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  confirmStep4Output = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.confirmStep4Output(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };
}
