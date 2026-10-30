import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../adaptive-core.service';
import { TruthService, type EvidenceReferenceBindingInput, type ValidatedSupportBindingInput } from '../../truth/truth.service';

const describeR2Persistence = process.env.R2_PERSISTENCE_E2E === '1' ? describe : describe.skip;

const prisma = new PrismaClient();
const adaptive = new AdaptiveCoreService(prisma);
const truth = new TruthService(prisma);

const userId = 'user-r2-persistence-e2e';
const mentorId = 'user-r2-persistence-mentor';
const otherUserId = 'user-r2-persistence-other';
const organizationId = 'org-r2-persistence-e2e';
const projectPrefix = 'project-r2-persistence-e2e';
const ownerActor = { id: userId, role: 'participante' };
const mentorActor = { id: mentorId, role: 'mentor' };

type TruthState = 'supported' | 'contradicted' | 'insufficient' | 'unvalidated';

const projectIds = [
  `${projectPrefix}-main`,
  `${projectPrefix}-no-bindings`,
  `${projectPrefix}-fake-evidence`,
  `${projectPrefix}-fake-source`,
  `${projectPrefix}-cross-project`,
  `${projectPrefix}-contradicted`,
  `${projectPrefix}-insufficient`,
  `${projectPrefix}-step2-negative`,
  `${projectPrefix}-step4-negative`,
  `${projectPrefix}-brief-spoof`,
  `${projectPrefix}-other`,
];

async function clean() {
  const where = { projectId: { in: projectIds } };
  await prisma.adaptiveAdaptationEvent.deleteMany({ where });
  await prisma.adaptiveProgressSignal.deleteMany({ where });
  await prisma.adaptiveCheckpointResponse.deleteMany({ where });
  await prisma.adaptiveCheckpointInstance.deleteMany({ where });
  await prisma.adaptiveStepOutput.deleteMany({ where });
  await prisma.adaptiveStepConfiguration.deleteMany({ where });
  await prisma.cycleStepState.deleteMany({ where: { cycle: { projectId: { in: projectIds } } } });
  await prisma.initiativeCycle.deleteMany({ where });
  await prisma.attentionItem.deleteMany({ where });
  await prisma.impactAssertion.deleteMany({ where });
  await prisma.truthClaimSourceRef.deleteMany({ where: { claim: { projectId: { in: projectIds } } } });
  await prisma.truthValidation.deleteMany({ where });
  await prisma.evidence.deleteMany({ where });
  await prisma.truthClaim.deleteMany({ where });
  await prisma.sourceRef.deleteMany({ where });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, mentorId, otherUserId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}

async function createUser(id: string, email: string, role: 'participante' | 'mentor' = 'participante') {
  return prisma.user.create({
    data: {
      id,
      email,
      name: email,
      role,
      roles: [role],
      initials: 'RP',
      skills: [],
      organizationId,
    },
  });
}

async function createProject(id: string) {
  return prisma.project.create({
    data: {
      id,
      name: `R2 persistence ${id}`,
      description: 'Disposable R2 persistence E2E project.',
      ownerId: userId,
      organizationId,
      step0Status: 'IN_PROGRESS',
      step0Data: {
        challengeType: 'growth',
        contextInitial: 'Contexto inicial R2.',
        initialFocus: 'Validar oportunidad con evidencia persistente.',
        expectedImpact: 'Menos retrabajo.',
        mainRisk: 'Evidencia insuficiente.',
        pendingQuestions: [{ question: 'Que evidencia valida el foco?' }],
        nextRecommendedStep: 'Completar Step 0',
      },
      teamMembers: { create: [
        { userId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] },
        { userId: mentorId, role: 'VIEWER', status: 'ACTIVE', modulePermissions: [] },
      ] },
    },
  });
}

async function createTruthBinding(projectId: string, state: TruthState = 'supported', overrides: Record<string, unknown> = {}) {
  const source = await truth.createSourceRef({
    projectId: String(overrides.sourceProjectId ?? projectId),
    sourceType: 'USER_INPUT',
    reference: String(overrides.reference ?? `${projectId}-${state}-source`),
  }, ownerActor);
  const claim = await truth.createClaim({
    projectId: String(overrides.claimProjectId ?? projectId),
    subjectType: 'initiative',
    subjectId: projectId,
    claimType: 'hypothesis',
    statement: String(overrides.statement ?? 'La evidencia persistente soporta el foco de Step 1.'),
    createdByType: 'human',
    sourceRefIds: [],
  }, ownerActor);
  const evidence = await truth.attachEvidence({
    projectId: String(overrides.evidenceProjectId ?? projectId),
    targetClaimId: String(overrides.evidenceClaimId ?? claim.id),
    sourceRefId: String(overrides.evidenceSourceRefId ?? source.id),
    name: `${projectId}-${state}-evidence`,
    evidenceType: 'OTHER',
    truthStatus: state === 'supported' ? 'supports' : state === 'contradicted' ? 'contradicts' : state === 'insufficient' ? 'insufficient' : 'supports',
    stepRef: Number(overrides.stepRef ?? 1),
    provenance: { test: 'r2-persistence-e2e' },
  }, ownerActor);
  if (state !== 'unvalidated') {
    await truth.recordValidation({
      projectId,
      claimId: claim.id,
      evidenceId: evidence.id,
      result: state,
      validatorType: 'human',
      validatorRole: 'mentor',
      expectedVersion: 0,
      rationale: `R2 persistence ${state} validation.`,
    }, mentorActor);
  }
  return {
    claim,
    evidence,
    source,
    truthBindings: {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    } satisfies ValidatedSupportBindingInput,
    evidenceBindings: {
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    } satisfies EvidenceReferenceBindingInput,
  };
}

async function completeStep0(projectId: string) {
  await adaptive.activateInitiativeCycle(projectId, userId, 'participante', {
    idempotencyKey: `${projectId}-activate`,
    expectedVersion: 0,
    origin: { kind: 'DIRECT_PROJECT' },
  });
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp01`,
    checkpointKey: 'CP-0.1',
    responses: { objective: 'Reducir retrabajo comercial.', challengeType: 'growth' },
  });
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp02`,
    checkpointKey: 'CP-0.2',
    responses: { scope: 'Equipo comercial', owner_and_actor_required: 'Owner comercial' },
  });
  const state = await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp03`,
    checkpointKey: 'CP-0.3',
    responses: { priorityHypothesis: 'Visibilidad temprana reduce retrabajo.', decisionCriteria: 'Uso semanal y menos retrabajo.' },
  });
  const draft = state.stepOutputs.find((output) => output.step === 0);
  await adaptive.confirmStep0Brief(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-step0-confirm`,
    brief: draft?.output as Record<string, unknown>,
    confirmed: true,
  });
}

async function prepareCp13(projectId: string) {
  await completeStep0(projectId);
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp11`,
    checkpointKey: 'CP-1.1',
    responses: {
      mainHypothesis: 'Usuarios adoptan el tablero si reduce retrabajo.',
      criticalAssumption: 'El retrabajo nace por falta de visibilidad.',
      learningQuestion: 'Que evidencia muestra retrabajo evitable?',
      riskOfBeingWrong: 'Disenar una solucion para el problema equivocado.',
      dependentDecision: 'Definir apuesta de Step 2.',
    },
  });
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp12`,
    checkpointKey: 'CP-1.2',
    responses: {
      methods: ['entrevistas', 'revision de metricas'],
      sourcesAndActors: ['Usuarios comerciales', 'Reporte CRM'],
      responsibleAndDates: ['Owner comercial - 2026-08-05'],
      expectedEvidenceAndSufficiency: 'Tres entrevistas y una metrica base.',
    },
  });
}

function cp13Responses(overrides: Record<string, unknown> = {}) {
  return {
    evidenceItems: overrides.evidenceItems ?? [
      { id: 'evidence-1', summary: '8 de 10 casos tienen retrabajo por visibilidad.', classification: 'supports', sourceRefs: ['https://fake.example/evidence'] },
    ],
    evidenceClassifications: overrides.evidenceClassifications ?? ['supports'],
    sourceRefs: overrides.sourceRefs ?? ['https://fake.example/evidence'],
  };
}

async function assertCp13NegativeNoWrites(projectId: string, beforeResponses: number) {
  const [cp13, responses, cp14Count, step1DraftCount] = await Promise.all([
    prisma.adaptiveCheckpointInstance.findFirst({ where: { projectId, checkpointKey: 'CP-1.3' } }),
    prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
    prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-1.4' } }),
    prisma.adaptiveStepOutput.count({ where: { projectId, stepNumber: 1, status: 'draft' } }),
  ]);
  expect(cp13?.status).toMatch(/ready|in_progress/);
  expect(responses).toBe(beforeResponses);
  expect(cp14Count).toBe(0);
  expect(step1DraftCount).toBe(0);
}

async function completeStep1WithSupportedTruth(projectId: string) {
  await prepareCp13(projectId);
  const binding = await createTruthBinding(projectId, 'supported');
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp13`,
    checkpointKey: 'CP-1.3',
    responses: cp13Responses(),
    truthBindings: binding.truthBindings,
  });
  const afterCp13 = await reloadState(projectId);
  expect(afterCp13.activeCheckpoint?.checkpointKey).toBe('CP-1.4');
  expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-1.4' } })).toBe(1);

  const afterCp14 = await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp14`,
    checkpointKey: 'CP-1.4',
    responses: {
      synthesis: 'La evidencia apoya enfocar visibilidad de retrabajo.',
      updatedFocusAndHypothesis: 'Reducir retrabajo comercial con visibilidad temprana.',
      continuityDecision: 'mantener',
    },
  });
  return { binding, state: afterCp14 };
}

async function confirmStep1(projectId: string, output: Record<string, unknown>, idempotencyKey = `${projectId}-step1-confirm`) {
  return adaptive.confirmStep1Output(projectId, userId, 'mentor', {
    idempotencyKey,
    brief: output,
    confirmed: true,
  });
}

async function completeStep2(projectId: string) {
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp21`,
    checkpointKey: 'CP-2.1',
    responses: {
      expectedOutcome: 'Reducir retrabajo validando visibilidad temprana.',
      successCriteria: ['Uso semanal', 'Menos retrabajo'],
      constraintsGuardrails: ['No usar datos productivos sin permiso'],
      reversibilityLevel: 'alta',
    },
  });
  const binding = await createTruthBinding(projectId, 'supported', { stepRef: 2, reference: `${projectId}-step2-source` });
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp22`,
    checkpointKey: 'CP-2.2',
    responses: {
      alternatives: [{ name: 'Prototipo manual', mode: 'experiment', evidenceRefs: ['crm-report'] }],
      implementationModes: ['experiment'],
      alternativeEvidenceRefs: ['crm-report'],
    },
    evidenceBindings: binding.evidenceBindings,
  });
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp23`,
    checkpointKey: 'CP-2.3',
    responses: {
      comparison: { valor: 'alto', factibilidad: 'media' },
      selectedBet: { primary: 'Prototipo manual', backup: 'No hacer nada', justification: 'Mayor aprendizaje con bajo costo.', evidenceRefs: ['crm-report'] },
      selectedBetEvidenceRefs: ['crm-report'],
    },
    evidenceBindings: binding.evidenceBindings,
  });
  return adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp24`,
    checkpointKey: 'CP-2.4',
    responses: {
      executionDesign: {
        testOrExecution: 'Prueba con 5 usuarios',
        scope: 'Equipo comercial',
        participants: ['5 usuarios'],
        baseline: '500 horas',
        metric: 'Horas de retrabajo',
        threshold: '20% reduccion',
        duration: '2 semanas',
      },
      ownersResourcesEvidence: ['Owner comercial', 'Tablero de seguimiento'],
      goNoGoCriteria: 'Go si baja 20% el retrabajo.',
    },
  });
}

async function confirmStep2(projectId: string, output: Record<string, unknown>) {
  return adaptive.confirmStep2Output(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-step2-confirm`,
    brief: output,
    confirmed: true,
  });
}

async function completeStep3UntilCp33WithContradictedEvidence(projectId: string) {
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp31`,
    checkpointKey: 'CP-3.1',
    responses: {
      step3TransferConfirmation: 'Transferencia Step 2 confirmada.',
      executionReadinessChecklist: ['Owner confirmado', 'Metrica lista'],
      executionDependencies: ['Plan alternativo: medicion manual'],
    },
  });
  const executionBinding = await createTruthBinding(projectId, 'supported', { stepRef: 3, reference: `${projectId}-execution-source` });
  await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp32`,
    checkpointKey: 'CP-3.2',
    responses: {
      executionRecords: [{ type: 'measurement', title: 'Medicion piloto', description: 'Resultado medido.', sourceRefs: ['result-1'] }],
      executionSourceRefs: ['result-1'],
    },
    evidenceBindings: executionBinding.evidenceBindings,
  });
  const contradictedBinding = await createTruthBinding(projectId, 'contradicted', { stepRef: 3, reference: `${projectId}-contradicted-result-source` });
  const state = await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp33`,
    checkpointKey: 'CP-3.3',
    responses: {
      resultComparison: { baseline: '500', result: '550', threshold: '20%', contradictingEvidenceRefs: ['result-1'], interpretation: 'Contradice la hipotesis.' },
      hypothesisClassification: 'contradicted',
      confirmedInterpretation: 'Contradice la hipotesis.',
    },
    evidenceBindings: contradictedBinding.evidenceBindings,
  });
  return { state, contradictedBinding };
}

async function completeStep3(projectId: string) {
  const cp33 = await completeStep3UntilCp33WithContradictedEvidence(projectId);
  const afterDecision = await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp34`,
    checkpointKey: 'CP-3.4',
    responses: {
      decision: 'iterate',
      decisionDetails: { rationale: 'Iterar con aprendizaje.', nextAction: 'Ajustar piloto.', owner: 'Owner comercial', requiredApprover: 'Sponsor' },
      decisionEvidenceRefs: ['result-1'],
    },
    evidenceBindings: cp33.contradictedBinding.evidenceBindings,
  });
  if (afterDecision.activeCheckpoint?.checkpointKey !== 'CP-3.5') {
    return afterDecision;
  }
  return adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-cp35`,
    checkpointKey: 'CP-3.5',
    responses: {
      operationalReadinessChecklist: ['Owner futuro confirmado', 'Soporte definido', 'Rollback documentado', 'Aceptacion area receptora'],
      operationalBlockers: ['Sin bloqueos operativos'],
    },
  });
}

async function confirmStep3(projectId: string, output: Record<string, unknown>) {
  return adaptive.confirmStep3Output(projectId, userId, 'mentor', {
    idempotencyKey: `${projectId}-step3-confirm`,
    brief: output,
    confirmed: true,
  });
}

async function reloadState(projectId: string) {
  const fresh = new PrismaClient();
  try {
    return await new AdaptiveCoreService(fresh).getState(projectId, userId, 'mentor');
  } finally {
    await fresh.$disconnect();
  }
}

describeR2Persistence('R2 Adaptive Core persistence E2E', () => {
  beforeAll(async () => {
    await clean();
    await prisma.organization.create({ data: { id: organizationId, name: 'R2 persistence org', slug: 'r2-persistence-org', seatLimit: 10 } });
    await createUser(userId, 'r2.persistence.e2e@starteria.test');
    await createUser(mentorId, 'r2.persistence.mentor@starteria.test', 'mentor');
    await createUser(otherUserId, 'r2.persistence.other@starteria.test');
    await prisma.organizationMember.createMany({ data: [userId, mentorId, otherUserId].map((memberId) => ({
      id: `r2-org-member-${memberId}`,
      organizationId,
      userId: memberId,
    })) });
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('blocks CP-1.3 negative paths without persisting operational progression', async () => {
    const cases = [
      {
        projectId: `${projectPrefix}-no-bindings`,
        expectedCode: 'CHECKPOINT_TRUTH_BINDING_REQUIRED',
        input: async () => ({ responses: cp13Responses() }),
      },
      {
        projectId: `${projectPrefix}-fake-evidence`,
        expectedCode: 'TRUTH_BINDING_EVIDENCE_NOT_FOUND',
        input: async () => ({
          responses: cp13Responses(),
          truthBindings: { claimId: (await createTruthBinding(`${projectPrefix}-fake-evidence`, 'supported')).claim.id, evidenceIds: ['evidence-1'], sourceRefIds: [(await prisma.sourceRef.findFirstOrThrow({ where: { projectId: `${projectPrefix}-fake-evidence` } })).id] },
        }),
      },
      {
        projectId: `${projectPrefix}-fake-source`,
        expectedCode: 'TRUTH_BINDING_SOURCE_REF_NOT_FOUND',
        input: async () => {
          const binding = await createTruthBinding(`${projectPrefix}-fake-source`, 'supported');
          return { responses: cp13Responses({ sourceRefs: ['https://fake.example/source'] }), truthBindings: { ...binding.truthBindings, sourceRefIds: ['https://fake.example/source'] } };
        },
      },
      {
        projectId: `${projectPrefix}-cross-project`,
        expectedCode: 'TRUTH_CLAIM_NOT_FOUND',
        input: async () => {
          const other = await createTruthBinding(`${projectPrefix}-other`, 'supported');
          return { responses: cp13Responses(), truthBindings: other.truthBindings };
        },
      },
      {
        projectId: `${projectPrefix}-contradicted`,
        expectedCode: 'CHECKPOINT_CLAIM_CONTRADICTED',
        input: async () => {
          const binding = await createTruthBinding(`${projectPrefix}-contradicted`, 'contradicted');
          return { responses: cp13Responses({ evidenceClassifications: ['supports'] }), truthBindings: binding.truthBindings };
        },
      },
      {
        projectId: `${projectPrefix}-insufficient`,
        expectedCode: 'CHECKPOINT_CLAIM_INSUFFICIENT',
        input: async () => {
          const binding = await createTruthBinding(`${projectPrefix}-insufficient`, 'insufficient');
          return { responses: cp13Responses(), truthBindings: binding.truthBindings };
        },
      },
    ] as const;

    await createProject(`${projectPrefix}-other`);
    for (const item of cases) {
      await createProject(item.projectId);
      await prepareCp13(item.projectId);
      const beforeResponses = await prisma.adaptiveCheckpointResponse.count({ where: { projectId: item.projectId } });
      const input = await item.input();

      await expect(adaptive.confirmCheckpoint(item.projectId, userId, 'mentor', {
        idempotencyKey: `${item.projectId}-cp13-negative`,
        checkpointKey: 'CP-1.3',
        ...input,
      })).rejects.toMatchObject({ code: item.expectedCode });

      await assertCp13NegativeNoWrites(item.projectId, beforeResponses);
    }
  });

  it('persists Step 0 through Step 4 with reload, provenance, transitions and idempotency intact', async () => {
    const projectId = `${projectPrefix}-main`;
    await createProject(projectId);

    const { binding, state: step1DraftState } = await completeStep1WithSupportedTruth(projectId);
    const step1Draft = step1DraftState.stepOutputs.find((output) => output.step === 1);
    expect(step1Draft?.status).toBe('draft');
    expect(step1Draft?.output).toMatchObject({
      truthReadiness: {
        claimId: binding.claim.id,
        verificationState: 'supported',
        satisfiesValidatedSupport: true,
        evidenceIds: [binding.evidence.id],
        sourceRefIds: [binding.source.id],
      },
      sufficiency: 'sufficient',
    });
    expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-2.1' } })).toBe(0);
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).currentStep).toBe(1);

    const afterCp14Reload = await reloadState(projectId);
    expect(afterCp14Reload.activeCheckpoint).toBeNull();
    expect(afterCp14Reload.stepOutputs.find((output) => output.step === 1)?.output).toMatchObject(step1Draft?.output as Record<string, unknown>);

    await confirmStep1(projectId, step1Draft?.output as Record<string, unknown>);
    await confirmStep1(projectId, { ...step1Draft?.output as Record<string, unknown>, truthReadiness: { verificationState: 'supported', satisfiesValidatedSupport: true, claimId: 'spoof' } });
    const [step1Output, step2ConfigCount, cp21Count, step1EventCount] = await Promise.all([
      prisma.adaptiveStepOutput.findFirstOrThrow({ where: { projectId, stepNumber: 1 }, orderBy: { version: 'desc' } }),
      prisma.adaptiveStepConfiguration.count({ where: { projectId, stepNumber: 2 } }),
      prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-2.1' } }),
      prisma.adaptiveAdaptationEvent.count({ where: { projectId, idempotencyKey: `${projectId}-step1-confirm` } }),
    ]);
    const step2Config = await prisma.adaptiveStepConfiguration.findFirstOrThrow({ where: { projectId, stepNumber: 2 } });
    expect(step1Output.status).toBe('confirmed');
    expect(step2ConfigCount).toBe(1);
    expect(cp21Count).toBe(1);
    expect(step1EventCount).toBe(1);
    expect(step2Config.sourceContextJson).toMatchObject({
      step1Output: { truthReadiness: { claimId: binding.claim.id, evidenceIds: [binding.evidence.id], sourceRefIds: [binding.source.id] } },
      step2Transfer: { truthReadiness: { claimId: binding.claim.id, evidenceIds: [binding.evidence.id], sourceRefIds: [binding.source.id] } },
    });

    const afterStep1Reload = await reloadState(projectId);
    expect(afterStep1Reload.activeCheckpoint?.checkpointKey).toBe('CP-2.1');
    expect(afterStep1Reload.progressSignal).toMatchObject({ checkpointCode: 'CP-2.1', truthReadiness: { claimId: binding.claim.id } });

    const step2DraftState = await completeStep2(projectId);
    const step2Draft = step2DraftState.stepOutputs.find((output) => output.step === 2);
    expect(step2Draft?.status).toBe('draft');
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).currentStep).toBe(2);
    expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-3.1' } })).toBe(0);

    await confirmStep2(projectId, step2Draft?.output as Record<string, unknown>);
    const afterStep2Reload = await reloadState(projectId);
    expect(afterStep2Reload.activeCheckpoint?.checkpointKey).toBe('CP-3.1');
    expect(await prisma.adaptiveStepConfiguration.count({ where: { projectId, stepNumber: 3 } })).toBe(1);

    const step3Cp33 = await completeStep3UntilCp33WithContradictedEvidence(projectId);
    expect(step3Cp33.state.activeCheckpoint?.checkpointKey).toBe('CP-3.4');
    const afterCp33Reload = await reloadState(projectId);
    expect(afterCp33Reload.activeCheckpoint?.checkpointKey).toBe('CP-3.4');
    expect(afterCp33Reload.checkpointInstances.find((cp) => cp.checkpointKey === 'CP-3.3')?.status).toBe('completed');

    await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
      idempotencyKey: `${projectId}-cp34`,
      checkpointKey: 'CP-3.4',
      responses: {
        decision: 'transfer',
        decisionDetails: { rationale: 'Transferir con aprendizaje trazable.', nextAction: 'Preparar paquete.', owner: 'Owner comercial', requiredApprover: 'Sponsor' },
        decisionEvidenceRefs: ['result-1'],
      },
      evidenceBindings: step3Cp33.contradictedBinding.evidenceBindings,
    });
    const step3DraftState = await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
      idempotencyKey: `${projectId}-cp35`,
      checkpointKey: 'CP-3.5',
      responses: {
        operationalReadinessChecklist: ['Owner futuro confirmado', 'Soporte definido', 'Rollback documentado', 'Aceptacion area receptora'],
        operationalBlockers: ['Sin bloqueos operativos'],
      },
    });
    const step3Draft = step3DraftState.stepOutputs.find((output) => output.step === 3);
    expect(step3Draft?.status).toBe('draft');
    expect((await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).currentStep).toBe(3);
    expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-4.1' } })).toBe(0);

    await confirmStep3(projectId, step3Draft?.output as Record<string, unknown>);
    const afterStep3Reload = await reloadState(projectId);
    expect(afterStep3Reload.activeCheckpoint?.checkpointKey).toBe('CP-4.1');
    expect(await prisma.adaptiveStepConfiguration.count({ where: { projectId, stepNumber: 4 } })).toBe(1);

    await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
      idempotencyKey: `${projectId}-cp41`,
      checkpointKey: 'CP-4.1',
      responses: {
        step4TransferConfirmation: 'Transferencia Step 3 confirmada.',
        decisionAudience: { primaryAudience: 'Comite ejecutivo', decisionMaker: 'Sponsor' },
        audienceDecisionNeeds: { requestedDecision: 'Aprobar siguiente horizonte', audienceNeeds: ['Evidencia'], preferredFormat: 'memo' },
      },
    });
    const step4Binding = await createTruthBinding(projectId, 'supported', { stepRef: 4, reference: `${projectId}-step4-source` });
    await adaptive.confirmCheckpoint(projectId, userId, 'mentor', {
      idempotencyKey: `${projectId}-cp42`,
      checkpointKey: 'CP-4.2',
      responses: {
        evidenceNarrative: { recommendation: 'Continuar con aprendizaje trazable.', results: 'Resultado medido y documentado.' },
        narrativeEvidenceRefs: ['result-1'],
      },
      evidenceBindings: step4Binding.evidenceBindings,
    });
    const afterCp42Reload = await reloadState(projectId);
    expect(afterCp42Reload.activeCheckpoint?.checkpointKey).toBe('CP-4.3');
  });

  it('keeps evidence-reference negative paths from writing checkpoint progression in Steps 2 and 4', async () => {
    const step2Project = `${projectPrefix}-step2-negative`;
    await createProject(step2Project);
    const { state: step1DraftState } = await completeStep1WithSupportedTruth(step2Project);
    const step1Draft = step1DraftState.stepOutputs.find((output) => output.step === 1);
    await confirmStep1(step2Project, step1Draft?.output as Record<string, unknown>);
    await adaptive.confirmCheckpoint(step2Project, userId, 'mentor', {
      idempotencyKey: `${step2Project}-cp21`,
      checkpointKey: 'CP-2.1',
      responses: {
        expectedOutcome: 'Reducir retrabajo.',
        successCriteria: ['Uso semanal'],
        constraintsGuardrails: ['Sin datos productivos'],
        reversibilityLevel: 'alta',
      },
    });
    const beforeStep2Responses = await prisma.adaptiveCheckpointResponse.count({ where: { projectId: step2Project } });
    const beforeStep2Instances = await prisma.adaptiveCheckpointInstance.count({ where: { projectId: step2Project } });
    await expect(adaptive.confirmCheckpoint(step2Project, userId, 'mentor', {
      idempotencyKey: `${step2Project}-cp22-fake`,
      checkpointKey: 'CP-2.2',
      responses: {
        alternatives: [{ name: 'Piloto manual', mode: 'experiment', evidenceRefs: ['fake-url'] }],
        implementationModes: ['experiment'],
        alternativeEvidenceRefs: ['https://fake.example/evidence'],
      },
      evidenceBindings: { evidenceIds: ['evidence-1'], sourceRefIds: ['https://fake.example/evidence'] },
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });
    expect(await prisma.adaptiveCheckpointResponse.count({ where: { projectId: step2Project } })).toBe(beforeStep2Responses);
    expect((await prisma.adaptiveCheckpointInstance.findFirst({ where: { projectId: step2Project, checkpointKey: 'CP-2.2' } }))?.status).toBe('ready');
    expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId: step2Project } })).toBe(beforeStep2Instances);

    const step4Project = `${projectPrefix}-step4-negative`;
    await createProject(step4Project);
    const { state: step1State } = await completeStep1WithSupportedTruth(step4Project);
    await confirmStep1(step4Project, step1State.stepOutputs.find((output) => output.step === 1)?.output as Record<string, unknown>);
    const step2State = await completeStep2(step4Project);
    await confirmStep2(step4Project, step2State.stepOutputs.find((output) => output.step === 2)?.output as Record<string, unknown>);
    const step3State = await completeStep3(step4Project);
    await confirmStep3(step4Project, step3State.stepOutputs.find((output) => output.step === 3)?.output as Record<string, unknown>);
    await adaptive.confirmCheckpoint(step4Project, userId, 'mentor', {
      idempotencyKey: `${step4Project}-cp41`,
      checkpointKey: 'CP-4.1',
      responses: {
        step4TransferConfirmation: 'Transferencia confirmada.',
        decisionAudience: { primaryAudience: 'Comite', decisionMaker: 'Sponsor' },
        audienceDecisionNeeds: { requestedDecision: 'Aprobar', audienceNeeds: ['Evidencia'], preferredFormat: 'memo' },
      },
    });
    const beforeStep4Responses = await prisma.adaptiveCheckpointResponse.count({ where: { projectId: step4Project } });
    const beforeStep4Instances = await prisma.adaptiveCheckpointInstance.count({ where: { projectId: step4Project } });
    await expect(adaptive.confirmCheckpoint(step4Project, userId, 'mentor', {
      idempotencyKey: `${step4Project}-cp42-fake`,
      checkpointKey: 'CP-4.2',
      responses: {
        evidenceNarrative: { recommendation: 'Continuar.', results: 'Resultado trazable.' },
        narrativeEvidenceRefs: ['fake-ref'],
      },
      evidenceBindings: { evidenceIds: ['evidence-1'], sourceRefIds: ['fake-ref'] },
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });
    expect(await prisma.adaptiveCheckpointResponse.count({ where: { projectId: step4Project } })).toBe(beforeStep4Responses);
    expect((await prisma.adaptiveCheckpointInstance.findFirst({ where: { projectId: step4Project, checkpointKey: 'CP-4.2' } }))?.status).toBe('ready');
    expect(await prisma.adaptiveCheckpointInstance.count({ where: { projectId: step4Project } })).toBe(beforeStep4Instances);
  });

  it('does not let edited Step 1 brief elevate stored Truth readiness or contractual sufficiency', async () => {
    const projectId = `${projectPrefix}-brief-spoof`;
    await createProject(projectId);
    await prepareCp13(projectId);
    const step1Config = await prisma.adaptiveStepConfiguration.findFirstOrThrow({ where: { projectId, stepNumber: 1 } });
    await prisma.adaptiveStepOutput.create({
      data: {
        projectId,
        cycleId: step1Config.cycleId,
        sourceConfigurationId: step1Config.id,
        stepNumber: 1,
        version: 1,
        status: 'draft',
        outputKey: 'ProblemFocusBrief',
        outputJson: {
          outputKey: 'ProblemFocusBrief',
          hypothesisForStep2: 'Hipotesis no soportada.',
          updatedFocus: 'Foco no soportado.',
          sufficiency: 'partial',
          methodologicalSufficiency: 'partial',
          truthReadiness: {
            verificationState: 'insufficient',
            satisfiesValidatedSupport: false,
            claimId: null,
            evidenceIds: [],
            sourceRefIds: [],
          },
        },
      },
    });

    await adaptive.confirmStep1Output(projectId, userId, 'mentor', {
      idempotencyKey: `${projectId}-step1-spoof`,
      brief: { sufficiency: 'sufficient', truthReadiness: { verificationState: 'supported', satisfiesValidatedSupport: true, claimId: 'fake' } },
      confirmed: true,
    });
    const confirmed = await prisma.adaptiveStepOutput.findFirstOrThrow({ where: { projectId, stepNumber: 1 } });
    expect(confirmed.outputJson).toMatchObject({
      sufficiency: 'partial',
      truthReadiness: {
        verificationState: 'insufficient',
        satisfiesValidatedSupport: false,
        claimId: null,
      },
    });
  });
});
