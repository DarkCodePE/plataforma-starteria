import { describe, expect, it, vi } from 'vitest';
import { PortfolioContextAuthorityService } from '../portfolio-context-authority.service';
import type { PortfolioContextActor } from '../portfolio-context.types';

type Row = { actorUserId: string; organizationId: string; invalidated: boolean };

function makeHarness(options: {
  memberships?: string[];
  organizations?: Record<string, string>;
  grants?: string[];
  activeSessions?: string[];
} = {}) {
  const rows = new Map<string, Row>();
  const memberships = new Set(options.memberships ?? []);
  const organizations = options.organizations ?? { o1: 'Org One', o2: 'Org Two' };
  const grants = new Set(options.grants ?? []);
  const activeSessions = new Set(options.activeSessions ?? ['s1', 's2']);
  const store = {
    getActiveSelection: vi.fn(async (sid: string) => {
      const row = rows.get(sid);
      return row && !row.invalidated ? {
        authSessionId: sid, actorUserId: row.actorUserId, organizationId: row.organizationId,
        selectedAt: new Date(), updatedAt: new Date(), invalidatedAt: null, invalidationReason: null,
      } : null;
    }),
    hasInvalidatedSelection: vi.fn(async (sid: string) => Boolean(rows.get(sid)?.invalidated)),
    setSelection: vi.fn(async ({ authSessionId, actorUserId, organizationId }: { authSessionId: string; actorUserId: string; organizationId: string }) => {
      rows.set(authSessionId, { actorUserId, organizationId, invalidated: false });
    }),
    invalidateSelection: vi.fn(async ({ authSessionId }: { authSessionId: string }) => {
      const row = rows.get(authSessionId);
      if (row) row.invalidated = true;
    }),
    clearSelection: vi.fn(async (sid: string) => { rows.delete(sid); }),
  };
  const prisma = {
    organizationMember: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; organizationId: string } }) =>
        memberships.has(`${where.userId}:${where.organizationId}`) ? { organizationId: where.organizationId } : null),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        [...memberships].filter((key) => key.startsWith(`${where.userId}:`)).map((key) => {
          const organizationId = key.split(':')[1];
          return { organizationId, organization: { id: organizationId, name: organizations[organizationId] } };
        })),
    },
  };
  const auth = { isAuthSessionActive: vi.fn(async ({ authSessionId }: { authSessionId: string }) => activeSessions.has(authSessionId)) };
  const scoped = {
    canUserAccessPortfolio: vi.fn(async ({ userId, organizationId }: { userId: string; organizationId: string }) =>
      grants.has(`${userId}:${organizationId}`)),
    listAccessibleOrganizations: vi.fn(async ({ userId }: { userId: string }) => [...memberships]
      .filter((key) => key.startsWith(`${userId}:`) && grants.has(key))
      .map((key) => { const organizationId = key.split(':')[1]; return { organizationId, name: organizations[organizationId] }; })),
  };
  return { service: new PortfolioContextAuthorityService(prisma as never, store as never, auth as never, scoped as never), store, prisma, auth, scoped, rows };
}

const actor = (session = 's1', permissions: string[] = []): PortfolioContextActor => ({
  actorUserId: 'u1', authSessionId: session, permissions: new Set(permissions as never),
});

describe('PortfolioContextAuthorityService', () => {
  it('returns no_context for a legacy actor without authSessionId', async () => {
    const { service, auth } = makeHarness();
    await expect(service.resolve({ actorUserId: 'u1', permissions: new Set() })).resolves.toEqual({ status: 'no_context' });
    expect(auth.isAuthSessionActive).not.toHaveBeenCalled();
  });

  it('rejects an inactive session before any organization lookup', async () => {
    const { service, prisma, auth } = makeHarness({ activeSessions: [] });
    await expect(service.resolve(actor())).resolves.toEqual({ status: 'not_authorized' });
    expect(auth.isAuthSessionActive).toHaveBeenCalled();
    expect(prisma.organizationMember.findFirst).not.toHaveBeenCalled();
  });

  it('invalidates a stored selection when the auth session is revoked', async () => {
    const h = makeHarness({ memberships: ['u1:o1'], grants: ['u1:o1'], activeSessions: ['s1'] });
    await h.service.select(actor(), 'o1');
    h.auth.isAuthSessionActive.mockResolvedValue(false);
    await expect(h.service.resolve(actor())).resolves.toEqual({ status: 'not_authorized' });
    expect(h.store.invalidateSelection).toHaveBeenCalledWith({ authSessionId: 's1', reason: 'auth_session_inactive' });
  });

  it('returns no_context for zero authorized organizations', async () => {
    const { service } = makeHarness();
    await expect(service.resolve(actor())).resolves.toEqual({ status: 'no_context' });
  });

  it('auto-establishes one globally authorized organization', async () => {
    const { service, store } = makeHarness({ memberships: ['u1:o1'] });
    const result = await service.resolve(actor('s1', ['portfolio:read']));
    expect(result.status).toBe('available');
    expect(result).toMatchObject({ context: { organizationId: 'o1', authoritySource: 'global', authSessionId: 's1' } });
    expect(store.setSelection).toHaveBeenCalledWith({ authSessionId: 's1', actorUserId: 'u1', organizationId: 'o1' });
  });

  it('requires explicit selection for multiple organizations', async () => {
    const { service, store } = makeHarness({ memberships: ['u1:o1', 'u1:o2'] });
    await expect(service.resolve(actor('s1', ['portfolio:read']))).resolves.toEqual({ status: 'context_selection_required' });
    expect(store.setSelection).not.toHaveBeenCalled();
  });

  it('supports valid scoped selection and rejects cross-org selection', async () => {
    const { service, store } = makeHarness({ memberships: ['u1:o1'], grants: ['u1:o1'] });
    await expect(service.select(actor(), 'o1')).resolves.toMatchObject({ status: 'available', context: { authoritySource: 'scoped' } });
    await expect(service.select(actor(), 'o2')).resolves.toEqual({ status: 'not_authorized' });
    expect(store.setSelection).toHaveBeenCalledTimes(1);
  });

  it('invalidates a revoked selection and never falls back', async () => {
    const h = makeHarness({ memberships: ['u1:o1', 'u1:o2'], grants: ['u1:o1', 'u1:o2'] });
    await h.service.select(actor(), 'o1');
    h.prisma.organizationMember.findFirst.mockResolvedValue(null);
    await expect(h.service.resolve(actor())).resolves.toEqual({ status: 'not_authorized' });
    expect(h.store.invalidateSelection).toHaveBeenCalledWith({ authSessionId: 's1', reason: 'portfolio_authority_revoked' });
    expect(h.store.setSelection).toHaveBeenCalledTimes(1);
  });

  it('invalidates a selection when its scoped grant is revoked', async () => {
    const h = makeHarness({ memberships: ['u1:o1'], grants: ['u1:o1'] });
    await h.service.select(actor(), 'o1');
    h.scoped.canUserAccessPortfolio.mockResolvedValue(false);
    await expect(h.service.resolve(actor())).resolves.toEqual({ status: 'not_authorized' });
    expect(h.store.invalidateSelection).toHaveBeenCalledWith({ authSessionId: 's1', reason: 'portfolio_authority_revoked' });
  });

  it('switches and clears only the current session selection', async () => {
    const h = makeHarness({ memberships: ['u1:o1', 'u1:o2'], grants: ['u1:o1', 'u1:o2'] });
    await h.service.select(actor('s1'), 'o1');
    await h.service.select(actor('s1'), 'o2');
    expect(await h.service.resolve(actor('s1'))).toMatchObject({ context: { organizationId: 'o2' } });
    await h.service.clear(actor('s1'));
    expect(h.store.clearSelection).toHaveBeenCalledWith('s1');
    expect(await h.service.resolve(actor('s1'))).toEqual({ status: 'context_selection_required' });
  });

  it('keeps two sessions for the same user isolated', async () => {
    const h = makeHarness({ memberships: ['u1:o1', 'u1:o2'], grants: ['u1:o1', 'u1:o2'] });
    await h.service.select(actor('s1'), 'o1');
    await h.service.select(actor('s2'), 'o2');
    expect(await h.service.resolve(actor('s1'))).toMatchObject({ context: { organizationId: 'o1' } });
    expect(await h.service.resolve(actor('s2'))).toMatchObject({ context: { organizationId: 'o2' } });
    await h.service.clear(actor('s1'));
    expect(await h.service.resolve(actor('s2'))).toMatchObject({ context: { organizationId: 'o2' } });
  });

  it('converges simultaneous selections to one row per session', async () => {
    const h = makeHarness({ memberships: ['u1:o1', 'u1:o2'], grants: ['u1:o1', 'u1:o2'] });
    await Promise.all([h.service.select(actor(), 'o1'), h.service.select(actor(), 'o2')]);
    expect(h.rows.size).toBe(1);
    expect(await h.service.resolve(actor())).toMatchObject({ status: 'available' });
  });
});
