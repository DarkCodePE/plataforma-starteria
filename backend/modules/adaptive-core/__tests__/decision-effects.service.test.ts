import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { createCycleStore, makeCyclePrisma, seedCycleProject } from './cycle-test-utils';
import type { DecisionOutcome } from '../adaptive-core.types';

function seedPresentedDecision(store: ReturnType<typeof createCycleStore>, outcome: DecisionOutcome, projectId = `project-effects-${outcome}`) {
  const ownerId = 'owner-effects';
  const leadId = 'lead-effects';
  const project = seedCycleProject(store, {
    id: projectId,
    ownerId,
    currentStep: 4,
    status: 'IN_PROGRESS',
    step0Data: { initialFocus: 'Foco', expectedImpact: 'Impacto', mainRisk: 'Riesgo conocido' },
    portfolioMeta: [{ id: `meta-${projectId}`, projectId, challengeId: `challenge-${projectId}`, currentStep: 'Step 4', status: 'lista_para_decision' }],
  });
  project.teamMembers = [
    ...(project.teamMembers ?? []),
    { userId: ownerId, projectId, status: 'ACTIVE' },
    { userId: leadId, projectId, status: 'ACTIVE' },
  ];
  store.teamMember.push({ userId: ownerId, projectId, status: 'ACTIVE' });
  store.teamMember.push({ userId: leadId, projectId, status: 'ACTIVE' });
  store.user.push(
    { id: ownerId, organizationId: project.organizationId },
    { id: leadId, organizationId: project.organizationId },
  );
  const cycle = {
    id: `cycle-${projectId}`,
    projectId,
    cycleNumber: 1,
    parentCycleId: null,
    basedOnCycleId: null,
    triggerType: 'initial',
    triggerRefId: null,
    startStep: 0,
    currentStep: 4,
    status: 'completed',
    completedAt: new Date('2026-08-20T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.initiativeCycle.push(cycle);
  for (let stepNumber = 0; stepNumber <= 4; stepNumber += 1) {
    store.cycleStepState.push({ id: `state-${projectId}-${stepNumber}`, cycleId: cycle.id, stepNumber, state: 'confirmed' });
    store.adaptiveStepOutput.push({
      id: `output-${projectId}-${stepNumber}`,
      projectId,
      cycleId: cycle.id,
      stepNumber,
      version: 1,
      status: 'confirmed',
      outputKey: `Step${stepNumber}Output`,
      outputJson: { stepNumber, selectedBet: stepNumber === 2 ? 'A' : undefined },
      confirmedAt: new Date('2026-08-20T10:05:00.000Z'),
      confirmedById: ownerId,
    });
  }
  store.adaptiveStepConfiguration.push({
    id: `config-${projectId}-3`,
    projectId,
    cycleId: cycle.id,
    stepNumber: 3,
    version: 1,
    status: 'active',
    routeType: 'explore_validate',
    depthLevel: 'standard',
    configJson: { step: 3 },
    sourceContextJson: { step2Output: { selectedBet: 'A' }, risks: ['Riesgo conocido'] },
  });
  store.truthClaim.push({ id: `claim-${projectId}`, projectId, verificationState: 'supported' });
  store.evidence.push({ id: `evidence-${projectId}`, projectId, truthStatus: 'supports', targetClaimId: `claim-${projectId}` });
  const request = {
    id: `request-${projectId}`,
    projectId,
    sourceCycleId: cycle.id,
    status: 'resolved',
    readinessSnapshotJson: { assessments: [] },
    authoritySnapshotJson: { authorityType: 'portfolio_lead' },
    decisionPackageSnapshotJson: { sourceOutputId: `output-${projectId}-4`, decisionPackage: { scope: 'Scope', metrics: ['M1'], evidenceReferences: [`evidence-${projectId}`], risks: ['R1'] } },
    recommendationSnapshotJson: { recommendation: 'Analisis Starteria' },
    presentationSnapshotJson: { completionRouting: { route: 'portfolio_presented' }, learning: { summary: 'Learning' }, evidenceReferences: [`evidence-${projectId}`] },
    idempotencyKey: `request-${projectId}`,
  };
  store.decisionRequest.push(request);
  const decision = {
    id: `decision-${projectId}`,
    projectId,
    sourceCycleId: cycle.id,
    decisionRequestId: request.id,
    outcome,
    decidedById: leadId,
    decidedAt: new Date('2026-08-20T11:00:00.000Z'),
    rationale: `Decision ${outcome}`,
    conditionsJson: outcome === 'implement' || outcome === 'scale' ? [{ code: 'EXECUTION_CONDITION', accepted: true }] : null,
    authoritySnapshotJson: { authorityType: 'portfolio_lead', authorityUserId: leadId },
    readinessSnapshotJson: outcome === 'continue_experimenting'
      ? { decisionType: outcome, overallStatus: 'ready', conditions: [{ code: 'EXECUTION_GAP', dimension: 'execution', message: 'Revisar ejecucion' }], unresolvedQuestions: [] }
      : { decisionType: outcome, overallStatus: 'ready', conditions: [], unresolvedQuestions: [] },
    recommendationSnapshotJson: request.recommendationSnapshotJson,
    packageSnapshotJson: request.decisionPackageSnapshotJson,
    presentationSnapshotJson: request.presentationSnapshotJson,
    idempotencyKey: `decision-${projectId}`,
    createdAt: new Date('2026-08-20T11:00:00.000Z'),
  };
  store.decision.push(decision);
  return { project, cycle, decision, leadId };
}

function historicalSnapshot(store: ReturnType<typeof createCycleStore>, projectId: string) {
  return JSON.stringify({
    outputs: store.adaptiveStepOutput.filter((row) => row.projectId === projectId),
    truth: store.truthClaim.filter((row) => row.projectId === projectId),
    evidence: store.evidence.filter((row) => row.projectId === projectId),
    decision: store.decision.filter((row) => row.projectId === projectId),
    request: store.decisionRequest.filter((row) => row.projectId === projectId),
  });
}

describe('DecisionEffects service', () => {
  it('maps continue_experimenting to a new decision-triggered cycle with selective inherited state and no output copy', async () => {
    const store = createCycleStore();
    const { project, cycle, decision, leadId } = seedPresentedDecision(store, 'continue_experimenting');
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const before = historicalSnapshot(store, project.id);

    const result = await service.applyDecisionEffects(project.id, leadId, 'mentor', decision.id, { idempotencyKey: 'effects-continue' });
    const retry = await service.applyDecisionEffects(project.id, leadId, 'mentor', decision.id, { idempotencyKey: 'effects-continue' });

    expect(retry.route.id).toBe(result.route.id);
    expect(result.route).toMatchObject({ routeType: 'new_cycle', decisionId: decision.id });
    const nextCycle = store.initiativeCycle.find((item) => item.id === result.resultingCycleId);
    expect(nextCycle).toMatchObject({
      cycleNumber: 2,
      parentCycleId: cycle.id,
      triggerType: 'decision',
      triggerRefId: decision.id,
      startStep: 3,
      currentStep: 3,
      status: 'active',
    });
    expect(cycle.status).toBe('completed');
    expect(store.cycleStepState.filter((state) => state.cycleId === nextCycle?.id).map((state) => [state.stepNumber, state.state])).toEqual([
      [0, 'inherited'],
      [1, 'inherited'],
      [2, 'inherited'],
      [3, 'active'],
      [4, 'pending'],
    ]);
    expect(store.adaptiveStepOutput.filter((output) => output.cycleId === nextCycle?.id)).toHaveLength(0);
    expect(store.project[0]).toMatchObject({ status: 'IN_PROGRESS', currentStep: 3 });
    expect(store.initiativePortfolioMeta[0]).toMatchObject({ status: 'en_step_3', currentStep: 'Step 3' });
    expect(historicalSnapshot(store, project.id)).toBe(before);
  });

  it('maps implement and scale to lightweight handoffs without creating methodological cycles', async () => {
    const store = createCycleStore();
    const implement = seedPresentedDecision(store, 'implement', 'project-effects-implement');
    const scale = seedPresentedDecision(store, 'scale', 'project-effects-scale');
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const implementResult = await service.applyDecisionEffects(implement.project.id, implement.leadId, 'mentor', implement.decision.id, {});
    const scaleResult = await service.applyDecisionEffects(scale.project.id, scale.leadId, 'mentor', scale.decision.id, {});

    expect(implementResult.route).toMatchObject({ routeType: 'implementation_handoff', resultingCycleId: null });
    expect(scaleResult.route).toMatchObject({ routeType: 'scaling_handoff', resultingCycleId: null });
    expect(store.implementationHandoff[0]).toMatchObject({ decisionId: implement.decision.id });
    expect(store.scalingHandoff[0]).toMatchObject({ decisionId: scale.decision.id });
    expect(store.initiativeCycle.filter((cycle) => cycle.projectId === implement.project.id)).toHaveLength(1);
    expect(store.initiativeCycle.filter((cycle) => cycle.projectId === scale.project.id)).toHaveLength(1);
    expect(store.project.find((item) => item.id === implement.project.id)).toMatchObject({ status: 'IMPLEMENTATION_APPROVED' });
    expect(store.project.find((item) => item.id === scale.project.id)).toMatchObject({ status: 'SCALING_APPROVED' });
  });

  it('maps pause and close to lifecycle routes preserving history and creating closure summary only for close', async () => {
    const store = createCycleStore();
    const pause = seedPresentedDecision(store, 'pause', 'project-effects-pause');
    const close = seedPresentedDecision(store, 'close_with_learning', 'project-effects-close');
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const pauseBefore = historicalSnapshot(store, pause.project.id);
    const closeBefore = historicalSnapshot(store, close.project.id);

    const pauseResult = await service.applyDecisionEffects(pause.project.id, pause.leadId, 'mentor', pause.decision.id, {});
    const closeResult = await service.applyDecisionEffects(close.project.id, close.leadId, 'mentor', close.decision.id, {});

    expect(pauseResult.route).toMatchObject({ routeType: 'paused', resultingCycleId: null });
    expect(closeResult.route).toMatchObject({ routeType: 'closed', resultingCycleId: null });
    expect(store.closureSummary[0]).toMatchObject({ decisionId: close.decision.id, closureReason: close.decision.rationale });
    expect(store.initiativeCycle.filter((cycle) => cycle.projectId === pause.project.id)).toHaveLength(1);
    expect(store.initiativeCycle.filter((cycle) => cycle.projectId === close.project.id)).toHaveLength(1);
    expect(store.project.find((item) => item.id === pause.project.id)).toMatchObject({ status: 'PAUSED' });
    expect(store.project.find((item) => item.id === close.project.id)).toMatchObject({ status: 'CLOSED' });
    expect(historicalSnapshot(store, pause.project.id)).toBe(pauseBefore);
    expect(historicalSnapshot(store, close.project.id)).toBe(closeBefore);
  });

  it('ignores frontend route fields and prevents a second route for one Decision', async () => {
    const store = createCycleStore();
    const { project, decision, leadId } = seedPresentedDecision(store, 'close_with_learning', 'project-effects-idempotent');
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const first = await service.applyDecisionEffects(project.id, leadId, 'mentor', decision.id, {
      idempotencyKey: 'effects-idempotent',
      routeType: 'new_cycle',
    } as any);
    const retryDifferentBody = await service.applyDecisionEffects(project.id, leadId, 'mentor', decision.id, {
      idempotencyKey: 'different-client-key',
      routeType: 'new_cycle',
    } as any);

    expect(first.route.routeType).toBe('closed');
    expect(retryDifferentBody.route.id).toBe(first.route.id);
    expect(store.continuationRoute).toHaveLength(1);
    expect(store.initiativeCycle.filter((cycle) => cycle.projectId === project.id)).toHaveLength(1);
    expect(store.decision).toHaveLength(1);
  });

  it('requires a resolved DecisionRequest and completed source cycle before applying effects', async () => {
    const store = createCycleStore();
    const { project, decision, leadId } = seedPresentedDecision(store, 'implement', 'project-effects-invalid-source');
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    store.decisionRequest[0].status = 'pending';
    await expect(service.applyDecisionEffects(project.id, leadId, 'mentor', decision.id, {}))
      .rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_RESOLVED' });

    store.decisionRequest[0].status = 'resolved';
    store.initiativeCycle[0].status = 'active';
    await expect(service.applyDecisionEffects(project.id, leadId, 'mentor', decision.id, {}))
      .rejects.toMatchObject({ code: 'DECISION_SOURCE_CYCLE_INVALID' });
  });
});
