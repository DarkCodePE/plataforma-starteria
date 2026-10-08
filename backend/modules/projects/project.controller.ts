import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { ProjectService } from './project.service';
import { ApiResponse } from '../../shared/types/api.types';
import { AppError } from '../../shared/errors/AppError';

export class ProjectController {
  constructor(private service: ProjectService) {}

  list = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const projects = await this.service.listProjects(user.id, user.role);
      res.json({ success: true, data: projects });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const project = await this.service.createProject(user.id, req.body, user.role);
      res.status(201).json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const project = await this.service.getProjectForRead(req.params.id, user.id, user.role);
      res.json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const project = await this.service.updateProject(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  };

  archive = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      await this.service.archiveProject(req.params.id, user.id, user.role);
      res.json({ success: true, data: { message: 'Proyecto archivado' } });
    } catch (err) {
      next(err);
    }
  };

  getStep0 = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const data = await this.service.getStep0(req.params.id, user.id, user.role);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateStep0 = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      if (!user) throw AppError.unauthorized();
      const { status, ...step0Data } = req.body;
      const project = await this.service.updateStep0(req.params.id, user.id, user.role, step0Data, status);
      res.json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  };

  updatePosition = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      await this.service.updateLastPosition(req.params.id, user.id, req.body);
      res.json({ success: true, data: { message: 'Posicion actualizada' } });
    } catch (err) {
      next(err);
    }
  };

  updateSponsorData = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const project = await this.service.updateSponsorData(req.params.id, user.id, user.role, req.body);
      res.json({ success: true, data: project });
    } catch (err) {
      next(err);
    }
  };
}
