import { PrismaClient, type DecisionOutcome } from '@prisma/client';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';

const describeR3CFinalE2E = process.env.R2_PERSISTENCE_E2E === '1' ? describe : describe.skip;

const prisma = new PrismaClient();

const ownerId = 'user-r3c-final-owner';
const leadId = 'user-r3c-final-lead';
const otherId = 'user-r3c-final-other';
const organizationId = 'org-r3c-final';
const strategicFrontId = 'front-r3c-final';
const challengeId = 'challenge-r3c-final';
const implementProjectId = 'project-r3c-final-implement';
const continueProjectId = 'project-r3c-final-continue';
const selfProjectId = 'project-r3c-final-self';
const projectIds = [implementProjectId, continueProjectId, selfProjectId];

async function clean() {
  const where = { projectId: { in: projectIds } };
  await (prisma as any).continuationRoute.deleteMany({ where });
  await (prisma as any).implementationHandoff.deleteMany({ where });
  await (prisma as any).scalingHandoff.deleteMany({ where });
  await (prisma as any).closureSummary.deleteMany({ where });
  await (prisma as any).decision.deleteMany({ where });
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
  await prisma.impactAssertion.deleteMany({ where });
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

async function seedUsersAndPortfolioContext() {
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: 'r3c-final-owner@starteria.test', name: 'R3C Final Owner', role: 'participante', initials: 'RO', skills: [] },
      { id: leadId, email: 'r3c-final-lead@starteria.test', name: 'R3C Final Lead', role: 'mentor', initials: 'RL', skills: [] },
      { id: otherId, email: 'r3c-final-other@starteria.test', name: 'R3C Final Other', role: 'mentor', initials: 'RX', skills: [] },
    ],
  });
  await prisma.organization.create({ data: { id: organizationId, name: 'R3C Final Org', slug: 'r3c-final-org' } });
  await prisma.user.updateMany({ where: { id: { in: [ownerId, leadId, otherId] } }, data: { organizationId } });
  await prisma.strategicFront.create({ data: { id: strategicFrontId, name: 'R3C Final Front', ownerId: leadId, organizationId } });
  await prisma.challenge.create({ data: { id: challengeId, strategicFrontId, title: 'R3C Final Challenge', ownerId: leadId } });
}

async function seedCompletedProject(projectId: string, options: { portfolioAligned: boolean }) {
  await prisma.project.create({
    data: {
      id: projectId,
      name: `R3C Final ${projectId}`,
      description: 'Disposable R3-C final journey project.',
      ownerId,
      organizationId,
      status: 'IN_PROGRESS',
      currentStep: 4,
      step0Status: 'COMPLETED',
      step0Data: {
        challengeType: 'growth',
        initialFocus: 'Reducir friccion operativa',
        expectedImpact: 'Mejorar adopcion',
        mainRisk: 'Dependencia operacional conocida',
        pendingQuestions: ['Que aprendizaje debe continuar si el portafolio decide otro ciclo?'],
      },
      teamMembers: {
        create: [
          { userId: ownerId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
          { userId: leadId, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
          { userId: otherId, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
        ],
      },
    },
  });

  if (options.portfolioAligned) {
    await prisma.initiativePortfolioMeta.create({
      data: {
        projectId,
        challengeId,
        strategicFrontId,
        currentStep: 'Step 4',
        status: 'lista_para_decision',
        readyForDecision: true,
      },
    });
    await (prisma as any).initiativeGovernance.create({
      data: { projectId, mode: 'portfolio_governed', portfolioLeadUserId: leadId },
    });
  }

  const cycle = await prisma.initiativeCycle.create({
    data: {
      projectId,
      cycleNumber: 1,
      triggerType: 'initial',
      startStep: 0,
      currentStep: 4,
      status: 'completed',
      completedAt: new Date('2026-08-20T10:00:00.000Z'),
    },
  });

  for (let stepNumber = 0; stepNumber <= 4; stepNumber += 1) {
    await prisma.cycleStepState.create({ data: { cycleId: cycle.id, stepNumber, state: 'confirmed' } });
    await prisma.adaptiveStepOutput.create({
      data: {
        projectId,
        cycleId: cycle.id,
        stepNumber,
        version: 1,
        status: 'confirmed',
        outputKey: `Step${stepNumber}Output`,
        outputJson: stepOutput(stepNumber, options.portfolioAligned),
        confirmedById: ownerId,
        confirmedAt: new Date('2026-08-20T10:05:00.000Z'),
      },
    });
  }

  await prisma.adaptiveStepConfiguration.create({
    data: {
      projectId,
      cycleId: cycle.id,
      stepNumber: 3,
      version: 1,
      status: 'active',
      routeType: 'explore_validate',
      depthLevel: 'standard',
      configurationJson: { step: 3, experimentPlan: 'Validar adopcion' },
      sourceContextJson: { selectedBet: 'Solucion A validada', risks: ['Dependencia operacional conocida'] },
    },
  });

  const source = await prisma.sourceRef.create({ data: { projectId, sourceType: 'USER_INPUT', reference: `${projectId}-source` } });
  const claim = await prisma.truthClaim.create({
    data: {
      projectId,
      subjectType: 'initiative',
      subjectId: projectId,
      claimType: 'learning',
      statement: 'La iniciativa tiene soporte validado para decision responsable.',
      createdById: ownerId,
      createdByType: 'human',
      verificationState: 'supported',
    },
  });
  const evidence = await prisma.evidence.create({
    data: { projectId, name: `${projectId} evidence`, type: 'OTHER', stepRef: 4, ownerId, sourceRefId: source.id, targetClaimId: claim.id, truthStatus: 'supports' },
  });
  const validation = await prisma.truthValidation.create({
    data: {
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      sourceRefId: source.id,
      result: 'supported',
      validatedById: ownerId,
      validatorType: 'human',
      rationale: 'Soporte validado para el paquete presentado.',
    },
  });
  await prisma.truthClaim.update({ where: { id: claim.id }, data: { currentValidationId: validation.id } });
  await prisma.impactAssertion.create({
    data: {
      projectId,
      subjectType: 'initiative',
      subjectId: projectId,
      claimId: claim.id,
      metric: 'adoption',
      valueJson: { baseline: 10, expected: 18 },
      status: 'estimated',
      sourceRefId: source.id,
      validationId: validation.id,
      createdById: ownerId,
    },
  });

  return { cycle, source, claim, evidence };
}

function stepOutput(stepNumber: number, portfolioAligned: boolean) {
  if (stepNumber === 2) return { selectedBet: 'Solucion A validada', learning: 'La apuesta resolvio el punto critico.' };
  if (stepNumber === 3) return { executionPlan: 'Plan operativo de piloto', risks: ['Dependencia operacional conocida'], unresolvedQuestions: ['Validar una variante adicional.'] };
  if (stepNumber === 4) {
    return {
      learning: 'Aprendizaje capturado para revision.',
      executionPlan: 'Plan operativo presentado.',
      risks: ['Dependencia operacional conocida'],
      unresolvedQuestions: ['Validar siguiente cohorte.'],
      recommendation: 'Starteria recomienda revision humana de portafolio.',
      decisionPackage: {
        scope: 'Solucion A validada',
        metrics: ['Adopcion', 'Tiempo de ciclo'],
        evidenceReferences: ['evidence-ref'],
        risks: ['Dependencia operacional conocida'],
      },
      lifecycleProjection: portfolioAligned ? 'presented' : 'active',
      completionRoute: portfolioAligned ? 'portfolio_presented' : 'owner_completed',
      portfolioReviewRequired: portfolioAligned,
    };
  }
  return { stepNumber, learning: `Contrato Step ${stepNumber}` };
}

async function sourceSnapshot(projectId: string, sourceCycleId: string) {
  const [cycle, outputs, states, claims, validations, evidence, sourceRefs] = await Promise.all([
    prisma.initiativeCycle.findUniqueOrThrow({ where: { id: sourceCycleId } }),
    prisma.adaptiveStepOutput.findMany({ where: { projectId, cycleId: sourceCycleId }, orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }] }),
    prisma.cycleStepState.findMany({ where: { cycleId: sourceCycleId }, orderBy: [{ stepNumber: 'asc' }] }),
    prisma.truthClaim.findMany({ where: { projectId }, orderBy: [{ id: 'asc' }] }),
    prisma.truthValidation.findMany({ where: { projectId }, orderBy: [{ id: 'asc' }] }),
    prisma.evidence.findMany({ where: { projectId }, orderBy: [{ id: 'asc' }] }),
    prisma.sourceRef.findMany({ where: { projectId }, orderBy: [{ id: 'asc' }] }),
  ]);
  return JSON.stringify({ cycle, outputs, states, claims, validations, evidence, sourceRefs });
}

async function decideAndApply(projectId: string, outcome: DecisionOutcome) {
  const service = new AdaptiveCoreService(prisma);
  const seeded = await seedCompletedProject(projectId, { portfolioAligned: true });
  const beforeRequest = await sourceSnapshot(projectId, seeded.cycle.id);

  const routing = await service.getInitiativeCompletionRouting(projectId, ownerId, 'participante');
  expect(routing).toMatchObject({
    route: 'portfolio_presented',
    methodologicalCompletion: true,
    initiativeCompleted: false,
    portfolioReviewRequired: true,
  });

  const request = await service.createDecisionRequest(projectId, ownerId, 'participante', {
    idempotencyKey: `r3c-final-request-${projectId}`,
  });
  expect(request).toMatchObject({
    status: 'pending',
    sourceCycleId: seeded.cycle.id,
    authorityType: 'portfolio_lead',
    authorityUserId: leadId,
  });
  expect((request.readinessSnapshotJson as any).assessments.map((item: any) => item.decisionType)).toEqual([
    'continue_experimenting',
    'implement',
    'scale',
    'pause',
    'close_with_learning',
  ]);

  await expect(service.decideDecisionRequest(projectId, otherId, 'mentor', request.id, {
    idempotencyKey: `r3c-final-decision-forbidden-${projectId}`,
    outcome,
    rationale: 'Intento sin autoridad asignada.',
  })).rejects.toMatchObject({ code: 'DECISION_AUTHORITY_REQUIRED' });

  const readiness = await service.getDecisionReadiness(projectId, leadId, 'mentor', outcome);
  expect(readiness.overallStatus).not.toBe('not_ready');
  const decision = await service.decideDecisionRequest(projectId, leadId, 'mentor', request.id, {
    idempotencyKey: `r3c-final-decision-${projectId}`,
    outcome,
    rationale: `Portfolio Lead decide ${outcome} con base en la presentacion.`,
    acceptedConditionCodes: readiness.conditions.map((condition) => condition.code),
  });
  expect(decision).toMatchObject({
    outcome,
    decisionRequestId: request.id,
    sourceCycleId: seeded.cycle.id,
    decidedById: leadId,
  });
  expect(await (prisma as any).decisionRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'resolved' });

  const requestAfterDecision = await (prisma as any).decisionRequest.findUniqueOrThrow({ where: { id: request.id } });
  const decisionBeforeEffects = await (prisma as any).decision.findUniqueOrThrow({ where: { id: decision.id } });
  const route = await service.applyDecisionEffects(projectId, leadId, 'mentor', decision.id, {
    idempotencyKey: `r3c-final-effects-${projectId}`,
  });
  const retry = await service.applyDecisionEffects(projectId, leadId, 'mentor', decision.id, {
    idempotencyKey: `r3c-final-effects-retry-${projectId}`,
  });

  expect(retry.route.id).toBe(route.route.id);
  expect(await sourceSnapshot(projectId, seeded.cycle.id)).toBe(beforeRequest);
  expect(await (prisma as any).decisionRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(requestAfterDecision);
  expect(await (prisma as any).decision.findUniqueOrThrow({ where: { id: decision.id } })).toEqual(decisionBeforeEffects);

  return { seeded, request, decision, route };
}

describeR3CFinalE2E('R3-C final portfolio decision journey PostgreSQL E2E', () => {
  beforeAll(async () => {
    await clean();
    await seedUsersAndPortfolioContext();
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('moves a portfolio-presented initiative through request, decision, and implementation handoff', async () => {
    const { seeded, decision, route } = await decideAndApply(implementProjectId, 'implement');

    expect(route.route).toMatchObject({ routeType: 'implementation_handoff', decisionId: decision.id, resultingCycleId: null });
    expect(await (prisma as any).continuationRoute.count({ where: { projectId: implementProjectId } })).toBe(1);
    expect(await (prisma as any).implementationHandoff.count({ where: { projectId: implementProjectId } })).toBe(1);
    expect(await prisma.initiativeCycle.count({ where: { projectId: implementProjectId } })).toBe(1);
    expect(await prisma.initiativeCycle.findUniqueOrThrow({ where: { id: seeded.cycle.id } })).toMatchObject({ status: 'completed' });
    expect(await prisma.project.findUniqueOrThrow({ where: { id: implementProjectId } })).toMatchObject({ status: 'IMPLEMENTATION_APPROVED', currentStep: 4 });
    expect(await prisma.initiativePortfolioMeta.findFirstOrThrow({ where: { projectId: implementProjectId } })).toMatchObject({ status: 'implementation_approved' });

    const fresh = new PrismaClient();
    try {
      const reloadedRoutes = await new AdaptiveCoreService(fresh).listContinuationRoutes(implementProjectId, leadId, 'mentor');
      expect(reloadedRoutes).toHaveLength(1);
      expect(reloadedRoutes[0]).toMatchObject({ routeType: 'implementation_handoff', decisionId: decision.id });
    } finally {
      await fresh.$disconnect();
    }
  });

  it('continues experimentation through a new decision-triggered cycle without copying historical outputs', async () => {
    const { seeded, decision, route } = await decideAndApply(continueProjectId, 'continue_experimenting');

    expect(route.route).toMatchObject({ routeType: 'new_cycle', decisionId: decision.id });
    const cycle2 = await prisma.initiativeCycle.findUniqueOrThrow({ where: { id: route.resultingCycleId! } });
    expect(cycle2).toMatchObject({
      cycleNumber: 2,
      parentCycleId: seeded.cycle.id,
      triggerType: 'decision',
      triggerRefId: decision.id,
      status: 'active',
    });
    expect(cycle2.startStep).toBeGreaterThan(0);
    expect(cycle2.currentStep).toBe(cycle2.startStep);
    expect(await prisma.initiativeCycle.findUniqueOrThrow({ where: { id: seeded.cycle.id } })).toMatchObject({ status: 'completed' });
    expect(await prisma.adaptiveStepOutput.count({ where: { cycleId: cycle2.id } })).toBe(0);
    const inheritedStates = await prisma.cycleStepState.findMany({
      where: { cycleId: cycle2.id, state: 'inherited' },
      orderBy: { stepNumber: 'asc' },
    });
    expect(inheritedStates.length).toBeGreaterThan(0);
    expect(inheritedStates.every((state) => state.inheritedFromCycleId === seeded.cycle.id && Boolean(state.inheritedFromOutputId))).toBe(true);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: continueProjectId } })).toMatchObject({ status: 'IN_PROGRESS', currentStep: cycle2.currentStep });
    expect(await prisma.initiativePortfolioMeta.findFirstOrThrow({ where: { projectId: continueProjectId } })).toMatchObject({
      status: `en_step_${cycle2.currentStep}`,
      currentStep: `Step ${cycle2.currentStep}`,
    });
  });

  it('keeps self-initiated completion outside portfolio request, decision, and route flow', async () => {
    const service = new AdaptiveCoreService(prisma);
    const seeded = await seedCompletedProject(selfProjectId, { portfolioAligned: false });
    const before = await sourceSnapshot(selfProjectId, seeded.cycle.id);

    const routing = await service.getInitiativeCompletionRouting(selfProjectId, ownerId, 'participante');
    expect(routing).toMatchObject({
      route: 'owner_completed',
      methodologicalCompletion: true,
      initiativeCompleted: false,
      portfolioReviewRequired: false,
    });

    await expect(service.createDecisionRequest(selfProjectId, ownerId, 'participante', {
      idempotencyKey: 'r3c-final-self-request',
    })).rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_REQUIRED' });

    expect(await (prisma as any).decisionRequest.count({ where: { projectId: selfProjectId } })).toBe(0);
    expect(await (prisma as any).decision.count({ where: { projectId: selfProjectId } })).toBe(0);
    expect(await (prisma as any).continuationRoute.count({ where: { projectId: selfProjectId } })).toBe(0);
    expect(await prisma.project.findUniqueOrThrow({ where: { id: selfProjectId } })).toMatchObject({ status: 'IN_PROGRESS' });

    const history = await service.getInitiativeHistory(selfProjectId, ownerId, 'participante');
    expect(history.summary.status).toBe('IN_PROGRESS');
    expect(history.lifecycleProjection).toBe('active');
    expect(history.cycles).toHaveLength(1);
    expect(history.cycles[0].status).toBe('completed');
    expect(history.cycles[0].confirmedOutputs.some((output) => output.stepNumber === 4)).toBe(true);
    expect(history.evidence).toHaveLength(1);
    expect(history.sourceRefs).toHaveLength(1);
    expect(history.truthClaims).toHaveLength(1);
    await expect(service.confirmStep4Output(selfProjectId, ownerId, 'participante', {
      confirmed: true,
      idempotencyKey: 'r3c-final-self-rewrite',
      brief: { rewritten: true },
    })).rejects.toMatchObject({ code: 'HISTORICAL_CYCLE_READ_ONLY' });
    expect(await sourceSnapshot(selfProjectId, seeded.cycle.id)).toBe(before);
  });
});
