import { describe, expect, it, vi } from 'vitest';
import { ScopedPortfolioAccessService } from '../scoped-portfolio-access.service';

type Fixture = {
  users: Set<string>;
  memberships: Set<string>;
  grants: Set<string>;
  organizations?: Map<string, string>;
};

function makeResolver(fixture: Fixture) {
  const db = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        fixture.users.has(where.id) ? { id: where.id } : null),
    },
    organization: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        fixture.organizations === undefined || fixture.organizations.has(where.id)
          ? { id: where.id, name: fixture.organizations?.get(where.id) ?? where.id } : null),
    },
    organizationMember: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; organizationId: string } }) =>
        fixture.memberships.has(`${where.userId}:${where.organizationId}`) ? { id: 'membership-1' } : null),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        [...fixture.memberships].filter((key) => key.startsWith(`${where.userId}:`)).map((key) => {
          const organizationId = key.slice(where.userId.length + 1);
          return { organizationId, organization: {
            id: organizationId, name: fixture.organizations?.get(organizationId) ?? organizationId,
          } };
        })),
    },
    organizationPortfolioAccessGrant: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; organizationId: string; capability: string } }) =>
        fixture.grants.has(`${where.userId}:${where.organizationId}:${where.capability}`) ? { id: 'grant-1' } : null),
    },
  };
  return { resolver: new ScopedPortfolioAccessService(db as never), db };
}

describe('Scoped Portfolio access authority', () => {
  it('AUTH-SCOPE-01 allows matching membership and read grant', async () => {
    const { resolver } = makeResolver({
      users: new Set(['u1']),
      memberships: new Set(['u1:o1']),
      grants: new Set(['u1:o1:portfolio:read']),
    });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'portfolio:read' })).resolves.toBe(true);
  });

  it('AUTH-SCOPE-02 denies membership without a grant', async () => {
    const { resolver } = makeResolver({ users: new Set(['u1']), memberships: new Set(['u1:o1']), grants: new Set() });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'portfolio:read' })).resolves.toBe(false);
  });

  it('AUTH-SCOPE-03 denies a grant without membership', async () => {
    const { resolver } = makeResolver({ users: new Set(['u1']), memberships: new Set(), grants: new Set(['u1:o1:portfolio:read']) });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'portfolio:read' })).resolves.toBe(false);
  });

  it('AUTH-SCOPE-04 isolates organizations', async () => {
    const { resolver } = makeResolver({ users: new Set(['u1']), memberships: new Set(['u1:o1', 'u1:o2']), grants: new Set(['u1:o1:portfolio:read']) });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o2', capability: 'portfolio:read' })).resolves.toBe(false);
  });

  it('AUTH-SCOPE-05 and AUTH-SCOPE-06 reject global role/permission state without a scoped grant', async () => {
    const { resolver } = makeResolver({ users: new Set(['u1']), memberships: new Set(['u1:o1']), grants: new Set() });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'portfolio:read' })).resolves.toBe(false);
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'portfolio:write' })).resolves.toBe(false);
  });

  it('AUTH-SCOPE-07 rejects client-provided or speculative capabilities', async () => {
    const { resolver, db } = makeResolver({ users: new Set(['u1']), memberships: new Set(['u1:o1']), grants: new Set(['u1:o1:portfolio:read']) });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'admin' as never })).resolves.toBe(false);
    expect(db.organizationPortfolioAccessGrant.findFirst).not.toHaveBeenCalled();
  });

  it('AUTH-SCOPE-13 performs no model or LLM calls', async () => {
    const { resolver, db } = makeResolver({ users: new Set(['u1']), memberships: new Set(['u1:o1']), grants: new Set(['u1:o1:portfolio:write']) });
    await expect(resolver.canUserAccessPortfolio({ userId: 'u1', organizationId: 'o1', capability: 'portfolio:write' })).resolves.toBe(true);
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.organizationMember.findFirst).toHaveBeenCalledTimes(1);
    expect(db.organizationPortfolioAccessGrant.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('114F readable scope resolution', () => {
  it('distinguishes zero, one and multiple scopes with stable ordering and no duplicate organization', async () => {
    const fixture = { users: new Set(['u1']), memberships: new Set(['u1:o2', 'u1:o1']),
      grants: new Set<string>(), organizations: new Map([['o1', 'Espacio'], ['o2', 'Espacio']]) };
    const { resolver, db } = makeResolver(fixture);
    await expect(resolver.resolveReadableScopes('u1')).resolves.toEqual({ state: 'ZERO_SCOPES', scopes: [] });
    fixture.grants.add('u1:o2:portfolio:read');
    await expect(resolver.resolveReadableScopes('u1')).resolves.toEqual({ state: 'ONE_SCOPE',
      scopes: [{ organizationId: 'o2', name: 'Espacio' }] });
    fixture.grants.add('u1:o1:portfolio:read');
    vi.mocked(db.organizationMember.findMany).mockResolvedValueOnce([
      { organizationId: 'o2', organization: { id: 'o2', name: 'Espacio' } },
      { organizationId: 'o1', organization: { id: 'o1', name: 'Espacio' } },
      { organizationId: 'o1', organization: { id: 'o1', name: 'Espacio' } },
    ]);
    await expect(resolver.resolveReadableScopes('u1')).resolves.toEqual({ state: 'MULTIPLE_SCOPES', scopes: [
      { organizationId: 'o1', name: 'Espacio' }, { organizationId: 'o2', name: 'Espacio' },
    ] });
  });

  it('revalidates a candidate against this user, existing organization, membership and exact read grant', async () => {
    const fixture = { users: new Set(['u1', 'u2']), memberships: new Set(['u1:o1', 'u2:o2']),
      grants: new Set(['u1:o1:portfolio:read', 'u1:o2:portfolio:read', 'u1:o3:portfolio:write']),
      organizations: new Map([['o1', 'Own'], ['o2', 'Other'], ['o3', 'Write only']]) };
    const { resolver } = makeResolver(fixture);
    const check = (organizationId: string) => resolver.revalidateReadableScope({ userId: 'u1', organizationId });
    await expect(check('o1')).resolves.toEqual({ state: 'AUTHORIZED', scope: { organizationId: 'o1', name: 'Own' } });
    await expect(check('arbitrary')).resolves.toEqual({ state: 'REJECTED' });
    await expect(check('o2')).resolves.toEqual({ state: 'REJECTED' });
    await expect(check('o3')).resolves.toEqual({ state: 'REJECTED' });
    fixture.grants.delete('u1:o1:portfolio:read');
    await expect(check('o1')).resolves.toEqual({ state: 'REJECTED' });
    fixture.grants.add('u1:o1:portfolio:read');
    fixture.memberships.delete('u1:o1');
    await expect(check('o1')).resolves.toEqual({ state: 'REJECTED' });
    fixture.memberships.add('u1:o1');
    fixture.organizations.delete('o1');
    await expect(check('o1')).resolves.toEqual({ state: 'REJECTED' });
  });

  it('distinguishes database failure from successful zero scopes and candidate rejection', async () => {
    const { resolver, db } = makeResolver({ users: new Set(['u1']), memberships: new Set(['u1:o1']),
      grants: new Set(['u1:o1:portfolio:read']) });
    vi.mocked(db.organizationMember.findMany).mockRejectedValueOnce(new Error('private database detail'));
    await expect(resolver.resolveReadableScopes('u1')).resolves.toEqual({ state: 'RESOLVER_FAILURE' });
    vi.mocked(db.organizationPortfolioAccessGrant.findFirst).mockRejectedValueOnce(new Error('private database detail'));
    await expect(resolver.revalidateReadableScope({ userId: 'u1', organizationId: 'o1' }))
      .resolves.toEqual({ state: 'RESOLVER_FAILURE' });
  });
});
