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
    await prisma.portfolioBootstrapAnalysisRun.create({ data: {
      id: 'analysis-pl04', bootstrapSessionId: sessionId, status: 'completed', analyzerMode: 'deterministic',
      inputVersion: 'pl04-input-v1', outputVersion: 'pl04-output-v1', createdBy: userId, completedAt: new Date(),
    } });
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

  it('guards save and confirm against active hard blockers with durable idempotent resolution', async () => {
    const mutation = await prisma.portfolioBootstrapProposedMutation.create({ data: {
      id: 'mutation-pl04-hard', bootstrapSessionId: sessionId, analysisRunId: 'analysis-pl04',
      targetType: 'advancement_condition', mutationType: 'create',
      proposedValue: { severity: 'blocking' }, sourceRefs: { source: 'kan-217-test' },
      provenanceStatus: 'ai_suggested', uncertainty: 'low', materiality: 'material',
      status: 'confirmed', reviewedBy: userId, reviewedAt: new Date(),
    } });
    const condition = await prisma.portfolioAdvancementCondition.create({ data: {
      id: 'condition-pl04-hard', bootstrapSessionId: sessionId, sourceMutationId: mutation.id,
      type: 'critical_dependency', status: 'confirmed', statement: 'Resolver dependencia crítica.',
      severity: 'blocking', movementAffected: 'Organización', provenanceStatus: 'user_confirmed',
      sourceRefs: { source: 'kan-217-test' }, confirmedBy: userId, confirmedAt: new Date(),
    } });
    const service = new PortfolioOrganizationService(prisma);

    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({
      allowed: false, reasonCodes: ['HARD_BLOCKERS_ACTIVE'],
      blockers: [{ id: condition.id, kind: 'confirmed_condition' }],
    });
    await expect(service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_E5_INELIGIBLE' });

    const auditCountBeforeResolution = await prisma.auditLog.count({ where: { resourceId: condition.id } });
    const resolved = await service.updateAdvancementConditionDisposition({
      ...authority, sessionId, conditionId: condition.id, disposition: 'resolved', expectedVersion: 1,
      reason: 'Dependencia verificada como resuelta.', evidenceRefs: ['evidence://kan-217/resolve-1'],
      idempotencyKey: 'resolve-condition-pl04-1',
    });
    const retry = await service.updateAdvancementConditionDisposition({
      ...authority, sessionId, conditionId: condition.id, disposition: 'resolved', expectedVersion: 1,
      reason: 'Dependencia verificada como resuelta.', evidenceRefs: ['evidence://kan-217/resolve-1'],
      idempotencyKey: 'resolve-condition-pl04-1',
    });
    expect(resolved.condition.dispositionVersion).toBe(2);
    expect(retry.condition.dispositionVersion).toBe(2);
    expect(retry.eligibility.allowed).toBe(true);
    expect(await prisma.auditLog.count({ where: { resourceId: condition.id } })).toBe(auditCountBeforeResolution + 1);

    const proposal = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() });
    await service.updateAdvancementConditionDisposition({
      ...authority, sessionId, conditionId: condition.id, disposition: 'active', expectedVersion: 2,
      reason: 'Nueva evidencia reabre la dependencia.', evidenceRefs: ['evidence://kan-217/reopen-1'],
      idempotencyKey: 'reopen-condition-pl04-1',
    });
    const historicalRetry = await service.updateAdvancementConditionDisposition({
      ...authority, sessionId, conditionId: condition.id, disposition: 'resolved', expectedVersion: 1,
      reason: 'Dependencia verificada como resuelta.', evidenceRefs: ['evidence://kan-217/resolve-1'],
      idempotencyKey: 'resolve-condition-pl04-1',
    });
    expect(historicalRetry).toMatchObject({
      replayed: true,
      originalDispositionVersion: 2,
      condition: { disposition: 'active', dispositionVersion: 3 },
      eligibility: { allowed: false },
    });
    expect(await prisma.auditLog.count({ where: { resourceId: condition.id } })).toBe(auditCountBeforeResolution + 2);
    await expect(service.confirmAndMaterialize({
      ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-blocked-pl04',
    })).rejects.toMatchObject({ code: 'PORTFOLIO_E5_INELIGIBLE' });

    const concurrent = await Promise.allSettled([
      service.updateAdvancementConditionDisposition({
        ...authority, sessionId, conditionId: condition.id, disposition: 'resolved', expectedVersion: 3,
        reason: 'Resolución concurrente válida.', evidenceRefs: ['evidence://kan-217/concurrent-resolve'],
        idempotencyKey: 'concurrent-resolve-pl04',
      }),
      service.updateAdvancementConditionDisposition({
        ...authority, sessionId, conditionId: condition.id, disposition: 'dismissed', expectedVersion: 3,
        reason: 'Descarte concurrente alternativo.', evidenceRefs: ['evidence://kan-217/concurrent-dismiss'],
        idempotencyKey: 'concurrent-dismiss-pl04',
      }),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({ allowed: true, blockers: [] });

    await expect(service.confirmAndMaterialize({
      ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-stale-after-resolution',
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ORGANIZATION_STALE' });
    const refreshed = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: proposal.version, payload: reviewedPayload() });
    await expect(service.confirmAndMaterialize({
      ...authority, sessionId, proposalVersion: refreshed.version, idempotencyKey: 'confirm-after-resolution',
    })).resolves.toMatchObject({ status: 'materialized' });
  });

  it('keeps soft reviewed findings non-blocking and hides cross-tenant blocker state', async () => {
    const softMutation = await prisma.portfolioBootstrapProposedMutation.create({ data: {
      id: 'mutation-pl04-soft', bootstrapSessionId: sessionId, analysisRunId: 'analysis-pl04',
      targetType: 'advancement_condition', mutationType: 'create',
      proposedValue: { severity: 'attention' }, sourceRefs: { source: 'kan-217-test' },
      provenanceStatus: 'ai_suggested', uncertainty: 'medium', materiality: 'material',
      status: 'confirmed', reviewedBy: userId, reviewedAt: new Date(),
    } });
    const softCondition = await prisma.portfolioAdvancementCondition.create({ data: {
      id: 'condition-pl04-soft', bootstrapSessionId: sessionId, sourceMutationId: softMutation.id,
      type: 'required_context', status: 'confirmed', statement: 'Contexto recomendable.',
      severity: 'attention', movementAffected: 'Organización', provenanceStatus: 'user_confirmed',
      sourceRefs: { source: 'kan-217-test' }, confirmedBy: userId, confirmedAt: new Date(),
    } });
    const service = new PortfolioOrganizationService(prisma);
    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({
      allowed: true, reasonCodes: ['ANALYZED_WORK_ELIGIBLE'], blockers: [],
    });
    await expect(service.updateAdvancementConditionDisposition({
      ...authority, sessionId, conditionId: softCondition.id, disposition: 'resolved', expectedVersion: 1,
      reason: 'No debe convertirse en un bloqueo duro.', evidenceRefs: ['evidence://kan-217/soft'],
      idempotencyKey: 'resolve-soft-condition-pl04',
    })).rejects.toMatchObject({ code: 'PORTFOLIO_CONDITION_NOT_HARD_BLOCKER' });
    await expect(service.getE5Eligibility({
      authenticatedUserId: otherUserId, roles: ['portfolio_lead'], permissions: ['portfolio:write'], sessionId,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ORGANIZATION_SESSION_NOT_FOUND' });
    await expect(service.getE5Eligibility({
      authenticatedUserId: userId, roles: ['viewer'], permissions: ['portfolio:write'], sessionId,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_ORGANIZATION_AUTHORITY_REQUIRED' });
  });

  it('fails closed for proposed and reviewed hard findings until both are rejected', async () => {
    await prisma.portfolioBootstrapProposedMutation.createMany({ data: [
      {
        id: 'mutation-pl04-hard-proposed', bootstrapSessionId: sessionId, analysisRunId: 'analysis-pl04',
        targetType: 'advancement_condition', mutationType: 'create', proposedValue: { severity: 'blocking' },
        sourceRefs: { source: 'kan-217-test' }, provenanceStatus: 'ai_suggested', uncertainty: 'low',
        materiality: 'material', status: 'proposed',
      },
      {
        id: 'mutation-pl04-hard-reviewed', bootstrapSessionId: sessionId, analysisRunId: 'analysis-pl04',
        targetType: 'advancement_condition', mutationType: 'create', proposedValue: { severity: 'blocking' },
        sourceRefs: { source: 'kan-217-test' }, provenanceStatus: 'ai_suggested', uncertainty: 'medium',
        materiality: 'material', status: 'reviewed', reviewedBy: userId, reviewedAt: new Date(),
      },
    ] });
    const service = new PortfolioOrganizationService(prisma);
    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({
      allowed: false, reasonCodes: ['HARD_BLOCKERS_PENDING'],
      blockers: [
        { id: 'mutation-pl04-hard-proposed', kind: 'proposed_mutation' },
        { id: 'mutation-pl04-hard-reviewed', kind: 'proposed_mutation' },
      ],
    });
    await expect(service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() }))
      .rejects.toMatchObject({ code: 'PORTFOLIO_E5_INELIGIBLE' });

    await prisma.portfolioBootstrapProposedMutation.updateMany({
      where: { id: { in: ['mutation-pl04-hard-proposed', 'mutation-pl04-hard-reviewed'] } },
      data: { status: 'rejected', reviewedBy: userId, reviewedAt: new Date(), reviewNote: 'No aplica tras revisión humana.' },
    });
    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({
      allowed: true, reasonCodes: ['ANALYZED_WORK_ELIGIBLE'], blockers: [],
    });
  });

  it('fails closed when a reviewed finding changes from soft to hard during confirmation', async () => {
    await prisma.portfolioBootstrapProposedMutation.create({ data: {
      id: 'mutation-pl04-race', bootstrapSessionId: sessionId, analysisRunId: 'analysis-pl04',
      targetType: 'advancement_condition', mutationType: 'create', proposedValue: { severity: 'attention' },
      sourceRefs: { source: 'kan-217-race-test' }, provenanceStatus: 'ai_suggested', uncertainty: 'medium',
      materiality: 'material', status: 'reviewed', reviewedBy: userId, reviewedAt: new Date(),
    } });
    const service = new PortfolioOrganizationService(prisma);
    const proposal = await service.saveReviewedProposal({ ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload() });

    let markUpdated!: () => void;
    let releaseUpdate!: () => void;
    const updated = new Promise<void>((resolve) => { markUpdated = resolve; });
    const release = new Promise<void>((resolve) => { releaseUpdate = resolve; });
    const writer = prisma.$transaction(async (tx) => {
      await tx.portfolioBootstrapProposedMutation.update({
        where: { id: 'mutation-pl04-race' },
        data: { proposedValue: { severity: 'blocking' }, correctedBy: userId, correctedAt: new Date() },
      });
      markUpdated();
      await release;
    });
    await updated;
    const confirmation = service.confirmAndMaterialize({
      ...authority, sessionId, proposalVersion: proposal.version, idempotencyKey: 'confirm-soft-hard-race',
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    releaseUpdate();
    await writer;

    await expect(confirmation).rejects.toMatchObject({
      code: expect.stringMatching(/PORTFOLIO_(E5_INELIGIBLE|E5_CONCURRENT_CHANGE|ORGANIZATION_STALE)/),
    });
    expect(await prisma.strategicFront.count({ where: { organizationId } })).toBe(0);
    expect(await prisma.challenge.count({ where: { strategicFront: { organizationId } } })).toBe(0);
  });

  it('authorizes the persisted no-work path without inventing an analysis run', async () => {
    await prisma.portfolioBootstrapWorkItem.deleteMany({ where: { bootstrapSessionId: sessionId } });
    await prisma.portfolioBootstrapAnalysisRun.deleteMany({ where: { bootstrapSessionId: sessionId } });
    await prisma.portfolioBootstrapSession.update({
      where: { id: sessionId },
      data: { existingWorkStatus: 'no_existing_work', bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING' },
    });
    const service = new PortfolioOrganizationService(prisma);
    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({
      allowed: true, reasonCodes: ['NO_EXISTING_WORK_ELIGIBLE'], blockers: [],
    });
    await expect(service.saveReviewedProposal({
      ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload([]),
    })).resolves.toMatchObject({ status: 'reviewed' });
  });

  it('does not let the no-work path bypass an active confirmed hard blocker', async () => {
    const mutation = await prisma.portfolioBootstrapProposedMutation.create({ data: {
      id: 'mutation-pl04-no-work-hard', bootstrapSessionId: sessionId, analysisRunId: 'analysis-pl04',
      targetType: 'advancement_condition', mutationType: 'create', proposedValue: { severity: 'blocking' },
      sourceRefs: { source: 'kan-217-no-work-test' }, provenanceStatus: 'ai_suggested', uncertainty: 'low',
      materiality: 'material', status: 'confirmed', reviewedBy: userId, reviewedAt: new Date(),
    } });
    const condition = await prisma.portfolioAdvancementCondition.create({ data: {
      id: 'condition-pl04-no-work-hard', bootstrapSessionId: sessionId, sourceMutationId: mutation.id,
      type: 'critical_dependency', status: 'confirmed', statement: 'Bloqueo duro aún activo.',
      severity: 'blocking', provenanceStatus: 'user_confirmed', sourceRefs: { source: 'kan-217-no-work-test' },
      confirmedBy: userId, confirmedAt: new Date(),
    } });
    await prisma.portfolioBootstrapWorkItem.deleteMany({ where: { bootstrapSessionId: sessionId } });
    await prisma.portfolioBootstrapSession.update({
      where: { id: sessionId },
      data: { existingWorkStatus: 'no_existing_work', bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING' },
    });
    const service = new PortfolioOrganizationService(prisma);
    expect(await service.getE5Eligibility({ ...authority, sessionId })).toMatchObject({
      allowed: false, reasonCodes: ['HARD_BLOCKERS_ACTIVE'],
      blockers: [{ id: condition.id, kind: 'confirmed_condition' }],
    });
    await expect(service.saveReviewedProposal({
      ...authority, sessionId, expectedVersion: 0, payload: reviewedPayload([]),
    })).rejects.toMatchObject({ code: 'PORTFOLIO_E5_INELIGIBLE' });
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
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: [
    'condition-pl04-hard', 'condition-pl04-soft', 'condition-pl04-no-work-hard',
  ] } } });
  await db.portfolioOrganizationMaterialization?.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
  await db.portfolioOrganizationProposal?.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
  await prisma.challenge.deleteMany({ where: { strategicFront: { organizationId: { in: [organizationId, otherOrganizationId] } } } });
  await prisma.strategicFront.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
  await prisma.portfolioBootstrapSession.deleteMany({ where: { id: { in: [sessionId, otherSessionId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
}
