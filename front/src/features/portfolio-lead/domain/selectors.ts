import { ACTIVE_FRONT_STATUSES, DECISION_RELEVANT_INITIATIVE_STATUSES } from './constants';
import { challengeIsConfigured, deriveChallengeCoverageStatus } from './actions';
import type {
  ActiveFrontCard,
  Challenge,
  ChallengeActivationReadiness,
  ChallengeActivationRecommendationModel,
  ChallengeCardModel,
  ChallengeCoverageStatus,
  ChallengeFocusRecommendation,
  ChallengesByActivationState,
  ChallengesSummary,
  ExecutiveOutput,
  HomeCommandCenterModel,
  Initiative,
  PortfolioAlert,
  PortfolioAttentionQueueItem,
  PortfolioDecisionCard,
  PortfolioHomeEmptyState,
  PortfolioHomeHeader,
  PortfolioHomeExperienceModel,
  PortfolioHomeSummaryCard,
  PortfolioFrontOverviewCard,
  PortfolioDecisionItem,
  PortfolioLeadState,
  PortfolioLeadSummary,
  PortfolioNextAction,
  PortfolioStrategicOverviewModel,
  PortfolioImportantChangeCard,
  PortfolioPendingDecisionRow,
  PortfolioRecentActivityItem,
  ReadyToActivateChallengeCard,
  StrategicObjectiveChallengeRow,
  StrategicObjectiveFrontCard,
  StrategicFrontCardModel,
  StrategicFrontFocusRecommendation,
  StrategicFrontsSummary,
  StrategicFront,
} from './types';
import { hasTechnicalBlocker } from '../utils/portfolioLeadFormatters';
import { activationLabel, challengeActivationStateLabel, challengeStatusLabel, challengeTypeLabel, coverageLabel, strategicFrontStatusLabel } from './copy';
import { buildChallengeActivationMessageDraft, deriveChallengeActivationRecommendation } from './actions';
import {
  isChallengeReadyToActivate,
  isInitiativeReadyForDecision,
  normalizeChallengeCoverageStatus,
  normalizeChallengeStatus,
  normalizeInitiativeStatus,
  normalizeStrategicFrontStatus,
} from './rules';

export function getFrontById(fronts: StrategicFront[], frontId: string) {
  return fronts.find(front => front.id === frontId) ?? null;
}

export function getChallengesByFrontId(challenges: Challenge[], frontId: string) {
  return challenges.filter(challenge => challenge.strategicFrontId === frontId);
}

export function getInitiativesByChallengeId(initiatives: Initiative[], challengeId: string) {
  return initiatives.filter(initiative => initiative.challengeId === challengeId);
}

export function getInitiativesByFrontId(initiatives: Initiative[], frontId: string) {
  return initiatives.filter(initiative => initiative.strategicFrontId === frontId);
}

export function getDecisionsByInitiativeId(decisions: PortfolioDecisionItem[], initiativeId: string) {
  return decisions.filter(decision => decision.initiativeId === initiativeId);
}

export function getPendingDecisions(initiatives: Initiative[]) {
  return initiatives.filter(
    initiative =>
      normalizeInitiativeStatus(initiative.status) === 'blocked'
      || normalizeInitiativeStatus(initiative.status) === 'ready_for_decision'
      || isInitiativeReadyForDecision(initiative),
  );
}

export function getBlockedInitiatives(initiatives: Initiative[]) {
  return initiatives.filter(initiative => normalizeInitiativeStatus(initiative.status) === 'blocked');
}

export function getChallengesReadyToActivate(challenges: Challenge[]) {
  return challenges.filter(challenge => isChallengeReadyToActivate(challenge));
}

export function getActiveFronts(fronts: StrategicFront[]) {
  return fronts.filter(front => ACTIVE_FRONT_STATUSES.includes(normalizeStrategicFrontStatus(front.status)));
}

export function getChallengeCoverageStatus(challenge: Challenge, initiatives: Initiative[]): ChallengeCoverageStatus {
  return deriveChallengeCoverageStatus(challenge, initiatives);
}

export function getFrontCoverageStatus(
  front: StrategicFront,
  challenges: Challenge[],
  initiatives: Initiative[],
): ChallengeCoverageStatus {
  const relatedChallenges = getChallengesByFrontId(challenges, front.id);
  const relatedInitiatives = getInitiativesByFrontId(initiatives, front.id);

  if (relatedChallenges.some(challenge => normalizeChallengeCoverageStatus(getChallengeCoverageStatus(challenge, initiatives)) === 'needs_reformulation')) {
    return 'necesita_reformulacion';
  }

  if (relatedChallenges.length === 0 || relatedInitiatives.length === 0) {
    return 'sin_cobertura';
  }

  if (relatedChallenges.some(challenge => ['sufficient', 'ready_for_decision', 'overlapped', 'cobertura_suficiente', 'resuelto'].includes(normalizeChallengeCoverageStatus(getChallengeCoverageStatus(challenge, initiatives))))) {
    return 'cobertura_suficiente';
  }

  return 'cobertura_parcial';
}

export function getPortfolioSummary(state: PortfolioLeadState): PortfolioLeadSummary {
  const pendingDecisions = getPendingDecisions(state.initiatives);
  // "En curso" = no cerrada. Es el mismo criterio para contar iniciativas y para decir qué retos
  // y frentes tienen trabajo: el estado del reto/frente (borrador, publicado) no se actualiza
  // solo cuando llegan iniciativas, y "0 retos activos" junto a "16 iniciativas en curso"
  // parecía una contradicción (2026-10-10).
  const activeInitiatives = state.initiatives.filter(initiative => normalizeInitiativeStatus(initiative.status) !== 'closed');
  const challengeFront = new Map(state.challenges.map(challenge => [challenge.id, challenge.strategicFrontId]));
  const challengesWithWork = new Set(activeInitiatives.map(initiative => initiative.challengeId).filter(Boolean));
  const frontsWithWork = new Set(
    activeInitiatives.map(initiative => challengeFront.get(initiative.challengeId) || initiative.strategicFrontId).filter(Boolean),
  );
  return {
    fronts: state.strategicFronts.length,
    activeFronts: getActiveFronts(state.strategicFronts).length,
    frontsWithActiveInitiatives: state.strategicFronts.filter(front => frontsWithWork.has(front.id)).length,
    challenges: state.challenges.length,
    activeChallenges: state.challenges.filter(challenge => challenge.visibleToParticipants).length,
    challengesWithActiveInitiatives: state.challenges.filter(challenge => challengesWithWork.has(challenge.id)).length,
    challengesReadyToActivate: getChallengesReadyToActivate(state.challenges).length,
    initiatives: state.initiatives.length,
    activeInitiatives: activeInitiatives.length,
    blockedInitiatives: getBlockedInitiatives(state.initiatives).length,
    pendingDecisions: pendingDecisions.length,
    readyForDecisionInitiatives: pendingDecisions.filter(initiative => isInitiativeReadyForDecision(initiative)).length,
    executiveOutputs: state.executiveOutputs.length,
  };
}

export function getPortfolioAlerts(state: PortfolioLeadState): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];

  state.strategicFronts.forEach(front => {
    const frontChallenges = getChallengesByFrontId(state.challenges, front.id);
    const inactiveChallenges = frontChallenges.filter(challenge => !challenge.visibleToParticipants);
    if (inactiveChallenges.length > 0) {
      alerts.push({
        id: `front-inactive-${front.id}`,
        tone: 'amber',
        type: 'activation',
        title: `${front.name} tiene retos definidos pero todavia no activados`,
        description: `${inactiveChallenges.length} reto(s) siguen solo en control interno y frenan la llegada de iniciativas al frente.`,
        contextLabel: front.name,
        whyItMatters: 'Mientras el reto no se active, el frente no se convierte en trabajo visible.',
        recommendedAction: 'Activa los retos pendientes de este frente.',
        actionLabel: 'Activar retos del frente',
        actionPath: `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`,
        frontId: front.id,
      });
    }
  });

  state.challenges.forEach(challenge => {
    const relatedInitiatives = getInitiativesByChallengeId(state.initiatives, challenge.id);

    if (challenge.visibleToParticipants && relatedInitiatives.length === 0) {
      alerts.push({
        id: `challenge-empty-${challenge.id}`,
        tone: 'sky',
        type: 'coverage',
        title: `${challenge.name} ya esta activo pero aun no recibe iniciativas`,
        description: 'El reto ya esta publicado, pero todavia no vuelve como trabajo visible para seguimiento.',
        contextLabel: challenge.name,
        whyItMatters: 'Un reto activo sin iniciativas todavia no genera aprendizaje ni avance.',
        recommendedAction: 'Revisa convocatoria, invitaciones o squad para movilizar trabajo.',
        actionLabel: challenge.activationMode === 'convocatoria_abierta'
          ? 'Revisar convocatoria'
          : challenge.activationMode === 'squad_asignado'
            ? 'Revisar squad'
            : 'Revisar reto',
        actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
        challengeId: challenge.id,
      });
    }

    if (challenge.challengeOwnerStatus !== 'confirmado') {
      alerts.push({
        id: `owner-${challenge.id}`,
        tone: 'amber',
        type: 'stakeholder',
        title: `${challenge.name} todavia no tiene challenge owner confirmado`,
        description: `Estado actual: ${challenge.challengeOwnerStatus}. Sin owner confirmado, el reto pierde traccion operativa.`,
        contextLabel: challenge.name,
        whyItMatters: 'Sin una persona claramente responsable, el reto pierde seguimiento y velocidad.',
        recommendedAction: 'Confirma el challenge owner antes de abrir mas trabajo.',
        actionLabel: 'Confirmar owner',
        actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
        challengeId: challenge.id,
      });
    }

    if (challenge.sponsorStatus !== 'confirmado') {
      alerts.push({
        id: `sponsor-${challenge.id}`,
        tone: 'rose',
        type: 'stakeholder',
        title: `${challenge.name} todavia no tiene sponsor confirmado`,
        description: `Estado actual: ${challenge.sponsorStatus}. Conviene destrabar sponsor antes de escalar o pedir recursos.`,
        contextLabel: challenge.name,
        whyItMatters: 'Sin sponsor visible, escalar decisiones o pedir recursos se vuelve mas dificil.',
        recommendedAction: 'Alinea sponsor antes de llevar este reto a una decision mayor.',
        actionLabel: 'Revisar sponsor',
        actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
        challengeId: challenge.id,
      });
    }
  });

  getPendingDecisions(state.initiatives).forEach(initiative => {
    const challenge = state.challenges.find(item => item.id === initiative.challengeId);
    const front = state.strategicFronts.find(item => item.id === initiative.strategicFrontId);
    alerts.push({
      id: `initiative-${initiative.id}`,
      tone: normalizeInitiativeStatus(initiative.status) === 'blocked' ? 'rose' : 'violet',
      type: normalizeInitiativeStatus(initiative.status) === 'blocked' ? 'blocker' : 'decision',
      title: `${initiative.name} ${normalizeInitiativeStatus(initiative.status) === 'blocked' ? 'sigue bloqueada' : 'ya requiere decision'}`,
      description: `${front?.name ?? 'Sin frente'} / ${challenge?.name ?? 'Sin reto'}. ${initiative.nextActionRecommended}`,
      contextLabel: `${front?.name ?? 'Sin frente'} / ${challenge?.name ?? 'Sin reto'}`,
      whyItMatters: normalizeInitiativeStatus(initiative.status) === 'blocked'
        ? 'Este caso ya no avanza solo y necesita destrabe.'
        : 'La evidencia ya alcanzada pide una definicion ejecutiva.',
      recommendedAction: normalizeInitiativeStatus(initiative.status) === 'blocked'
        ? 'Resuelve el bloqueo o redefine el destino de la iniciativa.'
        : 'Revisa esta decision antes de seguir abriendo mas trabajo.',
      actionLabel: normalizeInitiativeStatus(initiative.status) === 'blocked' ? 'Ir a seguimiento' : 'Revisar decisiones',
      actionPath: normalizeInitiativeStatus(initiative.status) === 'blocked'
        ? `/portfolio/iniciativas?challengeId=${encodeURIComponent(initiative.challengeId)}&initiativeId=${encodeURIComponent(initiative.id)}`
        : `/portfolio/decisiones?challengeId=${encodeURIComponent(initiative.challengeId)}&initiativeId=${encodeURIComponent(initiative.id)}`,
      initiativeId: initiative.id,
      challengeId: initiative.challengeId,
      frontId: initiative.strategicFrontId,
    });
  });

  return alerts;
}

function findNextActionFromFronts(fronts: StrategicFront[], challenges: Challenge[], initiatives: Initiative[]): PortfolioNextAction | null {
  for (const front of fronts) {
    const frontChallenges = getChallengesByFrontId(challenges, front.id);
    const frontInitiatives = getInitiativesByFrontId(initiatives, front.id);

    const inactiveChallenge = frontChallenges.find(challenge => !challenge.visibleToParticipants);
    if (inactiveChallenge) {
      return {
        label: 'Activar retos pendientes',
        description: `${front.name} todavia tiene retos sin activar.`,
        ctaLabel: 'Activar reto',
        contextLabel: `${front.name} / ${inactiveChallenge.name}`,
        impactLabel: 'Sin activacion no entra trabajo nuevo al frente.',
        riskLabel: 'El frente se queda en definicion y sin cobertura.',
        path: `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`,
        frontId: front.id,
        challengeId: inactiveChallenge.id,
      };
    }

    const blocked = frontInitiatives.find(initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker));
    if (blocked) {
      return {
        label: 'Destrabar iniciativa bloqueada',
        description: `${blocked.name} necesita una decision de destrabe o cambio de destino.`,
        ctaLabel: 'Resolver bloqueo',
        contextLabel: `${front.name} / ${blocked.name}`,
        impactLabel: 'Destrabar este caso puede recuperar avance visible del portafolio.',
        riskLabel: blocked.mainBlocker || 'El caso puede seguir perdiendo traccion.',
        path: `/portfolio/iniciativas?challengeId=${encodeURIComponent(blocked.challengeId)}&initiativeId=${encodeURIComponent(blocked.id)}`,
        frontId: front.id,
        challengeId: blocked.challengeId,
        initiativeId: blocked.id,
      };
    }

    const pending = frontInitiatives.find(
      initiative =>
        normalizeInitiativeStatus(initiative.status) === 'ready_for_decision'
        || isInitiativeReadyForDecision(initiative)
        || DECISION_RELEVANT_INITIATIVE_STATUSES.includes(normalizeInitiativeStatus(initiative.status)),
    );
    if (pending) {
      return {
        label: 'Revisar cola de decisiones',
        description: `${pending.name} ya tiene senal suficiente para pasar por decision.`,
        ctaLabel: 'Revisar decision',
        contextLabel: `${front.name} / ${pending.name}`,
        impactLabel: 'Una definicion ahora convierte evidencia en avance ejecutivo.',
        riskLabel: pending.mainBlocker || 'Si no decides, el caso pierde ritmo y foco.',
        path: `/portfolio/decisiones?challengeId=${encodeURIComponent(pending.challengeId)}&initiativeId=${encodeURIComponent(pending.id)}`,
        frontId: front.id,
        challengeId: pending.challengeId,
        initiativeId: pending.id,
      };
    }
  }

  return null;
}

export function getRecommendedNextAction(state: PortfolioLeadState): PortfolioNextAction {
  const fromFronts = findNextActionFromFronts(state.strategicFronts, state.challenges, state.initiatives);
  if (fromFronts) return fromFronts;

  if (state.strategicFronts.length === 0) {
    return {
      label: 'Crear primer frente estrategico',
      description: 'Sin un frente estrategico visible no hay ancla para priorizar el portafolio.',
      ctaLabel: 'Crear primer frente estrategico',
      impactLabel: 'Define por donde conviene mover el negocio primero.',
      riskLabel: 'Sin frentes, el portafolio se siente disperso.',
      path: '/portfolio/frentes-estrategicos',
    };
  }

  if (state.challenges.length === 0) {
    return {
      label: 'Definir primer reto',
      description: 'El portafolio ya tiene frente, pero aun no baja a retos accionables.',
      ctaLabel: 'Crear primer reto',
      impactLabel: 'Convertira la prioridad estrategica en una unidad accionable.',
      riskLabel: 'Sin retos, el frente sigue sin activarse.',
      path: '/portfolio/retos',
    };
  }

  return {
    label: 'Mantener seguimiento del portafolio',
    description: 'No hay un destrabe urgente visible ahora. Conviene revisar cobertura y continuidad.',
    ctaLabel: 'Revisar portafolio',
    impactLabel: 'Ayuda a sostener ritmo y foco en el avance actual.',
    riskLabel: 'La cobertura puede quedarse corta si no la revisas.',
    path: '/portfolio/inicio',
  };
}

export function getExecutiveOutputByInitiativeId(outputs: ExecutiveOutput[], initiativeId: string) {
  return outputs.find(output => output.initiativeId === initiativeId) ?? null;
}

export function getPortfolioHomeHeader(state: PortfolioLeadState): PortfolioHomeHeader {
  const summary = getPortfolioSummary(state);
  const decisions = summary.pendingDecisions;
  const readyChallenges = summary.challengesReadyToActivate;

  return {
    title: 'Command Center Portfolio Lead',
    summaryLine: `Tienes ${summary.activeFronts} frentes activos, ${readyChallenges} retos por activar y ${decisions} decisiones pendientes.`,
    supportingLine: 'Prioriza decisiones, activa retos y convierte evidencia en avance ejecutivo.',
  };
}

export function getPendingDecisionCards(state: PortfolioLeadState): PortfolioDecisionCard[] {
  return getPendingDecisions(state.initiatives).map(initiative => {
    const challenge = state.challenges.find(item => item.id === initiative.challengeId);
    const front = state.strategicFronts.find(item => item.id === initiative.strategicFrontId);
    const decision = state.portfolioDecisions.find(item => item.initiativeId === initiative.id);

    return {
      id: initiative.id,
      initiativeId: initiative.id,
      initiativeName: initiative.name,
      challengeId: challenge?.id ?? initiative.challengeId,
      challengeName: challenge?.name ?? 'Reto no visible',
      frontId: front?.id ?? initiative.strategicFrontId,
      frontName: front?.name ?? 'Frente no visible',
      evidenceLabel: initiative.deliverables.length > 0 ? `${initiative.deliverables.length} entregable(s) visible(s)` : 'Sin entregables visibles',
      evidenceSummary: initiative.signalSummary,
      suggestedRoute: decision?.summary ?? initiative.nextActionRecommended,
      actionLabel: 'Revisar decision',
      actionPath: `/portfolio/decisiones?challengeId=${encodeURIComponent(initiative.challengeId)}&initiativeId=${encodeURIComponent(initiative.id)}`,
    };
  });
}

export function getReadyToActivateChallengeCards(state: PortfolioLeadState): ReadyToActivateChallengeCard[] {
  return getChallengesReadyToActivate(state.challenges).map(challenge => {
    const front = state.strategicFronts.find(item => item.id === challenge.strategicFrontId);

    return {
      id: challenge.id,
      name: challenge.name,
      frontId: front?.id ?? challenge.strategicFrontId,
      frontName: front?.name ?? 'Frente no visible',
      challengeTypeLabel: challengeTypeLabel(challenge.challengeType),
      urgencyLabel: challenge.whyNow || 'Sin urgencia visible',
      challengeOwner: challenge.challengeOwner || 'Sin challenge owner visible',
      sponsor: challenge.sponsorName?.trim() ? challenge.sponsorName : front?.sponsor ?? 'Sin sponsor visible',
      actionLabel: 'Activar reto',
      actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
    };
  });
}

export function getActiveFrontCards(state: PortfolioLeadState): ActiveFrontCard[] {
  return getActiveFronts(state.strategicFronts).map(front => {
    const frontChallenges = getChallengesByFrontId(state.challenges, front.id);
    const frontInitiatives = getInitiativesByFrontId(state.initiatives, front.id);
    const coverage = getFrontCoverageStatus(front, state.challenges, state.initiatives);

    let nextActionLabel = 'Mantener seguimiento del frente';
    let actionLabel = 'Ver frentes';
    let actionPath = '/portfolio/frentes-estrategicos';

    const challengeToActivate = frontChallenges.find(challenge => !challenge.visibleToParticipants);
    const decisionCandidate = getPendingDecisions(frontInitiatives)[0];

    if (challengeToActivate) {
      nextActionLabel = `Activa ${challengeToActivate.name}`;
      actionLabel = 'Activar reto';
      actionPath = `/portfolio/retos?challengeId=${encodeURIComponent(challengeToActivate.id)}`;
    } else if (decisionCandidate) {
      nextActionLabel = `Revisa ${decisionCandidate.name}`;
      actionLabel = 'Revisar decision';
      actionPath = `/portfolio/decisiones?challengeId=${encodeURIComponent(decisionCandidate.challengeId)}&initiativeId=${encodeURIComponent(decisionCandidate.id)}`;
    } else if (frontChallenges.length === 0) {
      nextActionLabel = 'Crea el primer reto del frente';
      actionLabel = 'Crear reto';
      actionPath = `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`;
    }

    return {
      id: front.id,
      name: front.name,
      mainKpi: front.mainKpi,
      coverageLabel: coverage === 'sin_cobertura'
        ? 'Sin cobertura'
        : coverage === 'cobertura_parcial'
          ? 'Cobertura parcial'
          : coverage === 'cobertura_suficiente'
            ? 'Cobertura suficiente'
            : 'Necesita reformulacion',
      challengesCount: frontChallenges.length,
      initiativesCount: frontInitiatives.length,
      nextActionLabel,
      actionLabel,
      actionPath,
    };
  });
}

export function getPortfolioHomeEmptyState(state: PortfolioLeadState): PortfolioHomeEmptyState | null {
  if (state.strategicFronts.length === 0) {
    return {
      title: 'Todavia no hay frentes estrategicos',
      description: 'Empieza definiendo un frente estrategico. Esa prioridad ordena el portafolio y evita abrir trabajo sin direccion clara.',
      actionLabel: 'Crear primer frente estrategico',
      actionPath: '/portfolio/frentes-estrategicos',
    };
  }

  if (state.challenges.length === 0) {
    return {
      title: 'Todavia no hay retos activos en el portafolio',
      description: 'Ya existe una prioridad estrategica, pero aun no la convertiste en retos concretos. El siguiente paso es abrir el primer reto.',
      actionLabel: 'Crear primer reto',
      actionPath: '/portfolio/retos',
    };
  }

  if (state.initiatives.length === 0) {
    return {
      title: 'Todavia no hay iniciativas bajo seguimiento',
      description: 'Ya existen retos, pero aun falta movilizar personas o equipos para que el trabajo empiece a producir evidencia.',
      actionLabel: 'Activar reto',
      actionPath: '/portfolio/retos',
    };
  }

  return null;
}

export function getHomeCommandCenterModel(state: PortfolioLeadState): HomeCommandCenterModel {
  return {
    header: getPortfolioHomeHeader(state),
    nextAction: getRecommendedNextAction(state),
    summary: getPortfolioSummary(state),
    alerts: getPortfolioAlerts(state).slice(0, 6),
    pendingDecisions: getPendingDecisionCards(state),
    readyToActivateChallenges: getReadyToActivateChallengeCards(state),
    activeFronts: getActiveFrontCards(state),
    emptyState: getPortfolioHomeEmptyState(state),
  };
}

export function getAttentionQueue(state: PortfolioLeadState): PortfolioAttentionQueueItem[] {
  const queue: PortfolioAttentionQueueItem[] = [];
  const seen = new Set<string>();

  const push = (item: PortfolioAttentionQueueItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    queue.push(item);
  };

  getPortfolioAlerts(state).forEach(alert => {
    const challenge = alert.challengeId ? state.challenges.find(item => item.id === alert.challengeId) : null;
    const initiative = alert.initiativeId ? state.initiatives.find(item => item.id === alert.initiativeId) : null;
    const front = alert.frontId ? state.strategicFronts.find(item => item.id === alert.frontId) : challenge
      ? state.strategicFronts.find(item => item.id === challenge.strategicFrontId)
      : initiative
        ? state.strategicFronts.find(item => item.id === initiative.strategicFrontId)
        : null;
    const iconKey = alert.type === 'activation'
      ? 'rocket'
      : alert.type === 'coverage'
        ? 'flag'
        : alert.type === 'stakeholder'
          ? 'users'
          : alert.type === 'blocker'
            ? 'alert'
            : 'decision';

    push({
      id: `alert-${alert.id}`,
      tone: alert.tone,
      iconKey,
      title: alert.title,
      subtitle: alert.recommendedAction ?? alert.description,
      badgeLabel: alert.type === 'blocker'
        ? 'Bloqueo'
        : alert.type === 'activation'
          ? 'Activacion'
          : alert.type === 'coverage'
            ? 'Cobertura'
            : alert.type === 'stakeholder'
              ? 'Stakeholder'
              : 'Decision',
      actionLabel: alert.actionLabel ?? 'Revisar',
      actionPath: alert.actionPath,
      contextLabel: alert.contextLabel,
      frontName: front?.name,
      challengeName: challenge?.name,
      initiativeName: initiative?.name,
      alertType: alert.type === 'blocker'
        ? 'bloqueo'
        : alert.type === 'decision'
          ? 'decision'
          : alert.type === 'coverage'
            ? 'baja_cobertura'
            : alert.type === 'stakeholder'
              ? 'sin_owner'
              : 'activacion',
      severity: alert.tone === 'rose' || alert.type === 'blocker'
        ? 'Alta'
        : alert.tone === 'amber' || alert.tone === 'violet'
          ? 'Media'
          : 'Baja',
      recommendedAction: alert.recommendedAction ?? alert.description,
    });
  });

  getReadyToActivateChallengeCards(state).slice(0, 3).forEach(card => {
    push({
      id: `ready-${card.id}`,
      tone: 'amber',
      iconKey: 'rocket',
      title: `${card.name} ya puede activarse`,
      subtitle: `${card.challengeTypeLabel} · ${card.frontName}`,
      badgeLabel: 'Listo para activar',
      actionLabel: card.actionLabel,
      actionPath: card.actionPath,
      contextLabel: card.frontName,
      frontName: card.frontName,
      challengeName: card.name,
      alertType: 'activacion',
      severity: 'Media',
      recommendedAction: 'Activar el reto para que el frente empiece a recibir trabajo visible.',
    });
  });

  getPendingDecisionCards(state).slice(0, 3).forEach(card => {
    push({
      id: `decision-${card.id}`,
      tone: 'violet',
      iconKey: 'decision',
      title: `${card.initiativeName} ya pide decision`,
      subtitle: `${card.frontName} · ${card.challengeName}`,
      badgeLabel: 'Decision',
      actionLabel: card.actionLabel,
      actionPath: card.actionPath,
      contextLabel: card.frontName,
      frontName: card.frontName,
      challengeName: card.challengeName,
      initiativeName: card.initiativeName,
      alertType: 'decision',
      severity: card.urgency === 'Alta' ? 'Alta' : 'Media',
      recommendedAction: card.suggestedRoute,
    });
  });

  getStrategicFrontCards(state)
    .filter(card => card.coverageStatus === 'sin_cobertura' || card.coverageStatus === 'cobertura_parcial')
    .slice(0, 2)
    .forEach(card => {
      push({
        id: `coverage-${card.id}`,
        tone: card.coverageStatus === 'sin_cobertura' ? 'rose' : 'amber',
        iconKey: card.coverageStatus === 'sin_cobertura' ? 'alert' : 'flag',
        title: `${card.name} requiere cobertura`,
        subtitle: `${card.coverageLabel} · ${card.challengesCount} retos · ${card.initiativesCount} iniciativas`,
        badgeLabel: card.coverageLabel,
        actionLabel: card.actionLabel,
        actionPath: card.actionPath,
        contextLabel: card.areaLabel,
        frontName: card.name,
        alertType: 'baja_cobertura',
        severity: card.coverageStatus === 'sin_cobertura' ? 'Alta' : 'Media',
        recommendedAction: card.nextActionDescription,
      });
    });

  return queue.slice(0, 6);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pluralizeDay(days: number) {
  return days === 1 ? 'día' : 'días';
}

function formatRelativeDays(days: number) {
  if (days <= 0) return 'hoy';
  return `hace ${days} ${pluralizeDay(days)}`;
}

function daysSince(dateText: string) {
  const time = Date.parse(dateText);
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.round((Date.now() - time) / (1000 * 60 * 60 * 24)));
}

function parseRelativeDaysFromText(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes('hoy')) return 0;
  if (normalized.includes('ayer')) return 1;

  const explicit = normalized.match(/hace\s+(\d+)/);
  if (explicit) return Number(explicit[1]);

  const weekday = normalized.match(/(\d+)\s*d/i);
  if (weekday) return Number(weekday[1]);

  if (normalized.includes('semana')) return 7;
  if (normalized.includes('mes')) return 30;

  return null;
}

function formatCreatedLabel(dateText: string) {
  const days = daysSince(dateText);
  if (days === null) return 'Creado recientemente';
  if (days === 0) return 'Creado hoy';
  return `Creado hace ${days} ${pluralizeDay(days)}`;
}

function buildActivityAgeLabel(activityText: string, fallbackDays = 5) {
  const days = parseRelativeDaysFromText(activityText) ?? fallbackDays;
  return formatRelativeDays(days);
}

function getFrontProgressEstimate(front: StrategicFront, challenges: Challenge[], initiatives: Initiative[]) {
  if (normalizeStrategicFrontStatus(front.status) === 'closed') return 100;

  const relatedChallenges = getChallengesByFrontId(challenges, front.id);
  const visibleChallenges = relatedChallenges.filter(challenge => challenge.visibleToParticipants).length;
  const blockedInitiatives = initiatives.filter(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  ).length;
  const pendingDecisions = getPendingDecisions(initiatives).length;

  let score = 12;
  switch (normalizeStrategicFrontStatus(front.status)) {
    case 'with_active_challenges':
      score = 38;
      break;
    case 'in_tracking':
    case 'pending_decision':
      score = 28;
      break;
    case 'draft':
      score = 16;
      break;
    default:
      score = 20;
      break;
  }

  score += Math.min(visibleChallenges * 12, 24);
  score += Math.min(initiatives.length * 8, 24);
  score += Math.min(pendingDecisions * 6, 12);
  score -= Math.min(blockedInitiatives * 10, 20);

  return clamp(Math.round(score), 8, 96);
}

function getChallengeProgressEstimate(challenge: Challenge, initiatives: Initiative[]) {
  const relatedInitiatives = getInitiativesByChallengeId(initiatives, challenge.id);
  if (normalizeChallengeStatus(challenge.status) === 'closed') return 100;

  const visibleScore = challenge.visibleToParticipants ? 24 : 8;
  const initiativeScore = Math.min(relatedInitiatives.length * 12, 36);
  const readyScore = relatedInitiatives.some(initiative => isInitiativeReadyForDecision(initiative)) ? 18 : 0;
  const stepScore = relatedInitiatives.reduce((sum, initiative) => {
    const stepWeight: Record<string, number> = {
      'Step 0': 4,
      'Step 1': 8,
      'Step 2': 12,
      'Step 3': 16,
      'Step 4': 20,
    };
    return sum + (stepWeight[initiative.currentStep] ?? 0);
  }, 0);
  const blockerPenalty = relatedInitiatives.some(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  ) ? 16 : 0;

  return clamp(Math.round(visibleScore + initiativeScore + Math.min(stepScore, 24) + readyScore - blockerPenalty), 6, 96);
}

function getFrontExecutiveState(front: StrategicFront, challenges: Challenge[], initiatives: Initiative[]) {
  const relatedChallenges = getChallengesByFrontId(challenges, front.id);
  const relatedInitiatives = getInitiativesByFrontId(initiatives, front.id);
  const blockedInitiatives = relatedInitiatives.filter(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  );
  const pendingDecisions = getPendingDecisions(relatedInitiatives);
  const inactiveChallenges = relatedChallenges.filter(challenge => !challenge.visibleToParticipants);

  const normalizedFrontStatus = normalizeStrategicFrontStatus(front.status);
  if (normalizedFrontStatus === 'closed') return { label: 'Cerrado', tone: 'slate' as const };
  if (normalizedFrontStatus === 'draft' || (relatedChallenges.length === 0 && relatedInitiatives.length === 0)) {
    return { label: 'En definición', tone: 'slate' as const };
  }
  if (inactiveChallenges.length > 0) return { label: 'Requiere atención', tone: 'amber' as const };
  if (blockedInitiatives.length > 0 && pendingDecisions.length === 0) return { label: 'Bloqueado', tone: 'rose' as const };
  if (pendingDecisions.length > 0) return { label: 'Listo para decisión', tone: 'violet' as const };
  if (normalizedFrontStatus === 'pending_decision') return { label: 'Requiere atención', tone: 'amber' as const };
  if (relatedChallenges.length > 0 || relatedInitiatives.length > 0) return { label: 'En curso', tone: 'emerald' as const };

  return { label: 'En definición', tone: 'slate' as const };
}

function getFrontLastActivityLabel(front: StrategicFront, challenges: Challenge[], initiatives: Initiative[]) {
  const relatedChallenges = getChallengesByFrontId(challenges, front.id);
  const relatedInitiatives = getInitiativesByFrontId(initiatives, front.id);

  const initiativeAges = relatedInitiatives
    .map(initiative => parseRelativeDaysFromText(initiative.lastActivity))
    .filter((value): value is number => typeof value === 'number');

  const lastPublishedAges = relatedChallenges
    .map(challenge => (challenge.lastPublishedAt ? daysSince(challenge.lastPublishedAt) : null))
    .filter((value): value is number => typeof value === 'number');

  const candidates = [...initiativeAges, ...lastPublishedAges];
  const days = candidates.length > 0 ? Math.min(...candidates) : null;
  const source = relatedInitiatives.find(initiative => parseRelativeDaysFromText(initiative.lastActivity) === days);

  if (source) {
    const label = /coment/i.test(source.lastActivity)
      ? 'Comentario nuevo'
      : normalizeInitiativeStatus(source.status) === 'blocked'
        ? 'Iniciativa bloqueada'
        : isInitiativeReadyForDecision(source)
          ? 'Iniciativa lista para decisión'
          : 'Actividad reciente';
    return `${label} ${formatRelativeDays(days ?? 5)}`;
  }

  if (relatedChallenges.some(challenge => challenge.lastPublishedAt && challenge.visibleToParticipants)) {
    const publishedDays = lastPublishedAges.length > 0 ? Math.min(...lastPublishedAges) : 0;
    return `Reto activado ${formatRelativeDays(publishedDays)}`;
  }

  return 'Sin actividad reciente visible';
}

function getFrontAlertLabels(front: StrategicFront, challenges: Challenge[], initiatives: Initiative[]) {
  const relatedChallenges = getChallengesByFrontId(challenges, front.id);
  const relatedInitiatives = getInitiativesByFrontId(initiatives, front.id);
  const alerts: string[] = [];

  if (relatedChallenges.some(challenge => !challenge.visibleToParticipants)) {
    alerts.push('Reto sin activar');
  }

  if (relatedInitiatives.some(initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker))) {
    alerts.push('Iniciativa bloqueada');
  }

  if (relatedChallenges.some(challenge => challenge.sponsorStatus !== 'confirmado')) {
    alerts.push('Sponsor pendiente');
  }

  if (getPendingDecisions(relatedInitiatives).length > 0) {
    alerts.push('Decisión pendiente');
  }

  if (relatedChallenges.length === 0) {
    alerts.push('Sin retos asociados');
  }

  if (relatedInitiatives.length === 0) {
    alerts.push('Sin iniciativas en curso');
  }

  return alerts.slice(0, 3);
}

function getFrontCurrentValue(front: StrategicFront, challenges: Challenge[]) {
  const visibleMetric = challenges
    .map(challenge => challenge.currentMetricValue?.trim())
    .find(value => value && !/sin medici/i.test(value));

  return visibleMetric ?? front.baseline;
}

function getChallengePeopleCount(challenge: Challenge, initiatives: Initiative[]) {
  const people = new Set<string>();
  challenge.selectedPeople.forEach(person => {
    if (person.value.trim()) people.add(person.value.trim());
  });
  challenge.assignedSquad.forEach(person => {
    if (person.value.trim()) people.add(person.value.trim());
  });
  initiatives.forEach(initiative => {
    initiative.teamMembers.forEach(person => {
      if (person.trim()) people.add(person.trim());
    });
  });
  return people.size;
}

function getChallengeOwnerLabel(challenge: Challenge) {
  const owner = challenge.challengeOwner.trim();
  if (!owner && challenge.challengeOwnerStatus === 'confirmado') return 'Equipo asignado';
  if (!owner) return challenge.challengeOwnerStatus === 'definido' ? 'Owner pendiente' : 'Sin owner';
  return `Owner: ${owner}`;
}

function getChallengeNextActionLabel(
  challenge: Challenge,
  initiatives: Initiative[],
  blockedInitiative: Initiative | undefined,
  pendingDecision: Initiative | undefined,
) {
  if (blockedInitiative) return 'Revisar bloqueo';
  if (pendingDecision) return 'Revisar decision';
  if (!challenge.challengeOwner.trim() || challenge.challengeOwnerStatus !== 'confirmado') return 'Asignar owner';
  if (!challenge.visibleToParticipants) return 'Activar reto';
  if (initiatives.length === 0) return 'Importar iniciativas';
  return 'Ver avance';
}

function getChallengeSeverity(
  challenge: Challenge,
  coverage: ChallengeCoverageStatus,
  initiatives: Initiative[],
  progressPercent: number,
) {
  const normalizedStatus = normalizeChallengeStatus(challenge.status);
  const normalizedCoverage = normalizeChallengeCoverageStatus(coverage);
  const hasBlockedInitiatives = initiatives.some(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  );
  const hasPendingDecision = getPendingDecisions(initiatives).some(
    initiative => normalizeInitiativeStatus(initiative.status) !== 'blocked',
  );
  const isActiveWithoutOwner = challenge.visibleToParticipants && (!challenge.challengeOwner.trim() || challenge.challengeOwnerStatus !== 'confirmado');

  if (hasBlockedInitiatives || isActiveWithoutOwner || (hasPendingDecision && normalizedStatus === 'pending_decision')) {
    return 'critical' as const;
  }

  if (
    normalizedStatus === 'ready_to_activate'
    || !challenge.visibleToParticipants
    || normalizedCoverage === 'partial'
    || normalizedCoverage === 'needs_reformulation'
    || challenge.challengeOwnerStatus !== 'confirmado'
    || progressPercent < 25
  ) {
    return 'attention' as const;
  }

  if (
    ['sufficient', 'ready_for_decision', 'overlapped'].includes(normalizedCoverage)
    && initiatives.length > 0
    && !hasBlockedInitiatives
  ) {
    return 'healthy' as const;
  }

  if (normalizedStatus === 'draft' || initiatives.length === 0) return 'neutral' as const;

  return 'healthy' as const;
}

function getChallengeAttentionLabel(severity: StrategicObjectiveChallengeRow['severity']) {
  const labels = {
    critical: 'Necesita atencion',
    attention: 'En observacion',
    healthy: 'Sano',
    neutral: 'Sin datos suficientes',
  };
  return labels[severity];
}

export function getFrontHealthStatus(
  front: StrategicFront,
  challenges: Challenge[],
  initiatives: Initiative[],
): StrategicObjectiveFrontCard['healthStatus'] {
  if (normalizeStrategicFrontStatus(front.status) === 'closed') return 'closed';
  if (getPendingDecisions(initiatives).length > 0 || normalizeStrategicFrontStatus(front.status) === 'pending_decision') return 'pending_decision';
  if (
    initiatives.some(initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker))
    || challenges.some(challenge => !challenge.visibleToParticipants || challenge.challengeOwnerStatus !== 'confirmado')
    || challenges.some(challenge => {
      const coverage = normalizeChallengeCoverageStatus(getChallengeCoverageStatus(challenge, initiatives));
      return coverage === 'no_coverage' || coverage === 'partial' || coverage === 'needs_reformulation';
    })
  ) {
    return 'requires_attention';
  }
  if (challenges.length === 0) return 'definition';
  return 'tracking';
}

export function getFrontPriorityScore(
  front: StrategicFront,
  challenges: Challenge[],
  initiatives: Initiative[],
  progressPercent: number,
) {
  const pendingDecisions = getPendingDecisions(initiatives);
  const blockedInitiatives = initiatives.filter(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  );
  const challengesWithoutOwner = challenges.filter(challenge => challenge.visibleToParticipants && challenge.challengeOwnerStatus !== 'confirmado');
  const lowCoverageChallenges = challenges.filter(challenge => {
    const coverage = normalizeChallengeCoverageStatus(getChallengeCoverageStatus(challenge, initiatives));
    return coverage === 'no_coverage' || coverage === 'partial' || coverage === 'needs_reformulation';
  });
  const readyButInactiveChallenges = challenges.filter(challenge => !challenge.visibleToParticipants || normalizeChallengeStatus(challenge.status) === 'ready_to_activate');
  const horizonIsNear = front.endDate ? ((new Date(front.endDate).getTime() - Date.now()) / 86400000) <= 45 : false;

  let score = 0;
  if (blockedInitiatives.length > 0) score += 50;
  if (pendingDecisions.length > 0) score += 40;
  if (challengesWithoutOwner.length > 0) score += 35;
  if (lowCoverageChallenges.length > 0) score += 30;
  if (blockedInitiatives.length > 0) score += 25;
  if (normalizeStrategicFrontStatus(front.status) === 'pending_decision') score += 20;
  if (progressPercent < 35 && horizonIsNear) score += 15;
  if (readyButInactiveChallenges.length > 0) score += 10;

  return score;
}

export function sortFrontsByAttention(fronts: StrategicObjectiveFrontCard[]) {
  const statusOrder: Record<StrategicObjectiveFrontCard['healthStatus'], number> = {
    requires_attention: 5,
    pending_decision: 4,
    tracking: 3,
    definition: 2,
    closed: 1,
  };

  return fronts.sort((left, right) => {
    if (right.attentionPriorityScore !== left.attentionPriorityScore) {
      return right.attentionPriorityScore - left.attentionPriorityScore;
    }
    if (statusOrder[right.healthStatus] !== statusOrder[left.healthStatus]) {
      return statusOrder[right.healthStatus] - statusOrder[left.healthStatus];
    }
    return right.progressPercent - left.progressPercent;
  });
}

export function getFrontAlerts(
  challengeRows: StrategicObjectiveChallengeRow[],
  blockersCount: number,
  pendingDecisionsCount: number,
  createChallengePath: string,
) {
  const alerts: StrategicObjectiveFrontCard['alerts'] = [];
  const blockedChallenge = challengeRows.find(challenge => challenge.blockerLabel);
  const decisionChallenge = challengeRows.find(challenge => challenge.pendingDecisionLabel);
  const lowCoverageChallenge = challengeRows.find(challenge => /sin cobertura|cobertura parcial|reformular/i.test(challenge.coverageLabel));
  const activationChallenge = challengeRows.find(challenge => challenge.nextActionLabel === 'Activar reto');

  if (blockedChallenge && blockersCount > 0) {
    alerts.push({
      id: `blocker-${blockedChallenge.id}`,
      label: `Bloqueo: ${blockedChallenge.blockerLabel}`,
      actionLabel: 'Revisar',
      actionPath: blockedChallenge.actionPath,
      tone: 'rose',
    });
  }

  if (decisionChallenge && pendingDecisionsCount > 0) {
    alerts.push({
      id: `decision-${decisionChallenge.id}`,
      label: `Decision pendiente: ${decisionChallenge.pendingDecisionLabel}`,
      actionLabel: 'Revisar',
      actionPath: decisionChallenge.actionPath,
      tone: 'violet',
    });
  }

  if (lowCoverageChallenge) {
    alerts.push({
      id: `coverage-${lowCoverageChallenge.id}`,
      label: `Reto sin cobertura: ${lowCoverageChallenge.name}`,
      actionLabel: 'Ver reto',
      actionPath: lowCoverageChallenge.actionPath,
      tone: 'amber',
    });
  }

  if (activationChallenge) {
    alerts.push({
      id: `activation-${activationChallenge.id}`,
      label: `Reto listo para activar: ${activationChallenge.name}`,
      actionLabel: 'Activar',
      actionPath: activationChallenge.actionPath || createChallengePath,
      tone: 'amber',
    });
  }

  return alerts.slice(0, 2);
}

export function getFrontPrimaryAction(card: Pick<StrategicObjectiveFrontCard, 'alerts' | 'healthStatus' | 'challengesCount' | 'viewPath' | 'createChallengePath'>) {
  if (card.alerts.length > 0) {
    return { label: 'Revisar alertas', path: card.alerts[0].actionPath };
  }
  if (card.challengesCount === 0 || card.healthStatus === 'definition') {
    return { label: 'Activar reto', path: card.createChallengePath };
  }
  if (card.healthStatus === 'tracking') {
    return { label: 'Mantener seguimiento', path: card.viewPath };
  }
  return { label: 'Ver frente', path: card.viewPath };
}

function getStrategicObjectiveChallengeRows(
  challenges: Challenge[],
  initiatives: Initiative[],
): StrategicObjectiveChallengeRow[] {
  return challenges.map(challenge => {
    const relatedInitiatives = getInitiativesByChallengeId(initiatives, challenge.id);
    const blockedInitiative = relatedInitiatives.find(
      initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
    );
    const pendingDecision = getPendingDecisions(relatedInitiatives).find(
      initiative => normalizeInitiativeStatus(initiative.status) !== 'blocked',
    );
    const coverage = getChallengeCoverageStatus(challenge, initiatives);
    const progressPercent = getChallengeProgressEstimate(challenge, initiatives);
    const severity = getChallengeSeverity(challenge, coverage, relatedInitiatives, progressPercent);

    return {
      id: challenge.id,
      name: challenge.name,
      statusLabel: challengeStatusLabel(challenge.status),
      severity,
      attentionLabel: getChallengeAttentionLabel(severity),
      initiativesCount: relatedInitiatives.length,
      peopleCount: getChallengePeopleCount(challenge, relatedInitiatives),
      ownerLabel: getChallengeOwnerLabel(challenge),
      progressPercent,
      coverageLabel: coverageLabel(coverage),
      nextActionLabel: getChallengeNextActionLabel(challenge, relatedInitiatives, blockedInitiative, pendingDecision),
      blockerLabel: blockedInitiative ? blockedInitiative.mainBlocker || blockedInitiative.mainAlert : undefined,
      pendingDecisionLabel: pendingDecision ? pendingDecision.name : undefined,
      actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
    };
  }).sort((left, right) => {
    const severityWeight = { critical: 4, attention: 3, neutral: 2, healthy: 1 };
    const leftScore = severityWeight[left.severity] + (left.blockerLabel || left.pendingDecisionLabel ? 1 : 0);
    const rightScore = severityWeight[right.severity] + (right.blockerLabel || right.pendingDecisionLabel ? 1 : 0);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.progressPercent - right.progressPercent;
  });
}

export function getStrategicObjectivesOverviewModel(state: PortfolioLeadState): PortfolioStrategicOverviewModel {
  const fronts: StrategicObjectiveFrontCard[] = state.strategicFronts.map(front => {
    const frontChallenges = getChallengesByFrontId(state.challenges, front.id);
    const frontInitiatives = getInitiativesByFrontId(state.initiatives, front.id);
    const blockedInitiatives = frontInitiatives.filter(
      initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
    );
    const pendingDecisions = getPendingDecisions(frontInitiatives);
    const action = getFrontActionModel(front, frontChallenges, frontInitiatives);
    const executiveState = getFrontExecutiveState(front, state.challenges, state.initiatives);
    const progressPercent = getFrontProgressEstimate(front, state.challenges, frontInitiatives);
    const challengeRows = getStrategicObjectiveChallengeRows(frontChallenges, state.initiatives);
    const healthStatus = getFrontHealthStatus(front, frontChallenges, frontInitiatives);
    const attentionPriorityScore = getFrontPriorityScore(front, frontChallenges, frontInitiatives, progressPercent);
    const viewPath = '/portfolio/frentes-estrategicos';
    const createChallengePath = `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`;
    const importPath = `/portfolio/iniciar?mode=import&frontId=${encodeURIComponent(front.id)}`;
    const reportPath = `/portfolio/reportes?frontId=${encodeURIComponent(front.id)}`;
    const alerts = getFrontAlerts(challengeRows, blockedInitiatives.length, pendingDecisions.length, createChallengePath);
    const primaryAction = getFrontPrimaryAction({
      alerts,
      healthStatus,
      challengesCount: frontChallenges.length,
      viewPath,
      createChallengePath,
    });

    return {
      id: front.id,
      name: front.name,
      strategicObjective: front.strategicObjective,
      mainKpi: front.mainKpi,
      baseline: front.baseline,
      currentValue: getFrontCurrentValue(front, frontChallenges),
      target: front.target,
      progressPercent,
      statusLabel: executiveState.label,
      statusTone: executiveState.tone,
      healthStatus,
      attentionPriorityScore,
      sponsor: front.sponsor,
      horizon: front.horizon,
      challengesCount: frontChallenges.length,
      initiativesCount: frontInitiatives.length,
      blockersCount: blockedInitiatives.length,
      pendingDecisionsCount: pendingDecisions.length,
      nextActionLabel: action.label,
      nextActionDescription: action.description,
      primaryActionLabel: primaryAction.label,
      primaryActionPath: primaryAction.path,
      alerts,
      viewPath,
      createChallengePath,
      importPath,
      reportPath,
      hiddenChallengesCount: Math.max(challengeRows.length - 2, 0),
      challenges: challengeRows.slice(0, 2),
    };
  });

  return {
    fronts: sortFrontsByAttention(fronts),
  };
}

function getHomeSummaryCards(state: PortfolioLeadState): PortfolioHomeSummaryCard[] {
  const summary = getPortfolioSummary(state);

  return [
    {
      id: 'frentes-activos',
      label: 'Frentes activos',
      value: String(summary.activeFronts),
      microcopy: 'Objetivos en seguimiento.',
      tone: summary.activeFronts > 0 ? 'emerald' : 'slate',
      icon: 'fronts',
      path: '/portfolio/frentes-estrategicos',
    },
    {
      id: 'retos-activos',
      // Cuenta retos publicados, no retos con trabajo: la etiqueta lo dice tal cual.
      label: 'Retos publicados',
      value: String(summary.activeChallenges),
      microcopy: `Visibles para participantes · ${summary.challengesWithActiveInitiatives} con iniciativas en curso.`,
      tone: summary.activeChallenges > 0 ? 'sky' : 'slate',
      icon: 'challenges',
      path: '/portfolio/retos',
    },
    {
      id: 'retos-por-activar',
      label: 'Retos por activar',
      value: String(summary.challengesReadyToActivate),
      microcopy: 'Pendientes de publicar.',
      tone: summary.challengesReadyToActivate > 0 ? 'amber' : 'slate',
      icon: 'activation',
      path: '/portfolio/retos',
    },
    {
      id: 'iniciativas-bloqueadas',
      label: 'Iniciativas bloqueadas',
      value: String(summary.blockedInitiatives),
      microcopy: 'Casos que necesitan intervencion.',
      tone: summary.blockedInitiatives > 0 ? 'rose' : 'slate',
      icon: 'blockers',
      path: '/portfolio/iniciativas',
    },
    {
      id: 'iniciativas-en-curso',
      label: 'Iniciativas en curso',
      value: String(summary.activeInitiatives),
      microcopy: 'Trabajo visible en movimiento.',
      tone: summary.activeInitiatives > 0 ? 'sky' : 'slate',
      icon: 'activity',
      path: '/portfolio/iniciativas',
    },
    {
      id: 'decisiones-pendientes',
      label: 'Decisiones pendientes',
      value: String(summary.pendingDecisions),
      microcopy: 'Definiciones que ya piden revision.',
      tone: summary.pendingDecisions > 0 ? 'violet' : 'slate',
      icon: 'decisions',
      path: '/portfolio/decisiones',
    },
    {
      id: 'listas-para-decision',
      label: 'Listas para decision',
      value: String(summary.readyForDecisionInitiatives),
      microcopy: 'Casos maduros para revisar.',
      tone: summary.readyForDecisionInitiatives > 0 ? 'emerald' : 'slate',
      icon: 'ready',
      path: '/portfolio/decisiones',
    },
  ];
}

function getHomeFrontCards(state: PortfolioLeadState): PortfolioFrontOverviewCard[] {
  return getActiveFronts(state.strategicFronts).map(front => {
    const relatedChallenges = getChallengesByFrontId(state.challenges, front.id);
    const relatedInitiatives = getInitiativesByFrontId(state.initiatives, front.id);
    const activeChallenges = relatedChallenges.filter(challenge => challenge.visibleToParticipants);
    const blockedInitiatives = relatedInitiatives.filter(
      initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
    );
    const pendingDecisions = getPendingDecisions(relatedInitiatives);
    const action = getFrontActionModel(front, relatedChallenges, relatedInitiatives);
    const executiveState = getFrontExecutiveState(front, relatedChallenges, relatedInitiatives);
    const progressPercent = getFrontProgressEstimate(front, relatedChallenges, relatedInitiatives);

    return {
      id: front.id,
      name: front.name,
      executiveState: executiveState.label,
      executiveTone: executiveState.tone,
      mainKpi: front.mainKpi,
      progressPercent,
      progressLabel: `${progressPercent}% de avance estimado`,
      detail: `${activeChallenges.length} de ${relatedChallenges.length} retos activados · ${relatedInitiatives.length} iniciativas en curso · ${pendingDecisions.length} decisiones pendientes`,
      challengesCount: relatedChallenges.length,
      initiativesCount: relatedInitiatives.length,
      pendingDecisionsCount: pendingDecisions.length,
      createdLabel: formatCreatedLabel(front.createdAt),
      lastActivityLabel: getFrontLastActivityLabel(front, relatedChallenges, relatedInitiatives),
      alerts: getFrontAlertLabels(front, relatedChallenges, relatedInitiatives).concat(
        blockedInitiatives.length > 0 && !getFrontAlertLabels(front, relatedChallenges, relatedInitiatives).includes('Iniciativa bloqueada')
          ? ['Iniciativa bloqueada']
          : [],
      ).slice(0, 3),
      nextAction: action.label,
      nextActionDescription: action.description,
      actionLabel: 'Ver frente',
      actionPath: '/portfolio/frentes-estrategicos',
    };
  });
}

function getHomeImportantChanges(state: PortfolioLeadState): PortfolioImportantChangeCard[] {
  const typeLabels: Record<string, string> = {
    activation: 'Activación pendiente',
    coverage: 'Cobertura incompleta',
    stakeholder: 'Alineación pendiente',
    blocker: 'Bloqueo visible',
    decision: 'Decisión pendiente',
  };

  const riskByType: Record<string, string> = {
    activation: 'El frente puede quedarse en definición y no recibir iniciativas nuevas.',
    coverage: 'La cobertura seguirá incompleta y el avance puede verse fragmentado.',
    stakeholder: 'La activación sigue sin responsable confirmado y puede perder tracción.',
    blocker: 'La iniciativa puede seguir detenida y acumular más tiempo sin avance.',
    decision: 'La evidencia puede enfriarse si no se toma una definición ejecutiva.',
  };

  return getPortfolioAlerts(state)
    .slice(0, 5)
    .map(alert => {
      const challenge = alert.challengeId ? state.challenges.find(item => item.id === alert.challengeId) : null;
      const initiative = alert.initiativeId ? state.initiatives.find(item => item.id === alert.initiativeId) : null;
      const front = alert.frontId ? state.strategicFronts.find(item => item.id === alert.frontId) : challenge
        ? state.strategicFronts.find(item => item.id === challenge.strategicFrontId)
        : initiative
          ? state.strategicFronts.find(item => item.id === initiative.strategicFrontId)
          : null;
      const typeKey = alert.type ?? 'decision';

      return {
        id: alert.id,
        type: typeLabels[typeKey] ?? 'Alerta relevante',
        frontName: front?.name ?? alert.contextLabel ?? 'Frente no visible',
        itemName: challenge?.name ?? initiative?.name ?? alert.title,
        whyItMatters: alert.whyItMatters ?? alert.description,
        risk: riskByType[typeKey] ?? alert.description,
        suggestedAction: alert.recommendedAction ?? 'Revisar este punto antes de seguir.',
        actionLabel: alert.actionLabel ?? 'Revisar',
        actionPath: alert.actionPath,
        tone: alert.tone,
      };
    });
}

function getHomePendingDecisions(state: PortfolioLeadState): PortfolioPendingDecisionRow[] {
  return getPendingDecisions(state.initiatives)
    .map(initiative => {
      const challenge = state.challenges.find(item => item.id === initiative.challengeId);
      const front = state.strategicFronts.find(item => item.id === initiative.strategicFrontId);
      const evidenceLevel = isInitiativeReadyForDecision(initiative)
        ? 'Alta'
        : initiative.partialSignal
          ? 'Media'
          : 'Baja';
      const urgency = normalizeInitiativeStatus(initiative.status) === 'blocked' || initiative.blockedDays >= 14 || isInitiativeReadyForDecision(initiative)
        ? 'Alta'
        : 'Media';

      return {
        id: initiative.id,
        decision: normalizeInitiativeStatus(initiative.status) === 'blocked'
          ? 'Desbloquear o redefinir destino'
          : isInitiativeReadyForDecision(initiative)
            ? 'Tomar decisión'
            : 'Revisar avance',
        frontName: front?.name ?? 'Frente no visible',
        itemName: challenge?.name ?? initiative.name,
        evidenceLevel,
        urgency,
        actionLabel: 'Revisar',
        actionPath: `/portfolio/decisiones?challengeId=${encodeURIComponent(initiative.challengeId)}&initiativeId=${encodeURIComponent(initiative.id)}`,
      };
    })
    .sort((left, right) => {
      const leftUrgency = left.urgency === 'Alta' ? 2 : 1;
      const rightUrgency = right.urgency === 'Alta' ? 2 : 1;
      if (leftUrgency !== rightUrgency) return rightUrgency - leftUrgency;
      return left.itemName.localeCompare(right.itemName);
    });
}

function getHomeRecentActivity(state: PortfolioLeadState): PortfolioRecentActivityItem[] {
  type ActivityDraft = PortfolioRecentActivityItem & { sortIndex: number };
  const drafts: ActivityDraft[] = [];

  state.executiveOutputs.forEach(output => {
    const initiative = state.initiatives.find(item => item.id === output.initiativeId);
    const challenge = state.challenges.find(item => item.id === output.challengeId);
    const front = state.strategicFronts.find(item => item.id === challenge?.strategicFrontId);
    drafts.push({
      id: `exec-${output.id}`,
      label: 'Reporte generado',
      description: `${initiative?.name ?? 'Una iniciativa'} ya cuenta con salida ejecutiva para ${front?.name ?? 'el portafolio'}.`,
      timeLabel: initiative ? buildActivityAgeLabel(initiative.lastActivity) : 'Reciente',
      tone: 'violet',
      sortIndex: initiative ? parseRelativeDaysFromText(initiative.lastActivity) ?? 5 : 5,
    });
  });

  getPendingDecisionCards(state).forEach(card => {
    const initiative = state.initiatives.find(item => item.id === card.initiativeId);
    const ageText = initiative ? buildActivityAgeLabel(initiative.lastActivity) : 'hace 5 días';
    drafts.push({
      id: `decision-${card.id}`,
      label: 'Decisión registrada',
      description: `${card.initiativeName} ya quedó listo para la revisión ejecutiva.`,
      timeLabel: ageText,
      tone: 'sky',
      sortIndex: initiative ? parseRelativeDaysFromText(initiative.lastActivity) ?? 5 : 5,
    });
  });

  state.challenges.forEach(challenge => {
    if (!challenge.visibleToParticipants) return;
    drafts.push({
      id: `challenge-${challenge.id}`,
      label: 'Reto activado',
      description: `${challenge.name} ya está visible para trabajo con participantes o squad.`,
      timeLabel: challenge.lastPublishedAt ? formatRelativeDays(daysSince(challenge.lastPublishedAt) ?? 0) : 'Reciente',
      tone: 'emerald',
      sortIndex: challenge.lastPublishedAt ? daysSince(challenge.lastPublishedAt) ?? 5 : 5,
    });
  });

  state.initiatives.forEach(initiative => {
    const age = parseRelativeDaysFromText(initiative.lastActivity) ?? 5;
    const label = normalizeInitiativeStatus(initiative.status) === 'blocked'
      ? 'Iniciativa bloqueada'
      : isInitiativeReadyForDecision(initiative)
        ? 'Iniciativa lista para decisión'
        : /coment/i.test(initiative.lastActivity)
          ? 'Comentario nuevo'
          : 'Actividad registrada';

    drafts.push({
      id: `initiative-${initiative.id}`,
      label,
      description: initiative.signalSummary || initiative.nextActionRecommended,
      timeLabel: formatRelativeDays(age),
      tone: normalizeInitiativeStatus(initiative.status) === 'blocked'
        ? 'rose'
        : isInitiativeReadyForDecision(initiative)
          ? 'violet'
          : /coment/i.test(initiative.lastActivity)
            ? 'sky'
            : 'amber',
      sortIndex: age,
    });
  });

  return drafts
    .sort((left, right) => left.sortIndex - right.sortIndex)
    .slice(0, 6)
    .map(({ sortIndex: _sortIndex, ...item }) => item);
}

export function getPortfolioHomeExperienceModel(state: PortfolioLeadState, firstName = 'Valeria'): PortfolioHomeExperienceModel {
  return {
    banner: {
      title: `Hola, ${firstName}. Así avanzan tus objetivos estratégicos.`,
      subtitle: 'Revisa avance, cobertura, bloqueos y decisiones por cada frente estratégico.',
      actions: {
        primary: { label: 'Crear nuevo frente', path: '/portfolio/frentes-estrategicos', tone: 'primary' },
        secondary: { label: 'Importar iniciativas existentes', path: '/portfolio/iniciar?mode=import', tone: 'secondary' },
      },
    },
    summaryCards: getHomeSummaryCards(state),
    strategicOverview: getStrategicObjectivesOverviewModel(state),
    strategicFronts: getHomeFrontCards(state),
    importantChanges: getHomeImportantChanges(state),
    pendingDecisions: getHomePendingDecisions(state),
    recentActivity: getHomeRecentActivity(state),
  };
}

export function getChallengeActivationReadiness(challenge: Challenge): ChallengeActivationReadiness {
  const missingItems: string[] = [];

  if (!challenge.challengeOwner.trim()) {
    missingItems.push('Definir challenge owner');
  }

  if (challenge.challengeOwnerStatus !== 'confirmado') {
    missingItems.push('Confirmar challenge owner');
  }

  if (challenge.sponsorStatus !== 'confirmado') {
    missingItems.push('Confirmar sponsor');
  }

  if (
    challenge.activationMode === 'convocatoria_abierta'
    && challenge.openCallStatus !== 'activa'
  ) {
    missingItems.push('Preparar convocatoria');
  }

  if (
    challenge.activationMode === 'personas_seleccionadas'
    && challenge.selectedPeople.length === 0
  ) {
    missingItems.push('Definir personas invitadas');
  }

  if (
    ['squad_asignado', 'equipo_core_encargado'].includes(challenge.activationMode)
    && challenge.assignedSquad.length === 0
  ) {
    missingItems.push('Asignar squad');
  }

  if (
    challenge.activationMode === 'innovacion_abierta_partner_externo'
    && challenge.selectedPeople.length === 0
    && challenge.assignedSquad.length === 0
  ) {
    missingItems.push('Definir partner o contacto externo');
  }

  let activationState: ChallengeActivationReadiness['activationState'] = 'solo_definido';

  if (challenge.visibleToParticipants) {
    activationState = 'publicado';
  } else if (normalizeChallengeStatus(challenge.status) === 'activating_team') {
    activationState = 'activo_interno';
  } else if (missingItems.length === 0) {
    activationState = 'listo_para_activar';
  }

  return {
    challengeId: challenge.id,
    activationState,
    activationStateLabel: challengeActivationStateLabel(activationState),
    readyToActivate: !challenge.visibleToParticipants && missingItems.length === 0,
    missingItems,
  };
}

function getChallengeActionModel(challenge: Challenge, front: StrategicFront | null, initiatives: Initiative[]) {
  const readiness = getChallengeActivationReadiness(challenge);
  const pendingDecisions = getPendingDecisions(initiatives).filter(
    initiative => normalizeInitiativeStatus(initiative.status) !== 'blocked',
  );
  const blockedInitiatives = initiatives.filter(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  );

  if (!challenge.visibleToParticipants && readiness.readyToActivate) {
    return {
      label: 'Activar reto',
      description: `${challenge.name} ya esta listo para activarse y empezar a recibir trabajo visible bajo ${front?.name ?? 'su frente'}.`,
      actionLabel: 'Activar reto',
      actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
      focusReason: 'El reto ya tiene base suficiente y solo falta activarlo.',
      riskLabel: 'Mientras no lo actives, el frente sigue sin convertir esta prioridad en trabajo visible.',
      score: 100,
    };
  }

  if (blockedInitiatives.length > 0) {
    return {
      label: 'Resolver bloqueo',
      description: `${challenge.name} ya tiene iniciativas frenadas. Conviene destrabarlas antes de sumar mas carga al reto.`,
      actionLabel: 'Resolver bloqueo',
      actionPath: `/portfolio/iniciativas?challengeId=${encodeURIComponent(challenge.id)}&initiativeId=${encodeURIComponent(blockedInitiatives[0].id)}`,
      focusReason: 'Hay iniciativas bloqueadas frenando la cobertura del reto.',
      riskLabel: blockedInitiatives[0].mainBlocker || 'El reto pierde traccion si el bloqueo sigue abierto.',
      score: 90,
    };
  }

  if (pendingDecisions.length > 0) {
    return {
      label: 'Revisar decision',
      description: `${challenge.name} ya tiene iniciativas con senal suficiente para una definicion ejecutiva.`,
      actionLabel: 'Revisar decision',
      actionPath: `/portfolio/decisiones?challengeId=${encodeURIComponent(challenge.id)}&initiativeId=${encodeURIComponent(pendingDecisions[0].id)}`,
      focusReason: 'Ya existe evidencia madura que pide una decision.',
      riskLabel: 'Si la decision se posterga, la evidencia pierde ritmo y claridad.',
      score: 80,
    };
  }

  if (!challenge.visibleToParticipants && readiness.missingItems.length > 0) {
    return {
      label: 'Preparar activacion',
      description: `${challenge.name} aun necesita cerrar condiciones de activacion para pasar de definicion a trabajo visible.`,
      actionLabel: 'Completar activacion',
      actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
      focusReason: 'El reto existe, pero todavia no puede operar por su modalidad de activacion.',
      riskLabel: readiness.missingItems[0] ?? 'Faltan pasos de activacion antes de publicar el reto.',
      score: 70,
    };
  }

  if (challenge.visibleToParticipants && initiatives.length === 0) {
    return {
      label: 'Movilizar cobertura',
      description: `${challenge.name} ya esta activo, pero aun no recibe iniciativas visibles para seguimiento.`,
      actionLabel: 'Revisar activacion',
      actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challenge.id)}`,
      focusReason: 'El reto ya se activo, pero todavia no genera trabajo trazable.',
      riskLabel: 'Sin iniciativas, el reto no produce aprendizaje ni avance visible.',
      score: 60,
    };
  }

  return {
    label: 'Mantener seguimiento',
    description: `${challenge.name} ya tiene cobertura visible. Conviene sostener seguimiento y ajustar donde la senal aun sea parcial.`,
    actionLabel: 'Ver iniciativas',
    actionPath: `/portfolio/iniciativas?challengeId=${encodeURIComponent(challenge.id)}`,
    focusReason: 'El reto ya esta en movimiento y necesita continuidad.',
    riskLabel: 'Sin seguimiento, la cobertura puede quedar incompleta o dispersa.',
    score: 40,
  };
}

export function getChallengeCards(state: PortfolioLeadState): ChallengeCardModel[] {
  return state.challenges
    .map(challenge => {
      const front = state.strategicFronts.find(item => item.id === challenge.strategicFrontId) ?? null;
      const relatedInitiatives = getInitiativesByChallengeId(state.initiatives, challenge.id);
      const blockedInitiatives = relatedInitiatives.filter(
        initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
      );
      const pendingDecisions = getPendingDecisions(relatedInitiatives);
      const readiness = getChallengeActivationReadiness(challenge);
      const action = getChallengeActionModel(challenge, front, relatedInitiatives);

      return {
        id: challenge.id,
        name: challenge.name,
        frontId: front?.id ?? challenge.strategicFrontId,
        frontName: front?.name ?? 'Frente no visible',
        challengeTypeLabel: challengeTypeLabel(challenge.challengeType),
        whatWeWantToMove: challenge.whatWeWantToMove,
        mainSignalLabel: challenge.successCriteria || challenge.objective || 'Sin senal principal visible',
        urgencyLabel: challenge.whyNow || 'Sin urgencia visible',
        horizonLabel: front?.horizon ?? 'Sin horizonte visible',
        challengeOwner: challenge.challengeOwner || 'Sin challenge owner visible',
        sponsor: challenge.sponsorName?.trim() ? challenge.sponsorName : front?.sponsor ?? 'Sin sponsor visible',
        status: challenge.status,
        statusLabel: challengeStatusLabel(challenge.status),
        activationMode: challenge.activationMode,
        activationModeLabel: activationLabel(challenge.activationMode),
        activationState: readiness.activationState,
        activationStateLabel: readiness.activationStateLabel,
        coverageStatus: getChallengeCoverageStatus(challenge, state.initiatives),
        coverageLabel: coverageLabel(getChallengeCoverageStatus(challenge, state.initiatives)),
        initiativesCount: relatedInitiatives.length,
        blockedInitiativesCount: blockedInitiatives.length,
        pendingDecisionsCount: pendingDecisions.length,
        nextActionLabel: action.label,
        nextActionDescription: action.description,
        actionLabel: action.actionLabel,
        actionPath: action.actionPath,
        focusReason: action.focusReason,
        relevantBlocker: blockedInitiatives[0]?.mainBlocker ?? 'Sin bloqueos relevantes ahora.',
      };
    })
    .sort((left, right) => {
      const challengeLeft = state.challenges.find(item => item.id === left.id)!;
      const challengeRight = state.challenges.find(item => item.id === right.id)!;
      const frontLeft = state.strategicFronts.find(item => item.id === challengeLeft.strategicFrontId) ?? null;
      const frontRight = state.strategicFronts.find(item => item.id === challengeRight.strategicFrontId) ?? null;
      const scoreLeft = getChallengeActionModel(challengeLeft, frontLeft, getInitiativesByChallengeId(state.initiatives, left.id)).score;
      const scoreRight = getChallengeActionModel(challengeRight, frontRight, getInitiativesByChallengeId(state.initiatives, right.id)).score;
      return scoreRight - scoreLeft;
    });
}

export function getChallengesByActivationState(state: PortfolioLeadState): ChallengesByActivationState {
  const cards = getChallengeCards(state);

  return {
    soloDefinidos: cards.filter(card => card.activationState === 'solo_definido'),
    listosParaActivar: cards.filter(card => card.activationState === 'listo_para_activar'),
    activosInternos: cards.filter(card => card.activationState === 'activo_interno'),
    publicados: cards.filter(card => card.activationState === 'publicado'),
  };
}

export function getChallengesWithoutCoverage(state: PortfolioLeadState) {
  return getChallengeCards(state).filter(card => card.coverageStatus === 'sin_cobertura');
}

export function getChallengesWithPendingDecision(state: PortfolioLeadState) {
  return getChallengeCards(state).filter(card => card.pendingDecisionsCount > 0);
}

export function getChallengesSummary(state: PortfolioLeadState): ChallengesSummary {
  const cards = getChallengeCards(state);
  const byActivation = getChallengesByActivationState(state);

  return {
    totalChallenges: cards.length,
    readyToActivate: byActivation.listosParaActivar.length,
    activeChallenges: byActivation.publicados.length,
    challengesWithoutCoverage: cards.filter(card => card.coverageStatus === 'sin_cobertura').length,
    partialCoverageChallenges: cards.filter(card => card.coverageStatus === 'cobertura_parcial').length,
    challengesWithPendingDecision: cards.filter(card => card.pendingDecisionsCount > 0).length,
    blockedChallenges: cards.filter(card => card.blockedInitiativesCount > 0).length,
  };
}

export function getChallengesFocusRecommendation(state: PortfolioLeadState): ChallengeFocusRecommendation | null {
  const cards = getChallengeCards(state);
  const focusChallenge = cards[0];

  if (!focusChallenge) {
    return null;
  }

  let missingPiece = 'Conviene sostener seguimiento para no perder ritmo en la cobertura del reto.';
  if (focusChallenge.activationState === 'solo_definido') {
    missingPiece = 'Todavia faltan condiciones de activacion para que este reto reciba trabajo visible.';
  } else if (focusChallenge.activationState === 'listo_para_activar') {
    missingPiece = 'El reto ya esta listo. Solo falta activarlo para empezar a mover cobertura real.';
  } else if (focusChallenge.pendingDecisionsCount > 0) {
    missingPiece = 'Ya hay iniciativas maduras esperando una definicion.';
  } else if (focusChallenge.blockedInitiativesCount > 0) {
    missingPiece = focusChallenge.relevantBlocker;
  } else if (focusChallenge.initiativesCount === 0) {
    missingPiece = 'El reto ya esta activo, pero aun no genera iniciativas visibles.';
  }

  return {
    challengeId: focusChallenge.id,
    challengeName: focusChallenge.name,
    frontName: focusChallenge.frontName,
    title: `${focusChallenge.name} necesita tu atencion primero`,
    description: focusChallenge.nextActionDescription,
    whyItMatters: `${focusChallenge.frontName} depende de este reto para mover cobertura visible.`,
    missingPiece,
    riskLabel: focusChallenge.relevantBlocker !== 'Sin bloqueos relevantes ahora.'
      ? focusChallenge.relevantBlocker
      : `${focusChallenge.coverageLabel}. Si no actuas, el reto puede quedarse sin avance trazable.`,
    actionLabel: focusChallenge.actionLabel,
    actionPath: focusChallenge.actionPath,
  };
}

export function getChallengeActivationRecommendation(
  state: PortfolioLeadState,
  challengeId: string,
): ChallengeActivationRecommendationModel | null {
  const challenge = state.challenges.find(item => item.id === challengeId);
  if (!challenge) return null;
  const front = state.strategicFronts.find(item => item.id === challenge.strategicFrontId) ?? null;
  return deriveChallengeActivationRecommendation(challenge, front);
}

export function getChallengeActivationMessageDraft(
  state: PortfolioLeadState,
  challengeId: string,
) {
  const challenge = state.challenges.find(item => item.id === challengeId);
  if (!challenge) return '';
  const front = state.strategicFronts.find(item => item.id === challenge.strategicFrontId) ?? null;
  const recommendation = deriveChallengeActivationRecommendation(challenge, front);
  return challenge.activationMessageDraft || buildChallengeActivationMessageDraft(challenge, recommendation, front);
}

function getFrontAreaLabel(initiatives: Initiative[]) {
  const visibleAreas = initiatives
    .map(initiative => initiative.attackedArea.trim())
    .filter(Boolean);

  if (visibleAreas.length === 0) {
    return 'Sin area visible';
  }

  const counts = new Map<string, number>();
  visibleAreas.forEach(area => {
    counts.set(area, (counts.get(area) ?? 0) + 1);
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Sin area visible';
}

function getFrontActionModel(front: StrategicFront, challenges: Challenge[], initiatives: Initiative[]) {
  const challengeToActivate = challenges.find(challenge => !challenge.visibleToParticipants);
  if (challengeToActivate) {
    return {
      label: 'Activar reto',
      description: `${challengeToActivate.name} ya esta definido, pero el frente sigue sin mover trabajo visible mientras no se active.`,
      actionLabel: 'Activar reto',
      actionPath: `/portfolio/retos?challengeId=${encodeURIComponent(challengeToActivate.id)}`,
      focusReason: 'Este frente ya tiene un reto definido que aun no se activa.',
      score: 100,
      riskLabel: 'El frente se queda en definicion y sin cobertura visible.',
    };
  }

  const blockedInitiative = initiatives.find(
    initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
  );
  if (blockedInitiative) {
    return {
      label: 'Resolver bloqueo',
      description: `${blockedInitiative.name} ya no avanza por su cuenta y conviene destrabarla antes de abrir mas trabajo en este frente.`,
      actionLabel: 'Resolver bloqueo',
      actionPath: `/portfolio/iniciativas?challengeId=${encodeURIComponent(blockedInitiative.challengeId)}&initiativeId=${encodeURIComponent(blockedInitiative.id)}`,
      focusReason: 'Hay una iniciativa bloqueada frenando el avance del frente.',
      score: 90,
      riskLabel: blockedInitiative.mainBlocker || 'El frente pierde traccion mientras el bloqueo sigue abierto.',
    };
  }

  const pendingDecision = getPendingDecisions(initiatives).find(
    initiative => normalizeInitiativeStatus(initiative.status) !== 'blocked',
  );
  if (pendingDecision) {
    return {
      label: 'Revisar decision',
      description: `${pendingDecision.name} ya tiene senales suficientes para una definicion. Si no decides, el frente pierde ritmo ejecutivo.`,
      actionLabel: 'Revisar decision',
      actionPath: `/portfolio/decisiones?challengeId=${encodeURIComponent(pendingDecision.challengeId)}&initiativeId=${encodeURIComponent(pendingDecision.id)}`,
      focusReason: 'Hay una iniciativa madura lista para pasar por decision.',
      score: 80,
      riskLabel: 'La evidencia pierde fuerza si la decision se posterga.',
    };
  }

  if (challenges.length === 0) {
    return {
      label: 'Crear primer reto',
      description: 'El frente ya marca una prioridad del negocio, pero aun no baja a un reto accionable que movilice trabajo.',
      actionLabel: 'Crear primer reto',
      actionPath: `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`,
      focusReason: 'Todavia no existe cobertura inicial para esta prioridad.',
      score: 70,
      riskLabel: 'La prioridad sigue sin convertirse en trabajo gobernable.',
    };
  }

  if (initiatives.length === 0) {
    return {
      label: 'Activar cobertura',
      description: 'El frente ya tiene retos, pero todavia no se traduce en iniciativas visibles para seguimiento.',
      actionLabel: 'Ir a retos',
      actionPath: `/portfolio/retos?frontId=${encodeURIComponent(front.id)}`,
      focusReason: 'El frente ya esta planteado, pero aun no genera trabajo trazable.',
      score: 60,
      riskLabel: 'Sin iniciativas, el frente sigue sin aprendizaje ni evidencia.',
    };
  }

  return {
    label: 'Mantener seguimiento',
    description: 'Este frente ya tiene cobertura visible. Conviene sostener seguimiento y revisar donde aun falte profundidad.',
    actionLabel: 'Ver iniciativas',
    actionPath: `/portfolio/iniciativas?frontId=${encodeURIComponent(front.id)}`,
    focusReason: 'El frente ya se esta moviendo y necesita continuidad.',
    score: 40,
    riskLabel: 'Sin seguimiento, la cobertura puede quedarse corta o dispersa.',
  };
}

export function getStrategicFrontCards(state: PortfolioLeadState): StrategicFrontCardModel[] {
  return state.strategicFronts
    .map(front => {
      const frontChallenges = getChallengesByFrontId(state.challenges, front.id);
      const frontInitiatives = getInitiativesByFrontId(state.initiatives, front.id);
      const coverageStatus = getFrontCoverageStatus(front, state.challenges, state.initiatives);
      const blockedInitiatives = frontInitiatives.filter(
        initiative => normalizeInitiativeStatus(initiative.status) === 'blocked' || hasTechnicalBlocker(initiative.mainBlocker),
      );
      const pendingDecisions = getPendingDecisions(frontInitiatives);
      const action = getFrontActionModel(front, frontChallenges, frontInitiatives);

      return {
        id: front.id,
        name: front.name,
        strategicObjective: front.strategicObjective,
        whyNow: front.whyNow,
        mainKpi: front.mainKpi,
        baseline: front.baseline,
        target: front.target,
        horizon: front.horizon,
        sponsor: front.sponsor,
        priority: front.priority,
        status: front.status,
        statusLabel: strategicFrontStatusLabel(front.status),
        coverageStatus,
        coverageLabel: coverageLabel(coverageStatus),
        challengesCount: frontChallenges.length,
        initiativesCount: frontInitiatives.length,
        blockedInitiativesCount: blockedInitiatives.length,
        pendingDecisionsCount: pendingDecisions.length,
        areaLabel: getFrontAreaLabel(frontInitiatives),
        relevantBlocker: blockedInitiatives[0]?.mainBlocker ?? 'Sin bloqueos relevantes ahora.',
        nextActionLabel: action.label,
        nextActionDescription: action.description,
        actionLabel: action.actionLabel,
        actionPath: action.actionPath,
        focusReason: action.focusReason,
      };
    })
    .sort((left, right) => {
      const priorityWeight = { Alta: 3, Media: 2, Baja: 1 };
      const leftScore = getFrontActionModel(
        state.strategicFronts.find(front => front.id === left.id)!,
        getChallengesByFrontId(state.challenges, left.id),
        getInitiativesByFrontId(state.initiatives, left.id),
      ).score + priorityWeight[left.priority];
      const rightScore = getFrontActionModel(
        state.strategicFronts.find(front => front.id === right.id)!,
        getChallengesByFrontId(state.challenges, right.id),
        getInitiativesByFrontId(state.initiatives, right.id),
      ).score + priorityWeight[right.priority];
      return rightScore - leftScore;
    });
}

export function getStrategicFrontsSummary(state: PortfolioLeadState): StrategicFrontsSummary {
  const cards = getStrategicFrontCards(state);

  return {
    totalFronts: state.strategicFronts.length,
    activeFronts: getActiveFronts(state.strategicFronts).length,
    frontsWithoutChallenges: cards.filter(card => card.challengesCount === 0).length,
    partialCoverageFronts: cards.filter(card => card.coverageStatus === 'cobertura_parcial').length,
    frontsPendingDecision: cards.filter(card => card.pendingDecisionsCount > 0).length,
  };
}

export function getFrontsFocusRecommendation(state: PortfolioLeadState): StrategicFrontFocusRecommendation | null {
  const cards = getStrategicFrontCards(state);
  const focusFront = cards[0];

  if (!focusFront) {
    return null;
  }

  const missingPiece = focusFront.challengesCount === 0
    ? 'Todavia no hay retos que conviertan esta prioridad en trabajo accionable.'
    : focusFront.initiativesCount === 0
      ? 'Todavia no hay iniciativas visibles que le den cobertura al frente.'
      : focusFront.pendingDecisionsCount > 0
        ? 'Ya hay casos maduros que necesitan una definicion para seguir avanzando.'
        : focusFront.blockedInitiativesCount > 0
          ? focusFront.relevantBlocker
          : 'Conviene sostener seguimiento para que la cobertura no pierda traccion.';

  return {
    frontId: focusFront.id,
    frontName: focusFront.name,
    title: `${focusFront.name} necesita tu atencion primero`,
    description: focusFront.nextActionDescription,
    whyItMatters: focusFront.focusReason,
    missingPiece,
    actionLabel: focusFront.actionLabel,
    actionPath: focusFront.actionPath,
    impactLabel: focusFront.mainKpi ? `Este frente busca mover ${focusFront.mainKpi}.` : 'Este frente sostiene una prioridad clave del negocio.',
    riskLabel: focusFront.relevantBlocker !== 'Sin bloqueos relevantes ahora.'
      ? focusFront.relevantBlocker
      : `${focusFront.coverageLabel}. Si no actuas, el frente puede quedarse corto en cobertura.`,
  };
}



