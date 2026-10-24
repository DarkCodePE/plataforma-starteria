import { z } from 'zod';

export const fromContinuationBodySchema = z.object({
  portfolioEntryContinuationId: z.string().min(1),
}).strict();

export const fromPortfolioSetupBodySchema = z.object({ snapshotId: z.string().min(1) }).strict();

export const bootstrapSessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export const completePortfolioSetupBodySchema = z.object({
  confirmed: z.literal(true),
}).strict();

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

const organizationChallengeCandidateSchema = z.object({
  candidateId: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  problem: z.string().min(1).max(2_000),
  rationale: z.string().min(1).max(2_000),
  relatedInitiativeIds: z.array(z.string().min(1)).max(500),
  evidence: z.array(z.string().min(1).max(2_000)).max(100),
  gaps: z.array(z.string().min(1).max(2_000)).max(100),
  overlaps: z.array(z.string().min(1).max(2_000)).max(100),
}).strict();

const organizationFrontCandidateSchema = z.object({
  candidateId: z.string().min(1).max(160),
  name: z.string().min(1).max(240),
  focus: z.string().min(1).max(2_000),
  rationale: z.string().min(1).max(2_000),
  coverage: z.string().min(1).max(500),
  challenges: z.array(organizationChallengeCandidateSchema).min(1).max(100),
}).strict();

export const portfolioOrganizationPayloadSchema = z.object({
  summary: z.string().min(1).max(1_000),
  fronts: z.array(organizationFrontCandidateSchema).min(1).max(25),
  crossCuttingInitiativeIds: z.array(z.string().min(1)).max(500).default([]),
  outsideObjectiveInitiativeIds: z.array(z.string().min(1)).max(500),
  ungroupedInitiativeIds: z.array(z.string().min(1)).max(500),
}).strict().superRefine((payload, context) => {
  const frontIds = payload.fronts.map((front) => front.candidateId);
  const challengeIds = payload.fronts.flatMap((front) => front.challenges.map((challenge) => challenge.candidateId));
  if (new Set(frontIds).size !== frontIds.length) context.addIssue({ code: 'custom', message: 'Los candidateId de Front deben ser únicos.' });
  if (new Set(challengeIds).size !== challengeIds.length) context.addIssue({ code: 'custom', message: 'Los candidateId de Challenge deben ser únicos.' });
  const outside = new Set(payload.outsideObjectiveInitiativeIds);
  const ungrouped = new Set(payload.ungroupedInitiativeIds);
  const crossCutting = new Set(payload.crossCuttingInitiativeIds);
  if ([...outside].some((id) => ungrouped.has(id))) context.addIssue({ code: 'custom', message: 'Una iniciativa no puede estar fuera del objetivo y sin agrupar a la vez.' });
  if ([...crossCutting].some((id) => outside.has(id) || ungrouped.has(id))) context.addIssue({ code: 'custom', message: 'Una iniciativa de apoyo transversal no puede estar simultáneamente fuera del objetivo o sin agrupar.' });
  const related = new Set(payload.fronts.flatMap((front) => front.challenges.flatMap((challenge) => challenge.relatedInitiativeIds)));
  if ([...outside, ...ungrouped, ...crossCutting].some((id) => related.has(id))) context.addIssue({ code: 'custom', message: 'Una iniciativa con destino especial no puede quedar relacionada a un Challenge.' });
});

export const savePortfolioOrganizationProposalBodySchema = z.object({
  expectedVersion: z.number().int().min(0),
  payload: portfolioOrganizationPayloadSchema,
}).strict();

export const confirmPortfolioOrganizationBodySchema = z.object({
  proposalVersion: z.number().int().positive(),
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
export type PortfolioOrganizationPayload = z.infer<typeof portfolioOrganizationPayloadSchema>;
export type SavePortfolioOrganizationProposalBody = z.infer<typeof savePortfolioOrganizationProposalBodySchema>;
