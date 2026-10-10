import { NON_ACTIVE_INITIATIVE_STATUSES } from './constants';
import type {
  Challenge,
  ChallengeActivationInputs,
  ChallengeActivationMode,
  ChallengeActivationRecommendationModel,
  ChallengeCoverageStatus,
  ChallengeStatus,
  ExecutiveOutput,
  Initiative,
  PortfolioDecisionItem,
  PortfolioDecisionOutcome,
  StrategicFront,
} from './types';
import { activationLabel } from './copy';
import {
  isInitiativeReadyForDecision,
  normalizeChallengeCoverageStatus,
  normalizeChallengeStatus,
  normalizeInitiativeStatus,
} from './rules';

export {
  canChallengeReceiveInitiatives,
  canImportedItemBePublished,
  getConfidentialityAllowsFullAIProcessing,
  getStepProgressRiskLevel,
  isChallengeReadyToActivate,
  isInitiativeReadyForDecision,
  normalizeChallengeCoverageStatus,
  normalizeChallengeStatus,
  normalizeConfidentialityLevel,
  normalizeContributionType,
  normalizeDecisionType,
  normalizeEvidenceVerificationStatus,
  normalizeImportedItemStatus,
  normalizeInitiativeStatus,
  normalizeStrategicFrontStatus,
  normalizeStepContentStatus,
  normalizeStepValidationStatus,
} from './rules';

export function patchChallenge(
  challenges: Challenge[],
  challengeId: string,
  updater: (challenge: Challenge) => Challenge,
) {
  return challenges.map(challenge => (challenge.id === challengeId ? updater(challenge) : challenge));
}

export function challengeIsConfigured(challenge: Challenge) {
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

export function buildDefaultActivationInputs(
  sponsorStatus: ChallengeActivationInputs['sponsorStatus'] = 'definido',
): ChallengeActivationInputs {
  return {
    urgency: 'media',
    timeAvailable: 'acotado',
    estimatedEffort: 'medio',
    challengeClarity: 'media',
    informationSensitivity: 'media',
    internalCapacity: 'media',
    technicalNeed: 'media',
    sponsorStatus,
    dependency: 'ninguna',
  };
}

export function deriveChallengeActivationRecommendation(
  challenge: Challenge,
  front?: StrategicFront | null,
): ChallengeActivationRecommendationModel {
  const { activationInputs } = challenge;
  const reasons: string[] = [];
  const risks: string[] = [];
  const nextSteps: string[] = [];
  let recommendedMode: ChallengeActivationMode = challenge.activationMode;
  let confidenceScore = 0.55;

  if (
    activationInputs.urgency === 'alta'
    && activationInputs.timeAvailable === 'muy_poco'
    && ['operaciones', 'ti', 'data', 'comercial'].includes(activationInputs.dependency)
  ) {
    recommendedMode = 'equipo_core_encargado';
    confidenceScore = 0.91;
    reasons.push('La urgencia es alta, el tiempo es corto y ya existe una dependencia operativa concreta.');
    risks.push('Si no asignas un equipo core, el reto puede quedar disperso y lento.');
    nextSteps.push('Define un equipo minimo con responsables claros y un ritmo corto de seguimiento.');
  } else if (
    activationInputs.urgency === 'alta'
    && activationInputs.internalCapacity !== 'baja'
    && ['operaciones', 'comercial', 'data', 'ti'].includes(activationInputs.dependency)
  ) {
    recommendedMode = 'squad_asignado';
    confidenceScore = 0.86;
    reasons.push('La urgencia es alta y el reto necesita coordinar varias capacidades internas.');
    if (activationInputs.sponsorStatus === 'confirmado') {
      reasons.push('El sponsor ya esta confirmado y eso favorece un squad con reporte ejecutivo frecuente.');
      confidenceScore = 0.9;
    }
    risks.push('Si no armas un squad claro, el reto puede avanzar con responsabilidades difusas.');
    nextSteps.push('Asigna un squad con lider, responsables por frente y frecuencia de reporte.');
  } else if (
    activationInputs.timeAvailable === 'suficiente'
    && activationInputs.challengeClarity !== 'alta'
    && activationInputs.informationSensitivity !== 'alta'
  ) {
    recommendedMode = 'convocatoria_abierta';
    confidenceScore = 0.78;
    reasons.push('Hay tiempo para abrir participacion y el reto puede beneficiarse de mas diversidad de respuestas.');
    risks.push('Una convocatoria abierta sin buen marco puede traer senales dispersas.');
    nextSteps.push('Afina el reto, activa la convocatoria y define criterios visibles de entrada.');
  } else if (
    activationInputs.informationSensitivity === 'alta'
    && activationInputs.challengeClarity !== 'baja'
  ) {
    recommendedMode = 'personas_seleccionadas';
    confidenceScore = 0.84;
    reasons.push('La informacion es sensible y conviene trabajar con perfiles conocidos y controlados.');
    risks.push('Si no eliges bien a las personas, puedes perder velocidad o profundidad.');
    nextSteps.push('Selecciona perfiles concretos y comparte un mensaje de activacion acotado.');
  } else if (
    activationInputs.internalCapacity === 'baja'
    && activationInputs.technicalNeed === 'alta'
  ) {
    recommendedMode = 'innovacion_abierta_partner_externo';
    confidenceScore = 0.88;
    reasons.push('La capacidad interna es baja y el reto necesita una capacidad tecnica especializada.');
    risks.push('Sin partner o capacidad externa, el reto puede seguir frenado aunque el problema sea claro.');
    nextSteps.push('Identifica partner o capacidad externa y prepara un brief corto para activar la colaboracion.');
  } else if (
    activationInputs.challengeClarity === 'baja'
    && activationInputs.timeAvailable !== 'muy_poco'
  ) {
    recommendedMode = 'personas_seleccionadas';
    confidenceScore = 0.73;
    reasons.push('El reto todavia necesita aprender antes de abrirse mas, asi que conviene explorarlo con perfiles concretos.');
    risks.push('Abrirlo demasiado pronto puede generar trabajo con direccion insuficiente.');
    nextSteps.push('Invita personas puntuales para exploracion y alinea una pregunta clara de aprendizaje.');
  } else if (activationInputs.challengeClarity === 'baja') {
    recommendedMode = 'mantener_en_definicion';
    confidenceScore = 0.67;
    reasons.push('Todavia falta claridad para decidir una activacion sana.');
    risks.push('Si activas demasiado pronto, el reto puede atraer trabajo sin criterio suficiente.');
    nextSteps.push('Aclara el reto, confirma owner y vuelve a evaluar modalidad.');
  } else {
    recommendedMode = challenge.activationMode;
    confidenceScore = 0.62;
    reasons.push('La configuracion actual no fuerza una modalidad unica, asi que conviene mantener una lectura guiada por contexto.');
    nextSteps.push('Revisa owner, sponsor y dependencias antes de activar el reto.');
  }

  if (!challenge.challengeOwner.trim() || challenge.challengeOwnerStatus !== 'confirmado') {
    risks.push('Falta un challenge owner confirmado y eso bloquea la activacion.');
  }

  if (activationInputs.sponsorStatus !== 'confirmado') {
    risks.push('El sponsor aun no esta confirmado. Puedes activar, pero con riesgo de destrabe y continuidad.');
  }

  const missingItems = [
    !challenge.challengeOwner.trim() ? 'Definir challenge owner' : '',
    challenge.challengeOwnerStatus !== 'confirmado' ? 'Confirmar challenge owner' : '',
    activationInputs.sponsorStatus !== 'confirmado' ? 'Confirmar sponsor' : '',
    recommendedMode === 'convocatoria_abierta' && challenge.openCallStatus !== 'activa' ? 'Preparar convocatoria' : '',
    recommendedMode === 'personas_seleccionadas' && challenge.selectedPeople.length === 0 ? 'Definir personas seleccionadas' : '',
    ['squad_asignado', 'equipo_core_encargado'].includes(recommendedMode) && challenge.assignedSquad.length === 0 ? 'Asignar equipo o squad' : '',
    recommendedMode === 'innovacion_abierta_partner_externo' && challenge.selectedPeople.length === 0 && challenge.assignedSquad.length === 0 ? 'Identificar partner o contacto externo' : '',
  ].filter(Boolean);

  const sponsorText = front?.sponsor ? `con sponsor visible en ${front.sponsor}` : 'con sponsor visible';
  const justification = reasons.join(' ') || `Conviene ${activationLabel(recommendedMode).toLowerCase()} para mover este reto ${sponsorText}.`;

  return {
    challengeId: challenge.id,
    recommendedMode,
    recommendedModeLabel: activationLabel(recommendedMode),
    justification,
    risks,
    missingItems,
    nextSteps,
    confidenceLabel: confidenceScore >= 0.8 ? 'Alta' : confidenceScore >= 0.65 ? 'Media' : 'Baja',
    confidenceScore,
    sponsorRisk: activationInputs.sponsorStatus !== 'confirmado',
  };
}

export function buildChallengeActivationMessageDraft(
  challenge: Challenge,
  recommendation: ChallengeActivationRecommendationModel,
  front?: StrategicFront | null,
) {
  return [
    `Hola,`,
    ``,
    `Estamos activando el reto "${challenge.name}" dentro del frente ${front?.name ?? 'estrategico'} para mover: ${challenge.whatWeWantToMove}`,
    ``,
    `Modalidad sugerida: ${recommendation.recommendedModeLabel}.`,
    `Por que ahora: ${challenge.whyNow || 'Necesitamos avanzar con una prioridad visible del negocio.'}`,
    `Que esperamos: ${challenge.successCriteria || challenge.objective}`,
    ``,
    `Siguiente paso propuesto: ${recommendation.nextSteps[0] ?? 'Coordinar activacion y responsables.'}`,
    ``,
    `Quedo atento para confirmar responsables, tiempos y forma de trabajo.`,
  ].join('\n');
}

export function deriveChallengeStatus(challenge: Challenge, initiatives: Initiative[]): ChallengeStatus {
  const related = initiatives.filter(item => item.challengeId === challenge.id);
  const ready = related.filter(
    item =>
      isInitiativeReadyForDecision(item),
  ).length;
  const active = related.filter(item => !NON_ACTIVE_INITIATIVE_STATUSES.includes(normalizeInitiativeStatus(item.status))).length;
  const normalizedChallengeStatus = normalizeChallengeStatus(challenge.status);

  if (normalizedChallengeStatus === 'closed') return 'cerrado';
  if (!challenge.visibleToParticipants) return challengeIsConfigured(challenge) ? 'activo_interno' : 'listo_para_activar';
  if (related.length === 0) return 'publicado';
  if (ready > 0) return 'pendiente_de_decision';
  if (active > 0) return 'con_iniciativas_activas';
  return 'recibiendo_iniciativas';
}

const COVERAGE_RANK: Partial<Record<ChallengeCoverageStatus, number>> = {
  sin_cobertura: 0,
  cobertura_parcial: 1,
  cobertura_suficiente: 2,
};

/**
 * Cobertura efectiva del reto: la que muestran la tarjeta, el detalle y el panel de lectura.
 * Espejo de deriveChallengeCoverage (backend/modules/portfolio/challenge-coverage.read-service.ts),
 * que alimenta GET /portfolio/challenges/:id/coverage-reading; si cambia uno, cambia el otro.
 * - `reformular` / `resuelto` son decisiones explícitas y se respetan.
 * - Sin iniciativas no hay cobertura.
 * - Con iniciativas: parcial; suficiente si alguna llegó a decisión y resolvió la parte central.
 * - Nunca queda por debajo de lo persistido (Step 4 / decisión pueden declarar más).
 */
export function deriveChallengeCoverageStatus(
  challenge: Challenge,
  initiatives: Initiative[],
): ChallengeCoverageStatus {
  const normalizedCoverage = normalizeChallengeCoverageStatus(challenge.coverageStatus);
  if (normalizedCoverage === 'needs_reformulation') {
    return 'reformular';
  }
  if (normalizedCoverage === 'ready_for_decision' || normalizedCoverage === 'overlapped') {
    return 'resuelto';
  }

  const related = initiatives.filter(item => item.challengeId === challenge.id);
  if (related.length === 0) return 'sin_cobertura';

  // Antes un bloqueo contaba como "llegó a decisión" (DECISION_RELEVANT_INITIATIVE_STATUSES):
  // una iniciativa bloqueada no puede dejar el reto con cobertura suficiente.
  // Una iniciativa ya decidida no cuenta: su cobertura la escribió la decisión (§23).
  const sufficient = related.some(item =>
    normalizeInitiativeStatus(item.status) !== 'closed' && item.resolvedCorePart && isInitiativeReadyForDecision(item));
  const derived: ChallengeCoverageStatus = sufficient ? 'cobertura_suficiente' : 'cobertura_parcial';
  const persisted: ChallengeCoverageStatus = normalizedCoverage === 'sufficient'
    ? 'cobertura_suficiente'
    : normalizedCoverage === 'partial' ? 'cobertura_parcial' : 'sin_cobertura';
  return (COVERAGE_RANK[persisted] ?? 0) > (COVERAGE_RANK[derived] ?? 0) ? persisted : derived;
}

export function buildDecisionRecommendation(initiative: Initiative): PortfolioDecisionItem {
  const normalizedStatus = normalizeInitiativeStatus(initiative.status);

  if (isInitiativeReadyForDecision(initiative) || normalizedStatus === 'ready_for_decision') {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: initiative.resolvedCorePart ? 'escalar_piloto' : 'pasar_a_segunda_fase',
      summary: initiative.resolvedCorePart
        ? 'La iniciativa ya resolvio una parte clara del reto.'
        : 'La iniciativa llego al nivel de madurez suficiente para entrar a segunda fase.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker || 'Conviene definir el siguiente destino.',
    };
  }

  if (normalizedStatus === 'blocked' && initiative.blockedDays >= 14) {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: initiative.requiresExternalCapability ? 'transferir_a_ti' : 'iterar_desde_otro_angulo',
      summary: 'La iniciativa acumula demasiado tiempo bloqueada para seguir igual.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker,
    };
  }

  if (initiative.requiresExternalCapability) {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: 'evaluar_innovacion_abierta',
      summary: 'La solucion necesita una capacidad que hoy no esta disponible internamente.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker,
    };
  }

  if (initiative.partialSignal) {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: 'iterar_desde_otro_angulo',
      summary: 'Hay una senal parcial, pero aun no suficiente para escalar con confianza.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker,
    };
  }

  return {
    id: `decision-${initiative.id}`,
    challengeId: initiative.challengeId,
    initiativeId: initiative.id,
    recommendation: 'cerrar_con_aprendizaje',
    summary: 'La lectura actual no justifica seguir invirtiendo energia sin reformular.',
    successReading: initiative.signalSummary,
    reviewReason: initiative.mainBlocker,
  };
}

export function syncChallengeSummaries(challenges: Challenge[], initiatives: Initiative[]) {
  return challenges.map(challenge => {
    const related = initiatives.filter(item => item.challengeId === challenge.id);
    return {
      ...challenge,
      initiativeCount: related.length,
      coverageStatus: deriveChallengeCoverageStatus(challenge, initiatives),
      status: deriveChallengeStatus(challenge, initiatives),
    };
  });
}

export function buildSeededChallengeInitiatives(
  challenge: Challenge,
  front: StrategicFront,
  timestamp = Date.now(),
): Initiative[] {
  return [
    {
      id: `initiative-${timestamp}-a`,
      name: 'Piloto inicial del reto',
      strategicFrontId: front.id,
      challengeId: challenge.id,
      teamOwner: 'Equipo del reto',
      currentStep: 'Step 1',
      status: 'en_step_1',
      mentor: 'Mentor asignado',
      sponsorTouchpoint: 'Revision ejecutiva pendiente',
      mainAlert: 'Todavia falta evidencia para ver si el reto esta bien enfocado.',
      nextActionRecommended: 'Profundizar validacion con usuarios clave.',
      attackedArea: challenge.whatWeWantToMove,
      hypothesisCovered: 'La primera hipotesis del reto ya esta formulada.',
      mainMetric: challenge.successCriteria,
      contributionType: 'validar',
      estimatedContribution: 'medio',
      lastActivity: 'Hoy',
      signalSummary: 'Ya hay una primera lectura, pero todavia es parcial.',
      mainBlocker: 'Falta evidencia con usuarios prioritarios.',
      teamLabel: 'Equipo inicial',
      requiresSponsor: false,
      readyForDecision: false,
      blockedDays: 0,
      requiresExternalCapability: false,
      partialSignal: true,
      resolvedCorePart: false,
      teamMembers: ['Equipo inicial'],
      executiveSummary: 'Primer esfuerzo para entender si el reto esta bien enfocado.',
      experimentSummary: 'La iniciativa abre una primera validacion del reto con usuarios clave y evidencia basica.',
      deliverables: [
        { id: `deliverable-${timestamp}-a`, title: 'Resumen de hipotesis inicial', type: 'Resumen', note: 'Documento base para leer el avance temprano.' },
      ],
      aiCommentSummary: 'La IA sugiere ampliar evidencia antes de tomar decisiones.',
      mentorCommentSummary: 'El mentor recomienda seguir validando con usuarios clave.',
      decisionRecommendationReason: 'Por ahora sigue en seguimiento porque aun esta en una fase temprana.',
      stepsTimeline: [
        { step: 'Step 0', state: 'completado', note: 'Se ordeno el punto de partida del reto.' },
        { step: 'Step 1', state: 'en_progreso', note: 'Sigue abierta la validacion inicial.' },
        { step: 'Step 2', state: 'pendiente', note: 'Todavia no conviene bajar a solucion.' },
        { step: 'Step 3', state: 'pendiente', note: 'Sin experimento todavia.' },
        { step: 'Step 4', state: 'pendiente', note: 'Sin cierre ejecutivo todavia.' },
      ],
    },
  ];
}

export function buildExecutiveOutput(
  initiative: Initiative,
  challenge: Challenge,
  recommendation: PortfolioDecisionOutcome,
  decisionSummary: string | undefined,
): ExecutiveOutput {
  return {
    id: `exec-${initiative.id}`,
    challengeId: challenge.id,
    initiativeId: initiative.id,
    recommendation,
    status: 'borrador_ejecutivo',
    whyNow: challenge.whyNow,
    kpiToMove: initiative.mainMetric || challenge.successCriteria,
    approachSummary: initiative.executiveSummary,
    scopeSummary: initiative.experimentSummary,
    evidenceSummary: initiative.signalSummary,
    keyDeliverableSummary: initiative.deliverables[0]?.title ?? 'Sin entregable clave visible',
    cautionSummary: initiative.mainBlocker || 'No hay cautela principal visible',
    recommendationWhy: initiative.decisionRecommendationReason,
    secondaryOptions: 'Las alternativas siguen disponibles como opcion secundaria si cambia la prioridad ejecutiva.',
    managementNeeds: initiative.requiresExternalCapability
      ? ['Prioridad tecnica', 'Responsable de destrabe', 'Decision de transferencia']
      : initiative.requiresSponsor
        ? ['Sponsor activo', 'Prioridad de implementacion', 'Aprobacion de siguiente fase']
        : ['Aprobacion', 'Priorizacion', 'Recursos minimos para siguiente paso'],
    nextStepSummary: initiative.nextActionRecommended,
    nextStepOwner: initiative.teamOwner,
    nextStepHorizon: initiative.readyForDecision ? '4 a 6 semanas' : '2 a 4 semanas',
    nextStepExpectedResult: initiative.readyForDecision
      ? 'Convertir la validacion actual en una siguiente fase con alcance claro.'
      : 'Destrabar la iniciativa o confirmar si conviene reformularla.',
    timeline: [
      { label: 'Decision interna tomada', note: decisionSummary ?? 'Ya existe una recomendacion interna visible.' },
      { label: 'Borrador ejecutivo creado', note: 'Starteria traduce la evidencia a lenguaje gerencial.' },
      { label: 'Siguiente hito', note: 'Dejar la propuesta lista para sponsor o gerencia.' },
    ],
  };
}
