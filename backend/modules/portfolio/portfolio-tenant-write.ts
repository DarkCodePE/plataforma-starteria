import { AppError } from '../../shared/errors/AppError';

type TenantDb = any;

export type PortfolioWriteAuthority = {
  organizationId: string | null | undefined;
  actorUserId: string | null | undefined;
};

const denied = (): never => {
  throw AppError.notFound('Recurso de portafolio', 'PORTFOLIO_RESOURCE_NOT_FOUND');
};

/** Reuses an outer Prisma transaction (TransactionClient has no `$transaction`). */
export async function tenantWriteTransaction<T>(db: TenantDb, run: (tx: TenantDb) => Promise<T>): Promise<T> {
  return typeof db?.$transaction === 'function' ? db.$transaction(run) : run(db);
}

export async function frontTenant(tx: TenantDb, frontId: string): Promise<string> {
  const front = await tx.strategicFront.findUnique({
    where: { id: frontId },
    select: { id: true, organizationId: true },
  });
  if (!front?.organizationId) denied();
  return front.organizationId;
}

export async function challengeTenant(tx: TenantDb, challengeId: string): Promise<{ organizationId: string; strategicFrontId: string; challenge: any }> {
  const challenge = await tx.challenge.findUnique({
    where: { id: challengeId },
    include: { strategicFront: { select: { id: true, organizationId: true } } },
  });
  if (!challenge?.strategicFront?.organizationId) denied();
  return {
    organizationId: challenge.strategicFront.organizationId,
    strategicFrontId: challenge.strategicFrontId ?? challenge.strategicFront.id,
    challenge,
  };
}

export async function projectTenant(tx: TenantDb, projectId: string): Promise<{ organizationId: string; project: any }> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });
  if (!project?.organizationId) denied();
  return { organizationId: project.organizationId, project };
}

export async function assertUserInTenant(tx: TenantDb, userId: string | null | undefined, organizationId: string): Promise<void> {
  if (!userId) return;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  });
  if (!user) denied();
  if (user.organizationId !== organizationId) denied();
}

export function assertSameTenant(expected: string, actual: string | null | undefined): void {
  if (!actual || actual !== expected) denied();
}

export function rejectTenantMove(current: string | null | undefined, requested: string | null | undefined): void {
  if (!current) denied();
  if (requested !== undefined && requested !== current) denied();
}
