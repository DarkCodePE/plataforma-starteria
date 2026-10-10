import { describe, expect, it, vi } from 'vitest';
import { AdaptiveCoreService } from '../adaptive-core.service';

type Row = Record<string, any>;

function createStore() {
  return {
    project: [] as Row[],
    adaptiveStepConfiguration: [] as Row[],
    adaptiveCheckpointInstance: [] as Row[],
    adaptiveCheckpointResponse: [] as Row[],
    adaptiveStepOutput: [] as Row[],
    adaptiveProgressSignal: [] as Row[],
    adaptiveAdaptationEvent: [] as Row[],
    criticalChange: [] as Row[],
    initiativeCycle: [] as Row[],
    cycleStepState: [] as Row[],
    initiativePortfolioMeta: [] as Row[],
    sourceRef: [] as Row[],
    truthClaim: [] as Row[],
    evidence: [] as Row[],
    teamMember: [] as Row[],
  };
}

let seq = 1;
const id = (prefix: string) => `${prefix}-${seq++}`;

function matches(row: Row, where: Row): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected === null) return actual == null;
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected) return expected.in.includes(actual);
      if ('gte' in expected) return actual >= expected.gte;
      if ('not' in expected) return actual !== expected.not;
    }
    return actual === expected;
  });
}

function orderRows(rows: Row[], orderBy?: Row | Row[]) {
  const order = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...rows].sort((a, b) => {
    for (const item of order) {
      const [key, dir] = Object.entries(item)[0];
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (av === bv) continue;
      return dir === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    }
    return 0;
  });
}

function collection(store: ReturnType<typeof createStore>, name: keyof ReturnType<typeof createStore>) {
  return {
    findFirst: vi.fn(async (args: any = {}) => orderRows(store[name].filter((row) => matches(row, args.where)), args.orderBy)[0] ?? null),
    findMany: vi.fn(async (args: any = {}) => {
      let rows = store[name].filter((row) => matches(row, args.where));
      rows = orderRows(rows, args.orderBy);
      return typeof args.take === 'number' ? rows.slice(0, args.take) : rows;
    }),
    findUnique: vi.fn(async (args: any) => {
      const where = args.where ?? {};
      if ('id' in where) return store[name].find((row) => row.id === where.id) ?? null;
      if ('projectId' in where) return store[name].find((row) => row.projectId === where.projectId) ?? null;
      if ('idempotencyKey' in where) return store[name].find((row) => row.idempotencyKey === where.idempotencyKey) ?? null;
      if ('cycleId_stepNumber' in where) {
        return store[name].find((row) => row.cycleId === where.cycleId_stepNumber.cycleId && row.stepNumber === where.cycleId_stepNumber.stepNumber) ?? null;
      }
      return store[name].find((row) => matches(row, where)) ?? null;
    }),
    create: vi.fn(async (args: any) => {
      const row = { id: id(String(name)), createdAt: new Date(), updatedAt: new Date(), ...args.data };
      store[name].push(row);
      return row;
    }),
    update: vi.fn(async (args: any) => {
      const row = store[name].find((item) => item.id === args.where.id || item.projectId === args.where.projectId);
      if (!row) throw new Error(`${String(name)} not found`);
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    }),
    updateMany: vi.fn(async (args: any) => {
      const rows = store[name].filter((row) => matches(row, args.where));
      rows.forEach((row) => Object.assign(row, args.data, { updatedAt: new Date() }));
      return { count: rows.length };
    }),
    upsert: vi.fn(async (args: any) => {
      const existing = await (collection(store, name) as any).findUnique({ where: args.where });
      if (existing) {
        Object.assign(existing, args.update, { updatedAt: new Date() });
        return existing;
      }
      const row = { id: id(String(name)), createdAt: new Date(), updatedAt: new Date(), ...args.create };
      store[name].push(row);
      return row;
    }),
  };
}

function makePrisma(store = createStore()) {
  const prisma: any = {
    project: collection(store, 'project'),
    adaptiveStepConfiguration: collection(store, 'adaptiveStepConfiguration'),
    adaptiveCheckpointInstance: collection(store, 'adaptiveCheckpointInstance'),
    adaptiveCheckpointResponse: collection(store, 'adaptiveCheckpointResponse'),
    adaptiveStepOutput: collection(store, 'adaptiveStepOutput'),
    adaptiveProgressSignal: collection(store, 'adaptiveProgressSignal'),
    adaptiveAdaptationEvent: collection(store, 'adaptiveAdaptationEvent'),
    criticalChange: collection(store, 'criticalChange'),
    initiativeCycle: collection(store, 'initiativeCycle'),
    cycleStepState: collection(store, 'cycleStepState'),
    initiativePortfolioMeta: collection(store, 'initiativePortfolioMeta'),
    sourceRef: collection(store, 'sourceRef'),
    truthClaim: collection(store, 'truthClaim'),
    evidence: collection(store, 'evidence'),
    teamMember: collection(store, 'teamMember'),
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
  };
  return prisma;
}

function seedProject(store: ReturnType<typeof createStore>, overrides: Row = {}) {
  const project = {
    id: overrides.id ?? id('project'),
    name: 'Iniciativa',
    ownerId: 'u1',
    initialReviewSnapshotId: overrides.initialReviewSnapshotId ?? 'snap-1',
    step0Status: 'IN_PROGRESS',
    step0Data: {
      challengeType: overrides.challengeType ?? 'growth',
      contextInitial: overrides.contextInitial ?? 'Contexto inicial',
      initialFocus: overrides.initialFocus ?? 'Validar oportunidad',
      expectedImpact: overrides.expectedImpact ?? 'Adopcion semanal',
      mainRisk: overrides.mainRisk ?? '',
      pendingQuestions: overrides.pendingQuestions ?? [{ question: 'Que evidencia falta?' }],
      nextRecommendedStep: overrides.nextRecommendedStep ?? 'Completar Step 0',
    },
    teamMembers: [{ userId: 'u1' }],
    portfolioMeta: overrides.portfolioMeta ?? [],
    contextSnapshots: overrides.contextSnapshots ?? [],
    steps: [],
    ...overrides,
  };
  store.project.push(project);
  store.teamMember.push(...project.teamMembers.map((member: Row) => ({ ...member, projectId: project.id, status: 'ACTIVE' })));
  if (overrides.portfolioMeta) store.initiativePortfolioMeta.push(...overrides.portfolioMeta);
  return project;
}

async function completeStep0(service: AdaptiveCoreService, projectId: string) {
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp01`,
    checkpointKey: 'CP-0.1',
    responses: { objective: 'Mover adopcion', challengeType: 'growth' },
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp02`,
    checkpointKey: 'CP-0.2',
    responses: { scope: 'Equipo comercial', owner_and_actor_required: 'Owner comercial' },
  });
  return service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp03`,
    checkpointKey: 'CP-0.3',
    responses: { priorityHypothesis: 'Si simplificamos el tablero, sube el uso.', decisionCriteria: 'Uso semanal recurrente.' },
  });
}

async function confirmStep0AndStartStep1(service: AdaptiveCoreService, projectId: string) {
  const state = await completeStep0(service, projectId);
  const draft = state.stepOutputs.find((output: any) => output.step === 0);
  return service.confirmStep0Brief(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-brief-ok`,
    brief: draft?.output as Record<string, unknown>,
    confirmed: true,
  });
}

async function prepareCp13(service: AdaptiveCoreService, projectId: string) {
  await confirmStep0AndStartStep1(service, projectId);
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-prep-cp11`,
    checkpointKey: 'CP-1.1',
    responses: {
      mainHypothesis: 'Usuarios adoptan el tablero si reduce retrabajo.',
      criticalAssumption: 'El retrabajo nace por falta de visibilidad.',
      learningQuestion: 'Que evidencia muestra retrabajo evitable?',
      riskOfBeingWrong: 'Disenar una solucion para el problema equivocado.',
      dependentDecision: 'Definir apuesta de Step 2.',
    },
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-prep-cp12`,
    checkpointKey: 'CP-1.2',
    responses: {
      methods: ['entrevistas', 'revision de metricas'],
      sourcesAndActors: ['Usuarios comerciales', 'Reporte CRM'],
      responsibleAndDates: ['Owner comercial - 2026-08-05'],
      expectedEvidenceAndSufficiency: 'Tres entrevistas y una metrica base.',
    },
  });
}

async function createTruthBinding(
  service: AdaptiveCoreService,
  projectId: string,
  state: 'supported' | 'contradicted' | 'insufficient' | 'unvalidated' = 'supported',
  overrides: Record<string, any> = {},
) {
  const prisma = (service as any).prisma;
  const source = await prisma.sourceRef.create({
    data: {
      projectId: overrides.sourceProjectId ?? projectId,
      sourceType: 'USER_INPUT',
      reference: overrides.reference ?? `source-${projectId}-${state}`,
    },
  });
  const claim = await prisma.truthClaim.create({
    data: {
      projectId: overrides.claimProjectId ?? projectId,
      subjectType: 'initiative',
      claimType: 'hypothesis',
      statement: overrides.statement ?? 'La evidencia soporta el foco de Step 1.',
      createdById: 'u1',
      createdByType: 'human',
      verificationState: state,
    },
  });
  const evidence = await prisma.evidence.create({
    data: {
      projectId: overrides.evidenceProjectId ?? projectId,
      name: 'Evidencia Step 1',
      type: 'OTHER',
      stepRef: 1,
      ownerId: 'u1',
      sourceRefId: overrides.evidenceSourceRefId ?? source.id,
      targetClaimId: overrides.evidenceClaimId ?? claim.id,
      truthStatus: overrides.truthStatus ?? (state === 'supported' ? 'supports' : state === 'contradicted' ? 'contradicts' : state === 'insufficient' ? 'insufficient' : 'supports'),
    },
  });
  return {
    claim,
    evidence,
    source,
    truthBindings: {
      claimId: claim.id,
      evidenceIds: [evidence.id],
      sourceRefIds: [source.id],
    },
  };
}

async function createEvidenceReferenceBinding(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  const binding = await createTruthBinding(service, projectId, overrides.truthState ?? 'supported', overrides);
  return {
    evidence: binding.evidence,
    source: binding.source,
    evidenceBindings: {
      evidenceIds: [binding.evidence.id],
      sourceRefIds: [binding.source.id],
    },
  };
}

const cp13Responses = (overrides: Record<string, any> = {}) => ({
  evidenceItems: overrides.evidenceItems ?? [
    { id: 'ev-1', summary: '8 de 10 casos tienen retrabajo por visibilidad', classification: 'supports', sourceRefs: overrides.itemSourceRefs ?? ['crm-report'] },
  ],
  evidenceClassifications: overrides.evidenceClassifications ?? ['supports'],
  sourceRefs: overrides.sourceRefs ?? ['crm-report'],
});

async function seedHistoricalCp13AndActivateCp14(
  service: AdaptiveCoreService,
  store: ReturnType<typeof createStore>,
  projectId: string,
  truthState: 'supported' | 'contradicted' | 'insufficient' | 'unvalidated',
  responseOverrides: Record<string, any> = {},
) {
  await prepareCp13(service, projectId);
  const cp13 = store.adaptiveCheckpointInstance.find((cp) => cp.projectId === projectId && cp.checkpointKey === 'CP-1.3');
  const config = store.adaptiveStepConfiguration.find((item) => item.id === cp13?.stepConfigurationId);
  if (!cp13 || !config) throw new Error('CP-1.3 fixture missing');
  const binding = await createTruthBinding(service, projectId, truthState);
  cp13.status = 'completed';
  cp13.completedAt = new Date();
  cp13.sufficiencyJson = { sufficient: true, readiness: binding.truthBindings };
  store.adaptiveCheckpointResponse.push({
    id: id('adaptiveCheckpointResponse'),
    projectId,
    checkpointInstanceId: cp13.id,
    checkpointKey: 'CP-1.3',
    responseJson: { ...cp13Responses(responseOverrides), truthBindings: binding.truthBindings },
    answeredById: 'u1',
    idempotencyKey: `${projectId}-historical-cp13-${truthState}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.adaptiveCheckpointInstance.push({
    id: id('adaptiveCheckpointInstance'),
    projectId,
    stepConfigurationId: config.id,
    stepConfiguration: config,
    stepNumber: 1,
    checkpointKey: 'CP-1.4',
    sequence: 4,
    status: 'ready',
    materializedQuestionsJson: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return binding;
}

async function completeStep1(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp11`,
    checkpointKey: 'CP-1.1',
    responses: {
      mainHypothesis: overrides.mainHypothesis ?? 'Usuarios adoptan el tablero si reduce retrabajo.',
      criticalAssumption: 'El retrabajo nace por falta de visibilidad.',
      learningQuestion: 'Que evidencia muestra retrabajo evitable?',
      riskOfBeingWrong: 'Disenar una solucion para el problema equivocado.',
      dependentDecision: 'Definir apuesta de Step 2.',
    },
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp12`,
    checkpointKey: 'CP-1.2',
    responses: {
      methods: overrides.methods ?? ['entrevistas', 'revision de metricas'],
      sourcesAndActors: ['Usuarios comerciales', 'Reporte CRM'],
      responsibleAndDates: ['Owner comercial - 2026-08-05'],
      expectedEvidenceAndSufficiency: 'Tres entrevistas y una metrica base.',
    },
  });
  const binding = overrides.truthBindings ? { truthBindings: overrides.truthBindings } : await createTruthBinding(service, projectId);
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp13`,
    checkpointKey: 'CP-1.3',
    responses: {
      evidenceItems: overrides.evidenceItems ?? [
        { id: 'ev-1', summary: '8 de 10 casos tienen retrabajo por visibilidad', classification: 'supports', sourceRefs: ['crm-report'] },
      ],
      evidenceClassifications: overrides.evidenceClassifications ?? ['supports'],
      sourceRefs: overrides.sourceRefs ?? ['crm-report'],
    },
    truthBindings: binding.truthBindings,
  });
  return service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp14`,
    checkpointKey: 'CP-1.4',
    responses: {
      synthesis: overrides.synthesis ?? 'La evidencia apoya enfocar visibilidad de retrabajo.',
      updatedFocusAndHypothesis: overrides.updatedFocusAndHypothesis ?? 'Reducir retrabajo comercial con visibilidad temprana.',
      continuityDecision: overrides.continuityDecision ?? 'mantener',
    },
  });
}

async function confirmStep1AndStartStep2(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  const state = await completeStep1(service, projectId, overrides);
  const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as Record<string, unknown>;
  return service.confirmStep1Output(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-step1-confirm`,
    brief: output,
    confirmed: true,
  });
}

async function startStep2FromScratch(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await confirmStep0AndStartStep1(service, projectId);
  return confirmStep1AndStartStep2(service, projectId, overrides);
}

async function completeStep2(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp21`,
    checkpointKey: 'CP-2.1',
    responses: {
      expectedOutcome: overrides.expectedOutcome ?? 'Reducir retrabajo validando visibilidad temprana.',
      successCriteria: overrides.successCriteria ?? ['Uso semanal', 'Menos retrabajo'],
      constraintsGuardrails: overrides.constraintsGuardrails ?? ['No usar datos productivos sin permiso'],
      reversibilityLevel: overrides.reversibilityLevel ?? 'alta',
      companyGuardrails: overrides.companyGuardrails,
    },
  });
  const evidenceBinding = overrides.evidenceBindings ?? (await createEvidenceReferenceBinding(service, projectId)).evidenceBindings;
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp22`,
    checkpointKey: 'CP-2.2',
    responses: {
      alternatives: overrides.alternatives ?? [
        { name: 'Prototipo manual', mode: 'experiment', evidenceRefs: ['crm-report'] },
        { name: 'No hacer nada', mode: 'do_nothing', evidenceRefs: ['risk-log'] },
      ],
      implementationModes: overrides.implementationModes ?? ['experiment', 'do_nothing'],
      alternativeEvidenceRefs: overrides.alternativeEvidenceRefs ?? ['crm-report', 'risk-log'],
    },
    evidenceBindings: evidenceBinding,
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp23`,
    checkpointKey: 'CP-2.3',
    responses: {
      comparison: overrides.comparison ?? { valor: 'alto', factibilidad: 'media' },
      selectedBet: overrides.selectedBet ?? { primary: 'Prototipo manual', backup: 'No hacer nada', justification: 'Mayor aprendizaje con bajo costo.', evidenceRefs: ['crm-report'] },
      selectedBetEvidenceRefs: overrides.selectedBetEvidenceRefs ?? ['crm-report'],
    },
    evidenceBindings: evidenceBinding,
  });
  const afterCp24 = await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp24`,
    checkpointKey: 'CP-2.4',
    responses: {
      executionDesign: overrides.executionDesign ?? {
        testOrExecution: 'Prueba con 5 usuarios',
        scope: 'Equipo comercial',
        participants: ['5 usuarios'],
        baseline: '500 horas',
        metric: 'Horas de retrabajo',
        threshold: '20% reduccion',
        duration: '2 semanas',
      },
      ownersResourcesEvidence: overrides.ownersResourcesEvidence ?? ['Owner comercial', 'Tablero de seguimiento'],
      goNoGoCriteria: overrides.goNoGoCriteria ?? 'Go si baja 20% el retrabajo.',
    },
  });
  if (afterCp24.activeCheckpoint?.checkpointKey === 'CP-2.5') {
    return service.confirmCheckpoint(projectId, 'u1', 'participante', {
      idempotencyKey: `${projectId}-cp25`,
      checkpointKey: 'CP-2.5',
      responses: {
        readinessChecklist: overrides.readinessChecklist ?? ['Owner confirmado', 'Permisos confirmados', 'Datos disponibles'],
        dependenciesAndFallback: overrides.dependenciesAndFallback ?? ['Plan alternativo: encuesta manual'],
      },
    });
  }
  return afterCp24;
}

async function confirmStep2AndStartStep3(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  const state = await completeStep2(service, projectId, overrides);
  const output = state.stepOutputs.find((item: any) => item.step === 2)?.output as Record<string, unknown>;
  return service.confirmStep2Output(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-step2-confirm`,
    brief: output,
    confirmed: true,
  });
}

async function startStep3FromScratch(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await startStep2FromScratch(service, projectId, overrides);
  return confirmStep2AndStartStep3(service, projectId, overrides);
}

async function completeStep3(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp31`,
    checkpointKey: 'CP-3.1',
    responses: {
      step3TransferConfirmation: overrides.step3TransferConfirmation ?? 'Transferencia Step 2 confirmada.',
      executionReadinessChecklist: overrides.executionReadinessChecklist ?? ['Owner confirmado', 'Metrica lista', 'Sin faltantes'],
      executionDependencies: overrides.executionDependencies ?? ['Plan alternativo: medicion manual'],
    },
  });
  const evidenceBinding = overrides.evidenceBindings ?? (await createEvidenceReferenceBinding(service, projectId)).evidenceBindings;
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp32`,
    checkpointKey: 'CP-3.2',
    responses: {
      executionRecords: overrides.executionRecords ?? [
        { type: 'measurement', title: 'Medicion piloto', description: 'Resultado supero umbral', occurredAt: '2026-08-01T00:00:00.000Z', actor: 'Owner comercial', evidenceRefs: ['result-1'], sourceRefs: ['result-1'], impact: 'positivo', configurationVersion: 1, checkpointKey: 'CP-3.2' },
      ],
      executionSourceRefs: overrides.executionSourceRefs ?? ['result-1'],
      criticalExecutionChanges: overrides.criticalExecutionChanges,
    },
    evidenceBindings: evidenceBinding,
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp33`,
    checkpointKey: 'CP-3.3',
    responses: {
      resultComparison: overrides.resultComparison ?? {
        baseline: '500 horas',
        result: '350 horas',
        threshold: '20% reduccion',
        supportingEvidenceRefs: ['result-1'],
        contradictingEvidenceRefs: [],
        interpretation: 'La prueba apoya la hipotesis.',
      },
      hypothesisClassification: overrides.hypothesisClassification ?? 'supported',
      confirmedInterpretation: overrides.confirmedInterpretation ?? 'La prueba apoya la hipotesis.',
    },
    evidenceBindings: evidenceBinding,
  });
  const afterDecision = await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp34`,
    checkpointKey: 'CP-3.4',
    responses: {
      decision: overrides.decision ?? 'iterate',
      decisionDetails: overrides.decisionDetails ?? {
        rationale: 'Aprendizaje suficiente para iterar.',
        nextAction: 'Ajustar piloto.',
        owner: 'Owner comercial',
        dueDate: '2026-08-15',
        requiredApprover: 'Sponsor',
      },
      decisionEvidenceRefs: overrides.decisionEvidenceRefs ?? ['result-1'],
    },
    evidenceBindings: evidenceBinding,
  });
  if (afterDecision.activeCheckpoint?.checkpointKey === 'CP-3.5') {
    return service.confirmCheckpoint(projectId, 'u1', 'participante', {
      idempotencyKey: `${projectId}-cp35`,
      checkpointKey: 'CP-3.5',
      responses: {
        operationalReadinessChecklist: overrides.operationalReadinessChecklist ?? ['Owner futuro confirmado', 'Soporte definido', 'Rollback documentado', 'Aceptacion area receptora'],
        operationalBlockers: overrides.operationalBlockers ?? ['Sin bloqueos operativos'],
      },
    });
  }
  return afterDecision;
}

async function confirmStep3AndStartStep4(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  const state = await completeStep3(service, projectId, overrides);
  const output = state.stepOutputs.find((item: any) => item.step === 3)?.output as Record<string, unknown>;
  return service.confirmStep3Output(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-step3-confirm`,
    brief: output,
    confirmed: true,
  });
}

async function startStep4FromScratch(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await startStep3FromScratch(service, projectId, overrides);
  return confirmStep3AndStartStep4(service, projectId, overrides);
}

async function completeStep4(service: AdaptiveCoreService, projectId: string, overrides: Record<string, any> = {}) {
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp41`,
    checkpointKey: 'CP-4.1',
    responses: {
      step4TransferConfirmation: 'Transferencia Step 3 confirmada.',
      decisionAudience: overrides.decisionAudience ?? { primaryAudience: 'Comite ejecutivo', decisionMaker: 'Sponsor', secondaryAudiences: ['Challenge Owner'], deadline: '2026-08-30' },
      audienceDecisionNeeds: overrides.audienceDecisionNeeds ?? { requestedDecision: 'Aprobar siguiente horizonte', audienceNeeds: ['Evidencia', 'Riesgos'], objections: ['Carga operativa'], preferredFormat: overrides.preferredFormat ?? 'memo', requiredEvidenceRefs: ['result-1'] },
    },
  });
  const evidenceBinding = overrides.evidenceBindings ?? (await createEvidenceReferenceBinding(service, projectId)).evidenceBindings;
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp42`,
    checkpointKey: 'CP-4.2',
    responses: {
      evidenceNarrative: overrides.evidenceNarrative ?? { recommendation: 'Continuar con aprendizaje trazable.', results: 'Resultado validado.', contradictions: overrides.contradictions ?? '' },
      narrativeEvidenceRefs: overrides.narrativeEvidenceRefs ?? ['result-1'],
    },
    evidenceBindings: evidenceBinding,
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp43`,
    checkpointKey: 'CP-4.3',
    responses: {
      nextHorizonPlan: overrides.nextHorizonPlan ?? { phases: ['Fase 1'], owner: overrides.receiverOwner ?? 'Owner comercial', metrics: ['Horas de retrabajo'] },
      nextHorizonDetails: overrides.nextHorizonDetails ?? { resources: ['Equipo comercial'], milestones: ['Decision 2026-08-30'], rollback: 'Volver a proceso manual' },
    },
  });
  await service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp44`,
    checkpointKey: 'CP-4.4',
    responses: {
      decisionArtifacts: overrides.decisionArtifacts ?? [overrides.preferredFormat ?? 'memo'],
      artifactTraceability: overrides.artifactTraceability ?? { version: 1, author: 'Owner comercial', date: '2026-08-20', evidenceRefs: ['result-1'], limitations: ['Muestra pequena'] },
    },
    evidenceBindings: evidenceBinding,
  });
  return service.confirmCheckpoint(projectId, 'u1', 'participante', {
    idempotencyKey: `${projectId}-cp45`,
    checkpointKey: 'CP-4.5',
    responses: {
      transferOrClosure: overrides.transferOrClosure ?? { finalDecision: 'Cerrar con aprendizaje', owner: 'Owner comercial', nextStep: 'Documentar aprendizaje', evidenceRefs: ['result-1'], receiverOwner: overrides.receiverOwner },
      finalState: overrides.finalState ?? 'closed_with_learning',
      challengeCoverageUpdate: overrides.challengeCoverageUpdate,
    },
  });
}

const evidenceReferenceCheckpointCases = [
  {
    checkpointKey: 'CP-2.2',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep2FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp21`,
        checkpointKey: 'CP-2.1',
        responses: {
          expectedOutcome: 'Reducir retrabajo.',
          successCriteria: ['Uso semanal'],
          constraintsGuardrails: ['Sin datos productivos'],
          reversibilityLevel: 'alta',
        },
      });
    },
    responses: {
      alternatives: [{ name: 'Piloto manual', mode: 'experiment', evidenceRefs: ['crm-report'] }],
      implementationModes: ['experiment'],
      alternativeEvidenceRefs: ['crm-report'],
    },
  },
  {
    checkpointKey: 'CP-2.3',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep2FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp21`,
        checkpointKey: 'CP-2.1',
        responses: {
          expectedOutcome: 'Reducir retrabajo.',
          successCriteria: ['Uso semanal'],
          constraintsGuardrails: ['Sin datos productivos'],
          reversibilityLevel: 'alta',
        },
      });
      const binding = await createEvidenceReferenceBinding(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp22`,
        checkpointKey: 'CP-2.2',
        responses: {
          alternatives: [{ name: 'Piloto manual', mode: 'experiment', evidenceRefs: ['crm-report'] }],
          implementationModes: ['experiment'],
          alternativeEvidenceRefs: ['crm-report'],
        },
        evidenceBindings: binding.evidenceBindings,
      });
    },
    responses: {
      comparison: { valor: 'alto', factibilidad: 'media' },
      selectedBet: { primary: 'Piloto manual', justification: 'Aprendizaje rapido.', evidenceRefs: ['crm-report'] },
      selectedBetEvidenceRefs: ['crm-report'],
    },
  },
  {
    checkpointKey: 'CP-3.2',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep3FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp31`,
        checkpointKey: 'CP-3.1',
        responses: {
          step3TransferConfirmation: 'Transferencia confirmada.',
          executionReadinessChecklist: ['Owner confirmado'],
          executionDependencies: ['Plan alternativo'],
        },
      });
    },
    responses: {
      executionRecords: [{ type: 'measurement', title: 'Piloto', description: 'Resultado medido', sourceRefs: ['result-1'] }],
      executionSourceRefs: ['result-1'],
    },
  },
  {
    checkpointKey: 'CP-3.3',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep3FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp31`,
        checkpointKey: 'CP-3.1',
        responses: {
          step3TransferConfirmation: 'Transferencia confirmada.',
          executionReadinessChecklist: ['Owner confirmado'],
          executionDependencies: ['Plan alternativo'],
        },
      });
      const binding = await createEvidenceReferenceBinding(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp32`,
        checkpointKey: 'CP-3.2',
        responses: {
          executionRecords: [{ type: 'measurement', title: 'Piloto', description: 'Resultado medido', sourceRefs: ['result-1'] }],
          executionSourceRefs: ['result-1'],
        },
        evidenceBindings: binding.evidenceBindings,
      });
    },
    responses: {
      resultComparison: { baseline: '500', result: '550', threshold: '20%', contradictingEvidenceRefs: ['result-1'], interpretation: 'No alcanzo el umbral.' },
      hypothesisClassification: 'contradicted',
      confirmedInterpretation: 'No alcanzo el umbral.',
    },
  },
  {
    checkpointKey: 'CP-3.4',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep3FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp31`,
        checkpointKey: 'CP-3.1',
        responses: {
          step3TransferConfirmation: 'Transferencia confirmada.',
          executionReadinessChecklist: ['Owner confirmado'],
          executionDependencies: ['Plan alternativo'],
        },
      });
      const binding = await createEvidenceReferenceBinding(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp32`,
        checkpointKey: 'CP-3.2',
        responses: {
          executionRecords: [{ type: 'measurement', title: 'Piloto', description: 'Resultado medido', sourceRefs: ['result-1'] }],
          executionSourceRefs: ['result-1'],
        },
        evidenceBindings: binding.evidenceBindings,
      });
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp33`,
        checkpointKey: 'CP-3.3',
        responses: {
          resultComparison: { baseline: '500', result: '350', threshold: '20%', supportingEvidenceRefs: ['result-1'], interpretation: 'Supera umbral.' },
          hypothesisClassification: 'supported',
          confirmedInterpretation: 'Supera umbral.',
        },
        evidenceBindings: binding.evidenceBindings,
      });
    },
    responses: {
      decision: 'iterate',
      decisionDetails: { rationale: 'Iterar con aprendizaje.', nextAction: 'Ajustar piloto.' },
      decisionEvidenceRefs: ['result-1'],
    },
  },
  {
    checkpointKey: 'CP-4.2',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep4FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp41`,
        checkpointKey: 'CP-4.1',
        responses: {
          step4TransferConfirmation: 'Transferencia confirmada.',
          decisionAudience: { primaryAudience: 'Comite', decisionMaker: 'Sponsor' },
          audienceDecisionNeeds: { requestedDecision: 'Aprobar', audienceNeeds: ['Evidencia'], preferredFormat: 'memo' },
        },
      });
    },
    responses: {
      evidenceNarrative: { recommendation: 'Continuar.', results: 'Resultado trazable.' },
      narrativeEvidenceRefs: ['result-1'],
    },
  },
  {
    checkpointKey: 'CP-4.4',
    async prepare(service: AdaptiveCoreService, projectId: string) {
      await startStep4FromScratch(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp41`,
        checkpointKey: 'CP-4.1',
        responses: {
          step4TransferConfirmation: 'Transferencia confirmada.',
          decisionAudience: { primaryAudience: 'Comite', decisionMaker: 'Sponsor' },
          audienceDecisionNeeds: { requestedDecision: 'Aprobar', audienceNeeds: ['Evidencia'], preferredFormat: 'memo' },
        },
      });
      const binding = await createEvidenceReferenceBinding(service, projectId);
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp42`,
        checkpointKey: 'CP-4.2',
        responses: {
          evidenceNarrative: { recommendation: 'Continuar.', results: 'Resultado trazable.' },
          narrativeEvidenceRefs: ['result-1'],
        },
        evidenceBindings: binding.evidenceBindings,
      });
      await service.confirmCheckpoint(projectId, 'u1', 'participante', {
        idempotencyKey: `${projectId}-prep-cp43`,
        checkpointKey: 'CP-4.3',
        responses: {
          nextHorizonPlan: { phases: ['Fase 1'], owner: 'Owner' },
          nextHorizonDetails: { resources: ['Equipo'], milestones: ['Decision'] },
        },
      });
    },
    responses: {
      decisionArtifacts: ['memo'],
      artifactTraceability: { version: 1, author: 'Owner', date: '2026-08-20', evidenceRefs: ['result-1'] },
    },
  },
] as const;

describe('AdaptiveCoreService Step 0 cycle', () => {
  it('1. two initiatives generate different configurations', async () => {
    const store = createStore();
    const a = seedProject(store, { id: 'pa', nextRecommendedStep: 'Explorar evidencia' });
    const b = seedProject(store, { id: 'pb', nextRecommendedStep: 'Implementar handoff de solucion', initialFocus: 'adopcion' });
    const service = new AdaptiveCoreService(makePrisma(store));

    const stateA = await service.ensureInitialized(a.id, 'u1', 'participante');
    const stateB = await service.ensureInitialized(b.id, 'u1', 'participante');

    expect(stateA.masterContext.routeType).not.toBe(stateB.masterContext.routeType);
    expect(store.adaptiveCheckpointInstance.map((cp) => cp.idempotencyKey)).toEqual([
      `checkpoint_started:${a.id}:CP-0.1:1`,
      `checkpoint_started:${b.id}:CP-0.1:1`,
    ]);
  });

  it('2. company context changes questions without inventing facts', async () => {
    const store = createStore();
    const project = seedProject(store, {
      contextSnapshots: [{
        contextScore: 30,
        snapshotJson: {
          sources: [{ id: 'src-1' }],
          entries: [{ dimension: 'restriccion_datos', fieldKey: 'datos', value: 'No usar datos productivos sin autorizacion' }],
          company: { id: 'co1', name: 'Empresa' },
        },
      }],
    });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'ctx-cp01',
      checkpointKey: 'CP-0.1',
      responses: { objective: 'Mover adopcion', challengeType: 'growth' },
    });

    const cp02 = store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-0.2');
    const contextual = cp02?.materializedQuestionsJson.find((q: any) => q.source === 'company_context');
    expect(contextual.confirmationRequired).toBe(true);
    expect(contextual.required).toBe(false);
    expect(String(contextual.reason)).toMatch(/hip[oó]tesis/);
  });

  it('3. scope change creates critical change assessment without reconfiguration', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');

    await service.registerCriticalChange(project.id, 'u1', 'participante', {
      idempotencyKey: 'scope-change-1',
      field: 'scope',
      nextValue: 'Nuevo alcance',
      confirmed: true,
    });

    expect(store.criticalChange).toHaveLength(1);
    expect(store.criticalChange[0].status).toBe('assessment_ready');
    expect(store.adaptiveStepConfiguration).toHaveLength(1);
  });

  it('4. previous configuration remains active after critical change assessment', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');

    await service.registerCriticalChange(project.id, 'u1', 'participante', {
      idempotencyKey: 'scope-change-2',
      field: 'scope',
      nextValue: 'Nuevo alcance',
      confirmed: true,
    });

    expect(store.adaptiveStepConfiguration[0].status).toBe('active');
    expect(store.adaptiveStepConfiguration[0].configurationJson).toBeTruthy();
    expect(store.initiativeCycle).toHaveLength(1);
  });

  it('5. cannot close Step 0 without confirmed Brief', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');

    await expect(service.confirmStep0Brief(project.id, 'u1', 'participante', {
      idempotencyKey: 'brief-nope',
      brief: {},
      confirmed: false,
    })).rejects.toMatchObject({ code: 'BRIEF_CONFIRMATION_REQUIRED' });
  });

  it('6. confirming Step 0 configures Step 1', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const state = await completeStep0(service, project.id);
    const draft = state.stepOutputs.find((output: any) => output.step === 0);

    const final = await service.confirmStep0Brief(project.id, 'u1', 'participante', {
      idempotencyKey: 'brief-ok',
      brief: draft?.output as Record<string, unknown>,
      confirmed: true,
    });

    expect(final.stepConfigurations.some((config: any) => config.step === 1)).toBe(true);
    expect(final.activeCheckpoint?.checkpointKey).toBe('CP-1.1');
  });

  it('7. Portfolio Lead receives an event and updated signal', async () => {
    const store = createStore();
    const project = seedProject(store, {
      portfolioMeta: [{ id: 'meta-1', projectId: 'p-port', challengeId: 'ch1', strategicFrontId: 'f1', status: 'en_step_0' }],
      id: 'p-port',
    });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'port-cp01',
      checkpointKey: 'CP-0.1',
      responses: { objective: 'Mover adopcion', challengeType: 'growth' },
    });

    expect(store.adaptiveAdaptationEvent.some((event) => event.eventType === 'checkpoint_completed')).toBe(true);
    expect(store.adaptiveProgressSignal[0].signalJson.checkpointCode).toBe('CP-0.2');
    expect(store.initiativePortfolioMeta[0].nextActionRecommended).toContain('CP-0.2');
  });

  it('8. idempotent operations tolerate double click', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const input = { idempotencyKey: 'same-click', checkpointKey: 'CP-0.1', responses: { objective: 'Mover adopcion' } };

    await service.confirmCheckpoint(project.id, 'u1', 'participante', input);
    await service.confirmCheckpoint(project.id, 'u1', 'participante', input);

    expect(store.adaptiveCheckpointResponse.filter((r) => r.idempotencyKey === 'same-click')).toHaveLength(1);
  });

  it('8a. CP-1.3 complete structurally without truth binding does not persist progression', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const beforeResponses = store.adaptiveCheckpointResponse.length;

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-no-binding',
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
    })).rejects.toMatchObject({ code: 'CHECKPOINT_TRUTH_BINDING_REQUIRED' });

    expect(store.adaptiveCheckpointResponse).toHaveLength(beforeResponses);
    expect(store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-1.3')?.status).toBe('ready');
    expect(store.adaptiveCheckpointInstance.some((cp) => cp.checkpointKey === 'CP-1.4')).toBe(false);
  });

  it('8b. CP-1.3 local supports classification with fake sourceRef string fails', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-fake-source',
      checkpointKey: 'CP-1.3',
      responses: {
        ...cp13Responses(),
        truthBindings: { claimId: 'crm-report', evidenceIds: ['crm-report'], sourceRefIds: ['crm-report'] },
      },
    })).rejects.toMatchObject({ code: 'TRUTH_CLAIM_NOT_FOUND' });
  });

  it('8c. CP-1.3 synthetic evidence-1 cannot satisfy validated readiness', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-synthetic',
      checkpointKey: 'CP-1.3',
      responses: {
        ...cp13Responses({ evidenceItems: [{ summary: 'Texto sin id persistente', classification: 'supports' }], sourceRefs: ['evidence-1'] }),
        truthBindings: { claimId: 'evidence-1', evidenceIds: ['evidence-1'], sourceRefIds: ['evidence-1'] },
      },
    })).rejects.toMatchObject({ code: 'TRUTH_CLAIM_NOT_FOUND' });
  });

  it('8d. CP-1.3 cross-project Claim/Evidence/SourceRef IDs are rejected', async () => {
    const store = createStore();
    const project = seedProject(store, { id: 'local-project' });
    const other = seedProject(store, { id: 'other-project' });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const otherBinding = await createTruthBinding(service, other.id);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-cross-project',
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
      truthBindings: otherBinding.truthBindings,
    })).rejects.toMatchObject({ code: 'TRUTH_CLAIM_NOT_FOUND' });
  });

  it.each([
    ['unvalidated', 'CHECKPOINT_CLAIM_UNVALIDATED'],
    ['contradicted', 'CHECKPOINT_CLAIM_CONTRADICTED'],
    ['insufficient', 'CHECKPOINT_CLAIM_INSUFFICIENT'],
  ] as const)('8e. CP-1.3 %s claim blocks progression', async (state, code) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const binding = await createTruthBinding(service, project.id, state);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `cp13-${state}`,
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
      truthBindings: binding.truthBindings,
    })).rejects.toMatchObject({ code });

    expect(store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-1.3')?.status).toBe('ready');
    expect(store.adaptiveCheckpointInstance.some((cp) => cp.checkpointKey === 'CP-1.4')).toBe(false);
  });

  it('8f. CP-1.3 supported Claim with coherent Evidence and SourceRef completes', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const binding = await createTruthBinding(service, project.id, 'supported');

    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-supported',
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
      truthBindings: binding.truthBindings,
    });

    expect(store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-1.3')?.status).toBe('completed');
    expect(state.activeCheckpoint?.checkpointKey).toBe('CP-1.4');
  });

  it('8g. supported Step 1 draft preserves Truth provenance from CP-1.3', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const binding = await createTruthBinding(service, project.id, 'supported');
    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-supported-draft',
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
      truthBindings: binding.truthBindings,
    });

    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp14-supported-draft',
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'La evidencia validada soporta continuar.',
        updatedFocusAndHypothesis: 'Reducir retrabajo comercial con visibilidad temprana.',
        continuityDecision: 'mantener',
      },
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.truthReadiness).toMatchObject({
      claimId: binding.truthBindings.claimId,
      verificationState: 'supported',
      satisfiesValidatedSupport: true,
      evidenceIds: binding.truthBindings.evidenceIds,
      sourceRefIds: binding.truthBindings.sourceRefIds,
    });
    expect(output.methodologicalSufficiency).toBe('sufficient');
    expect(output.sufficiency).toBe('sufficient');
  });

  it.each([
    ['contradicted', 'contradicted'],
    ['insufficient', 'insufficient'],
  ] as const)('8h. historical CP-1.4 synthesis cannot promote %s Truth readiness to sufficient', async (truthState, expectedState) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await seedHistoricalCp13AndActivateCp14(service, store, project.id, truthState, {
      evidenceClassifications: ['supports'],
    });

    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `cp14-historical-${truthState}`,
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'La clasificacion local dice supports, pero Truth no esta supported.',
        updatedFocusAndHypothesis: 'Continuar para aprender mas.',
        continuityDecision: 'continuar_para_obtener_mas_evidencia',
      },
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.truthReadiness).toMatchObject({
      verificationState: expectedState,
      satisfiesValidatedSupport: false,
    });
    expect(output.methodologicalSufficiency).toBe('sufficient');
    expect(output.sufficiency).toBe('partial');
  });

  it('8i. local supports classification cannot spoof persisted Truth readiness', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await seedHistoricalCp13AndActivateCp14(service, store, project.id, 'insufficient', {
      evidenceClassifications: ['supports'],
      evidenceItems: [{ id: 'ev-local-support', summary: 'Texto optimista', classification: 'supports', sourceRefs: ['fake-local'] }],
      sourceRefs: ['fake-local'],
    });

    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp14-local-spoof',
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'Supports local no debe cambiar Truth.',
        updatedFocusAndHypothesis: 'Continuar validando.',
        continuityDecision: 'continuar_para_obtener_mas_evidencia',
      },
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.truthReadiness.verificationState).toBe('insufficient');
    expect(output.sufficiency).toBe('partial');
  });

  it('8j. confirmStep1Output preserves draft Truth readiness over edited brief spoofing', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await seedHistoricalCp13AndActivateCp14(service, store, project.id, 'insufficient');
    const draftState = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp14-draft-protection',
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'Falta evidencia suficiente.',
        updatedFocusAndHypothesis: 'Continuar validando.',
        continuityDecision: 'continuar_para_obtener_mas_evidencia',
      },
    });
    const draft = draftState.stepOutputs.find((item: any) => item.step === 1) as any;

    const confirmed = await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-confirm-spoof',
      brief: {
        ...draft.output,
        truthReadiness: { verificationState: 'supported', satisfiesValidatedSupport: true, claimId: 'fake' },
        sufficiency: 'sufficient',
      },
      confirmed: true,
    });
    const output = confirmed.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.truthReadiness.verificationState).toBe('insufficient');
    expect(output.truthReadiness.satisfiesValidatedSupport).toBe(false);
    expect(output.sufficiency).toBe('partial');
  });

  it('8k. confirmed Step 1 transfers Truth provenance to Step 2 context and materializes CP-2.1 once', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const binding = await createTruthBinding(service, project.id, 'supported');
    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-transfer-supported',
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
      truthBindings: binding.truthBindings,
    });
    const draftState = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp14-transfer-supported',
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'La evidencia validada soporta continuar.',
        updatedFocusAndHypothesis: 'Reducir retrabajo comercial con visibilidad temprana.',
        continuityDecision: 'mantener',
      },
    });
    const draft = draftState.stepOutputs.find((item: any) => item.step === 1) as any;

    await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-transfer-supported',
      brief: draft.output,
      confirmed: true,
    });
    await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-transfer-supported',
      brief: { ...draft.output, truthReadiness: { verificationState: 'supported', satisfiesValidatedSupport: true, claimId: 'spoof' } },
      confirmed: true,
    });

    const step2Config = store.adaptiveStepConfiguration.find((config) => config.projectId === project.id && config.stepNumber === 2);
    expect(step2Config?.sourceContextJson.step1Output.truthReadiness).toMatchObject({
      claimId: binding.truthBindings.claimId,
      verificationState: 'supported',
      satisfiesValidatedSupport: true,
      evidenceIds: binding.truthBindings.evidenceIds,
      sourceRefIds: binding.truthBindings.sourceRefIds,
    });
    expect(step2Config?.sourceContextJson.step2Transfer.truthReadiness).toMatchObject({
      claimId: binding.truthBindings.claimId,
      satisfiesValidatedSupport: true,
    });
    expect(store.adaptiveStepConfiguration.filter((config) => config.stepNumber === 2)).toHaveLength(1);
    expect(store.adaptiveCheckpointInstance.filter((cp) => cp.checkpointKey === 'CP-2.1')).toHaveLength(1);
    expect(store.adaptiveAdaptationEvent.filter((event) => event.eventType === 'next_step_configured' && event.payloadJson?.step === 2)).toHaveLength(1);
  });

  it('8l. Step 1 Truth provenance is resolved by CP-1.3 identity, not evidenceItems shape', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const cp12 = store.adaptiveCheckpointResponse.find((response) => response.checkpointKey === 'CP-1.2');
    const spoof = await createTruthBinding(service, project.id, 'supported', { statement: 'Spoof CP-1.2' });
    cp12.responseJson = {
      ...cp12.responseJson,
      evidenceItems: [{ summary: 'CP-1.2 no debe ser fuente de Truth Step1Output' }],
      truthBindings: spoof.truthBindings,
    };
    const cp13Binding = await createTruthBinding(service, project.id, 'supported', { statement: 'Real CP-1.3' });
    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-identity-real',
      checkpointKey: 'CP-1.3',
      responses: cp13Responses(),
      truthBindings: cp13Binding.truthBindings,
    });

    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp14-identity-real',
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'Usa CP-1.3 real.',
        updatedFocusAndHypothesis: 'Foco real.',
        continuityDecision: 'mantener',
      },
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.truthReadiness.claimId).toBe(cp13Binding.truthBindings.claimId);
    expect(output.truthReadiness.claimId).not.toBe(spoof.truthBindings.claimId);
  });

  it('8m. CP-1.3 without persisted truthBindings produces explicit missing Truth readiness', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const cp13 = store.adaptiveCheckpointInstance.find((cp) => cp.projectId === project.id && cp.checkpointKey === 'CP-1.3');
    const config = store.adaptiveStepConfiguration.find((item) => item.id === cp13?.stepConfigurationId);
    cp13.status = 'completed';
    store.adaptiveCheckpointResponse.push({
      id: id('adaptiveCheckpointResponse'),
      projectId: project.id,
      checkpointInstanceId: cp13.id,
      checkpointKey: 'CP-1.3',
      responseJson: cp13Responses(),
      answeredById: 'u1',
      idempotencyKey: 'legacy-cp13-no-truth',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    store.adaptiveCheckpointInstance.push({
      id: id('adaptiveCheckpointInstance'),
      projectId: project.id,
      stepConfigurationId: config.id,
      stepConfiguration: config,
      stepNumber: 1,
      checkpointKey: 'CP-1.4',
      sequence: 4,
      status: 'ready',
      materializedQuestionsJson: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp14-missing-truth',
      checkpointKey: 'CP-1.4',
      responses: {
        synthesis: 'Legacy sin Truth binding.',
        updatedFocusAndHypothesis: 'Continuar validando.',
        continuityDecision: 'continuar_para_obtener_mas_evidencia',
      },
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.truthReadiness).toEqual({
      verificationState: 'missing',
      satisfiesValidatedSupport: false,
      claimId: null,
      evidenceIds: [],
      sourceRefIds: [],
    });
    expect(output.sufficiency).toBe('partial');
  });

  it.each([
    ['legacy missing Truth', null],
    ['insufficient Truth', { verificationState: 'insufficient', satisfiesValidatedSupport: false }],
    ['contradicted Truth', { verificationState: 'contradicted', satisfiesValidatedSupport: false }],
  ] as const)('8n. confirmStep1Output cannot elevate %s draft sufficiency', async (_label, truthReadiness) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const step1Config = await (service as any).prisma.adaptiveStepConfiguration.create({
      data: {
        projectId: project.id,
        stepNumber: 1,
        version: 1,
        status: 'active',
        routeType: 'explore_validate',
        depthLevel: 'standard',
        maturity: 'problem',
        configurationJson: {},
        sourceContextJson: {},
      },
    });
    await (service as any).prisma.adaptiveStepOutput.create({
      data: {
        projectId: project.id,
        stepNumber: 1,
        version: 1,
        sourceConfigurationId: step1Config.id,
        outputKey: 'ProblemFocusBrief',
        status: 'draft',
        outputJson: {
          outputKey: 'ProblemFocusBrief',
          updatedFocus: 'Foco',
          hypothesisForStep2: 'Hipotesis',
          evidenceSummary: 'Resumen',
          futureDecision: 'Decision',
          actorRequired: 'Owner',
          methodologicalSufficiency: 'sufficient',
          sufficiency: 'sufficient',
          ...(truthReadiness ? { truthReadiness } : {}),
        },
      },
    });

    const state = await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: `step1-confirm-${_label.replace(/\s+/g, '-')}`,
      brief: { sufficiency: 'sufficient', truthReadiness: { verificationState: 'supported', satisfiesValidatedSupport: true } },
      confirmed: true,
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.methodologicalSufficiency).toBe('sufficient');
    expect(output.sufficiency).toBe('partial');
  });

  it('8o. confirmStep1Output preserves sufficient for supported Truth and methodological sufficient draft', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    const step1Config = await (service as any).prisma.adaptiveStepConfiguration.create({
      data: {
        projectId: project.id,
        stepNumber: 1,
        version: 1,
        status: 'active',
        routeType: 'explore_validate',
        depthLevel: 'standard',
        maturity: 'problem',
        configurationJson: {},
        sourceContextJson: {},
      },
    });
    await (service as any).prisma.adaptiveStepOutput.create({
      data: {
        projectId: project.id,
        stepNumber: 1,
        version: 1,
        sourceConfigurationId: step1Config.id,
        outputKey: 'ProblemFocusBrief',
        status: 'draft',
        outputJson: {
          outputKey: 'ProblemFocusBrief',
          updatedFocus: 'Foco',
          hypothesisForStep2: 'Hipotesis',
          evidenceSummary: 'Resumen',
          futureDecision: 'Decision',
          actorRequired: 'Owner',
          methodologicalSufficiency: 'sufficient',
          sufficiency: 'sufficient',
          truthReadiness: { verificationState: 'supported', satisfiesValidatedSupport: true, claimId: 'claim', evidenceIds: ['ev'], sourceRefIds: ['src'] },
        },
      },
    });

    const state = await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-confirm-supported-sufficient',
      brief: { sufficiency: 'partial' },
      confirmed: true,
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.sufficiency).toBe('sufficient');
  });

  it('8p. CP-1.3 responseJson persists canonical truthBindings only', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await prepareCp13(service, project.id);
    const binding = await createTruthBinding(service, project.id, 'supported');

    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-canonical-binding',
      checkpointKey: 'CP-1.3',
      responses: {
        ...cp13Responses(),
        truthBinding: { claimId: 'legacy-alias', evidenceIds: ['legacy-ev'], sourceRefIds: ['legacy-src'] },
      },
      truthBindings: binding.truthBindings,
    });
    const response = store.adaptiveCheckpointResponse.find((item) => item.idempotencyKey === 'cp13-canonical-binding')?.responseJson;

    expect(response.truthBindings).toEqual(binding.truthBindings);
    expect(response.truthBinding).toBeUndefined();

    const legacyStore = createStore();
    const legacyProject = seedProject(legacyStore);
    const legacyService = new AdaptiveCoreService(makePrisma(legacyStore));
    await legacyService.ensureInitialized(legacyProject.id, 'u1', 'participante');
    await prepareCp13(legacyService, legacyProject.id);
    const legacyBinding = await createTruthBinding(legacyService, legacyProject.id, 'supported');

    await legacyService.confirmCheckpoint(legacyProject.id, 'u1', 'participante', {
      idempotencyKey: 'cp13-legacy-alias-binding',
      checkpointKey: 'CP-1.3',
      responses: {
        ...cp13Responses(),
        truthBinding: legacyBinding.truthBindings,
      },
    });
    const legacyResponse = legacyStore.adaptiveCheckpointResponse.find((item) => item.idempotencyKey === 'cp13-legacy-alias-binding')?.responseJson;

    expect(legacyResponse.truthBindings).toEqual(legacyBinding.truthBindings);
    expect(legacyResponse.truthBinding).toBeUndefined();
  });

  it.each(evidenceReferenceCheckpointCases)('$checkpointKey rejects descriptive strings as persistent evidence references', async ({ checkpointKey, prepare, responses }) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await prepare(service, project.id);
    const beforeResponses = store.adaptiveCheckpointResponse.length;
    const beforeNext = store.adaptiveCheckpointInstance.length;

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-${checkpointKey}-fake-refs`,
      checkpointKey,
      responses: {
        ...responses,
        evidenceBindings: { evidenceIds: ['evidence-1'], sourceRefIds: ['crm-report'] },
      },
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });

    const instance = store.adaptiveCheckpointInstance.find((cp) => cp.projectId === project.id && cp.checkpointKey === checkpointKey);
    expect(store.adaptiveCheckpointResponse).toHaveLength(beforeResponses);
    expect(instance?.status).toBe('ready');
    expect(store.adaptiveCheckpointInstance).toHaveLength(beforeNext);
  });

  it.each(evidenceReferenceCheckpointCases)('$checkpointKey rejects missing Evidence IDs', async ({ checkpointKey, prepare, responses }) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await prepare(service, project.id);
    const binding = await createEvidenceReferenceBinding(service, project.id);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-${checkpointKey}-missing-evidence`,
      checkpointKey,
      responses,
      evidenceBindings: { evidenceIds: ['missing-evidence-id'], sourceRefIds: binding.evidenceBindings.sourceRefIds },
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });
  });

  it.each(evidenceReferenceCheckpointCases)('$checkpointKey rejects missing SourceRef IDs', async ({ checkpointKey, prepare, responses }) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await prepare(service, project.id);
    const binding = await createEvidenceReferenceBinding(service, project.id);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-${checkpointKey}-missing-source`,
      checkpointKey,
      responses,
      evidenceBindings: { evidenceIds: binding.evidenceBindings.evidenceIds, sourceRefIds: ['missing-source-id'] },
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_SOURCE_REF_NOT_FOUND' });
  });

  it.each(evidenceReferenceCheckpointCases)('$checkpointKey rejects cross-project Evidence or SourceRef IDs', async ({ checkpointKey, prepare, responses }) => {
    const store = createStore();
    const project = seedProject(store);
    const other = seedProject(store, { id: `${project.id}-other` });
    const service = new AdaptiveCoreService(makePrisma(store));
    await prepare(service, project.id);
    const otherBinding = await createEvidenceReferenceBinding(service, other.id);

    await expect(service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-${checkpointKey}-cross-project`,
      checkpointKey,
      responses,
      evidenceBindings: otherBinding.evidenceBindings,
    })).rejects.toMatchObject({ code: 'TRUTH_REFERENCE_EVIDENCE_NOT_FOUND' });
  });

  it.each(evidenceReferenceCheckpointCases)('$checkpointKey accepts coherent persistent Evidence and SourceRef IDs', async ({ checkpointKey, prepare, responses }) => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await prepare(service, project.id);
    const binding = await createEvidenceReferenceBinding(service, project.id);

    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-${checkpointKey}-valid-evidence-ref`,
      checkpointKey,
      responses,
      evidenceBindings: binding.evidenceBindings,
    });
    const response = store.adaptiveCheckpointResponse.find((item) => item.idempotencyKey === `${project.id}-${checkpointKey}-valid-evidence-ref`);

    expect(response?.responseJson.evidenceBindings).toEqual(binding.evidenceBindings);
    expect(store.adaptiveCheckpointInstance.find((cp) => cp.projectId === project.id && cp.checkpointKey === checkpointKey)?.status).toBe('completed');
  });

  it('CP-3.3 permits contradicted or insufficient results when persistent evidence references are valid', async () => {
    for (const classification of ['contradicted', 'insufficient'] as const) {
      const store = createStore();
      const project = seedProject(store);
      const service = new AdaptiveCoreService(makePrisma(store));
      const cp33 = evidenceReferenceCheckpointCases.find((item) => item.checkpointKey === 'CP-3.3');
      await cp33.prepare(service, project.id);
      const binding = await createEvidenceReferenceBinding(service, project.id, { truthState: classification });

      await service.confirmCheckpoint(project.id, 'u1', 'participante', {
        idempotencyKey: `${project.id}-cp33-${classification}`,
        checkpointKey: 'CP-3.3',
        responses: {
          resultComparison: {
            baseline: '500',
            result: classification === 'contradicted' ? '550' : '490',
            threshold: '20%',
            contradictingEvidenceRefs: classification === 'contradicted' ? ['result-1'] : [],
            supportingEvidenceRefs: [],
            interpretation: classification === 'contradicted' ? 'Contradice la hipotesis.' : 'La evidencia no alcanza.',
          },
          hypothesisClassification: classification,
          confirmedInterpretation: classification === 'contradicted' ? 'Contradice la hipotesis.' : 'La evidencia no alcanza.',
        },
        evidenceBindings: binding.evidenceBindings,
      });

      expect(store.adaptiveCheckpointInstance.find((cp) => cp.projectId === project.id && cp.checkpointKey === 'CP-3.3')?.status).toBe('completed');
    }
  });

  it('structural-only Step 2, 3 and 4 checkpoints still work without evidenceBindings', async () => {
    const step2Store = createStore();
    const step2Project = seedProject(step2Store);
    const step2Service = new AdaptiveCoreService(makePrisma(step2Store));
    await startStep2FromScratch(step2Service, step2Project.id);

    await step2Service.confirmCheckpoint(step2Project.id, 'u1', 'participante', {
      idempotencyKey: `${step2Project.id}-structural-cp21`,
      checkpointKey: 'CP-2.1',
      responses: {
        expectedOutcome: 'Reducir retrabajo.',
        successCriteria: ['Uso semanal'],
        constraintsGuardrails: ['Sin datos productivos'],
        reversibilityLevel: 'alta',
      },
    });
    expect(step2Store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-2.1')?.status).toBe('completed');

    const step3Store = createStore();
    const step3Project = seedProject(step3Store);
    const step3Service = new AdaptiveCoreService(makePrisma(step3Store));
    await startStep3FromScratch(step3Service, step3Project.id, { evidenceBindings: (await createEvidenceReferenceBinding(step3Service, step3Project.id)).evidenceBindings });
    await step3Service.confirmCheckpoint(step3Project.id, 'u1', 'participante', {
      idempotencyKey: `${step3Project.id}-structural-cp31`,
      checkpointKey: 'CP-3.1',
      responses: {
        step3TransferConfirmation: 'Transferencia Step 2 confirmada.',
        executionReadinessChecklist: ['Owner confirmado'],
        executionDependencies: ['Plan alternativo'],
      },
    });
    expect(step3Store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-3.1')?.status).toBe('completed');

    const step4Store = createStore();
    const step4Project = seedProject(step4Store);
    const step4Service = new AdaptiveCoreService(makePrisma(step4Store));
    await startStep4FromScratch(step4Service, step4Project.id, { evidenceBindings: (await createEvidenceReferenceBinding(step4Service, step4Project.id)).evidenceBindings });
    await step4Service.confirmCheckpoint(step4Project.id, 'u1', 'participante', {
      idempotencyKey: `${step4Project.id}-structural-cp41`,
      checkpointKey: 'CP-4.1',
      responses: {
        step4TransferConfirmation: 'Transferencia Step 3 confirmada.',
        decisionAudience: { primaryAudience: 'Comite ejecutivo', decisionMaker: 'Sponsor' },
        audienceDecisionNeeds: { requestedDecision: 'Aprobar siguiente horizonte', audienceNeeds: ['Evidencia'], preferredFormat: 'memo' },
      },
    });
    expect(step4Store.adaptiveCheckpointInstance.find((cp) => cp.checkpointKey === 'CP-4.1')?.status).toBe('completed');
  });

  it('evidence-reference checkpoints keep idempotency without duplicating responses or next checkpoint', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    const cp22 = evidenceReferenceCheckpointCases.find((item) => item.checkpointKey === 'CP-2.2');
    await cp22.prepare(service, project.id);
    const binding = await createEvidenceReferenceBinding(service, project.id);
    const input = {
      idempotencyKey: `${project.id}-cp22-idempotent`,
      checkpointKey: 'CP-2.2',
      responses: cp22.responses,
      evidenceBindings: binding.evidenceBindings,
    };

    await service.confirmCheckpoint(project.id, 'u1', 'participante', input);
    const responsesAfterFirst = store.adaptiveCheckpointResponse.length;
    const instancesAfterFirst = store.adaptiveCheckpointInstance.length;
    await service.confirmCheckpoint(project.id, 'u1', 'participante', input);

    expect(store.adaptiveCheckpointResponse).toHaveLength(responsesAfterFirst);
    expect(store.adaptiveCheckpointInstance).toHaveLength(instancesAfterFirst);
  });

  it('9. frontend and backend do not diverge on active checkpoint', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    const state = await service.ensureInitialized(project.id, 'u1', 'participante');

    expect(state.activeCheckpoint?.checkpointKey).toBe('CP-0.1');
    expect(state.checkpointInstances.filter((cp: any) => cp.status === 'ready')).toHaveLength(1);
  });

  it('10. legacy data still loads', async () => {
    const store = createStore();
    const project = seedProject(store, { step0Data: { quePasaQueQuieres: 'Legacy text', pendingQuestions: [] } });
    const service = new AdaptiveCoreService(makePrisma(store));
    const state = await service.ensureInitialized(project.id, 'u1', 'participante');

    expect(state.schemaVersion).toBe('PRD-03-v0.4');
    expect(state.activeCheckpoint?.checkpointKey).toBe('CP-0.1');
  });

  it('11. Step 1 receives confirmed output from Step 0', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');

    const state = await confirmStep0AndStartStep1(service, project.id);

    const step1Config = state.stepConfigurations.find((config: any) => config.step === 1);
    expect(step1Config?.transferredFromStep0).toMatchObject({ priorityHypothesis: 'Si simplificamos el tablero, sube el uso.' });
  });

  it('12. two hypotheses generate different evidence plans', async () => {
    const store = createStore();
    const projectA = seedProject(store, { id: 'plan-a' });
    const projectB = seedProject(store, { id: 'plan-b', nextRecommendedStep: 'Implementar handoff de adopcion', initialFocus: 'adopcion' });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(projectA.id, 'u1', 'participante');
    await service.ensureInitialized(projectB.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, projectA.id);
    await confirmStep0AndStartStep1(service, projectB.id);

    const stateA = await completeStep1(service, projectA.id, { mainHypothesis: 'Clientes compran si validamos dolor.' });
    const stateB = await completeStep1(service, projectB.id, { mainHypothesis: 'Usuarios adoptan si el handoff es simple.' });

    const methodsA = (stateA.stepOutputs.find((output: any) => output.step === 1)?.output as any).evidencePlan.suggestedMethods;
    const methodsB = (stateB.stepOutputs.find((output: any) => output.step === 1)?.output as any).evidencePlan.suggestedMethods;
    expect(methodsA).not.toEqual(methodsB);
  });

  it('13. company context modifies Step 1 methods without inventing facts', async () => {
    const store = createStore();
    const project = seedProject(store, {
      contextSnapshots: [{
        contextScore: 35,
        snapshotJson: {
          sources: [{ id: 'policy-src' }],
          entries: [{ dimension: 'restriccion_datos', fieldKey: 'datos', value: 'Validar acceso a datos' }],
          company: { id: 'co1', name: 'Empresa' },
        },
      }],
    });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    const state = await completeStep1(service, project.id);
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.evidencePlan.suggestedMethods).toContain('policy and data-access check');
    expect(output.evidencePlan.companyInfluences[0]).toMatchObject({
      source: 'CompanyContextSnapshot',
      coverageLevel: 'low',
      confirmationStatus: 'needs_confirmation',
    });
  });

  it('14. evidence keeps sourceRefs and contradictions affect synthesis', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);

    const state = await completeStep1(service, project.id, {
      evidenceItems: [
        { id: 'ev-1', summary: 'Usuarios reportan retrabajo', classification: 'supports', sourceRefs: ['interview-1'] },
        { id: 'ev-2', summary: 'Metrica no muestra retraso', classification: 'contradicts', sourceRefs: ['metric-1'] },
      ],
      evidenceClassifications: ['supports', 'contradicts'],
      sourceRefs: ['interview-1', 'metric-1'],
    });
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as any;

    expect(output.evidenceMap.items[0].sourceRefs).toEqual(['interview-1']);
    expect(output.sufficiency).toBe('partial');
    expect(output.contradictions).toContain('Metrica no muestra retraso');
  });

  it('15. Step 1 does not close without confirmed output and confirming creates Step 2 once', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    const state = await completeStep1(service, project.id);
    const output = state.stepOutputs.find((item: any) => item.step === 1)?.output as Record<string, unknown>;

    expect(store.project[0].currentStep).not.toBe(2);
    await expect(service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-nope',
      brief: output,
      confirmed: false,
    })).rejects.toMatchObject({ code: 'STEP1_CONFIRMATION_REQUIRED' });

    await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-ok',
      brief: output,
      confirmed: true,
    });
    await service.confirmStep1Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step1-ok',
      brief: output,
      confirmed: true,
    });

    expect(store.project[0].currentStep).toBe(2);
    expect(store.adaptiveStepConfiguration.filter((config) => config.stepNumber === 2)).toHaveLength(1);
    expect(store.adaptiveCheckpointInstance.filter((cp) => cp.checkpointKey === 'CP-2.1')).toHaveLength(1);
    expect(store.adaptiveProgressSignal[0].signalJson.step).toBe(2);
  });

  it('16. Step 2 receives confirmed Step 1 output and route-specific output', async () => {
    const store = createStore();
    const project = seedProject(store, { nextRecommendedStep: 'Disenar solucion propuesta', initialFocus: 'solucion' });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);

    const state = await confirmStep1AndStartStep2(service, project.id);
    const step2Config = state.stepConfigurations.find((config: any) => config.step === 2);

    expect(step2Config?.transferredFromStep1).toBeTruthy();
    expect(step2Config?.expectedOutput).toBe('PilotCard');
    expect(state.activeCheckpoint?.checkpointKey).toBe('CP-2.1');
  });

  it('17. prescribed solution does not force 10 alternatives and preserves evidenceRefs', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);

    const state = await completeStep2(service, project.id, {
      alternatives: [{ name: 'Solucion prescrita por sponsor', mode: 'build', prescribed: true, evidenceRefs: ['sponsor-note'] }],
      alternativeEvidenceRefs: ['sponsor-note'],
      selectedBet: { primary: 'Solucion prescrita por sponsor', backup: 'No hacer nada', justification: 'Sponsor ya definio solucion a comparar.', evidenceRefs: ['sponsor-note'] },
      selectedBetEvidenceRefs: ['sponsor-note'],
    });
    const output = state.stepOutputs.find((item: any) => item.step === 2)?.output as any;

    expect(output.alternativeSet.alternatives).toHaveLength(1);
    expect(output.alternativeSet.generationRule).toContain('not_fixed_count');
    expect(output.alternativeSet.alternatives[0].evidenceRefs).toEqual(['sponsor-note']);
    expect(output.selectedBet.justification).toContain('Sponsor');
  });

  it('18. company context modifies criteria and readiness only activates when needed', async () => {
    const store = createStore();
    const quick = seedProject(store, { id: 'quick' });
    const complex = seedProject(store, {
      id: 'complex',
      nextRecommendedStep: 'Implementar handoff de adopcion',
      initialFocus: 'adopcion',
      contextSnapshots: [{
        contextScore: 80,
        snapshotJson: {
          sources: [{ id: 'security-policy' }],
          entries: [{ dimension: 'restriccion_seguridad', fieldKey: 'security', value: 'Requiere aprobacion seguridad' }],
          company: { id: 'co1', name: 'Empresa' },
        },
      }],
    });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(quick.id, 'u1', 'participante');
    await service.ensureInitialized(complex.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, quick.id);
    await confirmStep0AndStartStep1(service, complex.id);
    await confirmStep1AndStartStep2(service, quick.id);
    await confirmStep1AndStartStep2(service, complex.id);

    const quickConfig = store.adaptiveStepConfiguration.find((config) => config.projectId === 'quick' && config.stepNumber === 2);
    const complexConfig = store.adaptiveStepConfiguration.find((config) => config.projectId === 'complex' && config.stepNumber === 2);
    const complexState = await completeStep2(service, complex.id);
    const output = complexState.stepOutputs.find((item: any) => item.step === 2)?.output as any;

    expect(quickConfig.configurationJson.checkpoints.map((cp: any) => cp.code)).not.toContain('CP-2.5');
    expect(complexConfig.configurationJson.checkpoints.map((cp: any) => cp.code)).toContain('CP-2.5');
    expect(output.designCriteria.companyInfluences[0]).toMatchObject({ source: 'CompanyContextSnapshot', coverageLevel: 'high' });
    expect(output.readiness.required).toBe(true);
  });

  it('19. Step 2 does not close without confirmation and confirmation creates Step 3 once', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    const state = await completeStep2(service, project.id);
    const output = state.stepOutputs.find((item: any) => item.step === 2)?.output as Record<string, unknown>;

    expect(store.project[0].currentStep).toBe(2);
    await expect(service.confirmStep2Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step2-nope',
      brief: output,
      confirmed: false,
    })).rejects.toMatchObject({ code: 'STEP2_CONFIRMATION_REQUIRED' });

    await service.confirmStep2Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step2-ok',
      brief: output,
      confirmed: true,
    });
    await service.confirmStep2Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step2-ok',
      brief: output,
      confirmed: true,
    });

    expect(store.project[0].currentStep).toBe(3);
    expect(store.adaptiveStepConfiguration.filter((config) => config.stepNumber === 3)).toHaveLength(1);
    expect(store.adaptiveCheckpointInstance.filter((cp) => cp.checkpointKey === 'CP-3.1')).toHaveLength(1);
    expect(store.adaptiveProgressSignal[0].signalJson.step).toBe(3);
  });

  it('20. changing selected bet creates assessment without a new Step 2 version', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);

    await service.registerCriticalChange(project.id, 'u1', 'participante', {
      idempotencyKey: 'bet-change-1',
      field: 'selected_bet',
      previousValue: 'Prototipo manual',
      nextValue: 'Piloto asistido',
      reason: 'Nueva evidencia reduce factibilidad de la opcion original.',
      confirmed: true,
      action: 'update_route',
    });

    const step2Configs = store.adaptiveStepConfiguration.filter((config) => config.stepNumber === 2);
    expect(step2Configs.map((config) => config.version)).toEqual([1]);
    expect(step2Configs[0].status).toBe('active');
    expect(store.criticalChange).toHaveLength(1);
    expect(store.criticalChange[0].status).toBe('assessment_ready');
  });

  it('21. Step 3 receives confirmed Step 2 output', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);

    const state = await confirmStep2AndStartStep3(service, project.id);
    const step3Config = state.stepConfigurations.find((config: any) => config.step === 3) as any;

    expect(step3Config?.transferredFromStep2?.selectedBet?.primary).toBe('Prototipo manual');
    expect(step3Config?.checkpoints.map((cp: any) => cp.code)).toContain('CP-3.1');
    expect(state.activeCheckpoint?.checkpointKey).toBe('CP-3.1');
  });

  it('22. quick win does not activate CP-3.5 and scaling does', async () => {
    const store = createStore();
    const quick = seedProject(store, { id: 'quick-step3' });
    const scale = seedProject(store, { id: 'scale-step3', nextRecommendedStep: 'Implementar handoff de adopcion', initialFocus: 'adopcion' });
    const service = new AdaptiveCoreService(makePrisma(store));
    for (const project of [quick, scale]) {
      await service.ensureInitialized(project.id, 'u1', 'participante');
      await confirmStep0AndStartStep1(service, project.id);
      await confirmStep1AndStartStep2(service, project.id);
      await confirmStep2AndStartStep3(service, project.id);
    }

    const quickState = await completeStep3(service, quick.id, { decision: 'iterate' });
    const scaleState = await completeStep3(service, scale.id, { decision: 'scale_pilot' });

    expect(quickState.checkpointInstances.map((cp: any) => cp.checkpointKey)).not.toContain('CP-3.5');
    expect(scaleState.checkpointInstances.map((cp: any) => cp.checkpointKey)).toContain('CP-3.5');
    expect((scaleState.stepOutputs.find((output: any) => output.step === 3)?.output as any).operationalReadiness.required).toBe(true);
  });

  it('23. contradictory evidence creates mixed signal while preserving sourceRefs', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);

    const state = await completeStep3(service, project.id, {
      executionRecords: [
        { type: 'measurement', title: 'Mejora parcial', description: 'Mejora 12%', sourceRefs: ['metric-a'], evidenceRefs: ['metric-a'] },
        { type: 'interview', title: 'Entrevista contradice', description: 'Usuarios reportan mayor carga', sourceRefs: ['interview-b'], evidenceRefs: ['interview-b'] },
      ],
      executionSourceRefs: ['metric-a', 'interview-b'],
      resultComparison: {
        result: 'Mejora parcial con mayor carga operativa',
        supportingEvidenceRefs: ['metric-a'],
        contradictingEvidenceRefs: ['interview-b'],
        limitations: ['Muestra pequena'],
      },
      hypothesisClassification: 'mixed_signal',
      confirmedInterpretation: 'La senal es mixta.',
    });
    const output = state.stepOutputs.find((item: any) => item.step === 3)?.output as any;

    expect(output.resultAnalysis.classification).toBe('mixed_signal');
    expect(output.resultAnalysis.contradictingEvidenceRefs).toEqual(['interview-b']);
    expect(output.sourceRefs).toContain('metric-a');
  });

  it('24. Step 3 does not close without confirmation and confirmation creates Step 4 once', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);
    const state = await completeStep3(service, project.id, { decision: 'close_with_learning' });
    const output = state.stepOutputs.find((item: any) => item.step === 3)?.output as Record<string, unknown>;

    expect(store.project[0].currentStep).toBe(3);
    await expect(service.confirmStep3Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step3-nope',
      brief: output,
      confirmed: false,
    })).rejects.toMatchObject({ code: 'STEP3_CONFIRMATION_REQUIRED' });

    await service.confirmStep3Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step3-ok',
      brief: output,
      confirmed: true,
    });
    await service.confirmStep3Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step3-ok',
      brief: output,
      confirmed: true,
    });

    expect(store.project[0].currentStep).toBe(4);
    expect(store.adaptiveStepConfiguration.filter((config) => config.stepNumber === 4)).toHaveLength(1);
    expect(store.adaptiveCheckpointInstance.filter((cp) => cp.checkpointKey === 'CP-4.1')).toHaveLength(1);
    expect(store.adaptiveProgressSignal[0].signalJson.step).toBe(4);
  });

  it('25. Portfolio and ChallengeContribution receive Step 3 signal', async () => {
    const store = createStore();
    const project = seedProject(store, {
      id: 'p-step3-port',
      portfolioMeta: [{ id: 'meta-step3', projectId: 'p-step3-port', challengeId: 'ch1', strategicFrontId: 'f1', status: 'en_step_0', challenge: { title: 'Reto adopcion' } }],
    });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);

    const state = await completeStep3(service, project.id, { decision: 'scale_pilot' });
    const output = state.stepOutputs.find((item: any) => item.step === 3)?.output as any;

    expect(output.challengeContribution).toMatchObject({ challengeId: 'ch1', challengeResolved: false });
    expect(store.adaptiveProgressSignal[0].signalJson.contributionToChallenge).toMatchObject({ challengeId: 'ch1' });
    expect(store.initiativePortfolioMeta[0].nextActionRecommended).toContain('Step 3');
  });

  it('26. critical execution change creates a review and legacy still works', async () => {
    const store = createStore();
    const project = seedProject(store, { step0Data: { quePasaQueQuieres: 'Legacy text', pendingQuestions: [] } });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);

    const state = await completeStep3(service, project.id, {
      criticalExecutionChanges: ['Cambio de alcance durante ejecucion'],
    });
    const output = state.stepOutputs.find((item: any) => item.step === 3)?.output as any;

    expect(state.legacyFallback).toBe(true);
    expect(output.executionLog.criticalChanges[0]).toMatchObject({ field: 'scope' });
  });

  it('27. Step 4 receives confirmed Step 3 output and preserves audience transfer', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);

    const state = await confirmStep3AndStartStep4(service, project.id, { decision: 'close_with_learning' });
    const step4Config = state.stepConfigurations.find((config: any) => config.step === 4) as any;

    expect(step4Config.transferredFromStep3.decision.decision).toBe('close_with_learning');
    expect(step4Config.checkpoints.map((cp: any) => cp.code)).toEqual(['CP-4.1', 'CP-4.2', 'CP-4.3', 'CP-4.4', 'CP-4.5']);
    expect(state.activeCheckpoint?.checkpointKey).toBe('CP-4.1');
  });

  it('28. Step 4 creates minimal artifacts and preserves contradictory sourceRefs', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);
    await confirmStep3AndStartStep4(service, project.id, {
      decision: 'pause',
      executionSourceRefs: ['result-1', 'interview-mixed'],
      resultComparison: { supportingEvidenceRefs: ['result-1'], contradictingEvidenceRefs: ['interview-mixed'], limitations: ['Muestra pequena'] },
      hypothesisClassification: 'mixed_signal',
      confirmedInterpretation: 'Senal mixta.',
    });

    const state = await completeStep4(service, project.id, {
      preferredFormat: 'learning report',
      narrativeEvidenceRefs: ['result-1', 'interview-mixed'],
      contradictions: 'Entrevistas contradicen metrica.',
      finalState: 'closed_with_learning',
    });
    const output = state.stepOutputs.find((item: any) => item.step === 4)?.output as any;

    expect(output.outputKey).toBe('DecisionMemoLearningReport');
    expect(output.decisionPackage.artifacts).toHaveLength(1);
    expect(output.narrative.contradictions.sourceRefs).toContain('interview-mixed');
    expect(output.sourceRefs).toContain('interview-mixed');
  });

  it('29. transfer requires receiver owner and scaling uses BusinessCaseRoadmap', async () => {
    const store = createStore();
    const transfer = seedProject(store, { id: 'step4-transfer' });
    const scale = seedProject(store, { id: 'step4-scale' });
    const service = new AdaptiveCoreService(makePrisma(store));
    for (const project of [transfer, scale]) {
      await service.ensureInitialized(project.id, 'u1', 'participante');
      await confirmStep0AndStartStep1(service, project.id);
      await confirmStep1AndStartStep2(service, project.id);
      await confirmStep2AndStartStep3(service, project.id);
    }
    await confirmStep3AndStartStep4(service, transfer.id, { decision: 'transfer' });
    await confirmStep3AndStartStep4(service, scale.id, { decision: 'scale_pilot' });

    const transferState = await completeStep4(service, transfer.id, { finalState: 'transferred', preferredFormat: 'handoff package' });
    const scaleState = await completeStep4(service, scale.id, { finalState: 'scaled', preferredFormat: 'business case', receiverOwner: 'Area receptora' });
    const transferOutput = transferState.stepOutputs.find((item: any) => item.step === 4)?.output as any;
    const scaleOutput = scaleState.stepOutputs.find((item: any) => item.step === 4)?.output as any;

    expect(transferOutput.transferOrClosure.blockers).toContain('Owner receptor requerido para transferencia u operacion.');
    expect(scaleOutput.outputKey).toBe('BusinessCaseRoadmap');
    expect(scaleOutput.transferOrClosure.receiverOwner).toBe('Area receptora');
  });

  it('30. Step 4 does not close without confirmation and double confirm is idempotent', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);
    await confirmStep3AndStartStep4(service, project.id, { decision: 'close_with_learning' });
    const state = await completeStep4(service, project.id, { finalState: 'closed_with_learning' });
    const output = state.stepOutputs.find((item: any) => item.step === 4)?.output as Record<string, unknown>;

    expect(store.project[0].status).not.toBe('COMPLETED');
    await expect(service.confirmStep4Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step4-nope',
      brief: output,
      confirmed: false,
    })).rejects.toMatchObject({ code: 'STEP4_CONFIRMATION_REQUIRED' });

    await service.confirmStep4Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step4-ok',
      brief: output,
      confirmed: true,
    });
    await service.confirmStep4Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step4-ok',
      brief: output,
      confirmed: true,
    });

    expect(store.project[0].status).toBe('COMPLETED');
    expect(store.adaptiveStepOutput.filter((item) => item.stepNumber === 4 && item.status === 'confirmed')).toHaveLength(1);
    expect(store.adaptiveAdaptationEvent.filter((event) => event.eventType === 'initiative_completed')).toHaveLength(1);
    expect(store.adaptiveAdaptationEvent.filter((event) => event.eventType === 'initiative_closed')).toHaveLength(0);
  });

  it('31. Portfolio receives final signal and challenge coverage is not auto resolved', async () => {
    const store = createStore();
    const project = seedProject(store, {
      id: 'p-step4-port',
      portfolioMeta: [{ id: 'meta-step4', projectId: 'p-step4-port', challengeId: 'ch1', strategicFrontId: 'f1', status: 'en_step_0', challenge: { title: 'Reto adopcion' } }],
    });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);
    await confirmStep3AndStartStep4(service, project.id, { decision: 'scale_pilot' });

    const state = await completeStep4(service, project.id, {
      finalState: 'scaled',
      receiverOwner: 'Area receptora',
      challengeCoverageUpdate: { status: 'ready_for_decision', metrics: ['Horas de retrabajo'] },
    });
    const output = state.stepOutputs.find((item: any) => item.step === 4)?.output as any;
    await service.confirmStep4Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'step4-port-ok',
      brief: output,
      confirmed: true,
    });

    expect(output.finalChallengeContribution.challengeId).toBe('ch1');
    expect(output.challengeCoverage).toMatchObject({ status: 'ready_for_decision', autoResolved: false });
    expect(store.adaptiveProgressSignal[0].signalJson.finalState).toBe('presented');
    expect(store.adaptiveProgressSignal[0].signalJson.completionRoute).toBe('portfolio_presented');
    expect(store.initiativePortfolioMeta[0]).toMatchObject({ status: 'lista_para_decision', resolvedCorePart: true });

    const reloaded = await new AdaptiveCoreService(makePrisma(store)).getState(project.id, 'u1', 'participante');
    expect(reloaded.activeCheckpoint).toBeNull();
    expect(reloaded.progressSignal).toMatchObject({ step: 4, finalState: 'presented', completionRoute: 'portfolio_presented' });
    expect(reloaded.progressSignal?.checkpointKey).not.toBe('CP-3.1');
    expect(store.initiativePortfolioMeta[0]).toMatchObject({ status: 'lista_para_decision', resolvedCorePart: true });
    expect(store.initiativePortfolioMeta[0].nextActionRecommended).not.toContain('CP-3.1');
  });

  it('32. legacy Step 0 to Step 4 complete flow works', async () => {
    const store = createStore();
    const project = seedProject(store, { step0Data: { quePasaQueQuieres: 'Legacy', pendingQuestions: [] } });
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');
    await confirmStep0AndStartStep1(service, project.id);
    await confirmStep1AndStartStep2(service, project.id);
    await confirmStep2AndStartStep3(service, project.id);
    await confirmStep3AndStartStep4(service, project.id, { decision: 'iterate' });
    const state = await completeStep4(service, project.id, { finalState: 'new_iteration_required', preferredFormat: 'one-pager' });
    const output = state.stepOutputs.find((item: any) => item.step === 4)?.output as Record<string, unknown>;
    const closed = await service.confirmStep4Output(project.id, 'u1', 'participante', {
      idempotencyKey: 'legacy-step4-ok',
      brief: output,
      confirmed: true,
    });

    expect(closed.legacyFallback).toBe(true);
    expect(store.project[0].status).toBe('COMPLETED');
    expect(closed.progressSignal?.finalState).toBe('completed');
    expect(closed.progressSignal?.completionRoute).toBe('owner_completed');
  });

  it('33. Step 0 declara nombre visible y output segun la ruta (PRD-03 §5)', async () => {
    // La ruta se deriva del texto de step0Data; una fila por ruta de la matriz del PRD.
    const cases: Array<{ initialFocus: string; route: string; output: string }> = [
      { initialFocus: 'Validar oportunidad', route: 'explore_validate', output: 'Context Brief + Validation Contract' },
      { initialFocus: 'Disenar la solucion', route: 'design_solution', output: 'Opportunity Brief' },
      { initialFocus: 'Implementar adopcion', route: 'implement_handoff', output: 'Implementation Brief' },
      { initialFocus: 'Coordinar plan con deadline', route: 'plan_coordinate', output: 'Project Brief + Validation Contract' },
      { initialFocus: 'Reconstruir la iniciativa', route: 'reconstruct_existing', output: 'Reconstructed Context' },
    ];

    for (const { initialFocus, route, output } of cases) {
      const store = createStore();
      const project = seedProject(store, { initialFocus });
      const service = new AdaptiveCoreService(makePrisma(store));
      const state = await service.ensureInitialized(project.id, 'u1', 'participante');
      const step0 = state.stepConfigurations.find((config: any) => config.step === 0) as any;

      expect(step0.routeType).toBe(route);
      expect(step0.expectedOutput).toBe(output);
      // El nombre visible tambien sale de la matriz, no del placeholder generico.
      expect(step0.visibleName).not.toBe('Step 0 adaptativo');
    }
  });

  it('34. el estado expone las respuestas confirmadas como fuente de verdad del recorrido', async () => {
    const store = createStore();
    const project = seedProject(store);
    const service = new AdaptiveCoreService(makePrisma(store));
    await service.ensureInitialized(project.id, 'u1', 'participante');

    await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-cp01`,
      checkpointKey: 'CP-0.1',
      responses: { objective: 'Mover adopcion', challengeType: 'growth' },
    });
    const state = await service.confirmCheckpoint(project.id, 'u1', 'participante', {
      idempotencyKey: `${project.id}-cp02`,
      checkpointKey: 'CP-0.2',
      responses: { scope: 'Equipo comercial', owner_and_actor_required: 'Owner comercial' },
    });

    // Fusionadas en orden cronologico: es lo que el frontend consume en vez de raspar
    // el formulario legacy de Step 0.
    expect(state.confirmedResponses).toMatchObject({
      objective: 'Mover adopcion',
      scope: 'Equipo comercial',
      owner_and_actor_required: 'Owner comercial',
    });

    // Y ademas adjuntas al checkpoint que las respondio, para poder rehidratar la vista.
    const cp01 = state.checkpointInstances.find((item: any) => item.checkpointKey === 'CP-0.1') as any;
    const cp02 = state.checkpointInstances.find((item: any) => item.checkpointKey === 'CP-0.2') as any;
    expect(cp01.responses).toMatchObject({ objective: 'Mover adopcion' });
    expect(cp02.responses).toMatchObject({ scope: 'Equipo comercial' });
    // Un checkpoint aun sin responder no inventa respuestas.
    const cp03 = state.checkpointInstances.find((item: any) => item.checkpointKey === 'CP-0.3') as any;
    expect(cp03?.responses ?? {}).toEqual({});
  });
});
