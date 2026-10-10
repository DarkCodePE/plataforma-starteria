import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { EvidenceService } from './evidence.service';
import { ApiResponse } from '../../shared/types/api.types';

export class EvidenceController {
  constructor(private service: EvidenceService) {}

  list = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const evidence = await this.service.listEvidence(req.params.projectId);
      res.json({ success: true, data: evidence });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      // ownerId es el id del usuario (FK a User); pasar el nombre daba 500.
      const evidence = await this.service.createEvidence(req.params.projectId, user.id, req.body);
      res.status(201).json({ success: true, data: evidence });
    } catch (err) {
      next(err);
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const evidence = await this.service.updateEvidenceStatus(
        req.params.projectId,
        req.params.id,
        req.body.status
      );
      res.json({ success: true, data: evidence });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      await this.service.deleteEvidence(req.params.projectId, req.params.id);
      res.json({ success: true, data: { message: 'Evidencia eliminada' } });
    } catch (err) {
      next(err);
    }
  };
}
