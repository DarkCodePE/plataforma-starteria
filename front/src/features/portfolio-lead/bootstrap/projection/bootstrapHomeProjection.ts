import {
  resolveNextBestPortfolioAction,
  resolvePortfolioHomeState,
  type PortfolioAnchor,
  type PortfolioBootstrapState,
  type HomeState,
  type NextBestPortfolioAction,
} from '../domain';
import type { PortfolioBootstrapResponse } from '../services/portfolioBootstrapClient';

export type BootstrapHomeProjection = {
  bootstrapSessionId: string;
  homeState: HomeState;
  nextAction: NextBestPortfolioAction;
  anchor: NonNullable<PortfolioBootstrapResponse['anchor']>;
  importBatches: PortfolioBootstrapResponse['importBatches'];
  workItems: PortfolioBootstrapResponse['workItems'];
  proposedMutations: PortfolioBootstrapResponse['proposedMutations'];
  latestAnalysisRun: PortfolioBootstrapResponse['latestAnalysisRun'];
  strategicConnections: PortfolioBootstrapResponse['strategicConnections'];
  advancementConditions: PortfolioBootstrapResponse['advancementConditions'];
  latestReading: PortfolioBootstrapResponse['latestReading'];
  existingWorkStatus: PortfolioBootstrapResponse['bootstrapSession']['existingWorkStatus'];
  analysisSummary: {
    total: number;
    strategicConnections: number;
    advancementConditions: number;
    attentionSignals: number;
    conflicts: number;
    reviewed: number;
    confirmed: number;
    rejected: number;
    pending: number;
    hardBlockingNow: number;
    reviewLater: number;
    carryToBrief: number;
    contextual: number;
    materialReviewComplete: boolean;
  };
  missingContext: string[];
  knownContext: string[];
  provenanceLabel: string;
  canConfirm: boolean;
};

export function projectBootstrapHome(response: PortfolioBootstrapResponse): BootstrapHomeProjection | null {
  if (!response.anchor) return null;

  const anchor = response.anchor;
  const portfolioState: PortfolioBootstrapState = {
    continuationExists: Boolean(response.sourceContinuation?.id ?? response.bootstrapSession.sourceContinuationId),
    anchor: toDomainAnchor(anchor),
    existingWorkStatus: response.bootstrapSession.existingWorkStatus,
    detectedWorkItems: response.workItems.map((item) => ({
      id: item.id,
      label: item.proposedName ?? item.rawLabel,
      provenance: 'USER_CONFIRMED',
      materialReviewRequired: item.status !== 'confirmed_in_portfolio',
      strategicConnectionStatus: 'alignment_unknown',
    })),
    firstReadingPublished: Boolean(response.latestReading),
    attentionSignals: (response.latestReading?.primaryAttentionItems ?? []).map((item) => ({
      type: toDomainAttentionType(item.type),
      severity: item.severity,
      label: item.title ?? item.statement,
      affectsMovement: item.severity === 'blocking',
    })),
    materialReviewPending: !response.latestReading && (response.workItems.length > 0 || response.bootstrapSession.existingWorkStatus === 'no_existing_work'),
  };
  const homeState = response.latestReading?.homeState ?? resolvePortfolioHomeState(portfolioState);

  return {
    bootstrapSessionId: response.bootstrapSession.id,
    homeState,
    nextAction: resolveNextBestPortfolioAction(portfolioState),
    anchor,
    importBatches: response.importBatches ?? [],
    workItems: response.workItems,
    proposedMutations: response.proposedMutations ?? [],
    latestAnalysisRun: response.latestAnalysisRun,
    strategicConnections: response.strategicConnections ?? [],
    advancementConditions: response.advancementConditions ?? [],
    latestReading: response.latestReading,
    existingWorkStatus: response.bootstrapSession.existingWorkStatus,
    analysisSummary: deriveAnalysisSummary(response.proposedMutations ?? []),
    missingContext: deriveMissingContext(anchor),
    knownContext: deriveKnownContext(anchor),
    provenanceLabel: provenanceLabel(anchor.provenanceStatus, anchor.status),
    canConfirm: anchor.status === 'anchor_sufficient',
  };
}

function deriveAnalysisSummary(proposedMutations: PortfolioBootstrapResponse['proposedMutations']) {
  const advancementConditions = proposedMutations.filter((mutation) => mutation.targetType === 'advancement_condition');
  const materialRequired = proposedMutations.filter((mutation) => mutation.materiality === 'material' && mutation.confirmationRequired);
  const unresolved = materialRequired.filter((mutation) => mutation.status === 'proposed' || (mutation.status === 'reviewed' && mutation.correctedAt));
  const pending = proposedMutations.filter((mutation) => mutation.status === 'proposed' || mutation.status === 'reviewed');
  const hardBlockingNow = pending.filter((mutation) => {
    const value = mutation.proposedValue as { severity?: string } | null;
    return value?.severity === 'blocking';
  });
  const carryToBrief = pending.filter((mutation) => {
    if (hardBlockingNow.some((blocker) => blocker.id === mutation.id)) return false;
    const value = mutation.proposedValue as { type?: string } | null;
    return ['business_signal', 'ownership_visibility', 'required_context', 'critical_dependency'].includes(value?.type ?? '');
  });
  const reviewLater = pending.filter((mutation) => (
    !hardBlockingNow.some((blocker) => blocker.id === mutation.id)
    && !carryToBrief.some((carry) => carry.id === mutation.id)
    && mutation.targetType === 'strategic_connection'
  ));
  const contextual = pending.filter((mutation) => (
    !hardBlockingNow.some((blocker) => blocker.id === mutation.id)
    && !carryToBrief.some((carry) => carry.id === mutation.id)
    && !reviewLater.some((later) => later.id === mutation.id)
  ));
  return {
    total: proposedMutations.filter((mutation) => mutation.status === 'proposed').length,
    strategicConnections: proposedMutations.filter((mutation) => mutation.targetType === 'strategic_connection' && mutation.status === 'proposed').length,
    advancementConditions: advancementConditions.filter((mutation) => mutation.status === 'proposed').length,
    attentionSignals: advancementConditions.filter((mutation) => {
      const value = mutation.proposedValue as { severity?: string } | null;
      return mutation.status === 'proposed' && ['attention', 'blocking'].includes(value?.severity ?? '');
    }).length,
    conflicts: proposedMutations.filter((mutation) => mutation.targetType === 'portfolio_anchor' && mutation.status === 'proposed').length,
    reviewed: proposedMutations.filter((mutation) => mutation.status === 'reviewed').length,
    confirmed: proposedMutations.filter((mutation) => mutation.status === 'confirmed').length,
    rejected: proposedMutations.filter((mutation) => mutation.status === 'rejected').length,
    pending: pending.length,
    hardBlockingNow: hardBlockingNow.length,
    reviewLater: reviewLater.length,
    carryToBrief: carryToBrief.length,
    contextual: contextual.length,
    materialReviewComplete: materialRequired.length > 0 && unresolved.length === 0,
  };
}

function toDomainAnchor(anchor: NonNullable<PortfolioBootstrapResponse['anchor']>): PortfolioAnchor {
  return {
    status: anchor.status,
    desiredOutcome: anchor.outcomeStatement,
    contextSummary: anchor.contextSummary ?? undefined,
    decisionToEnable: anchor.decisionToEnable ?? undefined,
    businessSignalStatus: anchor.businessSignalStatus === 'confirmed'
      ? 'known'
      : anchor.businessSignalStatus === 'proxy'
        ? 'proxy'
        : 'unknown',
    criticalContradictions: anchor.status === 'anchor_conflicting' ? ['anchor_conflicting'] : [],
    missing: deriveMissingContext(anchor),
    provenance: anchor.provenanceStatus === 'user_confirmed'
      ? 'USER_CONFIRMED'
      : anchor.provenanceStatus === 'ai_inferred'
        ? 'AI_INFERRED'
        : 'AI_SUGGESTED',
  };
}

function deriveMissingContext(anchor: NonNullable<PortfolioBootstrapResponse['anchor']>): string[] {
  if (anchor.status === 'anchor_conflicting') return ['Hay una contradiccion material que revisar.'];
  const missing: string[] = [];
  if (!hasValue(anchor.outcomeStatement)) missing.push('Intencion o prioridad interpretable.');
  if (!hasValue(anchor.contextSummary)) missing.push('Contexto minimo para organizar el trabajo.');
  if (!hasValue(anchor.decisionToEnable) && !['confirmed', 'proxy'].includes(anchor.businessSignalStatus)) {
    missing.push('Decision a habilitar o senal de negocio.');
  }
  if (anchor.status === 'anchor_provisional') missing.push('Confirmacion humana del punto de partida.');
  if (anchor.status === 'anchor_insufficient' && missing.length === 0) {
    missing.push('Claridad suficiente para confirmar el punto de partida.');
  }
  return missing;
}

function deriveKnownContext(anchor: NonNullable<PortfolioBootstrapResponse['anchor']>): string[] {
  return [
    anchor.outcomeStatement ? `Prioridad: ${anchor.outcomeStatement}` : null,
    anchor.contextSummary ? `Contexto: ${anchor.contextSummary}` : null,
    anchor.decisionToEnable ? `Decision: ${anchor.decisionToEnable}` : null,
    anchor.businessSignalValue ? `Senal: ${anchor.businessSignalValue}` : null,
  ].filter(Boolean) as string[];
}

function provenanceLabel(provenance: string, status: string): string {
  if (status === 'anchor_confirmed' || provenance === 'user_confirmed') return 'Confirmado por Portfolio Lead';
  if (provenance === 'ai_inferred') return 'Interpretado desde Portfolio Entry';
  if (provenance === 'ai_suggested') return 'Sugerido desde Portfolio Entry';
  if (provenance === 'extracted') return 'Extraido del handoff confirmado';
  return 'Viene de Portfolio Entry';
}

function toDomainAttentionType(type: string) {
  const map: Record<string, 'business_signal' | 'decision_path' | 'critical_dependency' | 'required_context' | 'ownership_visibility'> = {
    missing_business_signal: 'business_signal',
    unresolved_dependency: 'critical_dependency',
    missing_decision_path: 'decision_path',
    information_conflict: 'required_context',
    possible_misalignment: 'required_context',
    ownership_gap: 'ownership_visibility',
    missing_required_context: 'required_context',
  };
  return map[type] ?? 'required_context';
}

function hasValue(value?: string | null): boolean {
  return Boolean(value?.trim());
}
