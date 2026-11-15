import { describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { PortfolioBootstrapService } from '../portfolio-bootstrap.service';
import { assertPortfolioBootstrapSessionActive } from '../portfolio-bootstrap-session-state';

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
      contextReview: { status: 'draft', version: 2, updatedAt: new Date('2026-11-08T12:00:00.000Z'), draftJson: { situation: { value: 'Una cafetería quiere mejorar los pedidos.' } } },
    }]);
    const prisma = { user: { findUnique }, portfolioBootstrapSession: { findMany } };
    const result = await new PortfolioBootstrapService(prisma as any).listResumable({
      authenticatedUserId: 'lead-a', permissions,
    });

    expect(result).toEqual([{
      sessionId: 'bs-ongoing', title: 'Una cafetería quiere mejorar los pedidos.',
      bootstrapPhase: 'B1_ANCHOR', status: 'awaiting_anchor_review', source: 'direct',
      createdAt: '2026-11-07T10:00:00.000Z', updatedAt: '2026-11-08T11:00:00.000Z',
      contextVersion: 2, contextUpdatedAt: '2026-11-08T12:00:00.000Z', contextStatus: 'draft',
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

describe('discarding an unfinished Bootstrap preparation', () => {
  function harness(overrides: {
    session?: Record<string, unknown>;
    materializations?: number;
    importedLinks?: number;
    assignments?: number;
  } = {}) {
    const session = {
      id: 'bs-ongoing', userId: 'lead-a', organizationId: 'org-a',
      status: 'awaiting_anchor_review', setupCompletedAt: null,
      _count: {
        organizationMaterializations: overrides.materializations ?? 0,
        importedInitiativeLinks: overrides.importedLinks ?? 0,
      },
      ...overrides.session,
    };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-a' }) },
      portfolioBootstrapSession: {
        findUnique: vi.fn().mockResolvedValue(session),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      portfolioHandoffAssignment: { count: vi.fn().mockResolvedValue(overrides.assignments ?? 0) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
    };
    return { service: new PortfolioBootstrapService(prisma as any), db, prisma };
  }

  it('marks an owned, same-organization unfinished preparation as abandoned and records one audit event', async () => {
    const { service, db } = harness();

    await expect(service.abandonPreparation({
      sessionId: 'bs-ongoing', authenticatedUserId: 'lead-a', permissions,
      idempotencyKey: 'discard-bs-ongoing',
    })).resolves.toEqual({ sessionId: 'bs-ongoing', status: 'abandoned', idempotent: false });

    expect(db.portfolioBootstrapSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'bs-ongoing', status: { not: 'abandoned' }, setupCompletedAt: null },
      data: { status: 'abandoned' },
    });
    expect(db.auditLog.create).toHaveBeenCalledOnce();
  });

  it('is idempotent when the same discarded preparation is retried', async () => {
    const { service, db } = harness({ session: { status: 'abandoned' } });

    await expect(service.abandonPreparation({
      sessionId: 'bs-ongoing', authenticatedUserId: 'lead-a', permissions,
      idempotencyKey: 'discard-bs-ongoing',
    })).resolves.toEqual({ sessionId: 'bs-ongoing', status: 'abandoned', idempotent: true });

    expect(db.portfolioBootstrapSession.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('reconciles a concurrent Serializable retry with the committed abandoned state', async () => {
    const { service, db, prisma } = harness({ session: { status: 'abandoned' } });
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: (tx: typeof db) => unknown) => callback(db));

    await expect(service.abandonPreparation({
      sessionId: 'bs-ongoing', authenticatedUserId: 'lead-a', permissions,
      idempotencyKey: 'discard-bs-ongoing',
    })).resolves.toEqual({ sessionId: 'bs-ongoing', status: 'abandoned', idempotent: true });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it.each([
    ['canonical structure', { materializations: 1 }],
    ['canonical initiative link', { importedLinks: 1 }],
    ['linked assignment', { assignments: 1 }],
  ])('rejects a preparation with %s without changing it', async (_label, blocked) => {
    const { service, db } = harness(blocked);

    await expect(service.abandonPreparation({
      sessionId: 'bs-ongoing', authenticatedUserId: 'lead-a', permissions,
      idempotencyKey: 'discard-bs-ongoing',
    })).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_BOOTSTRAP_ABANDON_LINKED_WORK' });

    expect(db.portfolioBootstrapSession.updateMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('requires portfolio:write and the current owner organization', async () => {
    const denied = harness();
    await expect(denied.service.abandonPreparation({
      sessionId: 'bs-ongoing', authenticatedUserId: 'lead-a', permissions: new Set() as any,
      idempotencyKey: 'discard-bs-ongoing',
    })).rejects.toMatchObject({ statusCode: 403, code: 'PORTFOLIO_BOOTSTRAP_WRITE_REQUIRED' });

    const otherOrganization = harness({ session: { organizationId: 'org-b' } });
    await expect(otherOrganization.service.abandonPreparation({
      sessionId: 'bs-ongoing', authenticatedUserId: 'lead-a', permissions,
      idempotencyKey: 'discard-bs-ongoing',
    })).rejects.toMatchObject({ statusCode: 403, code: 'PORTFOLIO_BOOTSTRAP_ORGANIZATION_FORBIDDEN' });
  });

  it('prevents an abandoned session from being resumed or modified', () => {
    expect(() => assertPortfolioBootstrapSessionActive({ status: 'abandoned' }))
      .toThrow(expect.objectContaining({ statusCode: 409, code: 'PORTFOLIO_BOOTSTRAP_SESSION_ABANDONED' }));
    expect(() => assertPortfolioBootstrapSessionActive({ status: 'awaiting_anchor_review' })).not.toThrow();
  });

  it('never reuses an abandoned direct session when creating a new objective', async () => {
    const now = new Date('2026-11-15T12:00:00.000Z');
    const active = {
      id: 'bs-fresh', userId: 'lead-a', organizationId: 'org-a', sourceContinuationId: null,
      status: 'awaiting_anchor_review', bootstrapPhase: 'B1_ANCHOR', existingWorkStatus: 'unknown',
      setupCompletedAt: null, setupCompletedByActorId: null, createdAt: now, updatedAt: now,
      sourceContinuation: null, anchor: null, importBatches: [], workItems: [], proposedMutations: [],
      analysisRuns: [], strategicConnections: [], advancementConditions: [], readings: [],
    };
    const db = {
      user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-a' }) },
      portfolioBootstrapSession: { findFirst: vi.fn().mockResolvedValue(active) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-reuse' }) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)) };

    await expect(new PortfolioBootstrapService(prisma as any).createOrReuseDirect({
      authenticatedUserId: 'lead-a', permissions,
    })).resolves.toMatchObject({ bootstrapSession: { id: 'bs-fresh' } });
    expect(db.portfolioBootstrapSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { not: 'abandoned' }, setupCompletedAt: null }),
    }));
  });
});
