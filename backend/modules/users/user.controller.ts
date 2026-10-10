import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { UserService } from './user.service';
import { ApiResponse } from '../../shared/types/api.types';

export class UserController {
  constructor(private service: UserService) {}

  /** ADR-029: lista de usuarios para la pantalla de administración de roles. */
  listUsers = async (_req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      res.json({ success: true, data: await this.service.listUsers() });
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const profile = await this.service.getProfile(user.id);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const user = req.user!;
      const profile = await this.service.updateProfile(user.id, req.body);
      res.json({ success: true, data: profile });
    } catch (err) {
      next(err);
    }
  };

  // ADR-028: rol de PLATAFORMA. `updateMemberRole` (más abajo) es el rol de PROYECTO.
  updatePlatformRole = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const actor = req.user!;
      // ADR-029: `roles` (conjunto) gana; `role` se acepta como el conjunto de un
      // elemento para no romper a los clientes que ya usan el endpoint.
      const updated = await this.service.updatePlatformRoles(
        actor.id,
        req.params.userId,
        req.body.roles ?? [req.body.role],
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  getTeam = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const team = await this.service.getTeam(req.params.projectId);
      res.json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  };

  acceptInvitation = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const member = await this.service.acceptInvitation(req.params.projectId, req.user!.id);
      res.json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  };

  inviteMember = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const member = await this.service.inviteMember(req.params.projectId, req.body);
      res.status(201).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  };

  updateMemberRole = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      const member = await this.service.updateMemberRole(
        req.params.projectId,
        req.params.memberId,
        req.body.role
      );
      res.json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  };

  removeMember = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction) => {
    try {
      await this.service.removeMember(req.params.projectId, req.params.memberId);
      res.json({ success: true, data: { message: 'Miembro eliminado' } });
    } catch (err) {
      next(err);
    }
  };
}
