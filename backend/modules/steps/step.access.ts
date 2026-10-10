// Acceso al proyecto para /api/v1/projects/:projectId/steps*: leer es de cualquier miembro y del
// Portfolio Lead asignado (§23); escribir, del OWNER o EDITOR. Ver projects/project-team-access.ts.
import type { PrismaClient } from '@prisma/client';
import { requireProjectTeamAccess } from '../projects/project-team-access';

const READ_METHODS = new Set(['GET', 'HEAD']);

export function requireStepProjectAccess(prisma: PrismaClient) {
  return requireProjectTeamAccess(prisma, (req) => (READ_METHODS.has((req as any).method) ? 'read' : 'write'), 'projectId');
}
