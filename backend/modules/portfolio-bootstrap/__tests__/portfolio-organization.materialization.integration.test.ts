import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PortfolioOrganizationService } from '../portfolio-organization.service';

const prisma = new PrismaClient();
const organizationId = 'org-pl04-materialization';
const otherOrganizationId = 'org-pl04-other';
const userId = 'user-pl04-lead';
const otherUserId = 'user-pl04-other';
const sessionId = 'bootstrap-pl04';
const otherSessionId = 'bootstrap-pl04-other';

const authority = {
  authenticatedUserId: userId,
  roles: ['portfolio_lead'],
  permissions: ['portfolio:read', 'portfolio:write'],
};

function reviewedPayload(workItemIds = ['pl04-work-1', 'pl04-work-2']) {
  return {
    summary: 'Startería propone esta organización a partir de las 2 iniciativas revisadas.',
    fronts: [{
      candidateId: 'front-candidate-1',
      name: 'Adopción sostenible',
      focus: 'Reducir abandono y aumentar adopción.',
      rationale: 'Estas iniciativas persiguen el mismo resultado de negocio.',
      coverage: '2 de 2 iniciativas revisadas',
      challenges: [{
        candidateId: 'challenge-candidate-1',
        title: 'Reducir barreras de activación',
        problem: 'No sabemos qué fricciones explican el abandono inicial.',
        rationale: 'Las iniciativas necesitan aclarar y reducir las mismas barreras.',
        relatedInitiativeIds: workItemIds,
        evidence: ['El abandono se concentra en activación.'],
        gaps: ['Falta comparar cohortes.'],
        overlaps: ['Ambas iniciativas miden activación.'],
      }],
    }],
    crossCuttingInitiativeIds: [],
    outsideObjectiveInitiativeIds: [],
    ungroupedInitiativeIds: [],
  };
}

describe.runIf(Boolean(process.env.DATABASE_URL)).sequential('PL-04 organization confirmation and materialization', () => {
  beforeEach(async () => {
    await clean();
    await prisma.organization.createMany({ data: [
      { id: organizationId, name: 'PL04 organization', slug: organizationId },
      { id: otherOrganizationId, name: 'PL04 other', slug: otherOrganizationId },
    ] });
    await prisma.user.createMany({ data: [
      { id: userId, email: 'pl04-lead@starteria.test', name: 'PL04 Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'PL', skills: [], organizationId },
      { id: otherUserId, email: 'pl04-other@starteria.test', name: 'Other Lead', role: 'portfolio_lead', roles: ['portfolio_lead'], initials: 'OL', skills: [], organizationId: otherOrganizationId },
    ] });
    await prisma.portfolioBootstrapSession.create({ data: {
      id: sessionId, userId, organizationId, existingWorkStatus: 'has_work', bootstrapPhase: 'B4_MATERIAL_REVIEW',
      anchor: { create: { outcomeStatement: 'Reducir abandono durante activación', status: 'anchor_confirmed', provenanceStatus: 'user_confirmed', sourceRefs: { source: 'pl04-test' }, version: 2 } },
    } });
    const source = await prisma.portfolioBootstrapWorkIntakeSource.create({ data: { bootstrapSessionId: sessionId, sourceType: 'manual_entry', rawInput: 'PL04 test', requestHash: 'pl04-source', createdBy: userId } });
    await prisma.portfolioBootstrapWorkItem.createMany({ data: [
      { id: 'pl04-work-1', bootstrapSessionId: sessionId, sourceId: source.id, rawLabel: 'Onboarding guiado', proposedPurpose: 'Reducir abandono', sourceType: 'manual_entry', sourceRefs: { row: 1 }, createdBy: userId },
      { id: 'pl04-work-2', bootstrapSessionId: sessionId, sourceId: source.id, rawLabel: 'Nudges de activación', proposedPurpose: 'Aumentar adopción', sourceType: 'manual_entry', sourceRefs: { row: 2 }, createdBy: userId },
    ] });
    await prisma.portfolioBootstrapSession.create({ data: {
      id: otherSessionId, userId: otherUserId, organizationId: otherOrganizationId, existingWorkStatus: 'has_work', bootstrapPhase: 'B4_MATERIAL_REVIEW',
      anchor: { create: { outcomeStatement: 'Otro objetivo', status: 'anchor_confirmed', provenanceStatus: 'user_confirmed', sourceRefs: { source: 'pl04-test' }, version: 1 } },
    } });
    const otherSource = await prisma.portfolioBootstrapWorkIntakeSource.create({ data: { bootstrapSessionId: otherSessionId, sourceType: 'manual_entry', rawInput: 'Other test', requestHash: 'pl04-other-source', createdBy: otherUserId } });
    await prisma.portfolioBootstrapWorkItem.create({ data: { id: 'pl04-other-work', bootstrapSessionId: otherSessionId, sourceId: otherSource.id, rawLabel: 'Trabajo ajeno', sourceType: 'manual_entry', sourceRefs: {}, createdBy: otherUserId } });
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('keeps zero canonical entities before confirmation and materializes the exact reviewed structure once', async () => {
    const service = new PortfolioOrganizationService(prisma);
    const proposal = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() });
    expect(await prisma.strategicFront.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId } } })).toBe(0);

    const result = await service.confirmAndMaterialize({ ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-pl04-1' });
    expect(await prisma.strategicFront.findMany({ where: { organizationId }, select: { name: true, strategicObjective: true } }))
      .toEqual([{ name: 'Adopción sostenible', strategicObjective: 'Reducir abandono y aumentar adopción.' }]);
    expect(await prisma.challenge.findMany({ where: { strategicFront: { organizationId } }, select: { title: true, description: true, status: true } }))
      .toEqual([{ title: 'Reducir barreras de activación', description: 'No sabemos qué fricciones explican el abandono inicial.', status: 'draft' }]);
    expect(result.materialization.canonicalMappings).toEqual({
      fronts: [{ candidateId: 'front-candidate-1', canonicalId: expect.any(String) }],
      challenges: [{ candidateId: 'challenge-candidate-1', canonicalId: expect.any(String), relatedInitiativeIds: ['pl04-work-1', 'pl04-work-2'] }],
      specialDestinations: {
        crossCuttingInitiativeIds: [],
        outsideObjectiveInitiativeIds: [],
        ungroupedInitiativeIds: [],
      },
    });
  });

  it('preserves moves between special destinations as immutable reviewed history', async () => {
    const service = new PortfolioOrganizationService(prisma);
    const firstPayload = reviewedPayload(['pl04-work-1']);
    firstPayload.ungroupedInitiativeIds = ['pl04-work-2'];
    const first = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: firstPayload });
    const secondPayload = { ...firstPayload, ungroupedInitiativeIds: [], crossCuttingInitiativeIds: ['pl04-work-2'] };
    const second = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: first.version, payload: secondPayload });

    const history = await prisma.portfolioOrganizationProposal.findMany({
      where: { bootstrapSessionId: sessionId },
      orderBy: { version: 'asc' },
      select: { version: true, status: true, payload: true, provenance: true },
    });
    expect(second.version).toBe(2);
    expect(history).toMatchObject([
      { version: 1, status: 'superseded', payload: { ungroupedInitiativeIds: ['pl04-work-2'], crossCuttingInitiativeIds: [] } },
      { version: 2, status: 'reviewed', payload: { ungroupedInitiativeIds: [], crossCuttingInitiativeIds: ['pl04-work-2'] } },
    ]);
    expect(history.every((entry) => entry.provenance !== null)).toBe(true);
  });

  it('returns the same canonical IDs for retries and re-entry without downstream writes', async () => {
    const service = new PortfolioOrganizationService(prisma);
    const proposal = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() });
    const downstreamBefore = {
      projects: await prisma.project.count(),
      steps: await prisma.step.count(),
    };
    const first = await service.confirmAndMaterialize({ ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-pl04-retry' });
    const retry = await service.confirmAndMaterialize({ ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-pl04-retry' });
    const reentry = await service.getProposal({ ...authority, sessionId });
    expect(retry.materialization.canonicalMappings).toEqual(first.materialization.canonicalMappings);
    expect(reentry.materialization?.canonicalMappings).toEqual(first.materialization.canonicalMappings);
    expect(await prisma.strategicFront.count({ where: { organizationId } })).toBe(1);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId } } })).toBe(1);
    expect(await prisma.project.count()).toBe(downstreamBefore.projects);
    expect(await prisma.step.count()).toBe(downstreamBefore.steps);
    expect(await prisma.challengeInvitation.count({ where: { challenge: { strategicFront: { organizationId } } } })).toBe(0);
    expect(await prisma.portfolioHandoffAssignment.count({ where: { organizationId } })).toBe(0);
  });

  it('rejects stale source state and cross-tenant work-item references', async () => {
    const service = new PortfolioOrganizationService(prisma);
    const proposal = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() });
    await prisma.portfolioAnchor.update({ where: { bootstrapSessionId: sessionId }, data: { version: { increment: 1 } } });
    await expect(service.confirmAndMaterialize({ ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-stale' }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ORGANIZATION_STALE' });
    await expect(service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: proposal.version, payload: reviewedPayload(['pl04-other-work']) }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ORGANIZATION_CROSS_TENANT_REFERENCE' });
    expect(await prisma.strategicFront.count({ where: { organizationId } })).toBe(0);
  });

  it('rolls back the Front when Challenge creation fails', async () => {
    const service = new PortfolioOrganizationService(prisma);
    const proposal = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() });
    const failing = new PortfolioOrganizationService(transactionProxyThatFailsChallengeCreate(prisma));
    await expect(failing.confirmAndMaterialize({ ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-partial-failure' }))
      .rejects.toThrow('forced challenge failure');
    expect(await prisma.strategicFront.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId } } })).toBe(0);
  });
});

function transactionProxyThatFailsChallengeCreate(client: PrismaClient): PrismaClient {
  return new Proxy(client, {
    get(target, property) {
      if (property !== '$transaction') return Reflect.get(target, property, target);
      return (callback: (tx: any) => Promise<unknown>, ...args: unknown[]) => target.$transaction((tx) => callback(new Proxy(tx, {
        get(txTarget, txProperty) {
          if (txProperty !== 'challenge') return Reflect.get(txTarget, txProperty, txTarget);
          return new Proxy((txTarget as any).challenge, { get(delegate, method) {
            if (method === 'create') return async () => { throw new Error('forced challenge failure'); };
            return Reflect.get(delegate, method, delegate);
          } });
        },
      })), ...(args as []));
    },
  }) as PrismaClient;
}

async function clean() {
  const db = prisma as any;
  await db.portfolioOrganizationMaterialization?.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
  await db.portfolioOrganizationProposal?.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
  await prisma.challenge.deleteMany({ where: { strategicFront: { organizationId: { in: [organizationId, otherOrganizationId] } } } });
  await prisma.strategicFront.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: { in: [sessionId, otherSessionId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
}
