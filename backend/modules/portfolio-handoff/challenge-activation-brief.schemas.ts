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

export const emptyActivationBriefCommandBodySchema = z.object({}).strict();
