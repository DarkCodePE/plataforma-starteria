import { z } from 'zod/v3';

export const sourceRefSchema = z.object({
  projectId: z.string().min(1).optional(),
  sourceType: z.enum(['USER_INPUT', 'AI_OUTPUT', 'PDF_PROPOSAL', 'CONTEXT_SOURCE', 'FILE_UPLOAD', 'URL', 'SYSTEM_RULE', 'API', 'OTHER']),
  reference: z.string().min(1).max(1000),
  location: z.string().max(1000).optional(),
  originActorType: z.string().max(100).optional(),
  contentHash: z.string().max(256).optional(),
  version: z.string().max(100).optional(),
  metadataJson: z.record(z.unknown()).optional(),
  capturedAt: z.string().datetime().optional(),
});

export const claimSchema = z.object({
  projectId: z.string().min(1),
  subjectType: z.string().min(1).max(100),
  subjectId: z.string().max(200).optional(),
  claimType: z.string().min(1).max(100),
  statement: z.string().min(1).max(5000),
  valueJson: z.unknown().optional(),
  createdByType: z.enum(['human', 'ai', 'system']).default('human'),
  sourceRefIds: z.array(z.string().min(1)).default([]),
});

export const evidenceSchema = z.object({
  projectId: z.string().min(1),
  targetClaimId: z.string().min(1).optional(),
  sourceRefId: z.string().min(1),
  name: z.string().min(1).max(255),
  evidenceType: z.enum(['IMAGE', 'PDF', 'VIDEO', 'LINK', 'OTHER']).default('OTHER'),
  truthStatus: z.enum(['supports', 'contradicts', 'insufficient']),
  stepRef: z.number().int().min(0).max(4).default(0),
  moduleRef: z.string().max(200).optional(),
  url: z.string().url().optional(),
  storageKey: z.string().max(500).optional(),
  excerpt: z.string().max(5000).optional(),
  provenance: z.record(z.unknown()).optional(),
  metadataJson: z.record(z.unknown()).optional(),
  capturedAt: z.string().datetime().optional(),
});

export const validationSchema = z.object({
  projectId: z.string().min(1),
  claimId: z.string().min(1).optional(),
  evidenceId: z.string().min(1).optional(),
  sourceRefId: z.string().min(1).optional(),
  result: z.enum(['unvalidated', 'supported', 'contradicted', 'insufficient']),
  validatorType: z.enum(['human', 'system_rule', 'ai']),
  validatorRole: z.string().max(100).optional(),
  rationale: z.string().min(1).max(5000),
}).refine((value) => Boolean(value.claimId) || Boolean(value.evidenceId), {
  path: ['claimId'],
  message: 'Validation requires a claimId or evidenceId.',
});

export const attentionItemSchema = z.object({
  projectId: z.string().min(1),
  objectType: z.string().max(100).optional(),
  objectId: z.string().max(200).optional(),
  category: z.string().min(1).max(100),
  reason: z.string().min(1).max(5000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  sourceRefId: z.string().min(1).optional(),
  ownerId: z.string().max(200).optional(),
  exitCondition: z.string().min(1).max(2000),
  nextAction: z.string().min(1).max(2000),
});

export const resolveAttentionItemSchema = z.object({
  resolutionNote: z.string().min(1).max(2000),
  status: z.enum(['resolved', 'cancelled']).default('resolved'),
});

export const impactAssertionSchema = z.object({
  projectId: z.string().min(1),
  subjectType: z.string().min(1).max(100),
  subjectId: z.string().max(200).optional(),
  claimId: z.string().min(1).optional(),
  metric: z.string().max(500).optional(),
  valueJson: z.unknown().optional(),
  status: z.enum(['declared', 'estimated']).default('declared'),
  sourceRefId: z.string().min(1).optional(),
});

export const impactTransitionSchema = z.object({
  status: z.enum(['estimated', 'validated', 'realized']),
  validationId: z.string().min(1).optional(),
});

export type CreateSourceRefInput = z.infer<typeof sourceRefSchema>;
export type CreateClaimInput = z.infer<typeof claimSchema>;
export type AttachEvidenceInput = z.infer<typeof evidenceSchema>;
export type RecordValidationInput = z.infer<typeof validationSchema>;
export type CreateAttentionItemInput = z.infer<typeof attentionItemSchema>;
export type ResolveAttentionItemInput = z.infer<typeof resolveAttentionItemSchema>;
export type CreateImpactAssertionInput = z.infer<typeof impactAssertionSchema>;
export type TransitionImpactInput = z.infer<typeof impactTransitionSchema>;
