import { z } from 'zod';
import {
  criticalSituationInsightSchema,
  criticalSituationSynthesisSchema,
} from '../../portfolio-entry-runtime/domain/critical-situation-synthesis.schema';

export type CriticalHandoffConclusionStatus = 'supported' | 'bounded' | 'insufficient_basis';

export type CriticalHandoffUsableNow = {
  item: string;
  howItCanHelp: string;
};

export type CriticalHandoffDecisionChangingUnknown = {
  uncertainty: string;
  whyItMatters: string;
};

export type CriticalHandoffFirstMovement = {
  movement: string;
  whyNow: string;
  whatItMayClarify: string;
  boundary: string;
  existingAssetsUsed?: string[];
};

export type CriticalHandoffProjection = {
  conclusionStatus: CriticalHandoffConclusionStatus;
  finalReading: string | null;
  decisionInView: string | null;
  usableNow: CriticalHandoffUsableNow[];
  decisionChangingUnknowns: CriticalHandoffDecisionChangingUnknown[];
  firstMovement: CriticalHandoffFirstMovement | null;
};

const criticalHandoffSynthesisSourceSchema = criticalSituationSynthesisSchema
  .extend({ situation_insight: criticalSituationInsightSchema.nullable() })
  .superRefine((synthesis, context) => {
    const insight = synthesis.situation_insight;
    const hasNoSupportedConclusion = synthesis.basis_status === 'insufficient_basis'
      || insight === null
      || insight.status === 'no_supported_insight';

    if (synthesis.basis_status === 'insufficient_basis' && insight?.status === 'supported') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['basis_status'],
        message: 'Insufficient basis cannot be paired with a supported situation insight.',
      });
    }

    if (hasNoSupportedConclusion && synthesis.candidate_first_movement !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['candidate_first_movement'],
        message: 'A first movement cannot be present without a supported conclusion basis.',
      });
    }
  });

export function toCriticalHandoffProjection(
  source: unknown,
): CriticalHandoffProjection {
  const synthesis = criticalHandoffSynthesisSourceSchema.parse(source);
  const insight = synthesis.situation_insight;
  const insufficient = synthesis.basis_status === 'insufficient_basis'
    || insight === null
    || insight.status === 'no_supported_insight';
  const conclusionStatus: CriticalHandoffConclusionStatus = insufficient
    ? 'insufficient_basis'
    : synthesis.basis_status === 'partial' ? 'bounded' : 'supported';
  const finalReading = !insufficient && insight?.status === 'supported'
    ? insight.statement
    : null;
  const safeUsableNow = synthesis.usable_now.map(({ item, how_it_can_help }) => ({ item, howItCanHelp: how_it_can_help }));
  const sourceBackedAssets = new Set(safeUsableNow.map(({ item }) => item));
  const movement = synthesis.candidate_first_movement;
  const firstMovement = movement === null
    ? null
    : {
      movement: movement.movement,
      whyNow: movement.why_now,
      whatItMayClarify: movement.what_it_may_clarify,
      boundary: movement.boundary,
      ...(movement.existing_assets_used.some((asset) => sourceBackedAssets.has(asset))
        ? { existingAssetsUsed: movement.existing_assets_used.filter((asset) => sourceBackedAssets.has(asset)) }
        : {}),
    };

  return {
    conclusionStatus,
    finalReading,
    decisionInView: synthesis.decision_frame.status === 'framed'
      ? synthesis.decision_frame.decision_to_prepare
      : null,
    usableNow: safeUsableNow,
    decisionChangingUnknowns: synthesis.decision_changing_unknowns.map(({ uncertainty, why_it_matters }) => ({
      uncertainty,
      whyItMatters: why_it_matters,
    })),
    firstMovement,
  };
}
