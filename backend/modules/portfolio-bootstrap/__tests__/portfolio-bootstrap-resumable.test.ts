import { describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { PortfolioBootstrapService } from '../portfolio-bootstrap.service';

const permissions = permissionsForRoles(['portfolio_lead']);

describe('KAN-250 — resumable Bootstrap for Overview', () => {
  it('returns owner-scoped unfinished sessions without creating or canonicalizing anything', async () => {
    const findUnique = vi.fn().mockResolvedValue({ organizationId: 'org-a' });
    const findMany = vi.fn().mockResolvedValue([{
      id: 'bs-ongoing', bootstrapPhase: 'B1_ANCHOR', status: 'awaiting_anchor_review',
      sourceContinuationId: null,
      createdAt: new Date('2026-11-07T10:00:00.000Z'),
      updatedAt: new Date('2026-11-08T11:00:00.000Z'),
      anchor: { outcomeStatement: 'Resultado de negocio por definir', contextSummary: 'Necesitamos mejorar el servicio.' },
      contextReview: { version: 2, updatedAt: new Date('2026-11-08T12:00:00.000Z'), draftJson: { situation: { value: 'Una cafetería quiere mejorar los pedidos.' } } },
    }]);
    const prisma = { user: { findUnique }, portfolioBootstrapSession: { findMany } };
    const result = await new PortfolioBootstrapService(prisma as any).listResumable({
      authenticatedUserId: 'lead-a', permissions,
    });

    expect(result).toEqual([{
      sessionId: 'bs-ongoing', title: 'Una cafetería quiere mejorar los pedidos.',
      bootstrapPhase: 'B1_ANCHOR', status: 'awaiting_anchor_review', source: 'direct',
      createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-08T11:00:00.000Z',
      contextVersion: 2, contextUpdatedAt: '2026-11-08T12:00:00.000Z',
    }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: 'lead-a', organizationId: 'org-a',
        status: { not: 'abandoned' }, setupCompletedAt: null,
      },
      take: 5,
    }));
    expect(Object.keys(prisma)).toEqual(['user', 'portfolioBootstrapSession']);
  });

  it('requires read permission and does not query sessions when denied', async () => {
    const findMany = vi.fn();
    const prisma = { user: { findUnique: vi.fn() }, portfolioBootstrapSession: { findMany } };
    await expect(new PortfolioBootstrapService(prisma as any).listResumable({
      authenticatedUserId: 'lead-a', permissions: new Set() as any,
    })).rejects.toMatchObject({ statusCode: 403 });
    expect(findMany).not.toHaveBeenCalled();
  });
});
