import { z } from 'zod/v3';
import { gapResolutionMapV2Schema } from './gap-resolution.schema';
import { provenanceOriginV2Schema } from './analysis.schema';

export const handoffStatusV2Schema = z.enum([
  'ready',
  'ready_with_uncertainty',
  'insufficient_input',
]);

export const handoffReviewDispositionV2Schema = z.literal('UNREVIEWED');

export const handoffProvenanceV2Schema = z.object({
  origin: provenanceOriginV2Schema,
  source_path: z.string().optional(),
  source_text: z.string().optional(),
}).strict();

export const suggestedApproachV2Schema = z.object({
  description: z.string().min(1),
  rationale: z.string().min(1).optional(),
  assumption: z.string().min(1).optional(),
  origin: z.literal('AI_SUGGESTED'),
  review_disposition: handoffReviewDispositionV2Schema,
  provenance: z.array(handoffProvenanceV2Schema).optional(),
}).strict();

export const provenancedTextV2Schema = z.object({
  value: z.string().min(1),
  provenance: handoffProvenanceV2Schema.optional(),
}).strict();

export const knownContextItemV2Schema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  provenance: handoffProvenanceV2Schema.optional(),
}).strict();

export const unresolvedContextItemV2Schema = z.object({
  gap_id: z.string().min(1),
  description: z.string().min(1),
  provenance: handoffProvenanceV2Schema.optional(),
}).strict();

export const starteriaPathItemV2Schema = z.object({
  action: z.enum([
    'structure',
    'make_visible',
    'compare_or_follow',
    'resolve_gaps',
    'prepare_decision',
  ]),
  description: z.string().min(1),
}).strict();

export const portfolioEntryHandoffV2Schema = z.object({
  understanding: provenancedTextV2Schema,
  desired_outcome: provenancedTextV2Schema,
  decision_to_enable: z.union([provenancedTextV2Schema, z.literal('unresolved')]),
  recommended_approach: suggestedApproachV2Schema.optional(),
  alternative_approaches: z.array(suggestedApproachV2Schema),
  known_context: z.array(knownContextItemV2Schema),
  unresolved_context: z.array(unresolvedContextItemV2Schema),
  gap_resolution_map: gapResolutionMapV2Schema,
  evidence_or_clarity_needed: z.array(provenancedTextV2Schema),
  starteria_path: z.array(starteriaPathItemV2Schema),
  recommended_cta: z.string().min(1),
  provenance_summary: z.array(handoffProvenanceV2Schema),
  handoff_status: handoffStatusV2Schema,
}).strict();

export type HandoffStatusV2 = z.infer<typeof handoffStatusV2Schema>;
export type HandoffProvenanceV2 = z.infer<typeof handoffProvenanceV2Schema>;
export type SuggestedApproachV2 = z.infer<typeof suggestedApproachV2Schema>;
export type ProvenancedTextV2 = z.infer<typeof provenancedTextV2Schema>;
export type KnownContextItemV2 = z.infer<typeof knownContextItemV2Schema>;
export type UnresolvedContextItemV2 = z.infer<typeof unresolvedContextItemV2Schema>;
export type StarteriaPathItemV2 = z.infer<typeof starteriaPathItemV2Schema>;
export type PortfolioEntryHandoffV2 = z.infer<typeof portfolioEntryHandoffV2Schema>;
