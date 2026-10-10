import type {
  ConfidentialityLevel,
  Challenge,
  ChallengeCoverageStatus,
  ChallengeStatus,
  ChallengeType,
  ImportedItem,
  ImportedItemStatus,
  Initiative,
  InitiativePortfolioStatus,
  PortfolioStepNumber,
  RiskLevel,
  StepContentStatus,
  StepProgress,
  StepValidationStatus,
  StrategicFrontStatus,
  StrategicFrontQualityCriterion,
  StrategicFrontQualityEvaluation,
  StrategicFrontQualityInput,
  StrategicFrontQualityReview,
  ContributionType,
  DecisionType,
  EvidenceVerificationStatus,
} from './types';

type NormalizedValue = string;

function normalizeByMap<T extends NormalizedValue>(
  value: string | null | undefined,
  map: Record<string, T>,
  fallback: T,
): T {
  if (!value) return fallback;
  return map[value] ?? map[value.toLowerCase()] ?? fallback;
}

const STRATEGIC_FRONT_STATUS_NORMALIZATION: Record<string, StrategicFrontStatus> = {
  draft: 'draft',
  active: 'with_active_challenges',
  tracking: 'in_tracking',
  paused: 'pending_decision',
  closed: 'closed',
  in_definition: 'in_definition',
  with_active_challenges: 'with_active_challenges',
  in_tracking: 'in_tracking',
  pending_decision: 'pending_decision',
};

const CHALLENGE_STATUS_NORMALIZATION: Record<string, ChallengeStatus> = {
  draft: 'draft',
  listo_para_activar: 'ready_to_activate',
  ready_to_activate: 'ready_to_activate',
  activo_interno: 'activating_team',
  activating_team: 'activating_team',
  publicado: 'active',
  active: 'active',
  recibiendo_iniciativas: 'receiving_initiatives',
  receiving_initiatives: 'receiving_initiatives',
  con_iniciativas_activas: 'in_tracking',
  in_tracking: 'in_tracking',
  pendiente_de_decision: 'pending_decision',
  pending_decision: 'pending_decision',
  cerrado: 'closed',
  closed: 'closed',
};

const CHALLENGE_COVERAGE_NORMALIZATION: Record<string, ChallengeCoverageStatus> = {
  no_coverage: 'no_coverage',
  sin_cobertura: 'no_coverage',
  partial: 'partial',
  cobertura_parcial: 'partial',
  sufficient: 'sufficient',
  cobertura_suficiente: 'sufficient',
  overlapped: 'overlapped',
  resuelto: 'ready_for_decision',
  ready_for_decision: 'ready_for_decision',
  cerrar: 'ready_for_decision',
  needs_reformulation: 'needs_reformulation',
  reformular: 'needs_reformulation',
  necesita_reformulacion: 'needs_reformulation',
};

const INITIATIVE_STATUS_NORMALIZATION: Record<string, InitiativePortfolioStatus> = {
  draft: 'draft',
  imported_pending_validation: 'imported_pending_validation',
  in_step_0: 'in_step_0',
  en_step_0: 'in_step_0',
  in_step_1: 'in_step_1',
  en_step_1: 'in_step_1',
  in_step_2: 'in_step_2',
  en_step_2: 'in_step_2',
  in_step_3: 'in_step_3',
  en_step_3: 'in_step_3',
  in_step_4: 'in_step_4',
  en_step_4: 'in_step_4',
  blocked: 'blocked',
  bloqueada: 'blocked',
  ready_for_decision: 'ready_for_decision',
  lista_para_decision: 'ready_for_decision',
  waiting_for_review: 'imported_pending_validation',
  esperando_revision: 'imported_pending_validation',
  closed: 'closed',
  cerrada: 'closed',
};

const STEP_CONTENT_NORMALIZATION: Record<string, StepContentStatus> = {
  empty: 'empty',
  partial: 'partial',
  complete_preliminary: 'complete_preliminary',
  complete_with_observations: 'complete_with_observations',
  validated: 'validated',
};

const STEP_VALIDATION_NORMALIZATION: Record<string, StepValidationStatus> = {
  not_reviewed: 'not_reviewed',
  ai_reviewed: 'ai_reviewed',
  requires_mentor: 'requires_mentor',
  requires_challenge_owner: 'requires_challenge_owner',
  requires_sponsor: 'requires_sponsor',
  approved: 'approved',
};

const EVIDENCE_VERIFICATION_NORMALIZATION: Record<string, EvidenceVerificationStatus> = {
  unverified: 'unverified',
  ai_detected: 'ai_detected',
  user_confirmed: 'user_confirmed',
  mentor_confirmed: 'mentor_confirmed',
};

const CHALLENGE_TYPE_NORMALIZATION: Record<string, ChallengeType> = {
  correction: 'correction',
  growth: 'growth',
  exploration: 'exploration',
  correccion: 'correction',
  crecimiento: 'growth',
  exploracion: 'exploration',
};

const CONTRIBUTION_TYPE_NORMALIZATION: Record<string, ContributionType> = {
  discover: 'discover',
  validate: 'validate',
  partially_solve: 'partially_solve',
  directly_solve: 'directly_solve',
  descubrir: 'discover',
  validar: 'validate',
  resolver_parcialmente: 'partially_solve',
  resolver_directamente: 'directly_solve',
};

const CONFIDENTIALITY_NORMALIZATION: Record<string, ConfidentialityLevel> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  no_ai_full_content: 'no_ai_full_content',
};

const IMPORTED_ITEM_STATUS_NORMALIZATION: Record<string, ImportedItemStatus> = {
  detected: 'detected',
  needs_classification: 'needs_classification',
  conflict: 'conflict',
  ready_to_publish: 'ready_to_publish',
  published: 'published',
  discarded: 'discarded',
};

const DECISION_TYPE_NORMALIZATION: Record<string, DecisionType> = {
  continue_validating: 'continue_validating',
  iterate: 'iterate',
  pivot: 'pivot',
  scale_same_area: 'scale_same_area',
  scale_similar_area: 'scale_similar_area',
  transfer_to_it: 'transfer_to_it',
  integrate_to_roadmap: 'integrate_to_roadmap',
  pause: 'pause',
  close_with_learning: 'close_with_learning',
  pasar_a_segunda_fase: 'scale_same_area',
  iterar_desde_otro_angulo: 'iterate',
  transferir_a_ti: 'transfer_to_it',
  transferir_al_area_afectada: 'integrate_to_roadmap',
  evaluar_innovacion_abierta: 'pivot',
  escalar_piloto: 'scale_same_area',
  cerrar_con_aprendizaje: 'close_with_learning',
};

export function normalizeStrategicFrontStatus(status: StrategicFrontStatus | string | null | undefined): StrategicFrontStatus {
  return normalizeByMap(status, STRATEGIC_FRONT_STATUS_NORMALIZATION, 'draft');
}

export function normalizeChallengeStatus(status: ChallengeStatus | string | null | undefined): ChallengeStatus {
  return normalizeByMap(status, CHALLENGE_STATUS_NORMALIZATION, 'draft');
}

export function normalizeChallengeCoverageStatus(
  status: ChallengeCoverageStatus | string | null | undefined,
): ChallengeCoverageStatus {
  return normalizeByMap(status, CHALLENGE_COVERAGE_NORMALIZATION, 'no_coverage');
}

export function normalizeInitiativeStatus(
  status: InitiativePortfolioStatus | string | null | undefined,
): InitiativePortfolioStatus {
  return normalizeByMap(status, INITIATIVE_STATUS_NORMALIZATION, 'draft');
}

export function normalizeStepContentStatus(status: StepContentStatus | string | null | undefined): StepContentStatus {
  return normalizeByMap(status, STEP_CONTENT_NORMALIZATION, 'empty');
}

export function normalizeStepValidationStatus(
  status: StepValidationStatus | string | null | undefined,
): StepValidationStatus {
  return normalizeByMap(status, STEP_VALIDATION_NORMALIZATION, 'not_reviewed');
}

export function normalizeEvidenceVerificationStatus(
  status: EvidenceVerificationStatus | string | null | undefined,
): EvidenceVerificationStatus {
  return normalizeByMap(status, EVIDENCE_VERIFICATION_NORMALIZATION, 'unverified');
}

export function normalizeImportedItemStatus(
  status: ImportedItemStatus | string | null | undefined,
): ImportedItemStatus {
  return normalizeByMap(status, IMPORTED_ITEM_STATUS_NORMALIZATION, 'detected');
}

export function normalizeDecisionType(value: DecisionType | string | null | undefined): DecisionType {
  return normalizeByMap(value, DECISION_TYPE_NORMALIZATION, 'continue_validating');
}

export function normalizeChallengeType(value: ChallengeType | string | null | undefined): ChallengeType {
  return normalizeByMap(value, CHALLENGE_TYPE_NORMALIZATION, 'exploration');
}

export function normalizeContributionType(value: ContributionType | string | null | undefined): ContributionType {
  return normalizeByMap(value, CONTRIBUTION_TYPE_NORMALIZATION, 'discover');
}

export function normalizeConfidentialityLevel(
  value: ConfidentialityLevel | string | null | undefined,
): ConfidentialityLevel {
  return normalizeByMap(value, CONFIDENTIALITY_NORMALIZATION, 'medium');
}

export function getConfidentialityAllowsFullAIProcessing(level: ConfidentialityLevel | string | null | undefined) {
  return normalizeConfidentialityLevel(level) !== 'no_ai_full_content';
}

export function isChallengeReadyToActivate(challenge: Pick<Challenge, 'challengeOwner' | 'challengeOwnerStatus' | 'sponsorStatus' | 'visibleToParticipants' | 'activationMode' | 'selectedPeople' | 'assignedSquad' | 'openCallStatus'> | null | undefined) {
  if (!challenge) return false;
  if (challenge.visibleToParticipants) return false;
  if (!challenge.challengeOwner.trim()) return false;
  if (challenge.challengeOwnerStatus !== 'confirmado') return false;
  if (challenge.sponsorStatus !== 'confirmado') return false;
  if (challenge.activationMode === 'convocatoria_abierta') return challenge.openCallStatus === 'activa';
  if (challenge.activationMode === 'personas_seleccionadas') return challenge.selectedPeople.length > 0;
  if (challenge.activationMode === 'squad_asignado' || challenge.activationMode === 'equipo_core_encargado') {
    return challenge.assignedSquad.length > 0;
  }
  if (challenge.activationMode === 'innovacion_abierta_partner_externo') {
    return challenge.selectedPeople.length > 0 || challenge.assignedSquad.length > 0;
  }
  return false;
}

export function canChallengeReceiveInitiatives(challenge: Pick<Challenge, 'status' | 'visibleToParticipants' | 'openCallStatus' | 'activationMode'> | null | undefined) {
  if (!challenge) return false;
  if (!challenge.visibleToParticipants) return false;
  const status = normalizeChallengeStatus(challenge.status);
  return status === 'active' || status === 'receiving_initiatives' || status === 'in_tracking';
}

/**
 * Avance de una iniciativa: un criterio para todo el portafolio (tarjeta y detalle del reto,
 * /portfolio/iniciativas) y el mismo que "Mis iniciativas" (getAdaptiveProgress en
 * app/pages/dashboard-initiative-state.ts). Cada Step completo suma 20%: "Step 2" en curso es
 * 2/5 (40%); lista para decisión o cerrada es 5/5. Antes el reto usaba una escala propia
 * (Step 0 = 15%) y la misma iniciativa salía 15% en el reto y 0% en el listado (2026-10-10).
 */
export function getInitiativeStepProgress(
  initiative: Pick<Initiative, 'status' | 'currentStep' | 'readyForDecision' | 'progressSignal'>,
): { completed: number; percent: number } {
  const status = normalizeInitiativeStatus(initiative.status);
  if (status === 'closed') return { completed: 5, percent: 100 };
  const readyForDecision = Boolean(initiative.readyForDecision)
    || status === 'ready_for_decision'
    || initiative.progressSignal?.health === 'ready_for_decision';
  const current = Number(String(initiative.currentStep ?? '').match(/\d/)?.[0] ?? 0);
  const completed = readyForDecision ? 5 : Math.min(4, Math.max(0, current));
  return { completed, percent: completed * 20 };
}

export function isInitiativeReadyForDecision(initiative: Pick<Initiative, 'status' | 'currentStep' | 'readyForDecision'> | null | undefined) {
  if (!initiative) return false;
  const status = normalizeInitiativeStatus(initiative.status);
  return initiative.readyForDecision || initiative.currentStep === 'Step 4' || status === 'ready_for_decision';
}

export function canImportedItemBePublished(item: Pick<ImportedItem, 'status' | 'confidenceScore' | 'missingCriticalFields' | 'duplicateOfItemId'> | null | undefined) {
  if (!item) return false;
  return normalizeImportedItemStatus(item.status) === 'ready_to_publish'
    && item.confidenceScore >= 0.7
    && item.missingCriticalFields.length === 0
    && !item.duplicateOfItemId;
}

export function getStepProgressRiskLevel(stepProgress: Pick<StepProgress, 'contentStatus' | 'validationStatus' | 'completionScore' | 'missingCriticalFields' | 'risks'> | null | undefined): RiskLevel {
  if (!stepProgress) return 'medium';

  const contentStatus = normalizeStepContentStatus(stepProgress.contentStatus);
  const validationStatus = normalizeStepValidationStatus(stepProgress.validationStatus);
  const criticalCount = stepProgress.missingCriticalFields.length;
  const riskSignals = stepProgress.risks.length;

  if (validationStatus === 'requires_sponsor' || validationStatus === 'requires_challenge_owner') return 'high';
  if (contentStatus === 'empty' || stepProgress.completionScore < 35 || criticalCount >= 2 || riskSignals >= 3) return 'high';
  if (contentStatus === 'partial' || contentStatus === 'complete_with_observations' || stepProgress.completionScore < 75 || criticalCount > 0 || riskSignals > 0) {
    return 'medium';
  }
  return 'low';
}

export function normalizePortfolioStep(step: PortfolioStepNumber | number | string | null | undefined): PortfolioStepNumber {
  const numeric = typeof step === 'number' ? step : Number(step);
  if (Number.isNaN(numeric)) return 0;
  return Math.min(Math.max(Math.round(numeric), 0), 4) as PortfolioStepNumber;
}

const BROAD_FRONT_PATTERNS = [
  'transformacion digital',
  'innovacion',
  'mejorar la empresa',
  'optimizar procesos',
  'eficiencia',
  'productividad',
];

const SOLUTION_FRONT_PATTERNS = [
  'implementar dashboard',
  'crear dashboard',
  'dashboard',
  'crear chatbot',
  'chatbot',
  'desarrollar una app',
  'crear app',
  'app de',
  'automatizar reportes',
  'crear plataforma',
  'implementar plataforma',
  'implementar ia',
  'herramienta',
  'software',
];

const TIME_WORDS = ['dia', 'dias', 'semana', 'semanas', 'mes', 'meses', 'hora', 'horas', 'tiempo', 'plazo', 'duracion'];
const SATISFACTION_WORDS = ['satisfaccion', 'nps', 'csat', 'experiencia percibida', 'percepcion'];
const COST_WORDS = ['costo', 'coste', 'gasto', 'ahorro', 'presupuesto'];
const ADOPTION_WORDS = ['adopcion', 'uso', 'usuarios', 'activacion', 'conversion'];

export function evaluateStrategicFrontQuality(input: StrategicFrontQualityInput): StrategicFrontQualityEvaluation {
  const combinedText = normalizeStrategicQualityText([
    input.name,
    input.strategicObjective,
    input.whyNow ?? '',
    input.notes ?? '',
  ].join(' '));
  const nameText = normalizeStrategicQualityText(input.name);
  const kpiText = normalizeStrategicQualityText(input.mainKpi);
  const metricValuesText = normalizeStrategicQualityText([input.baseline, input.target, input.threshold ?? ''].join(' '));
  const warnings: string[] = [];

  const isTooBroad = BROAD_FRONT_PATTERNS.some(pattern => nameText === pattern || nameText.includes(pattern))
    && !hasConcreteBusinessContext(combinedText);
  const looksLikeSolution = SOLUTION_FRONT_PATTERNS.some(pattern => nameText.includes(pattern) || combinedText.includes(pattern));
  const hasBusinessPriority = Boolean(input.name.trim() && input.strategicObjective.trim() && !isTooBroad && !looksLikeSolution);
  const hasSignal = Boolean(input.mainKpi.trim());
  const hasArea = Boolean(input.area?.trim());
  const hasSponsor = Boolean(input.sponsor.trim());
  const hasHorizon = Boolean(input.horizon.trim());
  const hasScope = hasScopeSignal(combinedText);
  const metricCoherence = getMetricCoherenceStatus(kpiText, metricValuesText);
  const canGenerateChallenges = !looksLikeSolution
    && Boolean(input.name.trim())
    && Boolean(input.strategicObjective.trim())
    && hasSignal
    && hasArea
    && (hasScope || hasHorizon);

  if (isTooBroad) {
    warnings.push('Puedes fortalecer el foco expresando que proceso, cliente, area o resultado de negocio quieres mover.');
  }
  if (looksLikeSolution) {
    warnings.push('Conviene reformular el nombre como prioridad de negocio, no como herramienta o iniciativa.');
  }
  if (!hasSignal) {
    warnings.push('Agrega una senal observable de avance: tiempo, conversion, adopcion, reclamos, cumplimiento, satisfaccion o costo.');
  }
  if (metricCoherence === 'needs_improvement') {
    warnings.push('Conviene alinear KPI, baseline, meta y umbral bajo una misma logica de medicion.');
  }
  if (!hasArea) {
    warnings.push('Aun no se ha indicado que area tendra responsabilidad principal.');
  }
  if (!hasSponsor) {
    warnings.push('Puedes guardar sin sponsor. Antes de activar retos conviene definir quien puede respaldar o destrabar este frente.');
  }
  if (!hasScope) {
    warnings.push('Puedes fortalecer el alcance indicando segmento, proceso, periodo o limites.');
  }

  const criteria: StrategicFrontQualityCriterion[] = [
    {
      id: 'business_priority',
      label: 'Prioridad de negocio clara',
      status: hasBusinessPriority ? 'complete' : input.name.trim() || input.strategicObjective.trim() ? 'needs_improvement' : 'missing',
      feedback: hasBusinessPriority
        ? 'Expresa un resultado de negocio que vale la pena mover.'
        : isTooBroad
          ? 'Puedes aterrizarla con proceso, cliente, area o resultado.'
          : 'Pendiente por definir que resultado de negocio quieres mover.',
    },
    {
      id: 'not_solution',
      label: 'No parece una solucion puntual',
      status: looksLikeSolution ? 'needs_improvement' : input.name.trim() ? 'complete' : 'missing',
      feedback: looksLikeSolution
        ? 'Conviene describir el resultado de negocio antes que la herramienta.'
        : 'Se lee como prioridad, no como herramienta especifica.',
    },
    {
      id: 'responsible_area',
      label: 'Area responsable definida',
      status: hasArea ? 'complete' : 'missing',
      feedback: hasArea ? 'Hay una unidad principal asociada.' : 'Aun no se ha indicado el area responsable.',
    },
    {
      id: 'sponsor',
      label: 'Sponsor o respaldo claro',
      status: hasSponsor ? 'complete' : 'missing',
      feedback: hasSponsor ? 'Hay respaldo visible para priorizar o destrabar.' : 'Conviene aclararlo antes de activar retos.',
    },
    {
      id: 'progress_signal',
      label: 'KPI o senal de avance definida',
      status: hasSignal ? 'complete' : 'missing',
      feedback: hasSignal ? 'La senal principal esta declarada.' : 'Pendiente por definir como sabras que el frente avanza.',
    },
    {
      id: 'metric_coherence',
      label: 'Meta conversa con el KPI',
      status: metricCoherence,
      feedback: getMetricCoherenceFeedback(kpiText, metricValuesText, metricCoherence),
    },
    {
      id: 'horizon',
      label: 'Horizonte claro',
      status: hasHorizon ? 'complete' : 'missing',
      feedback: hasHorizon ? 'Tiene una ventana temporal para revisar avance.' : 'Pendiente por definir cuando revisaras avance.',
    },
    {
      id: 'scope',
      label: 'Alcance suficientemente delimitado',
      status: hasScope ? 'complete' : combinedText.length > 80 ? 'needs_improvement' : 'missing',
      feedback: hasScope ? 'Incluye alguna senal de limite o foco.' : 'Puedes aclarar segmento, proceso, area, periodo o limites.',
    },
    {
      id: 'actionable_challenges',
      label: 'Puede derivar en retos accionables',
      status: canGenerateChallenges ? 'complete' : looksLikeSolution || isTooBroad ? 'needs_improvement' : 'missing',
      feedback: canGenerateChallenges
        ? 'Tiene base suficiente para formular retos derivados.'
        : 'Puede madurar un poco mas antes de activar retos.',
    },
  ];

  const missingCriticalFields = [
    ['Nombre del frente', input.name],
    ['Area o unidad involucrada', input.area ?? ''],
    ['Objetivo estrategico', input.strategicObjective],
    ['KPI principal o senal de avance', input.mainKpi],
    ['Horizonte', input.horizon],
    ['Prioridad', input.priority],
    ['Estado inicial', input.status],
  ]
    .filter(([, value]) => !String(value).trim())
    .map(([label]) => label);

  const missingRecommendedFields = [
    ['Sponsor', input.sponsor],
    ['Email del sponsor', input.sponsorEmail ?? ''],
    ['Baseline actual', input.baseline],
    ['Meta esperada', input.target],
    ['Umbral minimo de avance', input.threshold ?? ''],
    ['Fecha estimada de termino', input.endDate ?? ''],
    ['Lectura actual del frente', input.whyNow ?? ''],
    ['Notas internas', input.notes ?? ''],
  ]
    .filter(([, value]) => !String(value).trim())
    .map(([label]) => label);

  const hasInitialDraft = Boolean(input.name.trim() && hasArea && input.priority && input.status);
  const hasGoodBase = hasInitialDraft && Boolean(input.strategicObjective.trim() || hasSignal);
  const hasReadyBase = Boolean(input.strategicObjective.trim() && hasSignal && hasHorizon && hasArea && !looksLikeSolution && !isTooBroad);
  const qualityStatus = hasReadyBase ? 'green' : hasGoodBase ? 'yellow' : 'red';

  return {
    qualityStatus,
    diagnosis: getQualityDiagnosis(qualityStatus, { looksLikeSolution, isTooBroad, missingCriticalFields, missingRecommendedFields, canGenerateChallenges }),
    nextBestAction: getNextBestStrategicFrontAction(input, { looksLikeSolution, isTooBroad, hasSignal, hasArea, hasHorizon, hasScope, metricCoherence }),
    criteria,
    warnings,
    missingCriticalFields,
    missingRecommendedFields,
    canGenerateChallenges,
  };
}

export function reviewStrategicFrontQualityMock(input: StrategicFrontQualityInput): StrategicFrontQualityReview {
  const evaluation = evaluateStrategicFrontQuality(input);
  const strengths = evaluation.criteria
    .filter(item => item.status === 'complete')
    .slice(0, 4)
    .map(item => item.feedback);
  const missingElements = evaluation.criteria
    .filter(item => item.status === 'missing')
    .map(item => item.label);
  const risks = [
    ...evaluation.warnings,
    ...evaluation.criteria
      .filter(item => item.status === 'needs_improvement')
      .map(item => item.feedback),
  ];

  return {
    qualityStatus: evaluation.qualityStatus,
    diagnosis: evaluation.diagnosis,
    strengths: strengths.length > 0 ? strengths : ['Hay una intencion inicial que puede convertirse en frente si la delimitas mejor.'],
    risks: uniqueStrategicQualityItems(risks).slice(0, 5),
    missingElements,
    suggestedRewrite: buildSuggestedStrategicFrontRewrite(input, evaluation.qualityStatus),
    canGenerateChallenges: evaluation.canGenerateChallenges,
    suggestedChallenges: evaluation.canGenerateChallenges ? buildSuggestedChallenges(input) : [],
    confidenceNote: 'No se agregaron datos nuevos. Solo se mejoro claridad usando lo que escribiste.',
  };
}

export const reviewStrategicFrontQuality = reviewStrategicFrontQualityMock;

function getQualityDiagnosis(
  qualityStatus: StrategicFrontQualityEvaluation['qualityStatus'],
  context: {
    looksLikeSolution: boolean;
    isTooBroad: boolean;
    missingCriticalFields: string[];
    missingRecommendedFields: string[];
    canGenerateChallenges: boolean;
  },
) {
  if (qualityStatus === 'red') {
    if (context.looksLikeSolution) return 'Ya puedes capturar la idea inicial. Para fortalecerla, cambia el foco desde la herramienta hacia el resultado de negocio que quieres mover.';
    if (context.isTooBroad) return 'Ya puedes capturar esta prioridad. Starteria te ayudara a aterrizarla con mas foco antes de convertirla en retos.';
    return 'Ya puedes capturar esta prioridad como primer borrador. Despues podras fortalecerla paso a paso.';
  }
  if (qualityStatus === 'green') {
    return 'Este frente ya tiene claridad suficiente para convertirse en retos accionables.';
  }
  if (context.missingCriticalFields.length > 0) {
    return 'Ya tienes una base inicial. Para que este frente pueda convertirse en retos accionables, aclara el resultado de negocio y el horizonte de revision.';
  }
  if (context.missingRecommendedFields.includes('Sponsor')) {
    return 'Ya hay senales utiles. Antes de activar retos, conviene definir quien puede respaldar o destrabar este frente.';
  }
  return context.canGenerateChallenges
    ? 'Ya puede orientar retos. Puedes fortalecer sponsor, baseline o alcance antes de activarlos.'
    : 'Ya hay una buena base. El siguiente paso es aclarar que resultado quieres mover y como revisaras avance.';
}

function getNextBestStrategicFrontAction(
  input: StrategicFrontQualityInput,
  context: {
    looksLikeSolution: boolean;
    isTooBroad: boolean;
    hasSignal: boolean;
    hasArea: boolean;
    hasHorizon: boolean;
    hasScope: boolean;
    metricCoherence: StrategicFrontQualityCriterion['status'];
  },
) {
  if (context.looksLikeSolution) {
    return {
      title: 'Reformula el nombre como prioridad',
      description: 'Este nombre suena a herramienta o iniciativa. Intenta describir el resultado de negocio que quieres mover.',
    };
  }
  if (!input.name.trim()) {
    return {
      title: 'Captura la prioridad inicial',
      description: 'Escribe una primera version del frente. No necesita estar perfecta; debe ayudarte a recordar que prioridad quieres ordenar.',
    };
  }
  if (!input.strategicObjective.trim() || context.isTooBroad) {
    return {
      title: 'Completa el objetivo estrategico',
      description: 'Explica que quieres mover, por que importa y que cambio esperas ver en el negocio.',
    };
  }
  if (!context.hasArea) {
    return {
      title: 'Asocia un area responsable',
      description: 'Indica que unidad tendra mayor responsabilidad sobre esta prioridad para que no quede como conversacion abierta.',
    };
  }
  if (!context.hasSignal) {
    return {
      title: 'Agrega una senal de avance',
      description: 'Define como sabras que este frente esta mejorando: tiempo, conversion, adopcion, costo, reclamos, SLA o satisfaccion.',
    };
  }
  if (!context.hasHorizon) {
    return {
      title: 'Define cuando revisaras avance',
      description: 'El horizonte ayuda a saber cuando este frente debe mostrar senales concretas.',
    };
  }
  if (context.metricCoherence === 'needs_improvement') {
    return {
      title: 'Alinea KPI, meta y baseline',
      description: 'Revisa que todos midan el mismo tipo de resultado antes de activar retos.',
    };
  }
  if (!context.hasScope) {
    return {
      title: 'Delimita un poco mas el alcance',
      description: 'Aclara segmento, proceso, periodo o limites para que los retos futuros tengan foco.',
    };
  }
  if (!input.sponsor.trim()) {
    return {
      title: 'Define respaldo antes de activar retos',
      description: 'Puedes guardar ahora. Cuando quieras activar retos, conviene indicar quien puede priorizar o destrabar decisiones.',
    };
  }
  return {
    title: 'Prepara los retos accionables',
    description: 'Este frente ya tiene una base clara. Puedes convertirlo en preguntas, oportunidades o incertidumbres concretas.',
  };
}

function getMetricCoherenceStatus(
  kpiText: string,
  metricValuesText: string,
): StrategicFrontQualityCriterion['status'] {
  if (!kpiText && !metricValuesText) return 'missing';
  if (kpiText && !metricValuesText) return 'needs_improvement';
  if (!kpiText && metricValuesText) return 'missing';

  const kpiCategory = inferMetricCategory(kpiText);
  const valuesCategory = inferMetricCategory(metricValuesText);
  if (kpiCategory !== 'unknown' && valuesCategory !== 'unknown' && kpiCategory !== valuesCategory) {
    return 'needs_improvement';
  }
  return 'complete';
}

function getMetricCoherenceFeedback(
  kpiText: string,
  metricValuesText: string,
  status: StrategicFrontQualityCriterion['status'],
) {
  if (status === 'complete') return 'KPI, baseline, meta o umbral parecen conversar entre si.';
  if (!kpiText) return 'Primero define la senal principal de avance.';
  if (!metricValuesText) return 'Agrega baseline, meta o umbral para que la senal tenga lectura.';
  if (inferMetricCategory(kpiText) === 'satisfaction' && inferMetricCategory(metricValuesText) === 'time') {
    return 'El KPI habla de satisfaccion, pero baseline y meta hablan de tiempo. Elige si mediras experiencia percibida o tiempo de activacion.';
  }
  return 'Revisa que KPI, baseline, meta y umbral midan el mismo tipo de resultado.';
}

function inferMetricCategory(text: string) {
  if (TIME_WORDS.some(word => text.includes(word))) return 'time';
  if (SATISFACTION_WORDS.some(word => text.includes(word))) return 'satisfaction';
  if (COST_WORDS.some(word => text.includes(word))) return 'cost';
  if (ADOPTION_WORDS.some(word => text.includes(word))) return 'adoption';
  if (/%|\d/.test(text)) return 'numeric';
  return 'unknown';
}

function hasConcreteBusinessContext(text: string) {
  return /(cliente|clientes|b2b|b2c|onboarding|activacion|venta|ventas|operacion|operaciones|talento|ti|riesgo|reclamo|reclamos|costo|costos|conversion|satisfaccion|cumplimiento|sla|primeros|dias|area|unidad|segmento|canal|proceso)/.test(text);
}

function hasScopeSignal(text: string) {
  return /(durante|primeros|dias|meses|b2b|b2c|segmento|canal|area|unidad|proceso|onboarding|postventa|comercial|operaciones|talento|ti|incluye|excluye|no entra|alcance|limite|limites)/.test(text);
}

function buildSuggestedStrategicFrontRewrite(input: StrategicFrontQualityInput, status: StrategicFrontQualityEvaluation['qualityStatus']) {
  if (!input.name.trim() && !input.strategicObjective.trim()) return undefined;

  const subject = input.name.trim() || input.strategicObjective.trim();
  const area = input.area?.trim() ? ` en ${input.area.trim()}` : '';
  const horizon = input.horizon.trim() ? ` durante ${input.horizon.trim()}` : '';
  const signal = input.mainKpi.trim() ? `, medido por ${input.mainKpi.trim()}` : '';

  if (status === 'green') return subject;
  return `Mejorar ${subject.replace(/^mejorar\s+/i, '')}${area}${horizon}${signal}.`;
}

function buildSuggestedChallenges(input: StrategicFrontQualityInput) {
  const objective = input.strategicObjective.trim() || input.name.trim();
  const area = input.area?.trim() || 'el area responsable';
  const signal = input.mainKpi.trim() || 'la senal principal';

  return [
    `Como reducir la friccion principal que hoy impide avanzar en ${objective}?`,
    `Como detectar temprano los casos donde ${signal} no mejora en ${area}?`,
    `Que incertidumbre debemos resolver primero para convertir este frente en trabajo accionable?`,
  ];
}

function uniqueStrategicQualityItems(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function normalizeStrategicQualityText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
