/**
 * Project authorization for the MVP v1.2 tenant and assignment invariants.
 *
 * - Every role, including admin, is constrained to its canonical organization.
 * - Admin may operate within that tenant, never globally by role alone.
 * - Mentor requires an explicit MentorSession (or an active TeamMember row).
 * - Portfolio Lead assignment is read-only.
 * - Pending team invitations do not expose corporate Project data.
 */
import type { NextFunction, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { AppError } from '../../shared/errors/AppError';

export type ProjectTeamNeed = 'read' | 'write' | 'manage';
export type ProjectCapability =
  | 'initiative:read'
  | 'initiative:write'
  | 'initiative:manage'
  | 'truth:validate-method'
  | 'cycle:activate';
type ProjectIdSource = string | ((req: AuthenticatedRequest) => string | undefined);

const WRITE_ROLES = new Set(['OWNER', 'EDITOR']);

export function assertProjectTeamAccess(input: {
  platformRole: string;
  teamRole: string | null;
  teamStatus?: string | null;
  isAssignedPortfolioLead: boolean;
  isAssignedMentor?: boolean;
  sameOrganization?: boolean;
  need: ProjectTeamNeed;
}): void {
  const {
    platformRole,
    teamRole,
    teamStatus,
    isAssignedPortfolioLead,
    isAssignedMentor = false,
    sameOrganization = true,
    need,
  } = input;

  if (!sameOrganization) {
    throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
  }
  if (platformRole === 'admin') return;

  if (platformRole === 'mentor' && isAssignedMentor) {
    if (need === 'manage') {
      throw AppError.forbidden('Solo el owner de la iniciativa puede hacer esto.', 'PROJECT_OWNER_REQUIRED');
    }
    return;
  }

  if (!teamRole) {
    if (!isAssignedPortfolioLead) throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
    if (need !== 'read') throw AppError.forbidden('Solo el equipo de la iniciativa puede avanzar sus Steps.', 'PROJECT_TEAM_ACCESS_REQUIRED');
    return;
  }
  if (teamStatus !== 'ACTIVE') {
    throw AppError.forbidden('Tu relacion con esta iniciativa no esta activa.', 'TEAM_MEMBERSHIP_INACTIVE', {
      hint: 'Acepta la invitacion desde la iniciativa para empezar a trabajar en ella.',
    });
  }
  if (need === 'write' && !WRITE_ROLES.has(teamRole)) {
    throw AppError.forbidden('Tu rol en el equipo es de solo lectura.', 'PROJECT_TEAM_ROLE_REQUIRED', {
      hint: 'Pide al owner de la iniciativa que te de rol de editor.',
    });
  }
  if (need === 'manage' && teamRole !== 'OWNER') {
    throw AppError.forbidden('Solo el owner de la iniciativa puede hacer esto.', 'PROJECT_OWNER_REQUIRED');
  }
}

type ResolvedProjectAuthority = {
  projectId: string;
  organizationId: string;
  platformRoles: string[];
  teamRole: string | null;
  teamStatus: string | null;
  isAssignedPortfolioLead: boolean;
};

async function resolveProjectAuthority(
  prisma: PrismaClient,
  req: AuthenticatedRequest,
  projectId: string,
): Promise<ResolvedProjectAuthority> {
  const userId = req.user!.id;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true, organizationId: true },
  });
  if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');

  const [member, governance] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { projectId, userId },
      select: { role: true, status: true },
    }),
    (prisma as any).initiativeGovernance.findUnique({ where: { projectId } }),
  ]);
  const effectiveMember = member
    ?? (project.ownerId === userId ? { role: 'OWNER', status: 'ACTIVE' } : null);
  const isAssignedPortfolioLead = !effectiveMember && governance?.portfolioLeadUserId === userId;

  // Resolve a resource relation before returning a tenant-specific error.
  if (!effectiveMember && !isAssignedPortfolioLead) {
    throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
  }
  if (!project.organizationId) {
    throw AppError.conflict(
      'La iniciativa no tiene organizacion configurada.',
      'PROJECT_TENANT_NOT_CONFIGURED',
    );
  }

  const [user, organizationMember] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: true, roles: true },
    }),
    prisma.organizationMember.findFirst({
      where: { userId, organizationId: project.organizationId },
      select: { id: true },
    }),
  ]);
  if (!user?.isActive || !organizationMember) {
    throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
  }

  const tokenRoles = (req.user as any).roles as string[] | undefined;
  const platformRoles = [...new Set([
    ...(tokenRoles ?? []),
    ...(user.roles ?? []),
    user.role,
    req.user!.role,
  ].filter(Boolean))];

  return {
    projectId,
    organizationId: project.organizationId,
    platformRoles,
    teamRole: effectiveMember?.role ?? null,
    teamStatus: effectiveMember?.status ?? null,
    isAssignedPortfolioLead,
  };
}

function effectiveRole(authority: ResolvedProjectAuthority): string {
  if (authority.teamRole === 'OWNER') return 'owner';
  if (authority.teamRole === 'EDITOR') return 'editor';
  if (authority.isAssignedPortfolioLead) return 'portfolio_lead';
  if (authority.platformRoles.includes('mentor')) return 'mentor';
  if (authority.platformRoles.includes('sponsor')) return 'sponsor';
  return 'viewer';
}

function assertProjectCapability(
  authority: ResolvedProjectAuthority,
  capability: ProjectCapability,
): void {
  if (capability === 'initiative:read') {
    assertProjectTeamAccess({
      platformRole: '', teamRole: authority.teamRole, teamStatus: authority.teamStatus,
      isAssignedPortfolioLead: authority.isAssignedPortfolioLead, need: 'read',
    });
    return;
  }
  if (capability === 'initiative:write' || capability === 'initiative:manage') {
    assertProjectTeamAccess({
      platformRole: '', teamRole: authority.teamRole, teamStatus: authority.teamStatus,
      isAssignedPortfolioLead: authority.isAssignedPortfolioLead,
      need: capability === 'initiative:manage' ? 'manage' : 'write',
    });
    return;
  }
  if (capability === 'truth:validate-method') {
    if (
      authority.teamStatus !== 'ACTIVE'
      || !authority.teamRole
      || !authority.platformRoles.includes('mentor')
    ) {
      throw AppError.forbidden(
        'La validacion independiente requiere un Mentor asignado a esta iniciativa.',
        'TRUTH_VALIDATOR_REQUIRED',
      );
    }
    return;
  }
  if (
    capability === 'cycle:activate'
    && (authority.teamStatus !== 'ACTIVE' || authority.teamRole !== 'OWNER')
  ) {
    throw AppError.forbidden(
      'Solo el Owner puede activar el ciclo de la iniciativa.',
      'PROJECT_OWNER_REQUIRED',
    );
  }
}

function sourceProjectId(req: AuthenticatedRequest, source: ProjectIdSource): string | undefined {
  return typeof source === 'function' ? source(req) : req.params[source];
}

export function requireProjectTeamAccess(
  prisma: PrismaClient,
  need: ProjectTeamNeed | ((req: AuthenticatedRequest) => ProjectTeamNeed),
  projectIdSource: ProjectIdSource = 'id',
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const projectId = sourceProjectId(req, projectIdSource);
      if (!projectId) throw AppError.badRequest('ID de proyecto requerido.', 'PROJECT_ID_REQUIRED');
      const { id: userId, role } = req.user!;
      const resolvedNeed = typeof need === 'function' ? need(req) : need;
      const db = prisma as any;
      const [project, user, member, governance, mentorSession] = await Promise.all([
        db.project.findUnique({ where: { id: projectId }, select: { organizationId: true } }),
        db.user.findUnique({ where: { id: userId }, select: { organizationId: true } }),
        db.teamMember.findFirst({ where: { projectId, userId }, select: { role: true, status: true } }),
        db.initiativeGovernance?.findUnique?.({ where: { projectId } }) ?? null,
        role === 'mentor'
          ? db.mentorSession?.findFirst?.({ where: { projectId, mentorId: userId }, select: { id: true } }) ?? null
          : null,
      ]);
      const sameOrganization = Boolean(
        project?.organizationId
        && user?.organizationId
        && project.organizationId === user.organizationId,
      );
      assertProjectTeamAccess({
        platformRole: role,
        teamRole: member?.role ?? null,
        teamStatus: member?.status ?? null,
        isAssignedPortfolioLead: !member && governance?.portfolioLeadUserId === userId,
        isAssignedMentor: Boolean(mentorSession),
        sameOrganization,
        need: resolvedNeed,
      });
      (req as any).projectAuthority = {
        projectId,
        organizationId: project?.organizationId,
        effectiveRole: member?.role === 'OWNER'
          ? 'owner'
          : member?.role === 'EDITOR'
            ? 'editor'
            : mentorSession
              ? 'mentor'
              : governance?.portfolioLeadUserId === userId
                ? 'portfolio_lead'
                : 'viewer',
        need: resolvedNeed,
      };
      next();
    } catch (err) {
      if (err instanceof AppError && err.code === 'PROJECT_ACCESS_DENIED') {
        next(AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND'));
        return;
      }
      next(err);
    }
  };
}

export function requireProjectCapability(
  prisma: PrismaClient,
  capability: ProjectCapability | ((req: AuthenticatedRequest) => ProjectCapability),
  projectIdSource: ProjectIdSource = 'id',
) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const projectId = sourceProjectId(req, projectIdSource);
      if (!projectId) throw AppError.badRequest('ID de proyecto requerido.', 'PROJECT_ID_REQUIRED');
      const resolvedCapability = typeof capability === 'function' ? capability(req) : capability;
      const authority = await resolveProjectAuthority(prisma, req, projectId);
      assertProjectCapability(authority, resolvedCapability);
      (req as any).projectAuthority = {
        projectId,
        organizationId: authority.organizationId,
        effectiveRole: effectiveRole(authority),
        capability: resolvedCapability,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
