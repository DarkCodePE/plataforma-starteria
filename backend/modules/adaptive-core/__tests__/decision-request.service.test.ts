import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { createCycleStore, makeCyclePrisma, seedCycleProject } from './cycle-test-utils';

function seedCompletedCycle(store: ReturnType<typeof createCycleStore>, projectId: string, overrides: Record<string, unknown> = {}) {
  const cycle = {
    id: String(overrides.id ?? 'cycle-rq-1'),
    projectId,
    cycleNumber: Number(overrides.cycleNumber ?? 1),
    parentCycleId: null,
    basedOnCycleId: null,
    triggerType: 'initial',
    triggerRefId: null,
    startStep: 0,
    currentStep: 4,
    status: String(overrides.status ?? 'completed'),
    completedAt: overrides.completedAt ?? new Date('2026-08-20T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  store.initiativeCycle.push(cycle);
  return cycle;
}

function seedStep4Output(store: ReturnType<typeof createCycleStore>, projectId: string, cycleId: string, outputJson: Record<string, unknown> = {}) {
  const output = {
    id: `output-${projectId}`,
    projectId,
    cycleId,
    sourceConfigurationId: 'config-step4',
    stepNumber: 4,
    version: 1,
    status: 'confirmed',
    outputKey: 'DecisionMemoLearningReport',
    outputJson: {
      recommendation: 'Solicitar revision de portafolio.',
      decisionPackage: { artifacts: ['memo'] },
      lifecycleProjection: 'presented',
      completionRoute: 'portfolio_presented',
      portfolioReviewRequired: true,
      ...outputJson,
    },
    confirmedById: 'u1',
    confirmedAt: new Date('2026-08-20T10:05:00.000Z'),
    requiresReview: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.adaptiveStepOutput.push(output);
  return output;
}

function seedPortfolioPresented(store: ReturnType<typeof createCycleStore>, options: { projectId?: string; ownerId?: string; leadId?: string; authorityAssigned?: boolean; active?: boolean } = {}) {
  const projectId = options.projectId ?? 'project-rq-portfolio';
  const ownerId = options.ownerId ?? 'u1';
  const leadId = options.leadId ?? 'lead-1';
  const project = seedCycleProject(store, {
    id: projectId,
    ownerId,
    currentStep: 4,
    status: 'IN_PROGRESS',
    portfolioMeta: [{ id: `meta-${projectId}`, projectId, challengeId: `challenge-${projectId}`, currentStep: 'Step 4', status: 'lista_para_decision' }],
  });
  store.teamMember.push({ userId: leadId, projectId, status: 'ACTIVE' });
  store.initiativeGovernance.push({
    id: `gov-${projectId}`,
    projectId,
    mode: 'portfolio_governed',
    portfolioLeadUserId: options.authorityAssigned === false ? null : leadId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const cycle = seedCompletedCycle(store, projectId, options.active ? { status: 'active', completedAt: null } : {});
  const output = seedStep4Output(store, projectId, cycle.id);
  store.truthClaim.push({ id: `claim-${projectId}`, projectId, verificationState: 'supported' });
  store.evidence.push({ id: `evidence-${projectId}`, projectId, truthStatus: 'supports', targetClaimId: `claim-${projectId}` });
  return { project, cycle, output, leadId };
}

function clone(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

describe('DecisionRequest service', () => {
  it('creates a pending DecisionRequest for portfolio_presented when owner can submit', async () => {
    const store = createCycleStore();
    const { project, cycle, leadId } = seedPortfolioPresented(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const request = await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-create-owner-submit',
    });

    expect(request).toMatchObject({
      projectId: project.id,
      sourceCycleId: cycle.id,
      requestedById: 'u1',
      status: 'pending',
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
    expect(request.authoritySnapshotJson).toMatchObject({
      authorityStatus: 'resolved',
      authorityType: 'portfolio_lead',
      decisionType: 'continue_experimenting',
      currentUserCanSubmit: true,
    });
    expect(request.decisionPackageSnapshotJson).toMatchObject({ sourceOutputId: `output-${project.id}`, outputKey: 'DecisionMemoLearningReport' });
    expect(request.presentationSnapshotJson).toMatchObject({ completionRouting: { route: 'portfolio_presented' } });
  });

  it('rejects decision requests for self-initiated initiatives after cycle completion', async () => {
    const store = createCycleStore();
    const project = seedCycleProject(store, { id: 'project-rq-self', currentStep: 4, status: 'IN_PROGRESS' });
    const cycle = seedCompletedCycle(store, project.id);
    seedStep4Output(store, project.id, cycle.id, { lifecycleProjection: 'active', completionRoute: 'owner_completed', portfolioReviewRequired: false });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    await expect(service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-self-reject',
    })).rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_REQUIRED' });
    expect(store.decisionRequest).toHaveLength(0);
  });

  it('rejects portfolio initiatives that are not methodologically complete or not presented', async () => {
    const store = createCycleStore();
    const { project } = seedPortfolioPresented(store, { projectId: 'project-rq-incomplete', active: true });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    await expect(service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-incomplete-reject',
    })).rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_PRESENTED' });
  });

  it('rejects unresolved Portfolio Lead authority', async () => {
    const store = createCycleStore();
    const { project } = seedPortfolioPresented(store, { projectId: 'project-rq-no-lead', authorityAssigned: false });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    await expect(service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-no-lead',
    })).rejects.toMatchObject({ code: 'DECISION_AUTHORITY_UNRESOLVED' });
  });

  it('rejects frontend-only requested outcome, authority, and status fields through strict schema boundary', async () => {
    const { decisionRequestCreateSchema } = await import('../adaptive-core.schemas');

    expect(() => decisionRequestCreateSchema.parse({
      idempotencyKey: 'rq-front-outcome',
      requestedDecisionType: 'implement',
    })).toThrow();
    expect(() => decisionRequestCreateSchema.parse({
      idempotencyKey: 'rq-front-status',
      status: 'resolved',
    })).toThrow();
    expect(() => decisionRequestCreateSchema.parse({
      idempotencyKey: 'rq-front-authority',
      authorityUserId: 'attacker',
    })).toThrow();
  });

  it('does not let raw team input restrict the readiness snapshot to one outcome', async () => {
    const store = createCycleStore();
    const { project } = seedPortfolioPresented(store, { projectId: 'project-rq-no-outcome' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const request = await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-raw-outcome-ignored',
      requestedDecisionType: 'scale',
    } as any);

    expect((request.readinessSnapshotJson as any).assessments.map((item: any) => item.decisionType)).toEqual([
      'continue_experimenting',
      'implement',
      'scale',
      'pause',
      'close_with_learning',
    ]);
    expect(request).not.toHaveProperty('requestedDecisionType');
  });

  it('is idempotent and prevents duplicate pending requests for the same presentation', async () => {
    const store = createCycleStore();
    const { project, cycle } = seedPortfolioPresented(store, { projectId: 'project-rq-idem' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const first = await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-idem-same',
    });
    const retry = await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-idem-same',
    });
    const secondKey = await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-idem-second',
    });

    expect(retry.id).toBe(first.id);
    expect(secondKey.id).toBe(first.id);
    expect(store.decisionRequest).toHaveLength(1);
    expect(store.decisionRequest[0]).toMatchObject({ sourceCycleId: cycle.id, status: 'pending' });
  });

  it('does not mutate Step4 output, Cycle, Truth, or Evidence when creating a request', async () => {
    const store = createCycleStore();
    const { project, cycle, output } = seedPortfolioPresented(store, { projectId: 'project-rq-no-mutate' });
    const before = {
      output: clone(output),
      cycle: clone(cycle),
      truth: clone(store.truthClaim),
      evidence: clone(store.evidence),
    };
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-no-mutation',
    });

    expect(clone(output)).toEqual(before.output);
    expect(clone(cycle)).toEqual(before.cycle);
    expect(clone(store.truthClaim)).toEqual(before.truth);
    expect(clone(store.evidence)).toEqual(before.evidence);
  });

  it('persists and reads requests through list and get entrypoints', async () => {
    const store = createCycleStore();
    const { project } = seedPortfolioPresented(store, { projectId: 'project-rq-read' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);

    const created = await service.createDecisionRequest(project.id, 'u1', 'participante', {
      idempotencyKey: 'rq-read',
    });

    await expect(service.listDecisionRequests(project.id, 'u1', 'participante')).resolves.toHaveLength(1);
    await expect(service.getDecisionRequest(project.id, 'u1', 'participante', created.id)).resolves.toMatchObject({
      id: created.id,
      status: 'pending',
    });
  });
});
