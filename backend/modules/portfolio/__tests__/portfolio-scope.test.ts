import { describe, expect, it, vi } from 'vitest';
import { defaultOrganizationId, frontScopeWhere, resolvePortfolioScope } from '../portfolio-scope';

function prisma({ primary = null as string | null, members = [] as string[], grants = [] as string[] } = {}) {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ organizationId: primary }) },
    organizationMember: { findMany: vi.fn().mockResolvedValue(members.map((organizationId) => ({ organizationId }))) },
    organizationPortfolioAccessGrant: { findMany: vi.fn().mockResolvedValue(grants.map((organizationId) => ({ organizationId }))) },
  };
}

describe('resolvePortfolioScope', () => {
  it('admin de plataforma ve todas las organizaciones', async () => {
    expect(await resolvePortfolioScope(prisma(), { id: 'u', role: 'admin' })).toEqual({ all: true, organizationIds: [] });
  });

  it('quien no tiene acceso de portafolio queda como antes (deuda #161: bandeja del participante)', async () => {
    expect(await resolvePortfolioScope(prisma({ primary: 'org-a' }), { id: 'u', role: 'participante', permissions: new Set(['project:own']) }))
      .toEqual({ all: true, organizationIds: [] });
  });

  it('con portfolio:read ve su organización primaria, sus membresías y sus grants, sin repetir', async () => {
    const scope = await resolvePortfolioScope(prisma({ primary: 'org-a', members: ['org-a', 'org-b'], grants: ['org-c'] }), { id: 'u', role: 'portfolio_lead', permissions: new Set(['portfolio:read', 'portfolio:write']) });
    expect(scope.all).toBe(false);
    expect(scope.organizationIds.sort()).toEqual(['org-a', 'org-b', 'org-c']);
  });

  it('sin organización no ve ninguna (sólo los frentes sin organización)', async () => {
    const scope = await resolvePortfolioScope(prisma(), { id: 'u', role: 'portfolio_lead', permissions: new Set(['portfolio:read']) });
    expect(scope).toEqual({ all: false, organizationIds: [] });
    expect(frontScopeWhere(scope)).toEqual({ OR: [{ organizationId: { in: [] } }, { organizationId: null }] });
  });
});

describe('frontScopeWhere', () => {
  it('admin no filtra', () => {
    expect(frontScopeWhere({ all: true, organizationIds: [] })).toEqual({});
  });
  it('filtra por organización y mantiene visibles los frentes sin organización (transición)', () => {
    expect(frontScopeWhere({ all: false, organizationIds: ['org-a'] })).toEqual({ OR: [{ organizationId: { in: ['org-a'] } }, { organizationId: null }] });
  });
});

describe('defaultOrganizationId', () => {
  it('usa la organización primaria de quien crea', async () => {
    expect(await defaultOrganizationId(prisma({ primary: 'org-a' }), 'u')).toBe('org-a');
    expect(await defaultOrganizationId(prisma(), 'u')).toBeNull();
    expect(await defaultOrganizationId(prisma(), undefined)).toBeNull();
  });
});
