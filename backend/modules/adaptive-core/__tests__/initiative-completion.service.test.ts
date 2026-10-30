import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { createCycleStore, makeCyclePrisma, seedCycleProject } from './cycle-test-utils';

function seedCycle(store: ReturnType<typeof createCycleStore>, projectId: string, overrides: Record<string, unknown> = {}) {
  const cycle = {
    id: String(overrides.id ?? 'cycle-1'),
    projectId,
    cycleNumber: Number(overrides.cycleNumber ?? 1),
    parentCycleId: null,
    basedOnCycleId: null,
    triggerType: 'initial',
    triggerRefId: null,
    startStep: 0,
    currentStep: Number(overrides.currentStep ?? 4),
    status: String(overrides.status ?? 'active'),
    completedAt: overrides.completedAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  store.initiativeCycle.push(cycle);
  return cycle;
}

function seedConfirmedStep4(store: ReturnType<typeof createCycleStore>, projectId: string, cycleId: string) {
  store.adaptiveStepOutput.push({
    id: 'output-step4-confirmed',
    projectId,
    cycleId,
    stepNumber: 4,
    version: 1,
    status: 'confirmed',
    outputKey: 'DecisionMemoLearningReport',
    outputJson: { recommendation: 'Cerrar con aprendizaje responsable.' },
    confirmedById: 'u1',
    confirmedAt: new Date('2026-08-19T10:00:00.000Z'),
    requiresReview: false,
  });
}

describe('Initiative completion service', () => {
  it('requires confirmed Step4 output and completed cycle for methodological completion', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store, { id: 'project-c2b-step4-open', currentStep: 4 });
    const cycle = seedCycle(store, project.id, { currentStep: 4, status: 'active' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const before = await service.getInitiativeCompletionRouting(project.id, 'u1', 'participante');
    expect(before).toMatchObject({
      cycleId: cycle.id,
      methodologicalCompletion: false,
      lifecycleProjection: 'active',
    });

    seedConfirmedStep4(store, project.id, cycle.id);
    const withOutputOnly = await service.getInitiativeCompletionRouting(project.id, 'u1', 'participante');
    expect(withOutputOnly).toMatchObject({
      methodologicalCompletion: false,
      lifecycleProjection: 'active',
    });

    cycle.status = 'completed';
    cycle.completedAt = new Date('2026-08-19T11:00:00.000Z');
    const after = await service.getInitiativeCompletionRouting(project.id, 'u1', 'participante');
    expect(after).toMatchObject({
      methodologicalCompletion: true,
      route: 'owner_completed',
      initiativeCompleted: false,
      portfolioReviewRequired: false,
      lifecycleProjection: 'active',
    });
  });

  it('does not use Step4 output lifecycle metadata as current lifecycle authority', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store, { id: 'project-c2b-output-snapshot', currentStep: 4 });
    const cycle = seedCycle(store, project.id, { currentStep: 4, status: 'completed', completedAt: new Date('2026-08-19T11:00:00.000Z') });
    seedConfirmedStep4(store, project.id, cycle.id);
    const output = store.adaptiveStepOutput.find((item) => item.id === 'output-step4-confirmed')!;
    output.outputJson = {
      recommendation: 'Snapshot historico preservado.',
      lifecycleProjection: 'presented',
      completionRoute: 'portfolio_presented',
      portfolioReviewRequired: true,
    };
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const routing = await service.getInitiativeCompletionRouting(project.id, 'u1', 'participante');
    const history = await service.getInitiativeHistory(project.id, 'u1', 'participante');

    expect(routing).toMatchObject({
      lifecycleProjection: 'active',
      route: 'owner_completed',
      portfolioReviewRequired: false,
    });
    expect(history.lifecycleProjection).toBe('active');
    expect(history.cycles[0].confirmedOutputs[0].outputJson).toMatchObject({
      lifecycleProjection: 'presented',
      completionRoute: 'portfolio_presented',
    });
  });

  it('keeps self-initiated completed project history readable', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store, { id: 'project-c2b-completed-history', status: 'COMPLETED', currentStep: 4 });
    const cycle = seedCycle(store, project.id, { id: 'cycle-completed-history', status: 'completed', currentStep: 4, completedAt: new Date() });
    seedConfirmedStep4(store, project.id, cycle.id);
    store.sourceRef.push({ id: 'source-completed', projectId: project.id, sourceType: 'USER_INPUT', reference: 'completed-doc' });
    store.evidence.push({ id: 'evidence-completed', projectId: project.id, name: 'Documento historico', truthStatus: 'supports', sourceRefId: 'source-completed', targetClaimId: null });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const history = await service.getInitiativeHistory(project.id, 'u1', 'participante');

    expect(history.summary.status).toBe('COMPLETED');
    expect(history.lifecycleProjection).toBe('active');
    expect(history.cycles[0]).toMatchObject({ id: cycle.id, status: 'completed' });
    expect(history.cycles[0].confirmedOutputs).toHaveLength(1);
    expect(history.evidence).toHaveLength(1);
    expect(history.sourceRefs).toHaveLength(1);
  });

  it('uses challenge linkage as portfolio alignment and preserves readable history', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store, {
      id: 'project-c2b-history',
      currentStep: 4,
      portfolioMeta: [{ id: 'meta-c2b', projectId: 'project-c2b-history', challengeId: 'challenge-1', strategicFrontId: 'front-1', status: 'en_step_4' }],
    });
    const cycle1 = seedCycle(store, project.id, { id: 'cycle-1', cycleNumber: 1, status: 'superseded', currentStep: 2 });
    const cycle2 = seedCycle(store, project.id, { id: 'cycle-2', cycleNumber: 2, parentCycleId: cycle1.id, status: 'completed', currentStep: 4, completedAt: new Date() });
    store.cycleStepState.push(
      { id: 'state-1-0', cycleId: cycle1.id, stepNumber: 0, state: 'confirmed' },
      { id: 'state-2-0', cycleId: cycle2.id, stepNumber: 0, state: 'inherited', inheritedFromCycleId: cycle1.id, inheritedFromOutputId: 'output-step0' },
      { id: 'state-2-4', cycleId: cycle2.id, stepNumber: 4, state: 'confirmed' },
    );
    store.adaptiveStepOutput.push({
      id: 'output-step0',
      projectId: project.id,
      cycleId: cycle1.id,
      stepNumber: 0,
      version: 1,
      status: 'confirmed',
      outputKey: 'Step0AlignmentBrief',
      outputJson: { objective: 'Aprendizaje inicial' },
      confirmedAt: new Date(),
    });
    seedConfirmedStep4(store, project.id, cycle2.id);
    store.sourceRef.push({ id: 'source-1', projectId: project.id, sourceType: 'USER_INPUT', reference: 'doc-1' });
    store.evidence.push({ id: 'evidence-1', projectId: project.id, name: 'Documento', truthStatus: 'supports', sourceRefId: 'source-1', targetClaimId: 'claim-1' });
    store.truthClaim.push({ id: 'claim-1', projectId: project.id, statement: 'Existe aprendizaje', verificationState: 'supported' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const history = await service.getInitiativeHistory(project.id, 'u1', 'participante');

    expect(history.alignment).toMatchObject({ alignmentType: 'challenge_assigned', portfolioAligned: true });
    expect(history.completionRouting).toMatchObject({
      route: 'portfolio_presented',
      initiativeCompleted: false,
      portfolioReviewRequired: true,
    });
    expect(history.cycles.map((cycle) => cycle.id)).toEqual(['cycle-1', 'cycle-2']);
    expect(history.cycles[1].stepStates).toContainEqual(expect.objectContaining({
      stepNumber: 0,
      state: 'inherited',
      inheritedFromCycleId: cycle1.id,
      inheritedFromOutputId: 'output-step0',
    }));
    expect(history.cycles[0].confirmedOutputs[0].outputJson).toEqual({ objective: 'Aprendizaje inicial' });
    expect(history.evidence).toHaveLength(1);
    expect(history.sourceRefs).toHaveLength(1);
    expect(history.truthClaims).toHaveLength(1);
  });

  it('rejects new mutation on completed and superseded cycles while keeping active draft flow available', async () => {
    const completedStore = createCycleStore();
    const completedProject = seedCycleProject(completedStore, { id: 'project-c2b-completed', currentStep: 1 });
    const completedCycle = seedCycle(completedStore, completedProject.id, { id: 'cycle-completed', status: 'completed', currentStep: 1, completedAt: new Date() });
    completedStore.adaptiveStepConfiguration.push({ id: 'config-completed', projectId: completedProject.id, cycleId: completedCycle.id, stepNumber: 1, version: 1, status: 'active', sourceContextJson: {}, configurationJson: {} });
    completedStore.adaptiveStepOutput.push({ id: 'draft-completed', projectId: completedProject.id, cycleId: completedCycle.id, stepNumber: 1, version: 1, status: 'draft', outputKey: 'ProblemFocusBrief', outputJson: {} });
    await expect(new AdaptiveCoreService(makeCyclePrisma(completedStore) as any).confirmStep1Output(completedProject.id, 'u1', 'participante', {
      idempotencyKey: 'completed-mutation',
      confirmed: true,
      brief: { updatedFocus: 'No debe escribir' },
    })).rejects.toMatchObject({ code: 'HISTORICAL_CYCLE_READ_ONLY' });

    const supersededStore = createCycleStore();
    const supersededProject = seedCycleProject(supersededStore, { id: 'project-c2b-superseded', currentStep: 1 });
    const supersededCycle = seedCycle(supersededStore, supersededProject.id, { id: 'cycle-superseded', status: 'superseded', currentStep: 1 });
    supersededStore.adaptiveStepConfiguration.push({ id: 'config-superseded', projectId: supersededProject.id, cycleId: supersededCycle.id, stepNumber: 1, version: 1, status: 'active', sourceContextJson: {}, configurationJson: {} });
    supersededStore.adaptiveStepOutput.push({ id: 'draft-superseded', projectId: supersededProject.id, cycleId: supersededCycle.id, stepNumber: 1, version: 1, status: 'draft', outputKey: 'ProblemFocusBrief', outputJson: {} });
    await expect(new AdaptiveCoreService(makeCyclePrisma(supersededStore) as any).confirmStep1Output(supersededProject.id, 'u1', 'participante', {
      idempotencyKey: 'superseded-mutation',
      confirmed: true,
      brief: { updatedFocus: 'No debe escribir' },
    })).rejects.toMatchObject({ code: 'HISTORICAL_CYCLE_READ_ONLY' });

    const activeStore = createCycleStore();
    const activeProject = seedCycleProject(activeStore, { id: 'project-c2b-active', currentStep: 1 });
    const activeCycle = seedCycle(activeStore, activeProject.id, { id: 'cycle-active', status: 'active', currentStep: 1 });
    activeStore.adaptiveStepConfiguration.push({ id: 'config-active', projectId: activeProject.id, cycleId: activeCycle.id, stepNumber: 1, version: 1, status: 'active', routeType: 'explore_validate', depthLevel: 'standard', maturity: 'problem', sourceContextJson: {}, configurationJson: {} });
    activeStore.adaptiveStepOutput.push({ id: 'draft-active', projectId: activeProject.id, cycleId: activeCycle.id, stepNumber: 1, version: 1, status: 'draft', outputKey: 'ProblemFocusBrief', outputJson: { truthReadiness: { satisfiesValidatedSupport: true } } });
    await new AdaptiveCoreService(makeCyclePrisma(activeStore) as any).confirmStep1Output(activeProject.id, 'u1', 'participante', {
      idempotencyKey: 'active-mutation',
      confirmed: true,
      brief: { updatedFocus: 'Puede avanzar', sufficiency: 'sufficient' },
    });
    expect(activeStore.adaptiveStepOutput.find((output) => output.id === 'draft-active')?.status).toBe('confirmed');
  });
});
