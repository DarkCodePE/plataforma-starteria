import { describe, expect, it } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { createCycleStore, makeCyclePrisma, seedCycleProject } from './cycle-test-utils';

function seedPresented(store: ReturnType<typeof createCycleStore>, overrides: Record<string, any> = {}) {
  const projectId = overrides.projectId ?? 'project-od';
  const ownerId = overrides.ownerId ?? 'owner-1';
  const leadId = overrides.leadId ?? 'lead-1';
  const project = seedCycleProject(store, {
    id: projectId,
    ownerId,
    currentStep: 4,
    status: 'IN_PROGRESS',
    step0Data: { mainRisk: 'Riesgo conocido', initialFocus: 'Foco', expectedImpact: 'Impacto' },
    portfolioMeta: [{ id: `meta-${projectId}`, projectId, challengeId: `challenge-${projectId}`, currentStep: 'Step 4', status: 'lista_para_decision' }],
  });
  project.teamMembers = [
    ...(project.teamMembers ?? []),
    { userId: ownerId, projectId, status: 'ACTIVE' },
    { userId: leadId, projectId, status: 'ACTIVE' },
    ...(overrides.otherId ? [{ userId: overrides.otherId, projectId, status: 'ACTIVE' }] : []),
  ];
  store.teamMember.push({ userId: ownerId, projectId, status: 'ACTIVE' });
  store.teamMember.push({ userId: leadId, projectId, status: 'ACTIVE' });
  if (overrides.otherId) store.teamMember.push({ userId: overrides.otherId, projectId, status: 'ACTIVE' });
  store.user.push(
    { id: ownerId, organizationId: project.organizationId },
    { id: leadId, organizationId: project.organizationId },
    ...(overrides.otherId ? [{ id: overrides.otherId, organizationId: project.organizationId }] : []),
  );
  store.initiativeGovernance.push({
    id: `gov-${projectId}`,
    projectId,
    mode: 'portfolio_governed',
    portfolioLeadUserId: leadId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
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
  const output = {
    id: `output-${projectId}`,
    projectId,
    cycleId: cycle.id,
    stepNumber: 4,
    version: 1,
    status: 'confirmed',
    outputKey: 'DecisionMemoLearningReport',
    outputJson: {
      learning: 'Aprendizaje capturado',
      executionPlan: 'Plan operativo',
      risks: ['Riesgo conocido'],
      recommendation: 'Starteria recomienda revisar implementacion.',
      lifecycleProjection: 'presented',
      completionRoute: 'portfolio_presented',
      portfolioReviewRequired: true,
    },
    confirmedById: ownerId,
    confirmedAt: new Date('2026-08-20T10:05:00.000Z'),
    requiresReview: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.adaptiveStepOutput.push(output);
  store.truthClaim.push({ id: `claim-${projectId}`, projectId, verificationState: 'supported' });
  store.evidence.push({ id: `evidence-${projectId}`, projectId, truthStatus: 'supports', targetClaimId: `claim-${projectId}` });
  store.impactAssertion.push({ id: `impact-${projectId}`, projectId, status: 'estimated' });
  return { project, cycle, output, leadId, ownerId };
}

async function createRequest(service: AdaptiveCoreService, projectId: string, ownerId = 'owner-1') {
  return service.createDecisionRequest(projectId, ownerId, 'participante', { idempotencyKey: `request-${projectId}` });
}

function snapshot(store: ReturnType<typeof createCycleStore>) {
  return JSON.stringify({
    outputs: store.adaptiveStepOutput,
    cycles: store.initiativeCycle,
    truth: store.truthClaim,
    evidence: store.evidence,
  });
}

describe('Organizational Decision service', () => {
  it('creates an immutable historical Decision from a pending request for an authorized Portfolio Lead', async () => {
    const store = createCycleStore();
    const { project, cycle, leadId } = seedPresented(store);
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const request = await createRequest(service, project.id);

    const decision = await service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-ready-close',
      outcome: 'close_with_learning',
      rationale: 'El aprendizaje esta documentado y no requiere continuar ahora.',
    });

    expect(decision).toMatchObject({
      projectId: project.id,
      sourceCycleId: cycle.id,
      decisionRequestId: request.id,
      outcome: 'close_with_learning',
      decidedById: leadId,
      rationale: expect.any(String),
    });
    expect(decision.authoritySnapshotJson).toMatchObject({ authorityPurpose: 'portfolio_review', authorityType: 'portfolio_lead', currentUserCanDecide: true });
    expect(decision.readinessSnapshotJson).toMatchObject({ decisionType: 'close_with_learning', overallStatus: 'ready' });
    expect(decision.packageSnapshotJson).toMatchObject({ sourceOutputId: `output-${project.id}` });
    expect(decision.presentationSnapshotJson).toMatchObject({ completionRouting: { route: 'portfolio_presented' } });
    expect(store.decisionRequest[0].status).toBe('resolved');
  });

  it('rejects owner and unassigned global Portfolio Lead-like users', async () => {
    const store = createCycleStore();
    const { project, ownerId } = seedPresented(store, { projectId: 'project-od-auth', otherId: 'other-lead' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const request = await createRequest(service, project.id, ownerId);

    await expect(service.decideDecisionRequest(project.id, ownerId, 'participante', request.id, {
      idempotencyKey: 'decision-owner-reject',
      outcome: 'close_with_learning',
      rationale: 'Intento owner.',
    })).rejects.toMatchObject({ code: 'DECISION_AUTHORITY_REQUIRED' });
    await expect(service.decideDecisionRequest(project.id, 'other-lead', 'portfolio_lead', request.id, {
      idempotencyKey: 'decision-global-reject',
      outcome: 'close_with_learning',
      rationale: 'Intento no asignado.',
    })).rejects.toMatchObject({ code: 'DECISION_AUTHORITY_REQUIRED' });
  });

  it('rechecks current authority instead of trusting the request-time snapshot', async () => {
    const store = createCycleStore();
    const { project, leadId } = seedPresented(store, { projectId: 'project-od-authority-change', otherId: 'new-lead' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const request = await createRequest(service, project.id);
    store.initiativeGovernance[0].portfolioLeadUserId = 'new-lead';

    await expect(service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-old-lead',
      outcome: 'close_with_learning',
      rationale: 'Autoridad anterior.',
    })).rejects.toMatchObject({ code: 'DECISION_AUTHORITY_REQUIRED' });
    await expect(service.decideDecisionRequest(project.id, 'new-lead', 'mentor', request.id, {
      idempotencyKey: 'decision-new-lead',
      outcome: 'close_with_learning',
      rationale: 'Autoridad vigente.',
    })).resolves.toMatchObject({ decidedById: 'new-lead' });
  });

  it('rejects resolved, cancelled, superseded, and stale requests', async () => {
    for (const status of ['resolved', 'cancelled', 'superseded'] as const) {
      const store = createCycleStore();
      const { project, leadId } = seedPresented(store, { projectId: `project-od-${status}` });
      const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
      const request = await createRequest(service, project.id);
      store.decisionRequest[0].status = status;

      await expect(service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
        idempotencyKey: `decision-${status}`,
        outcome: 'close_with_learning',
        rationale: 'No debe decidir.',
      })).rejects.toMatchObject({ code: 'DECISION_REQUEST_NOT_PENDING' });
    }

    const store = createCycleStore();
    const { project, leadId } = seedPresented(store, { projectId: 'project-od-stale' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const request = await createRequest(service, project.id);
    store.initiativeCycle.push({ ...store.initiativeCycle[0], id: 'cycle-newer', cycleNumber: 2, status: 'active', completedAt: null });

    await expect(service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-stale',
      outcome: 'close_with_learning',
      rationale: 'Solicitud vieja.',
    })).rejects.toMatchObject({ code: 'DECISION_REQUEST_STALE' });
  });

  it('enforces readiness: not_ready rejected and conditionally_ready requires accepted conditions', async () => {
    const store = createCycleStore();
    const { project, leadId } = seedPresented(store, { projectId: 'project-od-readiness' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const request = await createRequest(service, project.id);

    await expect(service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-scale-not-ready',
      outcome: 'scale',
      rationale: 'Escalar ahora.',
    })).rejects.toMatchObject({ code: 'DECISION_READINESS_NOT_READY' });
    await expect(service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-implement-no-conditions',
      outcome: 'implement',
      rationale: 'Implementar con condicion.',
    })).rejects.toMatchObject({ code: 'DECISION_CONDITIONS_REQUIRED' });
    await expect(service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-implement-conditions',
      outcome: 'implement',
      rationale: 'Acepto avanzar con condiciones operativas explicitas.',
      acceptedConditionCodes: ['EXECUTION_CONDITION'],
    })).resolves.toMatchObject({
      outcome: 'implement',
      conditionsJson: [expect.objectContaining({ code: 'EXECUTION_CONDITION', accepted: true })],
    });
  });

  it('is idempotent and preserves request snapshots, Step4, Cycle, Truth and Evidence', async () => {
    const store = createCycleStore();
    const { project, leadId } = seedPresented(store, { projectId: 'project-od-idem' });
    const service = new AdaptiveCoreService(makeCyclePrisma(store) as any);
    const request = await createRequest(service, project.id);
    const requestSnapshot = {
      readinessSnapshotJson: JSON.stringify(store.decisionRequest[0].readinessSnapshotJson),
      authoritySnapshotJson: JSON.stringify(store.decisionRequest[0].authoritySnapshotJson),
      decisionPackageSnapshotJson: JSON.stringify(store.decisionRequest[0].decisionPackageSnapshotJson),
      recommendationSnapshotJson: JSON.stringify(store.decisionRequest[0].recommendationSnapshotJson),
      presentationSnapshotJson: JSON.stringify(store.decisionRequest[0].presentationSnapshotJson),
    };
    const before = snapshot(store);

    const first = await service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-idempotent',
      outcome: 'close_with_learning',
      rationale: 'Decision idempotente.',
    });
    const retry = await service.decideDecisionRequest(project.id, leadId, 'mentor', request.id, {
      idempotencyKey: 'decision-idempotent',
      outcome: 'close_with_learning',
      rationale: 'Decision idempotente.',
    });

    expect(retry.id).toBe(first.id);
    expect(store.decision).toHaveLength(1);
    expect(store.decisionRequest[0].status).toBe('resolved');
    expect(JSON.stringify(store.decisionRequest[0].readinessSnapshotJson)).toBe(requestSnapshot.readinessSnapshotJson);
    expect(JSON.stringify(store.decisionRequest[0].authoritySnapshotJson)).toBe(requestSnapshot.authoritySnapshotJson);
    expect(JSON.stringify(store.decisionRequest[0].decisionPackageSnapshotJson)).toBe(requestSnapshot.decisionPackageSnapshotJson);
    expect(JSON.stringify(store.decisionRequest[0].recommendationSnapshotJson)).toBe(requestSnapshot.recommendationSnapshotJson);
    expect(JSON.stringify(store.decisionRequest[0].presentationSnapshotJson)).toBe(requestSnapshot.presentationSnapshotJson);
    expect(snapshot(store)).toBe(before);

    const other = seedPresented(store, { projectId: 'project-od-idem-other' });
    const otherRequest = await createRequest(service, other.project.id, other.ownerId);
    await expect(service.decideDecisionRequest(other.project.id, other.leadId, 'mentor', otherRequest.id, {
      idempotencyKey: 'decision-idempotent',
      outcome: 'close_with_learning',
      rationale: 'Reuso indebido de idempotencyKey.',
    })).rejects.toMatchObject({ code: 'DECISION_IDEMPOTENCY_CONFLICT' });
  });
});
