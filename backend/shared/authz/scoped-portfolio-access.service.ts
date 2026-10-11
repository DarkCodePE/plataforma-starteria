import type { PrismaClient } from '@prisma/client';

export const SCOPED_PORTFOLIO_CAPABILITIES = ['portfolio:read', 'portfolio:write'] as const;
export type ScopedPortfolioCapability = (typeof SCOPED_PORTFOLIO_CAPABILITIES)[number];

type ScopedPortfolioAccessDb = Pick<
  PrismaClient,
  'user' | 'organization' | 'organizationMember' | 'organizationPortfolioAccessGrant'
>;

export type CanUserAccessPortfolioInput = {
  userId: string;
  organizationId: string;
  capability: ScopedPortfolioCapability;
};

export type ReadablePortfolioScope = { organizationId: string; name: string };
export type ReadableScopeResolution =
  | { state: 'ZERO_SCOPES'; scopes: [] }
  | { state: 'ONE_SCOPE'; scopes: [ReadablePortfolioScope] }
  | { state: 'MULTIPLE_SCOPES'; scopes: [ReadablePortfolioScope, ReadablePortfolioScope, ...ReadablePortfolioScope[]] }
  | { state: 'RESOLVER_FAILURE' };
export type ReadableScopeValidation =
  | { state: 'AUTHORIZED'; scope: ReadablePortfolioScope }
  | { state: 'REJECTED' | 'RESOLVER_FAILURE' };

/**
 * Resolves organization-scoped Portfolio authority only from server-owned
 * identity, membership, and grant rows. Platform roles and client permissions
 * are intentionally not consulted here.
 */
export class ScopedPortfolioAccessService {
  constructor(private readonly prisma: ScopedPortfolioAccessDb) {}

  /** 114F read authority. An unavailable source cannot be interpreted as zero access. */
  async resolveReadableScopes(userId: string): Promise<ReadableScopeResolution> {
    try {
      const listed = await this.listAccessibleOrganizations({ userId, capability: 'portfolio:read' });
      const scopes = [...new Map(listed.map((scope) => [scope.organizationId, scope])).values()]
        .sort((a, b) => compareScopeField(a.name, b.name) || compareScopeField(a.organizationId, b.organizationId));
      if (scopes.length === 0) return { state: 'ZERO_SCOPES', scopes: [] };
      if (scopes.length === 1) return { state: 'ONE_SCOPE', scopes: [scopes[0]] };
      return { state: 'MULTIPLE_SCOPES', scopes: [scopes[0], scopes[1], ...scopes.slice(2)] };
    } catch {
      return { state: 'RESOLVER_FAILURE' };
    }
  }

  /** Recheck a candidate inside the caller's current read/write transaction. Never trust a previous list or snapshot. */
  async revalidateReadableScope(input: { userId: string; organizationId: string }): Promise<ReadableScopeValidation> {
    try {
      if (!(await this.canUserAccessPortfolio({ ...input, capability: 'portfolio:read' }))) {
        return { state: 'REJECTED' };
      }
      const organization = await this.prisma.organization.findUnique({
        where: { id: input.organizationId }, select: { id: true, name: true },
      });
      return organization
        ? { state: 'AUTHORIZED', scope: { organizationId: organization.id, name: organization.name } }
        : { state: 'REJECTED' };
    } catch {
      return { state: 'RESOLVER_FAILURE' };
    }
  }

  async canUserAccessPortfolio(input: CanUserAccessPortfolioInput): Promise<boolean> {
    if (!input.userId || !input.organizationId || !isScopedPortfolioCapability(input.capability)) {
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) return false;

    const organization = await this.prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true },
    });
    if (!organization) return false;

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });
    if (!membership) return false;

    const grant = await this.prisma.organizationPortfolioAccessGrant.findFirst({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
        capability: input.capability,
      },
      select: { id: true },
    });
    return Boolean(grant);
  }

  async listAccessibleOrganizations(input: {
    userId: string;
    capability: ScopedPortfolioCapability;
  }): Promise<Array<{ organizationId: string; name: string }>> {
    if (!input.userId || !isScopedPortfolioCapability(input.capability)) return [];
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId: input.userId },
      select: { organizationId: true, organization: { select: { id: true, name: true } } },
    });
    const eligible = await Promise.all(memberships.map(async (membership) => {
      const allowed = await this.canUserAccessPortfolio({
        userId: input.userId,
        organizationId: membership.organizationId,
        capability: input.capability,
      });
      return allowed ? { organizationId: membership.organization.id, name: membership.organization.name } : null;
    }));
    return eligible.filter((value): value is { organizationId: string; name: string } => value !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

function compareScopeField(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isScopedPortfolioCapability(value: string): value is ScopedPortfolioCapability {
  return (SCOPED_PORTFOLIO_CAPABILITIES as readonly string[]).includes(value);
}
