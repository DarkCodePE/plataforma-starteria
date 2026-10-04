// Recorridos de checkpoints Step 0–4 por API. Extraídos de adaptive-core-prd03.spec.ts
// (líneas confirmCheckpoint…confirmStep4). Única diferencia: confirmCheckpoint adjunta
// Claim/Evidence/SourceRef persistentes donde checkpoint-evidence-policy.ts lo exige, como
// hace backend/modules/adaptive-core/__tests__/r2-persistence.e2e.test.ts. Sin eso CP-1.3
// responde CHECKPOINT_TRUTH_BINDING_REQUIRED (y PRD03 cae ahí).
import type { APIRequestContext } from '@playwright/test';
import { getOk, postOk } from './api';

// Checkpoints con política en backend/modules/adaptive-core/checkpoint-evidence-policy.ts.
const BINDING_CHECKPOINTS = new Set(['CP-1.3', 'CP-2.2', 'CP-2.3', 'CP-3.2', 'CP-3.3', 'CP-3.4', 'CP-4.2', 'CP-4.4']);
const bindingsByProject = new Map<string, { claimId: string; evidenceIds: string[]; sourceRefIds: string[] }>();

async function truthBindingFor(api: APIRequestContext, token: string, projectId: string) {
  const cached = bindingsByProject.get(projectId);
  if (cached) return cached;
  const source = await postOk(api, token, '/api/v1/truth/source-refs', { projectId, sourceType: 'USER_INPUT', reference: `${projectId}-e2e-source` });
  const claim = await postOk(api, token, '/api/v1/truth/claims', {
    projectId,
    subjectType: 'initiative',
    subjectId: projectId,
    claimType: 'hypothesis',
    statement: 'La evidencia del piloto soporta el foco de la iniciativa.',
    createdByType: 'human',
    sourceRefIds: [source.id],
  });
  const evidence = await postOk(api, token, '/api/v1/truth/evidence', {
    projectId,
    targetClaimId: claim.id,
    sourceRefId: source.id,
    name: `${projectId}-e2e-evidence`,
    evidenceType: 'OTHER',
    truthStatus: 'supports',
    stepRef: 1,
  });
  await postOk(api, token, '/api/v1/truth/validations', {
    projectId,
    claimId: claim.id,
    evidenceId: evidence.id,
    result: 'supported',
    validatorType: 'human',
    validatorRole: 'owner',
    rationale: 'Validación humana sembrada por la suite E2E Job-Driven.',
  });
  const binding = { claimId: claim.id as string, evidenceIds: [evidence.id as string], sourceRefIds: [source.id as string] };
  bindingsByProject.set(projectId, binding);
  return binding;
}

export async function confirmCheckpoint(api: APIRequestContext, token: string, projectId: string, checkpointKey: string, responses: Record<string, unknown>, suffix: string) {
  const binding = BINDING_CHECKPOINTS.has(checkpointKey) ? await truthBindingFor(api, token, projectId) : null;
  return postOk(api, token, `/api/v1/projects/${projectId}/adaptive-core/checkpoints/confirm`, {
    idempotencyKey: `${projectId}-${suffix}`,
    checkpointKey,
    responses,
    ...(binding
      ? { truthBindings: binding, evidenceBindings: { evidenceIds: binding.evidenceIds, sourceRefIds: binding.sourceRefIds } }
      : {}),
  });
}

export async function completeStep0(api: APIRequestContext, token: string, projectId: string) {
  await getOk(api, token, `/api/v1/projects/${projectId}/adaptive-core`);
  await confirmCheckpoint(api, token, projectId, 'CP-0.1', { objective: 'Reducir retrabajo', challengeType: 'growth' }, 'cp01');
  await confirmCheckpoint(api, token, projectId, 'CP-0.2', { scope: 'Equipo comercial', owner_and_actor_required: 'Owner comercial' }, 'cp02');
  const state = await confirmCheckpoint(api, token, projectId, 'CP-0.3', {
    priorityHypothesis: 'Si damos visibilidad temprana, baja el retrabajo.',
    decisionCriteria: 'Baja 20% del retrabajo semanal.',
  }, 'cp03');
  const draft = state.stepOutputs.find((output: any) => output.step === 0)?.output;
  return postOk(api, token, `/api/v1/projects/${projectId}/adaptive-core/step0/brief/confirm`, {
    idempotencyKey: `${projectId}-brief-confirm`,
    brief: draft,
    confirmed: true,
  });
}

export async function completeStep1(api: APIRequestContext, token: string, projectId: string, contradictory = false) {
  await confirmCheckpoint(api, token, projectId, 'CP-1.1', {
    mainHypothesis: 'Usuarios adoptan el tablero si reduce retrabajo.',
    criticalAssumption: 'El retrabajo nace por falta de visibilidad.',
    learningQuestion: 'Que evidencia muestra retrabajo evitable?',
    riskOfBeingWrong: 'Disenar la solucion equivocada.',
    dependentDecision: 'Definir apuesta de Step 2.',
  }, 'cp11');
  await confirmCheckpoint(api, token, projectId, 'CP-1.2', {
    methods: ['entrevistas', 'revision de metricas'],
    sourcesAndActors: ['Usuarios comerciales', 'Reporte CRM'],
    responsibleAndDates: ['Owner comercial - 2026-08-05'],
    expectedEvidenceAndSufficiency: 'Tres entrevistas y una metrica base.',
  }, 'cp12');
  await confirmCheckpoint(api, token, projectId, 'CP-1.3', {
    evidenceItems: [
      { id: 'ev-support', summary: '8 de 10 casos tienen retrabajo por visibilidad', classification: 'supports', sourceRefs: ['crm-report'] },
      ...(contradictory ? [{ id: 'ev-contradicts', summary: 'La metrica agregada no muestra demoras', classification: 'contradicts', sourceRefs: ['metric-aggregate'] }] : []),
    ],
    evidenceClassifications: contradictory ? ['supports', 'contradicts'] : ['supports'],
    sourceRefs: contradictory ? ['crm-report', 'metric-aggregate'] : ['crm-report'],
  }, 'cp13');
  const state = await confirmCheckpoint(api, token, projectId, 'CP-1.4', {
    synthesis: contradictory ? 'La evidencia es parcial porque hay una contradiccion metrica.' : 'La evidencia apoya enfocar visibilidad de retrabajo.',
    updatedFocusAndHypothesis: 'Reducir retrabajo comercial con visibilidad temprana.',
    continuityDecision: contradictory ? 'avanzar con observaciones' : 'mantener',
  }, 'cp14');
  const output = state.stepOutputs.find((item: any) => item.step === 1)?.output;
  return postOk(api, token, `/api/v1/projects/${projectId}/adaptive-core/step1/output/confirm`, {
    idempotencyKey: `${projectId}-step1-confirm`,
    brief: output,
    confirmed: true,
  });
}

export async function completeStep2(api: APIRequestContext, token: string, projectId: string) {
  await confirmCheckpoint(api, token, projectId, 'CP-2.1', {
    expectedOutcome: 'Reducir retrabajo validando visibilidad temprana.',
    successCriteria: ['Uso semanal', 'Menos retrabajo'],
    constraintsGuardrails: ['No usar datos productivos sin permiso'],
    reversibilityLevel: 'alta',
  }, 'cp21');
  await confirmCheckpoint(api, token, projectId, 'CP-2.2', {
    alternatives: [
      { name: 'Prototipo manual', mode: 'experiment', evidenceRefs: ['crm-report'] },
      { name: 'No hacer nada', mode: 'do_nothing', evidenceRefs: ['risk-log'] },
    ],
    implementationModes: ['experiment', 'do_nothing'],
    alternativeEvidenceRefs: ['crm-report', 'risk-log'],
  }, 'cp22');
  await confirmCheckpoint(api, token, projectId, 'CP-2.3', {
    comparison: { valor: 'alto', factibilidad: 'media', reversibilidad: 'alta' },
    selectedBet: { primary: 'Prototipo manual', backup: 'No hacer nada', justification: 'Mayor aprendizaje con bajo costo.', evidenceRefs: ['crm-report'] },
    selectedBetEvidenceRefs: ['crm-report'],
  }, 'cp23');
  let state = await confirmCheckpoint(api, token, projectId, 'CP-2.4', {
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
  }, 'cp24');
  if (state.activeCheckpoint?.checkpointKey === 'CP-2.5') {
    state = await confirmCheckpoint(api, token, projectId, 'CP-2.5', {
      readinessChecklist: ['Owner confirmado', 'Permisos confirmados', 'Datos disponibles'],
      dependenciesAndFallback: ['Plan alternativo: encuesta manual'],
    }, 'cp25');
  }
  const output = state.stepOutputs.find((item: any) => item.step === 2)?.output;
  return { state, output };
}

export async function confirmStep2(api: APIRequestContext, token: string, projectId: string, output: Record<string, unknown>, suffix = 'step2-ok') {
  return postOk(api, token, `/api/v1/projects/${projectId}/adaptive-core/step2/output/confirm`, {
    idempotencyKey: `${projectId}-${suffix}`,
    brief: output,
    confirmed: true,
  });
}

export async function completeStep3(api: APIRequestContext, token: string, projectId: string, options: {
  decision?: string;
  mixedSignal?: boolean;
  criticalChange?: boolean;
  suffix?: string;
} = {}) {
  const suffix = options.suffix ?? options.decision ?? 'iterate';
  await confirmCheckpoint(api, token, projectId, 'CP-3.1', {
    step3TransferConfirmation: 'Transferencia Step 2 confirmada.',
    executionReadinessChecklist: ['Owner confirmado', 'Metrica lista', options.decision === 'scale_pilot' ? 'Soporte pendiente de confirmar' : 'Sin faltantes'],
    executionDependencies: options.decision === 'scale_pilot'
      ? ['Permiso de sponsor confirmado', 'Plan alternativo: rollback manual']
      : ['Plan alternativo: medicion manual'],
  }, `cp31-${suffix}`);
  await confirmCheckpoint(api, token, projectId, 'CP-3.2', {
    executionRecords: [
      { type: 'measurement', title: 'Medicion piloto', description: options.mixedSignal ? 'Mejora 12%, bajo umbral' : 'Resultado supero umbral', occurredAt: '2026-08-01T00:00:00.000Z', actor: 'Owner comercial', evidenceRefs: ['result-1'], sourceRefs: ['result-1'], impact: options.mixedSignal ? 'parcial' : 'positivo', configurationVersion: 1, checkpointKey: 'CP-3.2' },
      ...(options.mixedSignal ? [{ type: 'interview', title: 'Entrevista contradice', description: 'Usuarios reportan mayor carga operativa', occurredAt: '2026-08-02T00:00:00.000Z', actor: 'Owner comercial', evidenceRefs: ['interview-mixed'], sourceRefs: ['interview-mixed'], impact: 'contradictorio', configurationVersion: 1, checkpointKey: 'CP-3.2' }] : []),
    ],
    executionSourceRefs: options.mixedSignal ? ['result-1', 'interview-mixed'] : ['result-1'],
    criticalExecutionChanges: options.criticalChange ? ['Cambio de alcance durante ejecucion'] : undefined,
  }, `cp32-${suffix}`);
  await confirmCheckpoint(api, token, projectId, 'CP-3.3', {
    resultComparison: options.mixedSignal
      ? { baseline: '500 horas', result: '440 horas y mayor carga', threshold: '20% reduccion', supportingEvidenceRefs: ['result-1'], contradictingEvidenceRefs: ['interview-mixed'], limitations: ['Muestra pequena'], unexpectedEffects: ['Mayor carga operativa'] }
      : { baseline: '500 horas', result: '350 horas', threshold: '20% reduccion', supportingEvidenceRefs: ['result-1'], contradictingEvidenceRefs: [], interpretation: 'La prueba apoya la hipotesis.' },
    hypothesisClassification: options.mixedSignal ? 'mixed_signal' : 'supported',
    confirmedInterpretation: options.mixedSignal ? 'La evidencia es mixta por mejora parcial y carga operativa.' : 'La prueba apoya la hipotesis.',
  }, `cp33-${suffix}`);
  let state = await confirmCheckpoint(api, token, projectId, 'CP-3.4', {
    decision: options.decision ?? 'iterate',
    decisionDetails: {
      rationale: options.mixedSignal ? 'Escalar no es prudente con senal mixta.' : 'Resultado suficiente para decidir.',
      nextAction: options.decision === 'close_with_learning' ? 'Cerrar con aprendizaje documentado.' : options.decision === 'scale_pilot' ? 'Escalar piloto a siguiente muestra.' : 'Iterar diseno.',
      owner: 'Owner comercial',
      dueDate: '2026-08-15',
      requiredApprover: options.decision === 'scale_pilot' ? 'Sponsor' : 'Owner comercial',
    },
    decisionEvidenceRefs: options.mixedSignal ? ['result-1', 'interview-mixed'] : ['result-1'],
  }, `cp34-${suffix}`);
  if (state.activeCheckpoint?.checkpointKey === 'CP-3.5') {
    state = await confirmCheckpoint(api, token, projectId, 'CP-3.5', {
      operationalReadinessChecklist: ['Owner futuro confirmado', 'Soporte definido', 'Rollback documentado', 'Aceptacion area receptora'],
      operationalBlockers: ['Sin bloqueos operativos'],
    }, `cp35-${suffix}`);
  }
  const output = state.stepOutputs.find((item: any) => item.step === 3)?.output;
  return { state, output };
}

export async function confirmStep3(api: APIRequestContext, token: string, projectId: string, output: Record<string, unknown>, suffix = 'step3-ok') {
  return postOk(api, token, `/api/v1/projects/${projectId}/adaptive-core/step3/output/confirm`, {
    idempotencyKey: `${projectId}-${suffix}`,
    brief: output,
    confirmed: true,
  });
}

export async function completeStep4(api: APIRequestContext, token: string, projectId: string, options: {
  finalState?: string;
  preferredFormat?: string;
  receiverOwner?: string;
  mixedEvidence?: boolean;
  suffix?: string;
} = {}) {
  const suffix = options.suffix ?? options.finalState ?? 'closed';
  await confirmCheckpoint(api, token, projectId, 'CP-4.1', {
    step4TransferConfirmation: 'Transferencia Step 3 confirmada.',
    decisionAudience: { primaryAudience: 'Comite ejecutivo', decisionMaker: 'Sponsor', secondaryAudiences: ['Challenge Owner'], deadline: '2026-08-30' },
    audienceDecisionNeeds: { requestedDecision: 'Aprobar siguiente horizonte', audienceNeeds: ['Evidencia', 'Riesgos'], objections: ['Carga operativa'], preferredFormat: options.preferredFormat ?? 'memo', requiredEvidenceRefs: options.mixedEvidence ? ['result-1', 'interview-mixed'] : ['result-1'] },
  }, `cp41-${suffix}`);
  await confirmCheckpoint(api, token, projectId, 'CP-4.2', {
    evidenceNarrative: { recommendation: 'Continuar con cierre organizacional trazable.', results: 'Resultado validado.', contradictions: options.mixedEvidence ? 'Entrevista contradice la metrica.' : '' },
    narrativeEvidenceRefs: options.mixedEvidence ? ['result-1', 'interview-mixed'] : ['result-1'],
  }, `cp42-${suffix}`);
  await confirmCheckpoint(api, token, projectId, 'CP-4.3', {
    nextHorizonPlan: { phases: ['Fase 1'], owner: options.receiverOwner ?? 'Owner comercial', metrics: ['Horas de retrabajo'] },
    nextHorizonDetails: { resources: ['Equipo comercial'], milestones: ['Decision 2026-08-30'], rollback: 'Volver a proceso manual' },
  }, `cp43-${suffix}`);
  await confirmCheckpoint(api, token, projectId, 'CP-4.4', {
    decisionArtifacts: [options.preferredFormat ?? 'memo'],
    artifactTraceability: { version: 1, author: 'Owner comercial', date: '2026-08-20', evidenceRefs: options.mixedEvidence ? ['result-1', 'interview-mixed'] : ['result-1'], limitations: ['Muestra pequena'] },
  }, `cp44-${suffix}`);
  const state = await confirmCheckpoint(api, token, projectId, 'CP-4.5', {
    transferOrClosure: { finalDecision: 'Decision organizacional confirmada', owner: 'Owner comercial', receiverOwner: options.receiverOwner, nextStep: 'Ejecutar siguiente horizonte', evidenceRefs: options.mixedEvidence ? ['result-1', 'interview-mixed'] : ['result-1'] },
    finalState: options.finalState ?? 'closed_with_learning',
    challengeCoverageUpdate: { status: options.finalState === 'scaled' ? 'ready_for_decision' : 'partial', metrics: ['Horas de retrabajo'] },
  }, `cp45-${suffix}`);
  const output = state.stepOutputs.find((item: any) => item.step === 4)?.output;
  return { state, output };
}

export async function confirmStep4(api: APIRequestContext, token: string, projectId: string, output: Record<string, unknown>, suffix = 'step4-ok') {
  return postOk(api, token, `/api/v1/projects/${projectId}/adaptive-core/step4/output/confirm`, {
    idempotencyKey: `${projectId}-${suffix}`,
    brief: output,
    confirmed: true,
  });
}

