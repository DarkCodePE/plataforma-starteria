/**
 * Autorización por recurso de las escrituras de portafolio (auditoría E2E F-03).
 *
 * `requirePermission('portfolio:write')` sólo dice que la persona puede escribir portafolio en
 * general; no que el frente, reto o iniciativa que nombra el ID sea de una organización suya.
 * Este middleware resuelve la organización del recurso desde la ruta y la compara con el alcance
 * de `resolvePortfolioScope`:
 *
 * - admin de plataforma: cualquier recurso.
 * - recurso de una organización del alcance: permitido.
 * - recurso sin organización: denegado. La compatibilidad legacy no puede convertirse en un
 *   bypass global implícito; cualquier recuperación debe tener un grant explícito y auditable.
 * - recurso de otra organización o inexistente: 404. No se distingue "no existe" de "no es tuyo"
 *   para no confirmar IDs ajenos.
 *
 * Los hijos con su propio ID (invitación, miembro del squad o del equipo del reto) además tienen
 * que pertenecer al reto de la ruta; si no, un ID propio serviría de llave para un hijo ajeno.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import type { AuthenticatedRequest } from '../../shared/types/auth.types';
import { resolvePortfolioScope, resolvePortfolioWriteScope, type PortfolioScope } from './portfolio-scope';

type Resolved = { found: false } | { found: true; organizationId: string | null };

const NOT_FOUND: Resolved = { found: false };
const at = (organizationId: string | null | undefined): Resolved => ({ found: true, organizationId: organizationId ?? null });

export async function frontOrganization(prisma: any, frontId: string): Promise<Resolved> {
  const front = await prisma.strategicFront.findUnique({ where: { id: frontId }, select: { organizationId: true } });
  return front ? at(front.organizationId) : NOT_FOUND;
}

export async function challengeOrganization(prisma: any, challengeId: string): Promise<Resolved> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { strategicFront: { select: { organizationId: true } } },
  });
  return challenge ? at(challenge.strategicFront?.organizationId) : NOT_FOUND;
}

/**
 * ADR-009 makes Project.organizationId the only canonical tenant boundary.
 * Historical owner/front scalar references may point to organizations that do not exist;
 * a Project without an explicit canonical organization therefore fails closed.
 */
export async function projectOrganization(prisma: any, projectId: string): Promise<Resolved> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project?.organizationId) return NOT_FOUND;
  return at(project.organizationId);
}

export async function executiveOutputOrganization(prisma: any, outputId: string): Promise<Resolved> {
  const output = await prisma.executiveOutput.findUnique({ where: { id: outputId }, select: { challengeId: true } });
  return output ? challengeOrganization(prisma, output.challengeId) : NOT_FOUND;
}

/** Asignación de handoff: su organización, o la de su reto si no la tiene registrada. */
export async function handoffAssignmentOrganization(prisma: any, assignmentId: string): Promise<Resolved> {
  const assignment = await prisma.portfolioHandoffAssignment.findUnique({
    where: { id: assignmentId },
    select: { organizationId: true, challengeId: true },
  });
  if (!assignment) return NOT_FOUND;
  if (assignment.organizationId) return at(assignment.organizationId);
  return challengeOrganization(prisma, assignment.challengeId);
}

/** El hijo existe y cuelga del reto de la ruta. */
async function childOfChallenge(delegate: any, childId: string, challengeId: string): Promise<boolean> {
  const child = await delegate?.findUnique?.({ where: { id: childId }, select: { challengeId: true } });
  return Boolean(child && child.challengeId === challengeId);
}

export function scopeAllows(scope: PortfolioScope, resolved: Resolved): boolean {
  if (!resolved.found) return false;
  if (scope.all) return true;
  return resolved.organizationId !== null && scope.organizationIds.includes(resolved.organizationId);
}

type Target =
  | { kind: 'front'; param: string }
  | { kind: 'challenge'; param: string; child?: { param: string; model: 'challengeInvitation' | 'challengeSquadMember' | 'challengeTeamMember' } }
  | { kind: 'project'; param: string }
  | { kind: 'executiveOutput'; param: string }
  | { kind: 'handoffAssignment'; param: string };

export function requirePortfolioResource(prisma: any, target: Target) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user!;
      const id = req.params[target.param];
      const resolved = target.kind === 'front'
        ? await frontOrganization(prisma, id)
        : target.kind === 'challenge'
          ? await challengeOrganization(prisma, id)
          : target.kind === 'project'
            ? await projectOrganization(prisma, id)
            : target.kind === 'executiveOutput'
              ? await executiveOutputOrganization(prisma, id)
              : await handoffAssignmentOrganization(prisma, id);
      const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase());
      const scope = mutating
        ? await resolvePortfolioWriteScope(prisma, user)
        : await resolvePortfolioScope(prisma, user);
      if (!scopeAllows(scope, resolved)) throw AppError.notFound('Recurso de portafolio', 'PORTFOLIO_RESOURCE_NOT_FOUND');
      if (target.kind === 'challenge' && target.child) {
        const ok = await childOfChallenge(prisma[target.child.model], req.params[target.child.param], id);
        if (!ok) throw AppError.notFound('Recurso de portafolio', 'PORTFOLIO_RESOURCE_NOT_FOUND');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
