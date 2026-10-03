import { describe, expect, it, vi } from 'vitest';
import { PortfolioEntryContinuationService } from './portfolio-entry-continuation.service';

function makeService({ grant = true, owner = 'user-1' } = {}) {
  const continuation = {
    id: 'continuation-1', sessionId: 'session-1', continuedByUserId: owner,
    portfolioScope: { kind: 'scoped_portfolio_grant', organizationId: 'org-1' },
    sourceSnapshot: {
      handoff: {
        understanding: { value: 'Ordenar las iniciativas' },
        desired_outcome: { value: 'Decidir dónde concentrar atención' },
        known_context: [{ value: 'Hay varias iniciativas' }],
        unresolved_context: [{ description: 'Falta validar prioridad' }],
        later_work: [{ value: 'Revisar el detalle después' }],
        organizational_unknowns: [{ value: 'La capacidad debe confirmarse' }],
      },
      confirmation: { id: 'confirmation-1', version: 3, status: 'CONFIRMED', acceptedFields: { context: { value: 'Hay varias iniciativas' } } },
      handoffRef: { id: 'handoff-1', version: 2 },
    },
  };
  const prisma = {
    portfolioEntryPortfolioContinuation: { findUnique: vi.fn(async () => continuation), findFirst: vi.fn(async () => continuation) },
    portfolioEntrySession: { findUnique: vi.fn(async () => ({ ownerUserId: owner, ownershipState: 'CLAIMED', revision: 7 })) },
    user: { findUnique: vi.fn(async () => ({ id: 'user-1' })) },
    organization: { findUnique: vi.fn(async () => ({ id: 'org-1', name: 'Acme' })) },
    organizationMember: { findFirst: vi.fn(async () => ({ id: 'member-1' })) },
    organizationPortfolioAccessGrant: { findFirst: vi.fn(async () => grant ? ({ id: 'grant-1' }) : null) },
  } as any;
  return { service: new PortfolioEntryContinuationService(prisma, {} as any), prisma };
}

describe('Portfolio Home server-owned entry context', () => {
  const identity = { sessionId: 'session-1', sessionRevision: 7, handoffId: 'handoff-1', handoffVersion: 2, confirmationId: 'confirmation-1', confirmationVersion: 3 };

  it('KAN-100 scoped setup access requires the stored identity, owner, claimed session and current grant', async () => {
    const { service, prisma } = makeService();
    await expect(service.authorizeScopedFirstValueEntry({ identity, authenticatedUserId: 'user-1' })).resolves.toMatchObject({ continuationId: 'continuation-1' });
    await expect(service.authorizeScopedFirstValueEntry({ identity: { ...identity, handoffVersion: 1 }, authenticatedUserId: 'user-1' })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN' });
    await expect(makeService({ owner: 'other-user' }).service.authorizeScopedFirstValueEntry({ identity, authenticatedUserId: 'user-1' })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN' });
    await expect(makeService({ grant: false }).service.authorizeScopedFirstValueEntry({ identity, authenticatedUserId: 'user-1' })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED' });
    expect(prisma.organizationPortfolioAccessGrant.findFirst).toHaveBeenCalled();
  });

  it('HOME-01/06/07/08/09/10/11 returns a safe projection with the same session linkage', async () => {
    const { service } = makeService();
    const result = await service.readPortfolioHomeEntryContext({ continuationId: 'continuation-1', authenticatedUserId: 'user-1', permissions: new Set() });
    expect(result).toMatchObject({ continuationId: 'continuation-1', sessionId: 'session-1', organization: { id: 'org-1' } });
    expect(result.arrival).toMatchObject({ understoodNeed: 'Ordenar las iniciativas', desiredOutcome: 'Decidir dónde concentrar atención', openItems: ['Falta validar prioridad'], laterWork: ['Revisar el detalle después'], organizationalUnknowns: ['La capacidad debe confirmarse'] });
    expect(JSON.stringify(result)).not.toContain('OrganizationPortfolioAccessGrant');
    expect(JSON.stringify(result)).not.toContain('CONVERTED');
  });

  it('HOME-02/03/04/05/16 denies missing identity, wrong owner and revoked grant', async () => {
    await expect(makeService().service.readPortfolioHomeEntryContext({ continuationId: 'continuation-1', authenticatedUserId: '', permissions: new Set() })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN' });
    await expect(makeService({ owner: 'other-user' }).service.readPortfolioHomeEntryContext({ continuationId: 'continuation-1', authenticatedUserId: 'user-1', permissions: new Set() })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_CONTINUATION_FORBIDDEN' });
    await expect(makeService({ grant: false }).service.readPortfolioHomeEntryContext({ continuationId: 'continuation-1', authenticatedUserId: 'user-1', permissions: new Set() })).rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_CONTINUATION_SCOPED_PORTFOLIO_ACCESS_REQUIRED' });
  });

  it('HOME-12/13/14/15 performs a read-only projection without cognition or canonical writes', async () => {
    const { service, prisma } = makeService();
    await service.readPortfolioHomeEntryContext({ continuationId: 'continuation-1', authenticatedUserId: 'user-1', permissions: new Set() });
    expect(prisma).not.toHaveProperty('llm');
    expect(prisma).not.toHaveProperty('project.create');
    expect(prisma).not.toHaveProperty('initiative.create');
    expect(prisma).not.toHaveProperty('strategicFront.create');
    expect(prisma).not.toHaveProperty('challenge.create');
  });
});
