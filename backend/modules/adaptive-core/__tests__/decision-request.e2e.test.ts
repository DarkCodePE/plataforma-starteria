import { PrismaClient } from '@prisma/client';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';

const describeC3AE2E = process.env.R2_PERSISTENCE_E2E === '1' ? describe : describe.skip;

const prisma = new PrismaClient();

const ownerId = 'user-r3c3a-owner';
const leadId = 'user-r3c3a-lead';
const otherId = 'user-r3c3a-other';
const portfolioProjectId = 'project-r3c3a-portfolio';
const selfProjectId = 'project-r3c3a-self';
const unresolvedProjectId = 'project-r3c3a-unresolved';
const incompleteProjectId = 'project-r3c3a-incomplete';
const challengeId = 'challenge-r3c3a';
const strategicFrontId = 'front-r3c3a';
const organizationId = 'org-r3c3a';

async function clean() {
  const projectIds = [portfolioProjectId, selfProjectId, unresolvedProjectId, incompleteProjectId];
  const where = { projectId: { in: projectIds } };
  await (prisma as any).decisionRequest.deleteMany({ where });
  await (prisma as any).initiativeGovernance.deleteMany({ where });
  await prisma.adaptiveAdaptationEvent.deleteMany({ where });
  await prisma.adaptiveProgressSignal.deleteMany({ where });
  await prisma.adaptiveCheckpointResponse.deleteMany({ where });
  await prisma.adaptiveCheckpointInstance.deleteMany({ where });
  await prisma.adaptiveStepOutput.deleteMany({ where });
  await prisma.adaptiveStepConfiguration.deleteMany({ where });
  await prisma.cycleStepState.deleteMany({ where: { cycle: { projectId: { in: projectIds } } } });
  await prisma.initiativeCycle.deleteMany({ where });
  await prisma.truthValidation.deleteMany({ where });
  await prisma.evidence.deleteMany({ where });
  await prisma.truthClaim.deleteMany({ where });
  await prisma.sourceRef.deleteMany({ where });
  await prisma.initiativePortfolioMeta.deleteMany({ where });
  await prisma.teamMember.deleteMany({ where });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.challenge.deleteMany({ where: { id: challengeId } });
  await prisma.strategicFront.deleteMany({ where: { id: strategicFrontId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, leadId, otherId] } } });
}

async function seedUsersAndChallenge() {
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: 'r3c3a-owner@starteria.test', name: 'R3C3A Owner', role: 'participante', initials: 'RO', skills: [] },
      { id: leadId, email: 'r3c3a-lead@starteria.test', name: 'R3C3A Lead', role: 'mentor', initials: 'RL', skills: [] },
      { id: otherId, email: 'r3c3a-other@starteria.test', name: 'R3C3A Other', role: 'mentor', initials: 'RG', skills: [] },
    ],
  });
  await prisma.organization.create({ data: { id: organizationId, name: 'R3C3A Org', slug: 'r3c3a-org' } });
  await prisma.user.updateMany({ where: { id: { in: [ownerId, leadId, otherId] } }, data: { organizationId } });
  await prisma.strategicFront.create({ data: { id: strategicFrontId, name: 'R3C3A Front', ownerId: leadId, organizationId } });
  await prisma.challenge.create({ data: { id: challengeId, strategicFrontId, title: 'R3C3A Challenge', ownerId: leadId } });
}

async function seedProject(projectId: string, options: { portfolioGoverned?: boolean; unresolvedLead?: boolean; selfInitiated?: boolean; incomplete?: boolean } = {}) {
  await prisma.project.create({
    data: {
      id: projectId,
      name: `R3C3A ${projectId}`,
      description: 'Disposable R3-C3A E2E project.',
      ownerId,
      organizationId,
      status: 'IN_PROGRESS',
      currentStep: 4,
      step0Status: 'COMPLETED',
      step0Data: { challengeType: 'growth', initialFocus: 'Foco', expectedImpact: 'Impacto' },
      teamMembers: {
        create: [
          { userId: ownerId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
          { userId: leadId, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
          { userId: otherId, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
        ],
      },
    },
  });
  if (!options.selfInitiated) {
    await prisma.initiativePortfolioMeta.create({
      data: {
        projectId,
        challengeId,
        strategicFrontId,
        currentStep: 'Step 4',
        status: options.incomplete ? 'en_step_4' : 'lista_para_decision',
      },
    });
  }
  if (options.portfolioGoverned) {
    await (prisma as any).initiativeGovernance.create({
      data: {
        projectId,
        mode: 'portfolio_governed',
        portfolioLeadUserId: options.unresolvedLead ? null : leadId,
      },
    });
  }
  const cycle = await prisma.initiativeCycle.create({
    data: {
      projectId,
      cycleNumber: 1,
      triggerType: 'initial',
      startStep: 0,
      currentStep: 4,
      status: options.incomplete ? 'active' : 'completed',
      completedAt: options.incomplete ? null : new Date('2026-08-20T10:00:00.000Z'),
    },
  });
  for (let stepNumber = 0; stepNumber <= 4; stepNumber += 1) {
    await prisma.cycleStepState.create({
      data: { cycleId: cycle.id, stepNumber, state: stepNumber < 4 ? 'confirmed' : options.incomplete ? 'active' : 'confirmed' },
    });
  }
  const output = await prisma.adaptiveStepOutput.create({
    data: {
      projectId,
      cycleId: cycle.id,
      stepNumber: 4,
      version: 1,
      status: 'confirmed',
      outputKey: 'DecisionMemoLearningReport',
      outputJson: {
        recommendation: 'Solicitar revision de portafolio.',
        decisionPackage: { artifacts: ['memo'] },
        lifecycleProjection: options.selfInitiated ? 'active' : 'presented',
        completionRoute: options.selfInitiated ? 'owner_completed' : 'portfolio_presented',
        portfolioReviewRequired: !options.selfInitiated,
      },
      confirmedById: ownerId,
      confirmedAt: new Date('2026-08-20T10:05:00.000Z'),
    },
  });
  const source = await prisma.sourceRef.create({ data: { projectId, sourceType: 'USER_INPUT', reference: `${projectId}-source` } });
  const claim = await prisma.truthClaim.create({
    data: {
      projectId,
      subjectType: 'initiative',
      subjectId: projectId,
      claimType: 'learning',
      statement: 'La iniciativa tiene aprendizaje trazable.',
      createdById: ownerId,
      createdByType: 'human',
      verificationState: 'supported',
    },
  });
  const evidence = await prisma.evidence.create({
    data: { projectId, name: `${projectId} evidence`, type: 'OTHER', stepRef: 4, ownerId, sourceRefId: source.id, targetClaimId: claim.id, truthStatus: 'supports' },
  });
  return { cycle, output, source, claim, evidence };
}

describeC3AE2E('R3-C3A DecisionRequest PostgreSQL E2E', () => {
  beforeAll(async () => {
    await clean();
    await seedUsersAndChallenge();
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('persists one pending request per portfolio presentation and reloads snapshots', async () => {
    const seeded = await seedProject(portfolioProjectId, { portfolioGoverned: true });
    const service = new AdaptiveCoreService(prisma);

    const created = await service.createDecisionRequest(portfolioProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c3a-request-create',
    });
    const retry = await service.createDecisionRequest(portfolioProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c3a-request-create',
    });
    const secondKey = await service.createDecisionRequest(portfolioProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c3a-request-second-key',
    });

    expect(retry.id).toBe(created.id);
    expect(secondKey.id).toBe(created.id);
    expect(await (prisma as any).decisionRequest.count({ where: { projectId: portfolioProjectId } })).toBe(1);
    expect(created).toMatchObject({
      status: 'pending',
      sourceCycleId: seeded.cycle.id,
      authorityType: 'portfolio_lead',
      authorityUserId: leadId,
      requestedById: ownerId,
    });
    expect((created.readinessSnapshotJson as any).assessments.map((item: any) => item.decisionType)).toEqual([
      'continue_experimenting',
      'implement',
      'scale',
      'pause',
      'close_with_learning',
    ]);
    expect(created.authoritySnapshotJson).toMatchObject({
      authorityStatus: 'resolved',
      authorityType: 'portfolio_lead',
      authorityUserId: leadId,
      decisionType: 'continue_experimenting',
    });
    expect(created.decisionPackageSnapshotJson).toMatchObject({ sourceOutputId: seeded.output.id });
    expect(created.presentationSnapshotJson).toMatchObject({ completionRouting: { route: 'portfolio_presented' } });

    const fresh = new PrismaClient();
    try {
      const reloaded = await new AdaptiveCoreService(fresh).getDecisionRequest(portfolioProjectId, ownerId, 'participante', created.id);
      expect(reloaded).toMatchObject({ id: created.id, status: 'pending', sourceCycleId: seeded.cycle.id });
      expect(await new AdaptiveCoreService(fresh).listDecisionRequests(portfolioProjectId, ownerId, 'participante')).toHaveLength(1);
    } finally {
      await fresh.$disconnect();
    }

    expect(await prisma.initiativeCycle.findUniqueOrThrow({ where: { id: seeded.cycle.id } })).toMatchObject({ status: 'completed' });
    expect(await prisma.adaptiveStepOutput.findUniqueOrThrow({ where: { id: seeded.output.id } })).toMatchObject({
      outputJson: expect.objectContaining({ recommendation: 'Solicitar revision de portafolio.' }),
    });
    expect(await prisma.truthClaim.findUniqueOrThrow({ where: { id: seeded.claim.id } })).toMatchObject({ verificationState: 'supported' });
    expect(await prisma.evidence.findUniqueOrThrow({ where: { id: seeded.evidence.id } })).toMatchObject({ truthStatus: 'supports' });
    await (prisma as any).decisionRequest.create({
      data: {
        projectId: portfolioProjectId,
        sourceCycleId: seeded.cycle.id,
        requestedById: ownerId,
        status: 'cancelled',
        authorityType: 'portfolio_lead',
        authorityUserId: leadId,
        readinessSnapshotJson: { historical: 1 },
        authoritySnapshotJson: { historical: 1 },
        decisionPackageSnapshotJson: { historical: 1 },
        idempotencyKey: 'r3c3a-historical-cancelled-1',
      },
    });
    await (prisma as any).decisionRequest.create({
      data: {
        projectId: portfolioProjectId,
        sourceCycleId: seeded.cycle.id,
        requestedById: ownerId,
        status: 'cancelled',
        authorityType: 'portfolio_lead',
        authorityUserId: leadId,
        readinessSnapshotJson: { historical: 2 },
        authoritySnapshotJson: { historical: 2 },
        decisionPackageSnapshotJson: { historical: 2 },
        idempotencyKey: 'r3c3a-historical-cancelled-2',
      },
    });
    expect(await (prisma as any).decisionRequest.count({ where: { projectId: portfolioProjectId, sourceCycleId: seeded.cycle.id, status: 'cancelled' } })).toBe(2);
    const events = await prisma.adaptiveAdaptationEvent.findMany({ where: { projectId: portfolioProjectId } });
    expect(events.some((event) => event.eventType === 'decision_request_created')).toBe(true);
    expect(events.some((event) => event.eventType === 'organizational_decision_created')).toBe(false);
  });

  it('rejects decision requests for self-initiated initiatives after cycle completion', async () => {
    await seedProject(selfProjectId, { selfInitiated: true });
    const service = new AdaptiveCoreService(prisma);

    await expect(service.createDecisionRequest(selfProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c3a-self-reject',
    })).rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_REQUIRED' });
    expect(await (prisma as any).decisionRequest.count({ where: { projectId: selfProjectId } })).toBe(0);
    await expect(service.getInitiativeHistory(selfProjectId, ownerId, 'participante')).resolves.toMatchObject({
      lifecycleProjection: 'active',
    });
  });

  it('rejects incomplete presentations and unresolved Portfolio Lead authority', async () => {
    await seedProject(incompleteProjectId, { portfolioGoverned: true, incomplete: true });
    await seedProject(unresolvedProjectId, { portfolioGoverned: true, unresolvedLead: true });
    const service = new AdaptiveCoreService(prisma);

    await expect(service.createDecisionRequest(incompleteProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c3a-incomplete-reject',
    })).rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_PRESENTED' });
    await expect(service.createDecisionRequest(unresolvedProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c3a-unresolved-reject',
    })).rejects.toMatchObject({ code: 'DECISION_AUTHORITY_UNRESOLVED' });
    expect(await (prisma as any).decisionRequest.count({ where: { projectId: { in: [incompleteProjectId, unresolvedProjectId] } } })).toBe(0);
  });
});
