import { z } from 'zod/v3';
import { carriedProjectionSchema, openItemsSchema, CONTINUATION_114F_FORMAT } from './portfolio-entry-continuation.data-contract';

export const PORTFOLIO_SETUP_CONTINUITY_DTO_VERSION = 'portfolio-setup-continuity-read-v0.1' as const;

const scopeSchema = z.object({ organizationId: z.string().min(1), name: z.string().min(1) }).strict();
const sourceSchema = z.object({
  sessionId: z.string().min(1), contextRevision: z.number().int().nonnegative(),
  criticalHandoffId: z.string().min(1), criticalHandoffVersion: z.number().int().positive(),
  criticalHandoffSchemaVersion: z.string().min(1), confirmedAt: z.string().datetime(),
  starteriaPath: z.object({ projectionVersion: z.string(), schemaVersion: z.string(), boundaryVersion: z.string() }).strict().optional(),
}).strict();
const profileSchema = z.object({ value: z.enum(['PORTFOLIO_LEAD_ENTRY', 'INITIATIVE_ENTRY']), version: z.number().int().positive(), evidence: z.literal('SERVER_OWNED_VERSIONED') }).strict();
const sourceItemSchema = z.object({
  sourceRef: z.string().min(1), kind: z.literal('DOWNSTREAM_NON_BLOCKING'), description: z.string().min(1).max(300),
  impact: z.string().max(300).optional(),
}).strict();

export const portfolioSetupContinuityDtoSchema = z.object({
  dtoVersion: z.literal(PORTFOLIO_SETUP_CONTINUITY_DTO_VERSION),
  status: z.enum(['READY_PROVISIONAL', 'READY_AUTHORIZED_SCOPE', 'SELECT_SCOPE', 'NO_AUTHORIZED_SCOPE',
    'SCOPE_VALIDATION_FAILED', 'STALE_SOURCE', 'PROFILE_CONFLICT', 'BLOCKED_AUTHORITY', 'ERROR']),
  sourceBinding: sourceSchema.optional(), continuationProfile: profileSchema.optional(),
  scopeState: z.enum(['UNRESOLVED', 'NONE', 'ONE', 'MULTIPLE', 'VALIDATION_FAILED']),
  authorizedScopes: z.array(scopeSchema).optional(), currentScope: scopeSchema.optional(),
  portfolioAccess: z.object({ portfolioRead: z.boolean(), checkedAt: z.string().datetime().optional() }).strict(),
  carriedContext: z.object({ criticalReading: z.string().max(500).optional(), decisionInView: z.string().max(500).optional(),
    truthClass: z.literal('CONFIRMED_REPRESENTATION') }).strict().optional(),
  openItems: z.union([openItemsSchema, z.array(sourceItemSchema)]),
  snapshot: z.object({ id: z.string().min(1), generation: z.number().int().positive(), format: z.literal(CONTINUATION_114F_FORMAT),
    carriedProjection: carriedProjectionSchema.optional() }).strict().optional(),
  nextAuthorizedSurface: z.enum(['PORTFOLIO_HOME_BOOTSTRAP', 'PROVISIONAL_CONTEXT_ESTABLISHMENT', 'SCOPE_SELECTION_REQUIRED']).optional(),
  recovery: z.object({ code: z.enum(['REVIEW_CRITICAL_HANDOFF', 'REVIEW_PROFILE', 'RETRY_SCOPE_VALIDATION',
    'REQUEST_SCOPED_ACCESS', 'INITIATIVE_AUTHORITY_REQUIRED', 'INVALID_114F_SNAPSHOT', 'RETRY_READ']) }).strict().optional(),
}).strict();

export type PortfolioSetupContinuityDto = z.infer<typeof portfolioSetupContinuityDtoSchema>;
