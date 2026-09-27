import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../shared/db/prisma';
import { verifyAccessToken } from './token.service';
import { AppError } from '../../shared/errors/AppError';
import { Role } from '../../shared/types/user.types';
import {
  permissionsForRoles,
  rolesForUser,
  can,
  type Permission,
} from '../../shared/authz/permissions';

// Extend Express Request with authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        /** Rol PRIMARIO: etiqueta y eje de proyecto. NO decide acceso de plataforma. */
        role: Role;
        /** ADR-029: el conjunto de roles del que se derivan los permisos. */
        roles: Role[];
        /** ADR-029: permisos efectivos, ya derivados. Es lo que consultan los guards. */
        permissions: ReadonlySet<Permission>;
        cohort?: string;
        /** Stable session lineage from the verified access-token sid claim. */
        authSessionId?: string;
      };
      projectAccess?: 'none' | 'read' | 'write' | 'admin';
    }
  }
}

/**
 * buildRequestUser — construye el `req.user` a partir de una identidad, derivando
 * los roles efectivos y sus permisos (ADR-029).
 *
 * Existe como función exportada para que los tests que simulan `authenticate`
 * construyan el MISMO objeto que produce el middleware real, en vez de armar uno
 * a mano que se desincroniza en cuanto cambia la derivación. Un mock que miente
 * sobre la forma de `req.user` deja pasar guards que en producción fallarían.
 *
 * Un token anterior a ADR-029 no trae `roles`; `rolesForUser` cae a `[role]`, así
 * que las sesiones vivas siguen siendo válidas hasta expirar.
 */
export function buildRequestUser(u: {
  id: string;
  email: string;
  role: Role;
  roles?: readonly Role[] | null;
  cohort?: string;
  authSessionId?: string;
}): NonNullable<Request['user']> {
  const roles = [...rolesForUser(u)];

  return {
    id: u.id,
    email: u.email,
    role: u.role,
    roles,
    permissions: permissionsForRoles(roles),
    cohort: u.cohort,
    ...(u.authSessionId ? { authSessionId: u.authSessionId } : {}),
  };
}

/**
 * authenticate — Verify JWT access token and attach user to request.
 * Extracts Bearer token from Authorization header.
 * Returns 401 if missing, invalid, or expired.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Token de acceso requerido');
    }

    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);

    req.user = buildRequestUser({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      roles: payload.roles,
      cohort: payload.cohort,
      authSessionId: payload.sid,
    });

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @deprecated ADR-029 — usa `requirePermission`. Ya no queda ningún router que
 * lo llame; se conserva porque autoriza por identidad y algún consumidor externo
 * podría importarlo, y porque los tests lo usan para fijar la equivalencia entre
 * el guard viejo y el nuevo. Se retira con la fase 2 (#160).
 *
 * requireRole — Check that the authenticated user has one of the required roles.
 * Must be used after `authenticate`.
 *
 * Usage: router.get('/admin', authenticate, requireRole('admin'), handler)
 */
export function requireRole(
  ...roles: Role[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Autenticacion requerida'));
      return;
    }

    // ADR-029: compara contra el CONJUNTO de roles, no contra el escalar. Sin esto,
    // un usuario con ['participante','portfolio_lead'] fallaría un requireRole
    // ('portfolio_lead') porque su rol primario es participante.
    if (!roles.some((r) => req.user!.roles.includes(r))) {
      next(AppError.forbidden('No tienes permiso para acceder a este recurso'));
      return;
    }

    next();
  };
}

/**
 * requirePermission — ADR-029. El guard de plataforma: pregunta QUÉ PUEDE HACER
 * el usuario, no QUÉ ES.
 *
 * Sustituye a `requireRole`. La diferencia práctica: añadir un rol nuevo con
 * acceso a portafolio ya no obliga a editar 20 rutas — se declara una fila en la
 * tabla de derivación y ninguna ruta se entera. Ese bucle de "editar cada ruta
 * al añadir un rol" es exactamente lo que produjo el parche #156.
 *
 * Debe usarse después de `authenticate`.
 *
 * Uso: router.post('/frentes', authenticate, requirePermission('portfolio:write'), handler)
 */
export function requirePermission(
  permission: Permission,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Autenticacion requerida'));
      return;
    }

    if (!can(req.user.permissions, permission)) {
      next(AppError.forbidden('No tienes permiso para acceder a este recurso'));
      return;
    }

    next();
  };
}

type AccessLevel = 'read' | 'write' | 'admin';

/**
 * requireProjectAccess — Check that the user has the required access level
 * to a specific project. Reads projectId from req.params.id or req.params.projectId.
 *
 * Resolves access based on:
 * - admin: always 'admin'
 * - owner (project creator): 'write'
 * - assigned mentor: 'read'
 * - assigned leader: 'read'
 * - team member: 'read'
 *
 * Must be used after `authenticate`.
 *
 * Usage: router.get('/projects/:id', authenticate, requireProjectAccess('read'), handler)
 */
export function requireProjectAccess(
  level: AccessLevel,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Autenticacion requerida');
      }

      const projectId = req.params.projectId || req.params.id;
      if (!projectId) {
        throw AppError.badRequest('ID de proyecto requerido');
      }

      // Validate CUID format to prevent injection (schema uses cuid())
      const CUID_REGEX = /^c[a-z0-9]{20,30}$/i;
      if (!CUID_REGEX.test(projectId)) {
        throw AppError.badRequest('ID de proyecto invalido');
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          teamMembers: { select: { userId: true, role: true } },
        },
      });

      if (!project) {
        throw AppError.notFound('Proyecto');
      }

      const resolvedAccess = resolveProjectAccess(req.user, project);

      if (resolvedAccess === 'none') {
        throw AppError.forbidden('No tienes acceso a este proyecto');
      }

      // Check if resolved level meets the required level
      const hierarchy: Record<string, number> = { read: 1, write: 2, admin: 3 };
      if (hierarchy[resolvedAccess] < hierarchy[level]) {
        throw AppError.forbidden('No tienes el nivel de acceso requerido');
      }

      req.projectAccess = resolvedAccess;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Resolve a user's access level to a project based on role and membership.
 * Supports the 6-role model: admin, participante, mentor, sponsor, colaborador, viewer.
 */
function resolveProjectAccess(
  user: { id: string; role: Role },
  project: {
    id: string;
    teamMembers: Array<{ userId: string; role: string }>;
  },
): 'none' | 'read' | 'write' | 'admin' {
  // Admin: full access
  if (user.role === 'admin') return 'admin';

  // Participante (was owner): write access to own projects
  if (user.role === 'participante') {
    const isOwner = project.teamMembers.some(
      (m) => m.userId === user.id && m.role === 'OWNER',
    );
    if (isOwner) return 'write';
  }

  // Mentor: read access to assigned projects
  if (user.role === 'mentor') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'read';
  }

  // Sponsor: read access to projects they are assigned to
  if (user.role === 'sponsor') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'read';
  }

  // Colaborador: write access (module-level restrictions enforced by transition guards)
  if (user.role === 'colaborador') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'write';
  }

  // Viewer: read-only access
  if (user.role === 'viewer') {
    const isMember = project.teamMembers.some((m) => m.userId === user.id);
    if (isMember) return 'read';
  }

  // General fallback: any team member gets read
  const isMember = project.teamMembers.some((m) => m.userId === user.id);
  if (isMember) return 'read';

  return 'none';
}

/**
 * requireTransitionAuth — Combines structural validation + role authorization + guards.
 * Must be used after `authenticate`.
 * Expects req.body to contain { currentStatus, status } for the transition.
 */
export function requireTransitionAuth(
  entity: 'project' | 'step' | 'module',
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Autenticacion requerida');
      }

      const { validateTransitionWithRole } = await import('../projects/state-machine');

      const projectId = req.params.projectId || req.params.id;
      const stepNumber = req.params.number ? Number(req.params.number) : undefined;
      const moduleId = req.params.moduleId;

      // Build metadata for guards
      let metadata;
      if (projectId) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            teamMembers: {
              where: { userId: req.user.id },
              select: { role: true, modulePermissions: true },
            },
          },
        });

        const membership = project?.teamMembers[0];
        metadata = {
          isProjectOwner: membership?.role === 'OWNER',
          isSponsorCheckpointStep: [0, 2, 4].includes(stepNumber ?? -1),
          colaboradorPermissions: membership?.modulePermissions ?? [],
        };
      }

      validateTransitionWithRole({
        entity,
        currentStatus: req.body.currentStatus,
        targetStatus: req.body.status,
        actorRole: req.user.role,
        actorId: req.user.id,
        projectId: projectId || '',
        stepNumber,
        moduleId,
        metadata,
      });

      next();
    } catch (err) {
      next(err);
    }
  };
}
