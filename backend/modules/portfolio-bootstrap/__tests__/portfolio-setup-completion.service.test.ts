import { describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { PortfolioSetupCompletionService } from '../portfolio-setup-completion.service';

const permissions = permissionsForRoles(['portfolio_lead']);

function validLabRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lab-request-1',
    organizationId: 'org-1',
    challengeId: 'challenge-1',
    briefId: 'brief-lab-1',
    briefVersionId: 'brief-version-lab-1',
    requesterId: 'lead-1',
    status: 'REQUESTED',
    notificationStatus: 'NOTIFIED',
    briefVersion: {
      id: 'brief-version-lab-1', organizationId: 'org-1', challengeId: 'challenge-1',
      briefId: 'brief-lab-1', status: 'CONFIRMED',
    },
    notificationAttempts: [{
      status: 'ACCEPTED',
      acceptedRecipients: ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'],
    }],
    ...overrides,
  };
}

function fixture(options: { sent?: number; created?: number; failed?: number; labRequests?: any[] } = {}) {
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
      updateMany: vi.fn().mockImplementation(({ where, data }) => {
        if (where?.setupCompletedAt === null && session.setupCompletedAt) return Promise.resolve({ count: 0 });
        Object.assign(session, data);
        return Promise.resolve({ count: 1 });
      }),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({
        ...data,
        createdAt: new Date('2026-10-24T09:00:00.000Z'),
        updatedAt: new Date('2026-10-24T09:00:00.000Z'),
      })),
    },
    portfolioHandoffAssignment: { findMany: vi.fn().mockResolvedValue(assignments) },
    portfolioLabRequest: { findMany: vi.fn().mockResolvedValue(options.labRequests ?? []) },
    portfolioAnchor: { create: vi.fn().mockResolvedValue({ id: 'anchor-2' }) },
    auditLog: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'audit-1', ...data })),
      findFirst: vi.fn().mockResolvedValue(null),
    },
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

    expect(result).toMatchObject({
      completed: true,
      completionRoute: 'TEAM_SENT',
      summary: { sent: 2, unsent: 2, failed: 0 },
      labSummary: { notified: 0 },
    });
    expect(tx.portfolioBootstrapSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'setup-1', setupCompletedAt: null }),
      data: expect.objectContaining({ setupCompletedByActorId: 'lead-1', setupCompletionIdempotencyKey: 'close-setup-1' }),
    }));
  });

  it('closes Lab-only when one active request has the exact confirmed BriefVersion and both SMTP acceptances', async () => {
    const { prisma, tx } = fixture({ sent: 0, created: 0, labRequests: [validLabRequest()] });
    const service = new PortfolioSetupCompletionService(prisma as any, () => new Date('2026-11-07T12:00:00.000Z'));

    const result = await service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-lab-only',
    });

    expect(result).toMatchObject({
      completed: true,
      completionRoute: 'LAB_NOTIFIED',
      summary: { sent: 0, unsent: 0, failed: 0 },
      labSummary: { notified: 1 },
    });
    expect(tx.portfolioLabRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-1',
        requesterId: 'lead-1',
        challengeId: { in: ['challenge-1'] },
        status: { notIn: ['CLOSED', 'NOT_PROCEEDING', 'CANCELLED'] },
        notificationStatus: 'NOTIFIED',
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'portfolio_setup_completed',
        details: expect.objectContaining({ completionRoute: 'LAB_NOTIFIED' }),
      }),
    }));
  });

  it('returns the frozen completion snapshot on reentry even if the Lab request later becomes terminal', async () => {
    const labRequest = validLabRequest();
    const { prisma, tx, session } = fixture({ sent: 0, created: 0, labRequests: [labRequest] });
    const service = new PortfolioSetupCompletionService(prisma as any, () => new Date('2026-11-07T12:00:00.000Z'));

    const first = await service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-lab-first',
    });
    Object.assign(labRequest, { status: 'CLOSED', notificationStatus: 'FAILED' });
    tx.auditLog.findFirst.mockResolvedValue({
      details: {
        completionRoute: first.completionRoute,
        summary: first.summary,
        labSummary: first.labSummary,
        labRequestIds: ['lab-request-1'],
      },
    });

    const replay = await service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-lab-reentry',
    });

    expect(replay).toEqual(first);
    expect(session.setupCompletedAt).toEqual(new Date('2026-11-07T12:00:00.000Z'));
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.portfolioLabRequest.findMany).toHaveBeenCalledTimes(1);
  });

  it('reports BOTH without folding Lab notification into the PL-06 sent summary', async () => {
    const { prisma } = fixture({ sent: 1, created: 0, labRequests: [validLabRequest()] });
    const service = new PortfolioSetupCompletionService(prisma as any);

    const result = await service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-both',
    });

    expect(result).toMatchObject({
      completionRoute: 'BOTH',
      summary: { sent: 1 },
      labSummary: { notified: 1 },
    });
  });

  it.each([
    ['REQUESTED without notification', validLabRequest({ notificationStatus: 'PENDING' })],
    ['failed notification', validLabRequest({ notificationStatus: 'FAILED' })],
    ['terminal request', validLabRequest({ status: 'CLOSED' })],
    ['foreign tenant', validLabRequest({ organizationId: 'org-2' })],
    ['another requester', validLabRequest({ requesterId: 'lead-2' })],
    ['another setup challenge', validLabRequest({ challengeId: 'challenge-other' })],
    ['draft BriefVersion', validLabRequest({ briefVersion: { id: 'brief-version-lab-1', organizationId: 'org-1', challengeId: 'challenge-1', briefId: 'brief-lab-1', status: 'DRAFT' } })],
    ['missing first SMTP acceptance', validLabRequest({ notificationAttempts: [{ status: 'ACCEPTED', acceptedRecipients: ['orlandokuanb@gmail.com'] }] })],
    ['failed delivery attempt', validLabRequest({ notificationAttempts: [{ status: 'FAILED', acceptedRecipients: ['fabio.merino.97@gmail.com', 'orlandokuanb@gmail.com'] }] })],
  ])('does not close Lab-only for %s', async (_label, request) => {
    const { prisma, tx } = fixture({ sent: 0, created: 0, labRequests: [request] });
    const service = new PortfolioSetupCompletionService(prisma as any);

    await expect(service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-invalid-lab',
    })).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_SETUP_DELIVERY_REQUIRED' });
    expect(tx.portfolioBootstrapSession.updateMany).not.toHaveBeenCalled();
  });

  it('requires the explicit human confirmation even when Lab delivery is valid', async () => {
    const { prisma, tx } = fixture({ sent: 0, created: 0, labRequests: [validLabRequest()] });
    const service = new PortfolioSetupCompletionService(prisma as any);

    await expect(service.complete({
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: false, idempotencyKey: 'close-without-human',
    })).rejects.toMatchObject({ statusCode: 400, code: 'PORTFOLIO_SETUP_CONFIRMATION_REQUIRED' });
    expect(tx.portfolioBootstrapSession.updateMany).not.toHaveBeenCalled();
  });

  it('uses a CAS so two concurrent confirmations persist one completion audit', async () => {
    const { prisma, tx, session } = fixture({ sent: 1, created: 1 });
    const pendingReads: Array<(value: typeof session) => void> = [];
    tx.portfolioBootstrapSession.findFirst.mockImplementation(({ where }) => {
      if (where?.setupCompletedAt?.not === null) return Promise.resolve(session);
      if (where?.id && where.id !== session.id) return Promise.resolve(null);
      if (pendingReads.length >= 2) return Promise.resolve(session);
      return new Promise<typeof session>((resolve) => {
        pendingReads.push(resolve);
        if (pendingReads.length === 2) {
          const snapshot = { ...session, setupCompletedAt: null };
          pendingReads.splice(0).forEach((release) => release(snapshot));
        }
      });
    });
    const service = new PortfolioSetupCompletionService(prisma as any, () => new Date('2026-10-24T08:00:00.000Z'));
    const input = {
      sessionId: 'setup-1', authenticatedUserId: 'lead-1', permissions,
      confirmed: true, idempotencyKey: 'close-concurrent',
    };

    const [first, second] = await Promise.all([service.complete(input), service.complete(input)]);

    expect(first.completedAt).toBe(second.completedAt);
    expect(tx.portfolioBootstrapSession.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
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
