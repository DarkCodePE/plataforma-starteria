import { z } from 'zod/v3';

const briefVersionSchema = z.object({
  id: z.string().min(1),
  versionNumber: z.number().int().positive(),
  status: z.enum(['DRAFT', 'CONFIRMED']),
  intent: z.string().nullable(),
  scope: z.string().nullable(),
  strategicContextRefs: z.unknown(),
  inheritedContext: z.unknown(),
  constraintsSnapshot: z.unknown(),
  knownGaps: z.unknown(),
  sourceRefs: z.unknown(),
  provenance: z.unknown(),
  confirmedAt: z.union([z.date(), z.string().datetime(), z.null()]),
});

const baseSchema = z.object({
  assignmentId: z.string().min(1),
  challengeId: z.string().min(1),
  challenge: z.object({ id: z.string().min(1), title: z.string().min(1) }),
  contextNote: z.string().nullable(),
  briefVersion: briefVersionSchema.nullable(),
  handoffState: z.literal('STARTED'),
});

const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  organizationId: z.string().min(1),
  status: z.string().min(1),
  currentStep: z.number().int().nonnegative(),
  isArchived: z.literal(false),
  activationStatus: z.enum(['OWNER_PENDING', 'OWNER_CONFIRMED']).nullable(),
  retrospectiveAssessmentStatus: z.enum(['PENDING_RETROACTIVE_ASSESSMENT', 'IN_REVIEW', 'ASSESSED']).nullable(),
  stepCount: z.number().int().nonnegative(),
  operationalStep: z.number().int().nonnegative().nullable(),
  activeCheckpointStep: z.number().int().nonnegative().nullable(),
});

export const ownerPostStartContinuitySchema = z.discriminatedUnion('outcome', [
  baseSchema.extend({
    outcome: z.literal('EXISTING_READY'),
    targetKind: z.literal('EXISTING_INITIATIVE'),
    initiativeId: z.string().min(1),
    project: projectSchema.extend({ workspacePath: z.string().regex(/^\/projects\/[^/]+$/) }),
  }),
  baseSchema.extend({
    outcome: z.literal('EXISTING_ACTIVATION_REQUIRED'),
    targetKind: z.literal('EXISTING_INITIATIVE'),
    initiativeId: z.string().min(1),
    reasons: z.array(z.enum([
      'OPERATIONAL_ACCESS_REQUIRED',
      'OWNER_ACTIVATION_REQUIRED',
      'RETROSPECTIVE_ASSESSMENT_REQUIRED',
      'STEPS_NOT_MATERIALIZED',
      'OPERATIONAL_STATE_UNRESOLVED',
    ])).min(1),
    project: projectSchema,
  }),
  baseSchema.extend({
    outcome: z.literal('CHALLENGE_FORMULATION_REQUIRED'),
    targetKind: z.literal('CHALLENGE'),
    initiativeId: z.null(),
  }),
]);

