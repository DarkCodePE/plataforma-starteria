import { z } from 'zod';

const jsonRecord = z.record(z.string(), z.unknown());

/** Drafts may be semantically incomplete, but the HTTP envelope is typed. */
export const activationBriefDraftBodySchema = z.object({
  intent: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  strategicContextRefs: jsonRecord.optional(),
  inheritedContext: jsonRecord.optional(),
  constraintsSnapshot: z.array(z.unknown()).optional(),
  knownGaps: z.array(z.unknown()).optional(),
  sourceRefs: z.array(z.unknown()).optional(),
  provenance: jsonRecord.optional(),
}).strict();

export const activationBriefChallengeParamsSchema = z.object({
  challengeId: z.string().trim().min(1),
});

export const activationBriefParamsSchema = z.object({
  briefId: z.string().trim().min(1),
});

export const activationBriefVersionParamsSchema = z.object({
  versionId: z.string().trim().min(1),
});

export const handoffAssignmentParamsSchema = z.object({
  assignmentId: z.string().trim().min(1),
});

export const importedInitiativeParamsSchema = z.object({
  challengeId: z.string().trim().min(1),
  workItemId: z.string().trim().min(1),
});

const importedInitiativeCheckpointSchema = z.object({
  expectedWorkItemUpdatedAt: z.string().datetime({ offset: true }),
  identityConfirmed: z.literal(true),
  alignmentConfirmed: z.literal(true),
});

export const registerImportedInitiativeBodySchema = importedInitiativeCheckpointSchema.extend({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
}).strict();

export const linkImportedInitiativeBodySchema = importedInitiativeCheckpointSchema.extend({
  projectId: z.string().trim().min(1),
}).strict();

export const emptyActivationBriefCommandBodySchema = z.object({}).strict();

const handoffMemberSchema = z.object({
  identityKey: z.string().trim().min(1),
  userId: z.string().trim().min(1).nullable().optional(),
  emailNormalized: z.string().trim().email().nullable().optional(),
  label: z.string().trim().min(1).nullable().optional(),
  role: z.enum(['OWNER', 'EXECUTOR', 'OBSERVER']),
}).strict();

export const prepareChallengeAssignmentBodySchema = z.object({
  targetKind: z.enum(['EXISTING_INITIATIVE', 'CHALLENGE']).default('CHALLENGE'),
  initiativeId: z.string().trim().min(1).nullable().optional(),
  briefId: z.string().trim().min(1).nullable().optional(),
  briefVersionId: z.string().trim().min(1).nullable().optional(),
  contextNote: z.string().trim().max(2000).nullable().optional(),
  invitedEmailNormalized: z.string().trim().email().transform((value) => value.toLowerCase()),
  invitedIdentityRef: z.string().trim().min(1).nullable().optional(),
  members: z.array(handoffMemberSchema).min(1),
}).strict().superRefine((value, ctx) => {
  if (value.targetKind === 'CHALLENGE' && (!value.briefId || !value.briefVersionId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CHALLENGE requiere Brief confirmado', path: ['briefVersionId'] });
  if (value.targetKind === 'CHALLENGE' && value.initiativeId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CHALLENGE no admite initiativeId', path: ['initiativeId'] });
  if (value.targetKind === 'EXISTING_INITIATIVE' && !value.initiativeId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'EXISTING_INITIATIVE requiere initiativeId', path: ['initiativeId'] });
  if (Boolean(value.briefId) !== Boolean(value.briefVersionId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'briefId y briefVersionId deben enviarse juntos', path: ['briefVersionId'] });
});

export const updateChallengeAssignmentBodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  contextNote: z.string().trim().max(2000).nullable().optional(),
  invitedEmailNormalized: z.string().trim().email().transform((value) => value.toLowerCase()),
  invitedIdentityRef: z.string().trim().min(1).nullable().optional(),
  members: z.array(handoffMemberSchema).min(1),
}).strict();
