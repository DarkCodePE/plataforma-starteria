import type { Project, Step0Data } from '../../../app/context/AppContext';
import type { ChallengeType, InitialReview } from '../../initial-review/domain/types';
import type {
  AdaptiveCheckpointStatus,
  AdaptiveDepthLevel,
  AdaptiveInitiativeCore,
  AdaptiveQuestion,
  AdaptiveRouteType,
  ChallengeContribution,
  ContextSnapshot,
  InitiativeMasterContext,
  ProgressSignal,
  StepCheckpoint,
  StepConfiguration,
} from './types';

type StepNumber = 0 | 1 | 2 | 3 | 4;

const STABLE_PURPOSE: Record<StepNumber, string> = {
  0: 'Entender, alinear y definir qué debe validarse o resolverse',
  1: 'Delimitar y fundamentar el foco con evidencia',
  2: 'Diseñar la ruta de acción, apuesta, solución o experimento',
  3: 'Ejecutar, aprender, controlar y decidir',
  4: 'Cerrar, transferir, presentar y proyectar continuidad',
};

// Cada Step es un contrato de rigor, pero la persona lo vive como una pregunta de progreso
// (doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §19). Se muestra junto al nombre del Step.
export const STEP_PROGRESS_QUESTION: Record<StepNumber, string> = {
  0: '¿Qué es razonable intentar ahora?',
  1: '¿Qué sabemos realmente?',
  2: '¿Qué podemos poner frente a la realidad y cómo observaremos lo ocurrido?',
  3: '¿Qué ocurrió realmente?',
  4: '¿Qué decisión está suficientemente sustentada?',
};

const STEP_OUTPUT_BY_ROUTE: Record<AdaptiveRouteType, Record<StepNumber, string>> = {
  explore_validate: {
    0: 'Context Brief + Validation Contract',
    1: 'Focus Definition + Evidence Map',
    2: 'Selected Bet + Experiment Design',
    3: 'Pilot Results + Evidence-Based Decision',
    4: 'Final Decision Package + Learning Transfer',
  },
  design_solution: {
    0: 'Opportunity Brief',
    1: 'Solution Criteria + Assumption Review',
    2: 'Selected Solution + Test Design',
    3: 'Execution Evidence + Decision',
    4: 'Decision Package + Handoff Plan',
  },
  implement_handoff: {
    0: 'Implementation Brief',
    1: 'Readiness Baseline + Adoption Conditions',
    2: 'Execution Plan + Guardrails',
    3: 'Run Results + Adoption Reading',
    4: 'Transfer Package + Operating Owner',
  },
  plan_coordinate: {
    0: 'Project Brief + Validation Contract',
    1: 'Scope & Deliverable Map + Risk Baseline',
    2: 'Route Plan + Delivery Design',
    3: 'Execution Control + Decision Log',
    4: 'Closure Package + Continuity Plan',
  },
  reconstruct_existing: {
    0: 'Reconstructed Context',
    1: 'Gap Assessment + Evidence Reconstruction',
    2: 'Recovery Plan + Decision Criteria',
    3: 'Execution Evidence + Reconstructed Learning',
    4: 'Closure Record + Ownership Transfer',
  },
  lightweight_plan: {
    0: 'Quick Brief',
    1: 'Lightweight Focus + Evidence Note',
    2: 'Selected Bet + Lightweight Plan',
    3: 'Execution Check + Decision',
    4: 'Closure Note + Learning Transfer',
  },
};

const STEP_VISIBLE_NAME_BY_ROUTE: Record<AdaptiveRouteType, Record<StepNumber, string>> = {
  explore_validate: {
    0: 'Ordenar contexto y definir qué validar',
    1: 'Fundamentar el foco',
    2: 'Diseñar experimento o apuesta',
    3: 'Ejecutar y aprender',
    4: 'Cerrar y transferir aprendizaje',
  },
  design_solution: {
    0: 'Confirmar oportunidad y condiciones',
    1: 'Revisar criterio problema-solución',
    2: 'Comparar y seleccionar solución',
    3: 'Probar ejecución de la solución',
    4: 'Presentar decisión y traspaso',
  },
  implement_handoff: {
    0: 'Confirmar mandato y readiness inicial',
    1: 'Establecer baseline de adopcion',
    2: 'Preparar implementacion controlada',
    3: 'Ejecutar y leer resultados',
    4: 'Transferir a operacion',
  },
  plan_coordinate: {
    0: 'Aclarar objetivo, deadline y stakeholders',
    1: 'Sustentar alcance y riesgos',
    2: 'Diseñar ruta coordinada',
    3: 'Controlar ejecución y cambios',
    4: 'Cerrar entrega y continuidad',
  },
  reconstruct_existing: {
    0: 'Reconstruir contexto, ownership y supuestos',
    1: 'Reconstruir evidencia y brechas',
    2: 'Seleccionar ruta de recuperacion',
    3: 'Ejecutar recuperacion trazable',
    4: 'Cerrar registro y ownership',
  },
  lightweight_plan: {
    0: 'Ordenar quick win',
    1: 'Confirmar foco liviano',
    2: 'Seleccionar apuesta liviana',
    3: 'Ejecutar y decidir',
    4: 'Cerrar aprendizaje',
  },
};

const CHECKPOINTS: Record<StepNumber, Array<Omit<StepCheckpoint, 'status' | 'questions' | 'gates'>>> = {
  0: [
    {
      id: 'cp-0-1',
      step: 0,
      code: 'CP-0.1',
      title: 'Enmarcar la iniciativa',
      purpose: 'Aclarar qué se quiere mover, origen, tipo de reto, output y relación con reto o frente.',
      outputKey: 'InitiativeFraming',
      completionCriteria: ['Resultado entendible', 'Tipo de reto visible', 'Relacion con reto o frente tratada'],
    },
    {
      id: 'cp-0-2',
      step: 0,
      code: 'CP-0.2',
      title: 'Aterrizar condiciones reales',
      purpose: 'Aclarar alcance, actores, gobernanza, dependencias y restricciones.',
      outputKey: 'ExecutionConditionsMap',
      completionCriteria: ['Alcance inicial', 'Owner visible', 'Restricciones criticas tratadas o marcadas'],
    },
    {
      id: 'cp-0-3',
      step: 0,
      code: 'CP-0.3',
      title: 'Definir qué validar o decidir',
      purpose: 'Separar hechos, señales, supuestos y faltantes para definir hipótesis y decisión futura.',
      outputKey: 'AlignmentBrief + ValidationContract',
      completionCriteria: ['Hipótesis o pregunta central', 'Criterio de éxito', 'Decisión futura definida'],
    },
  ],
  1: [
    {
      id: 'cp-1-1',
      step: 1,
      code: 'CP-1.1',
      title: 'Priorizar qué comprobar',
      purpose: 'Priorizar pregunta, evidencia disponible, faltantes y método.',
      outputKey: 'ValidationFocus + EvidenceNeedMap',
      completionCriteria: ['Foco priorizado', 'Faltantes visibles', 'Metodo seleccionado'],
    },
    {
      id: 'cp-1-2',
      step: 1,
      code: 'CP-1.2',
      title: 'Diseñar plan de aprendizaje',
      purpose: 'Definir fuentes, tecnica, muestra, tiempos y responsables.',
      outputKey: 'ValidationPlan',
      completionCriteria: ['Fuentes definidas', 'Plan ejecutable', 'Responsable claro'],
    },
    {
      id: 'cp-1-3',
      step: 1,
      code: 'CP-1.3',
      title: 'Incorporar y analizar evidencia',
      purpose: 'Vincular evidencia a hipótesis, fuentes y contradicciones.',
      outputKey: 'EvidenceMap + FindingsLog',
      completionCriteria: ['Evidencia con fuente', 'Contradicciones visibles', 'Fuerza evaluada'],
    },
    {
      id: 'cp-1-4',
      step: 1,
      code: 'CP-1.4',
      title: 'Sintetizar foco y continuidad',
      purpose: 'Confirmar, refutar o ajustar foco y recomendar continuidad.',
      outputKey: 'SustainedFocus',
      completionCriteria: ['Foco delimitado', 'Recomendacion para Step 2', 'Checkpoint confirmado'],
    },
  ],
  2: [
    {
      id: 'cp-2-1',
      step: 2,
      code: 'CP-2.1',
      title: 'Traducir foco a criterios',
      purpose: 'Convertir evidencia en criterios de diseño, valor, factibilidad y riesgo.',
      outputKey: 'DesignCriteria',
      completionCriteria: ['Criterios visibles', 'Restricciones tratadas', 'Guardrails definidos'],
    },
    {
      id: 'cp-2-2',
      step: 2,
      code: 'CP-2.2',
      title: 'Comparar alternativas',
      purpose: 'Evitar saltar a la primera solución comparando opciones suficientes.',
      outputKey: 'AlternativeComparison',
      completionCriteria: ['Alternativas comparadas', 'Backup definido', 'Riesgos comparados'],
    },
    {
      id: 'cp-2-3',
      step: 2,
      code: 'CP-2.3',
      title: 'Seleccionar apuesta',
      purpose: 'Elegir apuesta principal y explicitar la hipótesis más riesgosa.',
      outputKey: 'SelectedBet',
      completionCriteria: ['Apuesta seleccionada', 'Hipotesis riesgosa explicita', 'Decisor visible'],
    },
    {
      id: 'cp-2-4',
      step: 2,
      code: 'CP-2.4',
      title: 'Diseñar prueba o ejecución',
      purpose: 'Definir unidad de prueba, metricas, evidencia, responsables y umbrales.',
      outputKey: 'ExperimentOrDeliveryPlan',
      completionCriteria: ['Plan medible', 'Evidencia requerida', 'Condición de decisión'],
    },
  ],
  3: [
    {
      id: 'cp-3-1',
      step: 3,
      code: 'CP-3.1',
      title: 'Preparar ejecución',
      purpose: 'Confirmar baseline, actores, medicion y riesgos antes de ejecutar.',
      outputKey: 'ExecutionRunbook',
      completionCriteria: ['Baseline visible', 'Responsables claros', 'Riesgos controlados'],
    },
    {
      id: 'cp-3-2',
      step: 3,
      code: 'CP-3.2',
      title: 'Ejecutar y registrar evidencia',
      purpose: 'Capturar resultados relevantes con fuente, fecha, hipótesis y criterio.',
      outputKey: 'ExecutionEvidenceLog',
      completionCriteria: ['Evidencia asociada', 'Cambios relevantes registrados', 'Sin microactividad'],
    },
    {
      id: 'cp-3-3',
      step: 3,
      code: 'CP-3.3',
      title: 'Analizar resultados',
      purpose: 'Distinguir resultados, limitaciones, desviaciones y aprendizaje.',
      outputKey: 'ResultsAssessment',
      completionCriteria: ['Resultado evaluado', 'Limitaciones visibles', 'Nivel de confianza'],
    },
    {
      id: 'cp-3-4',
      step: 3,
      code: 'CP-3.4',
      title: 'Crear decisión sustentada',
      purpose: 'Recomendar iterar, pivotear, escalar, transferir, pausar o cerrar con evidencia.',
      outputKey: 'EvidenceBasedDecision',
      completionCriteria: ['Decisión recomendada', 'Evidencia vinculada', 'Siguiente aprendizaje'],
    },
  ],
  4: [
    {
      id: 'cp-4-1',
      step: 4,
      code: 'CP-4.1',
      title: 'Definir audiencia y decisión',
      purpose: 'Aclarar quién decide, qué necesita ver y qué salida corresponde.',
      outputKey: 'DecisionAudienceMap',
      completionCriteria: ['Audiencia clara', 'Decisión esperada', 'Validadores visibles'],
    },
    {
      id: 'cp-4-2',
      step: 4,
      code: 'CP-4.2',
      title: 'Construir narrativa con evidencia',
      purpose: 'Preparar historia ejecutiva con resultados, fuentes, limitaciones y supuestos.',
      outputKey: 'ExecutiveNarrative',
      completionCriteria: ['Evidencia y límites visibles', 'Supuestos no presentados como resultados', 'Lectura ejecutiva clara'],
    },
    {
      id: 'cp-4-3',
      step: 4,
      code: 'CP-4.3',
      title: 'Preparar handoff u ownership',
      purpose: 'Definir owner del siguiente paso, gobernanza, metricas y transferencia.',
      outputKey: 'HandoffPlan',
      completionCriteria: ['Owner del siguiente paso', 'Gobernanza mínima', 'Métricas de continuidad'],
    },
    {
      id: 'cp-4-4',
      step: 4,
      code: 'CP-4.4',
      title: 'Registrar decisión final',
      purpose: 'Cerrar, transferir o proyectar continuidad conservando aprendizaje y contribución.',
      outputKey: 'FinalDecisionPackage',
      completionCriteria: ['Decisión registrada', 'Evidencia vinculada', 'Contribución final visible'],
    },
  ],
};

export function deriveAdaptiveRoute(input: {
  challengeType?: ChallengeType;
  nextRecommendedStep?: string;
  mainRisk?: string;
  initialFocus?: string;
}): AdaptiveRouteType {
  const text = [input.nextRecommendedStep, input.mainRisk, input.initialFocus].filter(Boolean).join(' ').toLowerCase();
  if (text.includes('implementar') || text.includes('handoff') || text.includes('adopcion')) return 'implement_handoff';
  if (text.includes('plan') || text.includes('coordinar') || text.includes('deadline')) return 'plan_coordinate';
  if (text.includes('reconstru')) return 'reconstruct_existing';
  if (text.includes('solucion') || text.includes('dise')) return 'design_solution';
  if (input.challengeType === 'correction') return 'plan_coordinate';
  return 'explore_validate';
}

export function deriveDepthLevel(input: {
  informationReadiness?: string | null;
  risk?: string;
  pendingCount?: number;
  hasCompanyContext?: boolean;
}): AdaptiveDepthLevel {
  const risk = input.risk?.toLowerCase() ?? '';
  if (risk.includes('legal') || risk.includes('datos') || risk.includes('regulator') || (input.pendingCount ?? 0) >= 4) return 'extended';
  if (input.hasCompanyContext || input.informationReadiness === 'medium' || input.informationReadiness === 'high') return 'standard';
  return 'essential';
}

export function buildAdaptiveCoreFromInitialReview(input: {
  reviewId?: string;
  snapshotId?: string;
  challengeType?: ChallengeType;
  suggestedName?: string;
  contextInitial?: string;
  initialFocus?: string;
  expectedImpact?: string;
  mainRisk?: string;
  nextRecommendedStep?: string;
  informationReadiness?: string | null;
  pendingQuestions?: Array<string | { question?: string; id?: string; status?: string }>;
  companyContext?: unknown;
  challengeContext?: unknown;
  now?: string;
}): AdaptiveInitiativeCore {
  const now = input.now ?? new Date().toISOString();
  const pendingQuestions = normalizePendingQuestions(input.pendingQuestions);
  const routeType = deriveAdaptiveRoute({
    challengeType: input.challengeType,
    nextRecommendedStep: input.nextRecommendedStep,
    mainRisk: input.mainRisk,
    initialFocus: input.initialFocus,
  });
  const depthLevel = deriveDepthLevel({
    informationReadiness: input.informationReadiness,
    risk: input.mainRisk,
    pendingCount: pendingQuestions.length,
    hasCompanyContext: Boolean(input.companyContext),
  });
  const masterContext = buildMasterContext({
    now,
    snapshotId: input.snapshotId,
    challengeType: input.challengeType,
    routeType,
    depthLevel,
    contextInitial: input.contextInitial,
    initialFocus: input.initialFocus,
    expectedImpact: input.expectedImpact,
    mainRisk: input.mainRisk,
    nextRecommendedStep: input.nextRecommendedStep,
    pendingQuestions,
    companyContext: input.companyContext,
    challengeContext: input.challengeContext,
  });
  const stepConfigurations = ([0, 1, 2, 3, 4] as StepNumber[]).map(step =>
    buildStepConfiguration(step, routeType, depthLevel, masterContext, now, step === 0),
  );
  const progressSignal = buildProgressSignal(stepConfigurations[0], masterContext, now);
  const challengeContribution = buildChallengeContribution(masterContext, input.expectedImpact);

  return {
    schemaVersion: 'PRD-03-v0.4',
    masterContext,
    stepConfigurations,
    activeStepConfigurationId: stepConfigurations[0].id,
    progressSignal,
    challengeContribution,
    auditEvents: [
      {
        id: `audit-route-confirmed-${input.snapshotId ?? input.reviewId ?? 'local'}`,
        type: 'route_confirmed',
        createdAt: now,
        summary: 'Ruta confirmada: se creo contexto maestro y configuracion adaptativa de Step 0.',
      },
      {
        id: `audit-step-config-created-0-${input.snapshotId ?? input.reviewId ?? 'local'}`,
        type: 'step_configuration_created',
        createdAt: now,
        summary: 'Step 0 configurado por checkpoints sin materializar todas las preguntas futuras.',
      },
    ],
  };
}

export function buildAdaptiveCoreFromReview(review: InitialReview, now?: string): AdaptiveInitiativeCore | undefined {
  if (!review.output) return undefined;
  const pendingQuestions = review.output.strategicQuestions
    .filter(question => question.status !== 'answered')
    .map(question => ({ id: question.id, question: question.question, status: question.status }));
  return buildAdaptiveCoreFromInitialReview({
    reviewId: review.id,
    snapshotId: review.id,
    challengeType: review.selectedChallengeType ?? review.output.suggestedChallengeType,
    suggestedName: review.output.improvedProposal.suggestedName,
    contextInitial: review.output.understandingSummary,
    initialFocus: review.output.improvedProposal.initialFocus,
    expectedImpact: review.output.improvedProposal.expectedImpact,
    mainRisk: review.output.critique.mainRisk ?? review.output.critique.risky,
    nextRecommendedStep: review.output.improvedProposal.nextRecommendedStep,
    pendingQuestions,
    now,
  });
}

export function getAdaptiveCoreFromStep0(step0Data?: Partial<Step0Data> | null): AdaptiveInitiativeCore | undefined {
  const raw = (step0Data as Record<string, unknown> | undefined)?.adaptiveCore;
  return isAdaptiveCore(raw) ? raw : undefined;
}

export function ensureAdaptiveCoreForProject(project: Pick<Project, 'id' | 'name' | 'step0Data' | 'challengeLink'>): AdaptiveInitiativeCore {
  const existing = getAdaptiveCoreFromStep0(project.step0Data);
  if (existing) return existing;
  const raw = (project.step0Data ?? {}) as Record<string, any>;
  return buildAdaptiveCoreFromInitialReview({
    snapshotId: typeof raw.initialReviewSnapshotId === 'string' ? raw.initialReviewSnapshotId : project.id,
    challengeType: raw.challengeType,
    suggestedName: raw.suggestedName ?? project.name,
    contextInitial: raw.contextInitial ?? raw.quePasaQueQuieres,
    initialFocus: raw.initialFocus ?? raw.quePasaQueQuieres,
    expectedImpact: raw.expectedImpact ?? raw.impactWho,
    mainRisk: raw.mainRisk ?? raw.validationSignal,
    nextRecommendedStep: raw.nextRecommendedStep,
    informationReadiness: raw.informationReadiness,
    pendingQuestions: raw.pendingQuestions,
    challengeContext: project.challengeLink,
  });
}

export function getActiveStepConfiguration(core: AdaptiveInitiativeCore): StepConfiguration {
  return core.stepConfigurations.find(config => config.id === core.activeStepConfigurationId) ?? core.stepConfigurations[0];
}

export function materializeQuestionsForCheckpoint(core: AdaptiveInitiativeCore, checkpointCode: string): AdaptiveQuestion[] {
  return core.stepConfigurations
    .flatMap(config => config.checkpoints)
    .find(checkpoint => checkpoint.code === checkpointCode)?.questions ?? [];
}

function buildMasterContext(input: {
  now: string;
  snapshotId?: string;
  challengeType?: ChallengeType;
  routeType: AdaptiveRouteType;
  depthLevel: AdaptiveDepthLevel;
  contextInitial?: string;
  initialFocus?: string;
  expectedImpact?: string;
  mainRisk?: string;
  nextRecommendedStep?: string;
  pendingQuestions: string[];
  companyContext?: unknown;
  challengeContext?: unknown;
}): InitiativeMasterContext {
  const contextSnapshots: ContextSnapshot[] = [];
  if (input.companyContext) {
    contextSnapshots.push({
      id: `company-context-${input.snapshotId ?? 'local'}-v1`,
      type: 'company',
      label: 'Contexto de empresa seleccionado',
      source: 'Seleccion del pre-Step',
      coverage: 60,
      confidence: 'medium',
      capturedAt: input.now,
      constraints: ['Toda restricción derivada del contexto debe confirmarse antes de crear hard gates.'],
      actors: ['Sponsor', 'Owner de iniciativa'],
      confirmable: true,
    });
  }
  if (input.challengeContext) {
    contextSnapshots.push({
      id: `challenge-context-${input.snapshotId ?? 'local'}-v1`,
      type: 'challenge',
      label: 'Contexto heredado del reto',
      source: 'Reto vinculado',
      coverage: 70,
      confidence: 'medium',
      capturedAt: input.now,
      constraints: ['Validar que la contribución no duplique iniciativas existentes.'],
      actors: ['Challenge Owner', 'Portfolio Lead'],
      confirmable: true,
    });
  }

  return {
    id: `master-context-${input.snapshotId ?? 'local'}-v1`,
    version: 1,
    initialReviewSnapshotId: input.snapshotId,
    challengeType: input.challengeType,
    routeType: input.routeType,
    depthLevel: input.depthLevel,
    maturity: input.routeType === 'reconstruct_existing' ? 'legacy_reconstruction' : input.routeType === 'implement_handoff' ? 'solution_proposed' : 'problem',
    knownFacts: [input.contextInitial, input.initialFocus, input.expectedImpact].filter(isNonEmpty),
    assumptions: input.pendingQuestions.length > 0 ? input.pendingQuestions : ['La hipótesis central aún debe confirmarse en Step 0.'],
    missingCriticalInformation: input.pendingQuestions,
    risks: [input.mainRisk].filter(isNonEmpty),
    decisions: [input.nextRecommendedStep ?? 'Definir decisión futura en CP-0.3.'],
    contextSnapshots,
    createdAt: input.now,
  };
}

function buildStepConfiguration(
  step: StepNumber,
  routeType: AdaptiveRouteType,
  depthLevel: AdaptiveDepthLevel,
  masterContext: InitiativeMasterContext,
  now: string,
  active: boolean,
): StepConfiguration {
  const checkpoints = CHECKPOINTS[step].map((checkpoint, index) => ({
    ...checkpoint,
    status: (active && index === 0 ? 'ready' : 'locked') as AdaptiveCheckpointStatus,
    questions: buildQuestionsForCheckpoint(checkpoint.code, routeType, masterContext),
    gates: buildGatesForCheckpoint(checkpoint.code, masterContext),
  }));
  return {
    id: `step-${step}-${routeType}-v1`,
    step,
    version: 1,
    visibleName: STEP_VISIBLE_NAME_BY_ROUTE[routeType][step],
    stablePurpose: STABLE_PURPOSE[step],
    objective: buildStepObjective(step, routeType),
    expectedOutput: STEP_OUTPUT_BY_ROUTE[routeType][step],
    routeType,
    depthLevel,
    checkpoints,
    closureCriteria: buildClosureCriteria(step),
    generatedAt: now,
    generatedBy: 'deterministic_fallback',
  };
}

function buildQuestionsForCheckpoint(code: string, routeType: AdaptiveRouteType, masterContext: InitiativeMasterContext): AdaptiveQuestion[] {
  const base: AdaptiveQuestion[] = [];
  const add = (question: Omit<AdaptiveQuestion, 'id' | 'checkpointId'>) => {
    base.push({
      id: `${code.toLowerCase().replace('.', '-')}-q${base.length + 1}`,
      checkpointId: code,
      ...question,
    });
  };

  if (code === 'CP-0.1') {
    add({
      prompt: '¿Qué resultado o cambio debe quedar entendible para un líder?',
      purpose: 'Aclarar propósito antes de ejecutar método.',
      clarifiesVariable: 'objective',
      priority: 'must',
      answerType: 'free_text',
      reason: 'Step 0 no puede cerrar sin propósito entendible.',
      source: 'method_catalog',
      allowsUnknown: false,
      optional: false,
      prefilledFrom: masterContext.knownFacts[0] ? 'InitialReviewSnapshot' : undefined,
    });
    if (masterContext.contextSnapshots.some(snapshot => snapshot.type === 'challenge')) {
      add({
        prompt: '¿Qué parte del reto padre aborda esta iniciativa?',
        purpose: 'Trazar contribución sin duplicar cobertura.',
        clarifiesVariable: 'challengeContribution.subproblem',
        priority: 'must',
        answerType: 'free_text',
        reason: 'La iniciativa está vinculada a un reto y debe reportar contribución.',
        source: 'challenge_context',
        allowsUnknown: true,
        optional: false,
      });
    }
  }

  if (code === 'CP-0.2') {
    add({
      prompt: '¿Quién es el owner operativo y qué actor debe confirmar condiciones?',
      purpose: 'Evitar avanzar sin responsable o validador.',
      clarifiesVariable: 'owner_and_actor_required',
      priority: 'must',
      answerType: 'owner',
      reason: 'Sin owner hay hard gate de Step 0.',
      source: 'method_catalog',
      allowsUnknown: false,
      optional: false,
    });
    if (masterContext.contextSnapshots.some(snapshot => snapshot.type === 'company')) {
      add({
        prompt: '¿Qué restricción de empresa podría afectar evidencia, datos o aprobaciones?',
        purpose: 'Usar contexto organizacional como hipótesis confirmable.',
        clarifiesVariable: 'company_constraints',
        priority: 'should',
        answerType: 'free_text',
        reason: 'El contexto de empresa influye, pero no crea verdad silenciosa.',
        source: 'company_context',
        allowsUnknown: true,
        optional: false,
      });
    }
  }

  if (code === 'CP-0.3') {
    add({
      prompt: '¿Cuál es la hipótesis o pregunta central que debe validarse o decidirse?',
      purpose: 'Crear Validation Contract.',
      clarifiesVariable: 'critical_hypothesis',
      priority: 'must',
      answerType: 'free_text',
      reason: 'Step 0 debe cerrar con hipótesis o pregunta central.',
      source: 'method_catalog',
      allowsUnknown: false,
      optional: false,
    });
    add({
      prompt: '¿Qué evidencia o criterio permitiría tomar la siguiente decisión?',
      purpose: 'Definir criterio de cierre y próxima decisión.',
      clarifiesVariable: 'decision_criteria',
      priority: 'must',
      answerType: 'free_text',
      reason: 'No se debe avanzar sin criterio de decisión.',
      source: 'critical_missing',
      allowsUnknown: true,
      optional: false,
    });
  }

  if (code.startsWith('CP-1')) {
    add({
      prompt: '¿Qué evidencia con fuente sostiene o contradice el foco vigente?',
      purpose: 'Separar hechos, señales y supuestos.',
      clarifiesVariable: 'evidence_map',
      priority: 'must',
      answerType: 'evidence_link',
      reason: 'Step 1 debe cerrar con foco sustentado y Evidence Map.',
      source: 'method_catalog',
      allowsUnknown: true,
      optional: false,
    });
  }

  if (code.startsWith('CP-2')) {
    add({
      prompt: routeType === 'implement_handoff'
        ? '¿Qué guardrail impide ejecutar sin autorización o readiness suficiente?'
        : '¿Qué alternativa merece compararse antes de seleccionar la apuesta?',
      purpose: 'Evitar saltar de evidencia a solución única.',
      clarifiesVariable: 'alternative_or_guardrail',
      priority: 'must',
      answerType: 'free_text',
      reason: 'Step 2 debe comparar y seleccionar una apuesta ejecutable.',
      source: 'method_catalog',
      allowsUnknown: true,
      optional: false,
    });
  }

  if (code.startsWith('CP-3')) {
    add({
      prompt: '¿Qué resultado relevante quedó asociado a fuente, fecha, hipótesis y criterio?',
      purpose: 'Registrar ejecución trazable.',
      clarifiesVariable: 'execution_evidence',
      priority: 'must',
      answerType: 'evidence_link',
      reason: 'Step 3 no escala automáticamente; propone decisión con evidencia.',
      source: 'method_catalog',
      allowsUnknown: true,
      optional: false,
    });
  }

  if (code.startsWith('CP-4')) {
    add({
      prompt: '¿Quién recibe el paquete final y quién queda como owner del siguiente paso?',
      purpose: 'Cerrar o transferir sin perder ownership.',
      clarifiesVariable: 'handoff_owner',
      priority: 'must',
      answerType: 'owner',
      reason: 'Step 4 debe terminar con decisión, transferencia o cierre formal.',
      source: 'method_catalog',
      allowsUnknown: false,
      optional: false,
    });
  }

  return base;
}

function buildGatesForCheckpoint(code: string, masterContext: InitiativeMasterContext) {
  const gates = [];
  if (code === 'CP-0.2') {
    gates.push({
      id: 'gate-owner-required',
      severity: 'hard' as const,
      label: 'Owner requerido',
      condition: 'No existe owner operativo confirmado.',
      resolution: 'Asignar owner o registrar quién debe confirmarlo antes de cerrar Step 0.',
    });
  }
  if (code === 'CP-0.3') {
    gates.push({
      id: 'gate-decision-criteria-required',
      severity: 'hard' as const,
      label: 'Criterio de decisión requerido',
      condition: 'No existe decisión futura ni criterio de éxito.',
      resolution: 'Definir qué decisión habilita la iniciativa y qué evidencia mínima se necesita.',
    });
  }
  if (masterContext.contextSnapshots.some(snapshot => snapshot.type === 'company' && snapshot.coverage < 50)) {
    gates.push({
      id: 'gate-low-context-coverage',
      severity: 'soft' as const,
      label: 'Contexto incompleto',
      condition: 'La cobertura de contexto empresarial es baja.',
      resolution: 'Presentar restricciones como hipótesis a confirmar, no como reglas.',
    });
  }
  return gates;
}

function buildStepObjective(step: StepNumber, routeType: AdaptiveRouteType): string {
  if (step === 0) return 'Convertir la intención inicial en hipótesis estratégica delimitada y contrato de validación o ejecución.';
  if (step === 1) return 'Delimitar y fundamentar el foco mediante evidencia suficiente para decidir qué pasa a diseño.';
  if (step === 2) return 'Diseñar y seleccionar una apuesta concreta, comparada y ejecutable según evidencia, contexto y restricciones.';
  if (step === 3) return 'Ejecutar la apuesta, capturar evidencia trazable, aprender y proponer una decisión sustentada.';
  return routeType === 'implement_handoff'
    ? 'Convertir la decisión en transferencia, ownership operativo y continuidad medible.'
    : 'Cerrar la iniciativa con paquete de decisión, aprendizaje y siguiente horizonte.';
}

function buildClosureCriteria(step: StepNumber): string[] {
  if (step === 0) {
    return [
      'Objetivo o resultado entendible',
      'Alcance inicial y owner',
      'Tipo de reto y ruta confirmada',
      'Hipótesis o pregunta central',
      'Decisión futura y criterio de éxito',
      'Output final confirmado',
    ];
  }
  if (step === 1) {
    return ['Foco delimitado', 'Evidencia con fuentes', 'Hechos y supuestos separados', 'Recomendacion para Step 2'];
  }
  if (step === 2) {
    return ['Criterios claros', 'Alternativas comparadas', 'Apuesta seleccionada', 'Plan medible con guardrails'];
  }
  if (step === 3) {
    return ['Resultados vinculados a fuentes', 'Limitaciones visibles', 'Aprendizajes', 'Decisión basada en evidencia'];
  }
  return ['Paquete final', 'Decisión registrada', 'Owner de siguiente paso o cierre formal', 'Contribución final visible'];
}

function buildProgressSignal(stepConfiguration: StepConfiguration, masterContext: InitiativeMasterContext, now: string): ProgressSignal {
  const checkpoint = stepConfiguration.checkpoints[0];
  const hasRisk = masterContext.risks.length > 0;
  return {
    id: `progress-signal-${masterContext.id}`,
    step: stepConfiguration.step,
    checkpointCode: checkpoint.code,
    checkpointTitle: checkpoint.title,
    health: hasRisk ? 'attention' : 'healthy',
    hypothesis: masterContext.assumptions[0] ?? 'Hipotesis pendiente de definir en Step 0.',
    evidence: masterContext.knownFacts[0] ?? 'Sin evidencia robusta aún; Step 0 ordena contexto.',
    evidenceStrength: masterContext.knownFacts.length > 1 ? 'weak' : 'none',
    blocker: hasRisk ? masterContext.risks[0] : '',
    actorRequired: masterContext.contextSnapshots.some(snapshot => snapshot.type === 'challenge') ? 'Challenge Owner' : 'Owner de iniciativa',
    nextAction: `Iniciar ${checkpoint.code}: ${checkpoint.title}.`,
    upcomingDecision: masterContext.decisions[0] ?? 'Definir decisión futura en CP-0.3.',
    updatedAt: now,
  };
}

function buildChallengeContribution(masterContext: InitiativeMasterContext, expectedImpact?: string): ChallengeContribution | undefined {
  if (!masterContext.contextSnapshots.some(snapshot => snapshot.type === 'challenge')) return undefined;
  return {
    subproblem: masterContext.knownFacts[0] ?? 'Subproblema pendiente de delimitar.',
    hypothesis: masterContext.assumptions[0] ?? 'Hipotesis pendiente.',
    kpi: expectedImpact ?? 'KPI pendiente de asociar.',
    contributionType: 'discover',
    evidenceStrength: 'weak',
    scope: 'Inicial, sujeto a confirmacion en Step 0.',
    overlap: 'low',
  };
}

function normalizePendingQuestions(input?: Array<string | { question?: string; id?: string; status?: string }>): string[] {
  return (input ?? [])
    .map(item => typeof item === 'string' ? item : item.question ?? '')
    .map(item => item.trim())
    .filter(Boolean);
}

function isAdaptiveCore(value: unknown): value is AdaptiveInitiativeCore {
  return Boolean(value && typeof value === 'object' && (value as AdaptiveInitiativeCore).schemaVersion === 'PRD-03-v0.4');
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
