import { describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { PortfolioSetupCompletionService } from '../portfolio-setup-completion.service';

const permissions = permissionsForRoles(['portfolio_lead']);

function fixture(options: { sent?: number; created?: number; failed?: number } = {}) {
  const sent = options.sent ?? 2;
  const created = options.created ?? 2;
  const failed = options.failed ?? 0;
  const assignments = [
    ...Array.from({ length: sent }, (_, index) => ({
      id: `sent-${index}`,
      state: 'SENT',
      targetKind: 'CHALLENGE',
      briefVersion: { id: `brief-${index}`, status: 'CONFIRMED', challengeId: 'challenge-1' },
      deliveryAttempts: [{ status: 'SUCCEEDED' }],
    })),
    ...Array.from({ length: created }, (_, index) => ({
      id: `created-${index}`,
      state: 'CREATED',
      targetKind: 'EXISTING_INITIATIVE',
      briefVersion: null,
      deliveryAttempts: [],
    })),
    ...Array.from({ length: failed }, (_, index) => ({
      id: `failed-${index}`,
      state: 'CREATED',
      targetKind: 'CHALLENGE',
      briefVersion: { id: `failed-brief-${index}`, status: 'CONFIRMED', challengeId: 'challenge-1' },
      deliveryAttempts: [{ status: 'FAILED' }],
    })),
  ];
  const session = {
    id: 'setup-1',
    userId: 'lead-1',
    organizationId: 'org-1',
    setupCompletedAt: null,
    setupCompletedByActorId: null,
    anchor: {
      outcomeStatement: 'Reducir abandono', contextSummary: 'Contexto', decisionToEnable: 'Priorizar',
      businessSignalStatus: 'confirmed', businessSignalValue: 'Retención', status: 'anchor_confirmed',
      sourceRefs: [], provenanceStatus: 'confirmed', version: 3,
    },
    organizationMaterializations: [{
      canonicalMappings: {
        fronts: [{ candidateId: 'front-1', canonicalId: 'front-canonical-1' }],
        challenges: [{ candidateId: 'challenge-1', canonicalId: 'challenge-1', relatedInitiativeIds: [] }],
      },
    }],
  };
  const tx = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'lead-1', organizationId: 'org-1' }) },
    portfolioBootstrapSession: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        if (where?.id && where.id !== session.id) return Promise.resolve(null);
        if (where?.setupCompletedAt === null && session.setupCompletedAt) return Promise.resolve(null);
        return Promise.resolve(session);
      }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...session, ...data })),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
        ...data,
        createdAt: new Date('2026-10-24T09:00:00.000Z'),
        updatedAt: new Date('2026-10-24T09:00:00.000Z'),
      })),
    },
    portfolioHandoffAssignment: { findMany: vi.fn().mockResolvedValue(assignments) },
    portfolioAnchor: { create: vi.fn().mockResolvedValue({ id: 'anchor-2' }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { ...tx, $transaction: vi.fn((callback) => callback(tx)) };
  return { prisma, tx, session };
}

describe('PortfolioSetupCompletionService', () => {
  it('closes the contextual setup only after explicit confirmation and a durable successful delivery', async () => {
    const { prisma, tx } = fixture({ sent: 2, created: 2 });
    const service = new PortfolioSetupCompletionService(prisma as any, () => new Date('2026-10-24T08:00:00.000Z'));

    const result = await service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-setup-1',
    });

    expect(result).toMatchObject({ completed: true, summary: { sent: 2, unsent: 2, failed: 0 } });
    expect(tx.portfolioBootstrapSession.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'setup-1' },
      data: expect.objectContaining({ setupCompletedByActorId: 'lead-1', setupCompletionIdempotencyKey: 'close-setup-1' }),
    }));
  });

  it('does not close a setup with no successful invitation delivery', async () => {
    const { prisma, tx } = fixture({ sent: 0, created: 2, failed: 1 });
    const service = new PortfolioSetupCompletionService(prisma as any);

    await expect(service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-without-send',
    })).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_DELIVERY_REQUIRED' });
    expect(tx.portfolioBootstrapSession.update).not.toHaveBeenCalled();
  });

  it('opens a second contextual setup at 1/7 with the confirmed organization context as reference only', async () => {
    const { prisma, tx, session } = fixture();
    session.setupCompletedAt = new Date('2026-10-24T08:00:00.000Z') as any;
    const service = new PortfolioSetupCompletionService(prisma as any);

    const result = await service.openAdditionalFront({
      authenticatedUserId: 'lead-1', permissions, idempotencyKey: 'new-front-intent-1',
    });

    expect(result.bootstrapSession.id).not.toBe('setup-1');
    expect(tx.portfolioBootstrapSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: 'org-1', status: 'awaiting_anchor_review', bootstrapPhase: 'B1_ANCHOR', existingWorkStatus: 'unknown',
      }),
    }));
    expect(tx.portfolioAnchor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        bootstrapSessionId: result.bootstrapSession.id,
        contextSummary: null,
        outcomeStatement: 'Reducir abandono',
        status: 'anchor_insufficient',
        provenanceStatus: 'extracted',
        confirmedBy: null,
        confirmedAt: null,
        sourceRefs: expect.objectContaining({
          organizationalContextReference: expect.objectContaining({
            sourceBootstrapSessionId: 'setup-1',
            contextSummary: 'Contexto',
            reviewStatus: 'reference_only',
          }),
        }),
      }),
    }));
    expect(tx.portfolioBootstrapSession.update).not.toHaveBeenCalled();
  });

  it('reuses only the session associated with the same creation intent', async () => {
    const { prisma, tx, session } = fixture();
    session.setupCompletedAt = new Date('2026-10-24T08:00:00.000Z') as any;
    const existingDraft = {
      id: 'portfolio-additional-existing', userId: 'lead-1', organizationId: 'org-1',
      sourceContinuationId: null, status: 'awaiting_anchor_review', bootstrapPhase: 'B1_ANCHOR',
      existingWorkStatus: 'unknown', setupCompletedAt: null, setupCompletedByActorId: null,
      createdAt: new Date('2026-10-24T09:00:00.000Z'), updatedAt: new Date('2026-10-24T09:00:00.000Z'),
      anchor: { id: 'anchor-existing', status: 'anchor_insufficient', contextSummary: null },
    };
    tx.portfolioBootstrapSession.findFirst.mockImplementation(({ where }) => {
      if (where?.id) return Promise.resolve(existingDraft);
      return Promise.resolve(session);
    });
    const service = new PortfolioSetupCompletionService(prisma as any);

    const result = await service.openAdditionalFront({
      authenticatedUserId: 'lead-1', permissions, idempotencyKey: 'same-intent',
    });

    expect(result.bootstrapSession.id).toBe('portfolio-additional-existing');
    expect(tx.portfolioBootstrapSession.create).not.toHaveBeenCalled();
    expect(tx.portfolioAnchor.create).not.toHaveBeenCalled();
  });

  it('creates different session identities for different deliberate creation intents', async () => {
    const { prisma, tx, session } = fixture();
    session.setupCompletedAt = new Date('2026-10-24T08:00:00.000Z') as any;
    const service = new PortfolioSetupCompletionService(prisma as any);

    await service.openAdditionalFront({ authenticatedUserId: 'lead-1', permissions, idempotencyKey: 'intent-a' });
    await service.openAdditionalFront({ authenticatedUserId: 'lead-1', permissions, idempotencyKey: 'intent-b' });

    const createdIds = tx.portfolioBootstrapSession.create.mock.calls.map(([call]) => call.data.id);
    expect(createdIds).toHaveLength(2);
    expect(createdIds[0]).not.toBe(createdIds[1]);
  });
});
