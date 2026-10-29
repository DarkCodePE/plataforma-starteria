import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../adaptive-core.service';

const describeC2BE2E = process.env.R2_PERSISTENCE_E2E === '1' ? describe : describe.skip;

const prisma = new PrismaClient();

const ownerId = 'user-r3c2b-owner';
const leadId = 'user-r3c2b-lead';
const selfProjectId = 'project-r3c2b-self';
const portfolioProjectId = 'project-r3c2b-portfolio';
const challengeProjectId = 'project-r3c2b-challenge';
const strategicFrontId = 'front-r3c2b';
const challengeId = 'challenge-r3c2b';
const organizationId = 'org-r3c2b';

async function clean() {
  const projectIds = [selfProjectId, portfolioProjectId, challengeProjectId];
  const where = { projectId: { in: projectIds } };
  await (prisma as any).initiativeGovernance.deleteMany({ where: { projectId: { in: projectIds } } });
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
  await prisma.initiativePortfolioMeta.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.teamMember.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.challenge.deleteMany({ where: { id: challengeId } });
  await prisma.strategicFront.deleteMany({ where: { id: strategicFrontId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, leadId] } } });
}

async function seedUsers() {
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: 'r3c2b-owner@starteria.test', name: 'R3C2B Owner', role: 'participante', initials: 'RO', skills: [] },
      { id: leadId, email: 'r3c2b-lead@starteria.test', name: 'R3C2B Lead', role: 'mentor', initials: 'RL', skills: [] },
    ],
  });
}

async function seedProject(projectId: string, options: { challengeLinked?: boolean; portfolioGoverned?: boolean } = {}) {
  const project = await prisma.project.create({
    data: {
      id: projectId,
      name: `R3C2B ${projectId}`,
      description: 'Disposable R3-C2B E2E project.',
      ownerId,
      status: 'IN_PROGRESS',
      currentStep: 4,
      step0Status: 'COMPLETED',
      step0Data: { challengeType: 'growth', initialFocus: 'Foco', expectedImpact: 'Impacto' },
      teamMembers: {
        create: [
          { userId: ownerId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
          { userId: leadId, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
        ],
      },
    },
  });

  if (options.challengeLinked) {
    await prisma.initiativePortfolioMeta.create({
      data: {
        projectId,
        challengeId,
        strategicFrontId,
        currentStep: 'Step 4',
        status: 'en_step_4',
      },
    });
  }
  if (options.portfolioGoverned) {
    await (prisma as any).initiativeGovernance.create({
      data: {
        projectId,
        mode: 'portfolio_governed',
        portfolioLeadUserId: leadId,
      },
    });
  }
  return project;
}

async function seedChallenge() {
  await prisma.organization.create({ data: { id: organizationId, name: 'R3C2B Org', slug: 'r3c2b-org' } });
  await prisma.strategicFront.create({ data: { id: strategicFrontId, name: 'R3C2B Front', ownerId: leadId, organizationId } });
  await prisma.challenge.create({ data: { id: challengeId, strategicFrontId, title: 'R3C2B Challenge', ownerId: leadId } });
}

async function seedStep4Ready(projectId: string) {
  const cycle = await prisma.initiativeCycle.create({
    data: {
      projectId,
      cycleNumber: 1,
      triggerType: 'initial',
      startStep: 0,
      currentStep: 4,
      status: 'active',
    },
  });
  for (let stepNumber = 0; stepNumber <= 4; stepNumber += 1) {
    await prisma.cycleStepState.create({
      data: {
        cycleId: cycle.id,
        stepNumber,
        state: stepNumber < 4 ? 'confirmed' : 'active',
      },
    });
  }
  const config = await prisma.adaptiveStepConfiguration.create({
    data: {
      projectId,
      cycleId: cycle.id,
      stepNumber: 4,
      version: 1,
      status: 'active',
      routeType: 'explore_validate',
      depthLevel: 'standard',
      maturity: 'results_confirmed',
      configurationJson: { id: 'step-4-e2e', step: 4 },
      sourceContextJson: { step3Output: { hypothesis: 'Hipotesis probada' } },
    },
  });
  const output = await prisma.adaptiveStepOutput.create({
    data: {
      projectId,
      cycleId: cycle.id,
      sourceConfigurationId: config.id,
      stepNumber: 4,
      version: 1,
      status: 'draft',
      outputKey: 'DecisionMemoLearningReport',
      outputJson: {
        hypothesis: 'Hipotesis probada',
        recommendation: 'Completar recorrido metodologico.',
        decisionPackage: { artifacts: ['memo'] },
      },
    },
  });
  const source = await prisma.sourceRef.create({
    data: { projectId, sourceType: 'USER_INPUT', reference: `${projectId}-source` },
  });
  const claim = await prisma.truthClaim.create({
    data: {
      projectId,
      subjectType: 'initiative',
      subjectId: projectId,
      claimType: 'learning',
      statement: 'La iniciativa capturo aprendizaje trazable.',
      createdById: ownerId,
      createdByType: 'human',
      verificationState: 'supported',
    },
  });
  const evidence = await prisma.evidence.create({
    data: {
      projectId,
      name: `${projectId} evidence`,
      type: 'OTHER',
      stepRef: 4,
      ownerId,
      sourceRefId: source.id,
      targetClaimId: claim.id,
      truthStatus: 'supports',
    },
  });
  return { cycle, config, output, source, claim, evidence };
}

describeC2BE2E('R3-C2B completion routing E2E', () => {
  beforeAll(async () => {
    await clean();
    await seedUsers();
    await seedChallenge();
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('persists self-initiated completion as completed without portfolio review', async () => {
    await seedProject(selfProjectId);
    const seeded = await seedStep4Ready(selfProjectId);
    const service = new AdaptiveCoreService(prisma);

    await service.confirmStep4Output(selfProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c2b-self-step4-confirm',
      confirmed: true,
      brief: { recommendation: 'Cerrar aprendizaje propio.' },
    });

    const [project, cycle, output, events] = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: selfProjectId } }),
      prisma.initiativeCycle.findUniqueOrThrow({ where: { id: seeded.cycle.id } }),
      prisma.adaptiveStepOutput.findUniqueOrThrow({ where: { id: seeded.output.id } }),
      prisma.adaptiveAdaptationEvent.findMany({ where: { projectId: selfProjectId } }),
    ]);
    expect(project.status).toBe('IN_PROGRESS');
    expect(cycle.status).toBe('completed');
    expect(cycle.completedAt).toBeTruthy();
    expect(output.status).toBe('confirmed');
    expect(output.outputJson).toMatchObject({ lifecycleProjection: 'completed', completionRoute: 'owner_completed' });
    expect(events.some((event) => event.eventType === 'cycle_completed')).toBe(true);
    expect(events.some((event) => event.eventType === 'initiative_closed')).toBe(false);
    const selfHistory = await service.getInitiativeHistory(selfProjectId, ownerId, 'participante');
    expect(selfHistory.summary.status).toBe('IN_PROGRESS');
    expect(selfHistory.lifecycleProjection).toBe('completed');
    expect(selfHistory.cycles[0]).toMatchObject({ id: seeded.cycle.id, status: 'completed' });
    await expect(service.confirmStep4Output(selfProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c2b-self-step4-mutate-after-complete',
      confirmed: true,
      brief: { recommendation: 'Intento de reescritura' },
    })).rejects.toMatchObject({ code: 'HISTORICAL_CYCLE_READ_ONLY' });
    expect(await prisma.adaptiveStepOutput.findUniqueOrThrow({ where: { id: seeded.output.id } })).toMatchObject({
      outputJson: expect.objectContaining({ recommendation: 'Cerrar aprendizaje propio.' }),
    });
  });

  it('persists portfolio-governed completion as presented without closing the initiative', async () => {
    await seedProject(portfolioProjectId, { portfolioGoverned: true });
    const seeded = await seedStep4Ready(portfolioProjectId);
    const service = new AdaptiveCoreService(prisma);

    await service.confirmStep4Output(portfolioProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c2b-portfolio-step4-confirm',
      confirmed: true,
      brief: { recommendation: 'Presentar al portafolio.' },
    });

    const [project, cycle, output, signal] = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: portfolioProjectId } }),
      prisma.initiativeCycle.findUniqueOrThrow({ where: { id: seeded.cycle.id } }),
      prisma.adaptiveStepOutput.findUniqueOrThrow({ where: { id: seeded.output.id } }),
      prisma.adaptiveProgressSignal.findUniqueOrThrow({ where: { projectId: portfolioProjectId } }),
    ]);
    expect(project.status).toBe('IN_PROGRESS');
    expect(cycle.status).toBe('completed');
    expect(output.outputJson).toMatchObject({ lifecycleProjection: 'presented', completionRoute: 'portfolio_presented', portfolioReviewRequired: true });
    expect(signal.signalJson).toMatchObject({ completionRoute: 'portfolio_presented', portfolioReviewRequired: true });
    await prisma.adaptiveStepOutput.update({
      where: { id: seeded.output.id },
      data: {
        outputJson: {
          ...(output.outputJson as Record<string, unknown>),
          lifecycleProjection: 'completed',
          completionRoute: 'owner_completed',
          portfolioReviewRequired: false,
        },
      },
    });

    const fresh = new PrismaClient();
    try {
      const history = await new AdaptiveCoreService(fresh).getInitiativeHistory(portfolioProjectId, ownerId, 'participante');
      expect(history.lifecycleProjection).toBe('presented');
      expect(history.completionRouting).toMatchObject({ route: 'portfolio_presented', initiativeCompleted: false, portfolioReviewRequired: true });
      expect(history.cycles[0]).toMatchObject({ id: seeded.cycle.id, status: 'completed' });
      expect(history.cycles[0].confirmedOutputs[0].outputJson).toMatchObject({ lifecycleProjection: 'completed', completionRoute: 'owner_completed' });
      expect(history.evidence.map((item) => item.id)).toContain(seeded.evidence.id);
      expect(history.sourceRefs.map((item) => item.id)).toContain(seeded.source.id);
      expect(history.truthClaims.map((item) => item.id)).toContain(seeded.claim.id);
    } finally {
      await fresh.$disconnect();
    }
  });

  it('derives challenge-assigned alignment as portfolio-presented and creates no decision artifacts', async () => {
    await seedProject(challengeProjectId, { challengeLinked: true });
    await seedStep4Ready(challengeProjectId);
    const service = new AdaptiveCoreService(prisma);

    await service.confirmStep4Output(challengeProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c2b-challenge-step4-confirm',
      confirmed: true,
      brief: { recommendation: 'Presentar aprendizaje del reto.' },
    });

    const [routing, meta, events] = await Promise.all([
      service.getInitiativeCompletionRouting(challengeProjectId, ownerId, 'participante'),
      prisma.initiativePortfolioMeta.findUniqueOrThrow({ where: { projectId_challengeId: { projectId: challengeProjectId, challengeId } } }),
      prisma.adaptiveAdaptationEvent.findMany({ where: { projectId: challengeProjectId } }),
    ]);
    expect(routing).toMatchObject({
      alignmentType: 'challenge_assigned',
      route: 'portfolio_presented',
      portfolioReviewRequired: true,
      initiativeCompleted: false,
    });
    expect(meta.status).toBe('lista_para_decision');
    expect(events.some((event) => event.eventType === 'initiative_presented')).toBe(true);
    expect(events.some((event) => event.eventType === 'decision_request_created')).toBe(false);
    expect(events.some((event) => event.eventType === 'organizational_decision_created')).toBe(false);
  });
});
