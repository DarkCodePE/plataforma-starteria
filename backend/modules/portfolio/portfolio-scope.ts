/**
 * Canonical organization scope for portfolio reads and writes.
 *
 * MVP v1.2 D1/D11: every activated corporate account, including admin, is
 * limited to User.organizationId. Memberships and capability grants never add
 * organizations to the active identity.
 */
import { logger } from '../../shared/utils/logger';

export interface PortfolioScope {
  all: boolean;
  organizationIds: string[];
}

type ScopeUser = { id: string; role?: string | null; organizationId?: string | null; permissions?: ReadonlySet<string> };

export async function resolvePortfolioScope(prisma: any, user: ScopeUser): Promise<PortfolioScope> {
  if (!prisma) return { all: false, organizationIds: [] };
  try {
    const record = user.organizationId !== undefined
      ? { organizationId: user.organizationId }
      : await prisma.user?.findUnique?.({ where: { id: user.id }, select: { organizationId: true } });
    return { all: false, organizationIds: record?.organizationId ? [record.organizationId] : [] };
  } catch (err) {
    logger.warn({ err, userId: user.id }, '[portfolio-scope] canonical organization unavailable');
    return { all: false, organizationIds: [] };
  }
}

/** Permissions are checked separately and cannot widen the canonical tenant. */
export async function resolvePortfolioWriteScope(prisma: any, user: ScopeUser): Promise<PortfolioScope> {
  return resolvePortfolioScope(prisma, user);
}

/** Prisma where clause for StrategicFront within the canonical scope. */
export function frontScopeWhere(scope: PortfolioScope): Record<string, unknown> {
  return { organizationId: { in: scope.organizationIds } };
}

/** Default organization for a new front: the creator's canonical tenant. */
export async function defaultOrganizationId(prisma: any, userId: string | undefined): Promise<string | null> {
  if (!userId || !prisma) return null;
  const record = await prisma.user?.findUnique?.({ where: { id: userId }, select: { organizationId: true } });
  return record?.organizationId ?? null;
}
