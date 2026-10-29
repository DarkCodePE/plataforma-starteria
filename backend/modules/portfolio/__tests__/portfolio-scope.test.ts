import { describe, expect, it, vi } from 'vitest';
import { defaultOrganizationId, frontScopeWhere, resolvePortfolioScope, resolvePortfolioWriteScope } from '../portfolio-scope';

function prisma({ primary = null as string | null, members = [] as string[], grants = [] as string[] } = {}) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ organizationId: primary }) },
    organizationMember: { findMany: vi.fn().mockResolvedValue(members.map((organizationId) => ({ organizationId }))) },
    organizationPortfolioAccessGrant: { findMany: vi.fn().mockResolvedValue(grants.map((organizationId) => ({ organizationId }))) },
  };
}

describe('resolvePortfolioScope', () => {
  it('limits admin to the canonical organization', async () => {
    expect(await resolvePortfolioScope(prisma({ primary: 'org-a', members: ['org-b'], grants: ['org-c'] }), { id: 'u', role: 'admin' }))
      .toEqual({ all: false, organizationIds: ['org-a'] });
  });

  it('never gives a global scope to a user without portfolio access', async () => {
    expect(await resolvePortfolioScope(prisma({ primary: 'org-a' }), { id: 'u', role: 'participante', permissions: new Set(['project:own']) }))
      .toEqual({ all: false, organizationIds: ['org-a'] });
    expect(await resolvePortfolioScope(prisma(), { id: 'u', role: 'participante', permissions: new Set() }))
      .toEqual({ all: false, organizationIds: [] });
  });

  it('does not let memberships or grants widen the canonical tenant', async () => {
    const db = prisma({ primary: 'org-a', members: ['org-a', 'org-b'], grants: ['org-c'] });
    await expect(resolvePortfolioScope(db, { id: 'u', role: 'portfolio_lead' }))
      .resolves.toEqual({ all: false, organizationIds: ['org-a'] });
    await expect(resolvePortfolioWriteScope(db, { id: 'u', role: 'portfolio_lead' }))
      .resolves.toEqual({ all: false, organizationIds: ['org-a'] });
    expect(db.organizationMember.findMany).not.toHaveBeenCalled();
    expect(db.organizationPortfolioAccessGrant.findMany).not.toHaveBeenCalled();
  });

  it('fails closed when there is no canonical organization', async () => {
    const scope = await resolvePortfolioScope(prisma(), { id: 'u', role: 'portfolio_lead' });
    expect(scope).toEqual({ all: false, organizationIds: [] });
    expect(frontScopeWhere(scope)).toEqual({ organizationId: { in: [] } });
  });

  it('fails closed instead of throwing when the canonical source is unavailable', async () => {
    const db = prisma();
    db.user.findUnique = vi.fn().mockRejectedValue(new Error('down'));
    await expect(resolvePortfolioScope(db, { id: 'u', role: 'portfolio_lead' }))
      .resolves.toEqual({ all: false, organizationIds: [] });
  });
});

describe('frontScopeWhere', () => {
  it('does not turn the legacy all flag into a cross-tenant bypass', () => {
    expect(frontScopeWhere({ all: true, organizationIds: ['org-a'] })).toEqual({ organizationId: { in: ['org-a'] } });
  });

  it('filters strictly by canonical organization', () => {
    expect(frontScopeWhere({ all: false, organizationIds: ['org-a'] })).toEqual({ organizationId: { in: ['org-a'] } });
  });
});

describe('defaultOrganizationId', () => {
  it('uses the creator canonical organization', async () => {
    expect(await defaultOrganizationId(prisma({ primary: 'org-a' }), 'u')).toBe('org-a');
    expect(await defaultOrganizationId(prisma(), 'u')).toBeNull();
    expect(await defaultOrganizationId(prisma(), undefined)).toBeNull();
  });
});
