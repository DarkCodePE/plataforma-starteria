import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { createCycleStore, makeCyclePrisma, seedCycleProject } from './cycle-test-utils';

describe('R3-A cycle state loading', () => {
  it('does not materialize a cycle or any adaptive rows while reading an uninitialized project', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const before = JSON.stringify(store);

    await expect(service.getState(project.id, 'u1', 'participante'))
      .rejects.toMatchObject({ code: 'NO_OPERATIONAL_CYCLE' });

    expect(JSON.stringify(store)).toBe(before);
    expect(store.initiativeCycle).toHaveLength(0);
    expect(store.cycleStepState).toHaveLength(0);
    expect(store.adaptiveStepConfiguration).toHaveLength(0);
    expect(store.adaptiveCheckpointInstance).toHaveLength(0);
    expect(store.adaptiveAdaptationEvent).toHaveLength(0);
  });

  it('loads state only from the active cycle', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const active = store.initiativeCycle[0];
    const historical = {
      id: 'historical-cycle',
      projectId: project.id,
      cycleNumber: 0,
      status: 'completed',
      startStep: 0,
      currentStep: 4,
      triggerType: 'initial',
    };
    store.initiativeCycle.push(historical);
    store.adaptiveStepOutput.push({
      id: 'historical-output',
      projectId: project.id,
      cycleId: historical.id,
      stepNumber: 1,
      version: 1,
      status: 'confirmed',
      outputKey: 'HistoricalOutput',
      outputJson: { historical: true },
    });

    const state = await service.getState(project.id, 'u1', 'participante');

    expect(state.cycle?.id).toBe(active.id);
    expect(state.stepOutputs.some((output) => output.id === 'historical-output')).toBe(false);
  });

  it('rejects confirmation of a checkpoint that belongs only to a historical cycle', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const historical = {
      id: 'historical-cycle',
      projectId: project.id,
      cycleNumber: 0,
      status: 'completed',
      startStep: 0,
      currentStep: 1,
      triggerType: 'initial',
    };
    store.initiativeCycle.push(historical);
    store.adaptiveCheckpointInstance.push({
      id: 'historical-cp',
      projectId: project.id,
      cycleId: historical.id,
      stepConfigurationId: store.adaptiveStepConfiguration[0].id,
      stepNumber: 1,
      checkpointKey: 'CP-1.1',
      sequence: 1,
      status: 'ready',
      materializedQuestionsJson: [],
    });

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'historical-cp-confirm',
      checkpointKey: 'CP-1.1',
      responses: { mainHypothesis: 'H1' },
    })).rejects.toMatchObject({ code: 'CHECKPOINT_NOT_ACTIVE' });
    expect(store.adaptiveCheckpointInstance.find((item) => item.id === 'historical-cp')?.status).toBe('ready');
  });

  it('projects missing structural route fields from their persisted columns', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const config = store.adaptiveStepConfiguration[0];
    config.routeType = 'reconstruct_existing';
    config.depthLevel = 'extended';
    config.maturity = 'legacy_reconstruction';
    config.configurationJson = { step: 0, visibleName: 'Reconstruir contexto' };

    const state = await service.getState(project.id, 'u1', 'participante');

    expect(state.stepConfigurations[0]).toMatchObject({
      routeType: 'reconstruct_existing',
      depthLevel: 'extended',
      maturity: 'legacy_reconstruction',
    });
  });

  it('keeps explicit JSON route fields ahead of persisted-column fallback', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const config = store.adaptiveStepConfiguration[0];
    config.routeType = 'explore_validate';
    config.depthLevel = 'standard';
    config.maturity = 'idea';
    config.configurationJson = {
      ...config.configurationJson,
      routeType: 'reconstruct_existing',
      depthLevel: 'extended',
      maturity: 'legacy_reconstruction',
    };

    const state = await service.getState(project.id, 'u1', 'participante');

    expect(state.stepConfigurations[0]).toMatchObject({
      routeType: 'reconstruct_existing',
      depthLevel: 'extended',
      maturity: 'legacy_reconstruction',
    });
  });
});
