import { z } from 'zod/v3';

const optionalUrl = z.string().url().max(500).optional().or(z.literal(''));

export const employeeRanges = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
  'unknown',
] as const;

export const createCompanySchema = z.object({
  name: z.string().min(2).max(180),
  sector: z.string().min(2).max(120),
  country: z.string().min(2).max(120),
  employeeRange: z.enum(employeeRanges).optional(),
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  areaName: z.string().max(120).optional(),
  scope: z.enum(['PERSONAL', 'ORGANIZATION']).optional(),
  organizationId: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial().omit({ scope: true, organizationId: true });

export const updateContextSchema = z.object({
  entries: z.array(z.object({
    dimension: z.enum(['IDENTITY', 'CULTURE', 'STRUCTURE', 'POLICIES', 'INNOVATION', 'RESOURCES', 'AREA', 'OTHER']),
    fieldKey: z.string().min(1).max(120),
    value: z.unknown(),
    sourceType: z.enum(['USER_INPUT', 'WEBSITE', 'LINKEDIN', 'FILE', 'PROJECT_NOTE', 'AGENT_INFERENCE']).default('USER_INPUT'),
    sourceId: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    verificationStatus: z.enum(['UNVERIFIED', 'USER_CONFIRMED', 'INFERRED', 'NEEDS_REVIEW']).default('USER_CONFIRMED'),
  })).min(1).max(80),
});

export const createAreaSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(600).optional(),
  leadRole: z.string().max(120).optional(),
  context: z.object({
    purpose: z.string().max(800).optional(),
    autonomyLevel: z.string().max(160).optional(),
    dependencies: z.array(z.string().max(80)).max(20).optional(),
    priorities: z.array(z.string().max(120)).max(20).optional(),
  }).optional(),
});

export const updateAreaSchema = createAreaSchema.partial();

export const createUrlSourceSchema = z.object({
  sourceType: z.enum(['WEBSITE', 'LINKEDIN']),
  url: z.string().url().max(500),
  areaId: z.string().optional(),
});

export const uploadSourceQuerySchema = z.object({
  areaId: z.string().optional(),
});

export const addMembershipSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['OWNER', 'CURATOR', 'EDITOR', 'VIEWER']).default('VIEWER'),
});

export const updateMembershipSchema = z.object({
  role: z.enum(['OWNER', 'CURATOR', 'EDITOR', 'VIEWER']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REMOVED']).optional(),
});

export const submitContributionSchema = z.object({
  targetDimension: z.enum(['IDENTITY', 'CULTURE', 'STRUCTURE', 'POLICIES', 'INNOVATION', 'RESOURCES', 'AREA', 'OTHER']),
  proposedValue: z.unknown(),
  evidenceSourceId: z.string().optional(),
});

export const createSnapshotSchema = z.object({
  companyId: z.string().min(1),
  areaId: z.string().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1).max(4000),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type UpdateContextInput = z.infer<typeof updateContextSchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateUrlSourceInput = z.infer<typeof createUrlSourceSchema>;
export type AddMembershipInput = z.infer<typeof addMembershipSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
export type SubmitContributionInput = z.infer<typeof submitContributionSchema>;
export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
