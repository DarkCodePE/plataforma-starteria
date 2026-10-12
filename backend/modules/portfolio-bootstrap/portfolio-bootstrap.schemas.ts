import { z } from 'zod';

export const fromContinuationBodySchema = z.object({
  portfolioEntryContinuationId: z.string().min(1),
}).strict();

export const fromPortfolioSetupBodySchema = z.object({ snapshotId: z.string().min(1) }).strict();

export const bootstrapSessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export const updateAnchorBodySchema = z.object({
  outcomeStatement: z.string().min(1).optional(),
  contextSummary: z.string().min(1).nullable().optional(),
  decisionToEnable: z.string().min(1).nullable().optional(),
  businessSignalStatus: z.enum(['confirmed', 'proxy', 'suggested', 'unknown', 'conflicting']).optional(),
  businessSignalValue: z.string().min(1).nullable().optional(),
  sourceRefs: z.unknown().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar.',
});

export const pasteWorkItemsBodySchema = z.object({
  text: z.string().min(1).max(20_000),
}).strict();

export const manualWorkItemBodySchema = z.object({
  label: z.string().min(1).max(500),
  purpose: z.string().min(1).max(2_000).optional(),
  currentStateHint: z.enum(['idea', 'candidate', 'active', 'paused', 'completed', 'unknown']).optional(),
}).strict();

export const workItemParamsSchema = bootstrapSessionParamsSchema.extend({
  workItemId: z.string().min(1),
});

export const importBatchParamsSchema = bootstrapSessionParamsSchema.extend({
  importId: z.string().min(1),
});

export const uploadImportBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  contentBase64: z.string().min(1),
}).strict();

const importMappingValueSchema = z.string().min(1).max(255).nullable().optional();

export const updateImportMappingBodySchema = z.object({
  confirmedMapping: z.object({
    label: importMappingValueSchema,
    owner: importMappingValueSchema,
    state: importMappingValueSchema,
    purpose: importMappingValueSchema,
    signal: importMappingValueSchema,
    notes: importMappingValueSchema,
  }).strict(),
}).strict().refine((value) => Boolean(value.confirmedMapping.label?.trim()), {
  message: 'El mapping de nombre es obligatorio.',
});

export const proposedMutationParamsSchema = bootstrapSessionParamsSchema.extend({
  mutationId: z.string().min(1),
});

export const proposedMutationsQuerySchema = z.object({
  status: z.enum(['proposed', 'reviewed', 'confirmed', 'rejected', 'superseded', 'expired']).optional(),
  targetType: z.enum(['work_item', 'strategic_connection', 'advancement_condition', 'portfolio_anchor']).optional(),
}).strict();

export const updateWorkItemBodySchema = z.object({
  label: z.string().min(1).max(500).optional(),
  purpose: z.string().min(1).max(2_000).nullable().optional(),
  currentStateHint: z.enum(['idea', 'candidate', 'active', 'paused', 'completed', 'unknown']).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar.',
});

export const analyzeBodySchema = z.object({}).strict();

export const correctProposedMutationBodySchema = z.object({
  proposedValue: z.unknown(),
  reviewNote: z.string().min(1).max(2_000).optional(),
}).strict();

export const reviewProposedMutationBodySchema = z.object({
  reviewNote: z.string().min(1).max(2_000).optional(),
}).strict();

export type FromContinuationBody = z.infer<typeof fromContinuationBodySchema>;
export type UpdateAnchorBody = z.infer<typeof updateAnchorBodySchema>;
export type PasteWorkItemsBody = z.infer<typeof pasteWorkItemsBodySchema>;
export type ManualWorkItemBody = z.infer<typeof manualWorkItemBodySchema>;
export type UploadImportBody = z.infer<typeof uploadImportBodySchema>;
export type UpdateImportMappingBody = z.infer<typeof updateImportMappingBodySchema>;
export type UpdateWorkItemBody = z.infer<typeof updateWorkItemBodySchema>;
export type AnalyzeBody = z.infer<typeof analyzeBodySchema>;
export type CorrectProposedMutationBody = z.infer<typeof correctProposedMutationBodySchema>;
export type ReviewProposedMutationBody = z.infer<typeof reviewProposedMutationBodySchema>;
