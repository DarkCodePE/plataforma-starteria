import { z } from 'zod';
import { provenanceOriginV2Schema, reviewDispositionV2Schema } from './analysis.schema';

const nonEmptyTextSchema = z.string().trim().min(1);
const sourceReferenceSchema = nonEmptyTextSchema;

export const criticalSituationBasisStatusSchema = z.enum([
  'sufficient',
  'partial',
  'insufficient_basis',
]);

export const criticalSituationEpistemicRoleSchema = z.enum([
  'FACT',
  'INTERPRETATION',
  'PROPOSAL',
  'UNKNOWN',
]);

export const criticalSituationLensSchema = z.enum([
  'priority / allocation',
  'diagnosis',
  'evidence / learning',
  'sequencing',
  'dependencies',
  'governance',
  'capacity',
  'risk',
  'alignment',
  'system design',
]);

export const criticalSituationImpactDimensionSchema = z.enum([
  'situation_reading',
  'decision_frame',
  'material_tension',
  'first_movement',
  'critical_dependency',
  'material_risk',
  'ability_to_act_now',
  'starteria_continuation_shape',
]);

export const criticalSituationClaimSchema = z.object({
  statement: nonEmptyTextSchema,
  support: z.array(sourceReferenceSchema),
  epistemic_role: criticalSituationEpistemicRoleSchema,
}).strict();

export const criticalSituationMaterialTensionSchema = z.object({
  statement: nonEmptyTextSchema,
  status: z.enum(['supported', 'unresolved']),
  support: z.array(sourceReferenceSchema),
  why_it_matters: nonEmptyTextSchema,
  affected_decision: nonEmptyTextSchema,
}).strict().superRefine((tension, context) => {
  if (tension.status === 'supported' && tension.support.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['support'],
      message: 'A supported material tension requires at least one support reference.',
    });
  }
});

export const criticalSituationModelSchema = z.object({
  desired_change: criticalSituationClaimSchema.nullable(),
  current_situation: z.array(criticalSituationClaimSchema),
  existing_work_or_assets: z.array(criticalSituationClaimSchema),
  decision_to_enable: criticalSituationClaimSchema.nullable().optional(),
  known_evidence: z.array(criticalSituationClaimSchema),
  constraints: z.array(criticalSituationClaimSchema),
  actors_and_authority: z.array(criticalSituationClaimSchema),
  dependencies: z.array(criticalSituationClaimSchema),
  uncertainties: z.array(criticalSituationClaimSchema),
  time_pressure: z.array(criticalSituationClaimSchema),
  existing_alternatives: z.array(criticalSituationClaimSchema),
  // This is the same conceptual collection as the root material_tensions.
  // Conformance requires a deep-equal projection so the two views cannot diverge.
  material_tensions: z.array(criticalSituationMaterialTensionSchema),
}).strict();

export const criticalSituationInsightSchema = z.object({
  statement: nonEmptyTextSchema.nullable(),
  support: z.array(sourceReferenceSchema),
  novelty_type: z.enum([
    'relationship_made_explicit',
    'tension_made_explicit',
    'decision_structure_clarified',
    'sequence_dependency_exposed',
    'no_supported_insight',
  ]),
  epistemic_role: z.literal('INTERPRETATION'),
  status: z.enum(['supported', 'no_supported_insight']),
}).strict().superRefine((insight, context) => {
  if (insight.status === 'no_supported_insight') {
    if (insight.statement !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['statement'],
        message: 'A no_supported_insight must not invent a statement.',
      });
    }
    if (insight.support.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['support'],
        message: 'A no_supported_insight cannot claim supporting references.',
      });
    }
    if (insight.novelty_type !== 'no_supported_insight') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['novelty_type'],
        message: 'A no_supported_insight must use the matching novelty type.',
      });
    }
    return;
  }

  if (insight.statement === null || insight.support.length === 0 || insight.novelty_type === 'no_supported_insight') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A supported insight requires a statement, support, and a substantive novelty type.',
    });
  }
});

export const criticalSituationDecisionFrameSchema = z.object({
  status: z.enum(['framed', 'not_yet_identifiable']),
  decision_to_prepare: nonEmptyTextSchema.nullable(),
  decision_authority: nonEmptyTextSchema,
  materially_distinct_paths: z.array(nonEmptyTextSchema),
  distinguishing_conditions: z.array(nonEmptyTextSchema),
  timing_or_constraints: z.array(nonEmptyTextSchema),
  unresolved_basis: z.array(nonEmptyTextSchema),
}).strict().superRefine((frame, context) => {
  if (frame.status === 'framed' && frame.decision_to_prepare === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision_to_prepare'],
      message: 'A framed decision requires the decision to prepare.',
    });
  }
  if (frame.status === 'not_yet_identifiable' && frame.decision_to_prepare !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision_to_prepare'],
      message: 'A not_yet_identifiable frame must not invent a decision.',
    });
  }
});

export const criticalSituationUsableNowSchema = z.object({
  item: nonEmptyTextSchema,
  how_it_can_help: nonEmptyTextSchema,
  source_refs: z.array(sourceReferenceSchema).min(1),
  provenance_refs: z.array(nonEmptyTextSchema).min(1),
}).strict();

export const criticalSituationDecisionChangingUnknownSchema = z.object({
  uncertainty: nonEmptyTextSchema,
  why_it_matters: nonEmptyTextSchema,
  current_evidence: z.array(sourceReferenceSchema).nullable(),
  resolution_mode: nonEmptyTextSchema,
  related_decision: nonEmptyTextSchema,
  impact_dimensions: z.array(criticalSituationImpactDimensionSchema).min(1),
}).strict().superRefine((unknown, context) => {
  if (new Set(unknown.impact_dimensions).size !== unknown.impact_dimensions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['impact_dimensions'],
      message: 'Impact dimensions must not contain duplicates.',
    });
  }
});

export const criticalSituationFirstMovementSchema = z.object({
  movement: nonEmptyTextSchema,
  why_now: nonEmptyTextSchema,
  existing_assets_used: z.array(nonEmptyTextSchema),
  what_it_may_clarify: nonEmptyTextSchema,
  decision_supported: nonEmptyTextSchema,
  boundary: nonEmptyTextSchema,
  epistemic_role: z.literal('PROPOSAL'),
}).strict();

export const criticalSituationProvenanceRecordSchema = z.object({
  id: nonEmptyTextSchema,
  claim_ref: nonEmptyTextSchema,
  origin: provenanceOriginV2Schema,
  review_disposition: reviewDispositionV2Schema,
  source_refs: z.array(sourceReferenceSchema).min(1),
  source_path: nonEmptyTextSchema.nullable(),
  source_text: z.string().nullable(),
  recorded_at: z.string().nullable(),
}).strict();

export const criticalSituationSynthesisSchema = z.object({
  basis_status: criticalSituationBasisStatusSchema,
  situation_model: criticalSituationModelSchema,
  reasoning_metadata: z.object({
    selected_lenses: z.array(criticalSituationLensSchema),
  }).strict(),
  situation_insight: criticalSituationInsightSchema,
  material_tensions: z.array(criticalSituationMaterialTensionSchema),
  decision_frame: criticalSituationDecisionFrameSchema,
  usable_now: z.array(criticalSituationUsableNowSchema),
  decision_changing_unknowns: z.array(criticalSituationDecisionChangingUnknownSchema),
  candidate_first_movement: criticalSituationFirstMovementSchema.nullable(),
  uncertainty_statement: z.string().trim().min(1).nullable().optional(),
  provenance: z.array(criticalSituationProvenanceRecordSchema),
}).strict();

export type CriticalSituationEpistemicRole = z.infer<typeof criticalSituationEpistemicRoleSchema>;
export type CriticalSituationMaterialTension = z.infer<typeof criticalSituationMaterialTensionSchema>;
export type CriticalSituationSynthesis = z.infer<typeof criticalSituationSynthesisSchema>;
export type CriticalSituationSynthesisProvenanceRecord = z.infer<typeof criticalSituationProvenanceRecordSchema>;
