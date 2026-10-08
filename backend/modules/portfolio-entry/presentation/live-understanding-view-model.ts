import type { CriticalSituationSynthesis } from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';

export type LiveUnderstandingTension = {
  statement: string;
  whyItMatters: string;
};

export type LiveUnderstandingDecisionChangingUnknown = {
  uncertainty: string;
  whyItMatters: string;
};

export type LiveUnderstandingViewModel = {
  state: 'supported_reading' | 'no_supported_insight' | 'insufficient_basis' | 'synthesis_unavailable';
  reading?: string;
  tensions?: LiveUnderstandingTension[];
  decision?: { decisionToPrepare: string };
  decisionChangingUnknowns: LiveUnderstandingDecisionChangingUnknown[];
};

export function liveUnderstandingUnavailableViewModel(): LiveUnderstandingViewModel {
  return { state: 'synthesis_unavailable', decisionChangingUnknowns: [] };
}

/**
 * Projects accepted KAN-114 output into a user-facing allowlist.
 * This mapper is intentionally pure and does not consume runtime metadata,
 * mutate the synthesis, or create content that was not present in it.
 */
export function toLiveUnderstandingViewModel(
  synthesis: CriticalSituationSynthesis,
): LiveUnderstandingViewModel {
  const tensions = synthesis.material_tensions
    .filter((tension) => tension.status === 'supported')
    .map(({ statement, why_it_matters }) => ({ statement, whyItMatters: why_it_matters }));
  const decisionChangingUnknowns = synthesis.decision_changing_unknowns
    .map(({ uncertainty, why_it_matters }) => ({ uncertainty, whyItMatters: why_it_matters }));
  const decision = synthesis.decision_frame.status === 'framed'
    && synthesis.decision_frame.decision_to_prepare !== null
    ? { decisionToPrepare: synthesis.decision_frame.decision_to_prepare }
    : undefined;

  const shared = {
    ...(tensions.length > 0 ? { tensions } : {}),
    ...(decision ? { decision } : {}),
    decisionChangingUnknowns,
  };

  if (synthesis.basis_status === 'insufficient_basis') {
    return { state: 'insufficient_basis', ...shared };
  }

  if (synthesis.situation_insight.status === 'no_supported_insight'
    || synthesis.situation_insight.statement === null) {
    return { state: 'no_supported_insight', ...shared };
  }

  return {
    state: 'supported_reading',
    reading: synthesis.situation_insight.statement,
    ...shared,
  };
}
