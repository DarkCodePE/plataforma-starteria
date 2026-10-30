import { z } from 'zod/v3';
import { provenanceOriginV2Schema } from './analysis.schema';

export const gapResolutionTypeV2Schema = z.enum([
  'STARTERIA_CAN_STRUCTURE',
  'STARTERIA_CAN_GUIDE',
  'STARTERIA_CAN_TRACK',
  'REQUIRES_ORGANIZATIONAL_INPUT',
  'REQUIRES_EXTERNAL_EVIDENCE',
  'OUT_OF_SCOPE',
]);

export const gapResolutionStageV2Schema = z.enum([
  'PORTFOLIO',
  'INITIATIVE_SETUP',
  'STEP_0',
  'STEP_1',
  'STEP_2',
  'STEP_3',
  'STEP_4',
  'EXTERNAL',
]);

export const gapResolutionProvenanceV2Schema = z.object({
  origin: provenanceOriginV2Schema,
  source_path: z.string().optional(),
  source_text: z.string().optional(),
}).strict();

export const gapResolutionV2Schema = z.object({
  gap_id: z.string().min(1),
  gap_description: z.string().min(1),
  resolution_type: gapResolutionTypeV2Schema,
  starteria_capability: z.string().optional(),
  resolution_stage: gapResolutionStageV2Schema,
  provenance: gapResolutionProvenanceV2Schema.optional(),
}).strict();

export const gapResolutionMapV2Schema = z.array(gapResolutionV2Schema);

export type GapResolutionTypeV2 = z.infer<typeof gapResolutionTypeV2Schema>;
export type GapResolutionStageV2 = z.infer<typeof gapResolutionStageV2Schema>;
export type GapResolutionV2 = z.infer<typeof gapResolutionV2Schema>;
