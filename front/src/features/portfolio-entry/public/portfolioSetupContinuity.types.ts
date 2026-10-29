import { z } from 'zod/v3';

const scope = z.object({ organizationId: z.string().min(1), name: z.string().min(1) }).strict();
const pathVersion = z.object({
  projectionVersion: z.string().min(1), schemaVersion: z.string().min(1), boundaryVersion: z.string().min(1),
}).strict();
export const setupSource = z.object({
  sessionId: z.string().min(1), contextRevision: z.number().int().nonnegative(),
  criticalHandoffId: z.string().min(1), criticalHandoffVersion: z.number().int().positive(),
  criticalHandoffSchemaVersion: z.string().min(1), confirmedAt: z.string().datetime(),
  starteriaPath: pathVersion.optional(),
}).strict();
const carriedField = z.object({
  text: z.string().min(1).max(500), sourceRef: z.string().min(1).max(128),
  origin: z.enum(['USER_DECLARED', 'EXTRACTED_FROM_USER_TEXT', 'AI_INFERRED', 'AI_SUGGESTED']),
  truthClass: z.enum(['PROVISIONAL_USER_CONTEXT', 'CONFIRMED_REPRESENTATION', 'ORGANIZATIONAL_AUTHORITY_REQUIRED']),
}).strict();
const openItem = z.object({
  sourceRef: z.string().min(1).max(128),
  kind: z.enum(['SOURCE_CURRENTNESS_BLOCKER', 'ACCESS_SCOPE_BLOCKER', 'ORGANIZATIONAL_AUTHORITY_BLOCKER', 'EXTERNAL_EVIDENCE_BLOCKER', 'DOWNSTREAM_NON_BLOCKING']),
  description: z.string().min(1).max(300), impact: z.string().max(300).optional(),
  evidenceRequired: z.string().max(300).optional(), status: z.string().max(64).optional(),
  nextOwner: z.string().max(128).optional(),
}).strict();
const carriedProjection = z.object({
  criticalReading: carriedField.optional(), decisionFrame: carriedField.optional(),
  knownContext: z.array(carriedField).max(10).optional(), confirmedRepresentation: carriedField.optional(),
  firstMoveSuggestion: carriedField.optional(),
}).strict();

export const portfolioSetupContinuityReadSchema = z.object({
  dtoVersion: z.literal('portfolio-setup-continuity-read-v0.1'),
  status: z.enum(['READY_PROVISIONAL', 'READY_AUTHORIZED_SCOPE', 'SELECT_SCOPE', 'NO_AUTHORIZED_SCOPE',
    'SCOPE_VALIDATION_FAILED', 'STALE_SOURCE', 'PROFILE_CONFLICT', 'BLOCKED_AUTHORITY', 'ERROR']),
  sourceBinding: setupSource.optional(),
  continuationProfile: z.object({
    value: z.enum(['PORTFOLIO_LEAD_ENTRY', 'INITIATIVE_ENTRY']), version: z.number().int().positive(),
    evidence: z.literal('SERVER_OWNED_VERSIONED'),
  }).strict().optional(),
  scopeState: z.enum(['UNRESOLVED', 'NONE', 'ONE', 'MULTIPLE', 'VALIDATION_FAILED']),
  authorizedScopes: z.array(scope).optional(), currentScope: scope.optional(),
  portfolioAccess: z.object({ portfolioRead: z.boolean(), checkedAt: z.string().datetime().optional() }).strict(),
  carriedContext: z.object({
    criticalReading: z.string().max(500).optional(), decisionInView: z.string().max(500).optional(),
    truthClass: z.literal('CONFIRMED_REPRESENTATION'),
  }).strict().optional(),
  openItems: z.array(openItem).max(20),
  snapshot: z.object({
    id: z.string().min(1), generation: z.number().int().positive(), format: z.literal('PORTFOLIO_SETUP_114F_V1'),
    carriedProjection: carriedProjection.optional(),
  }).strict().optional(),
  nextAuthorizedSurface: z.enum(['PORTFOLIO_HOME_BOOTSTRAP', 'PROVISIONAL_CONTEXT_ESTABLISHMENT', 'SCOPE_SELECTION_REQUIRED']).optional(),
  recovery: z.object({ code: z.enum(['REVIEW_CRITICAL_HANDOFF', 'REVIEW_PROFILE', 'RETRY_SCOPE_VALIDATION',
    'REQUEST_SCOPED_ACCESS', 'INITIATIVE_AUTHORITY_REQUIRED', 'INVALID_114F_SNAPSHOT', 'RETRY_READ']) }).strict().optional(),
}).strict().superRefine((dto, ctx) => {
  const scopes = dto.authorizedScopes ?? [];
  const ids = scopes.map((item) => item.organizationId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate scope' });
  if (dto.currentScope && !scopes.some((item) => item.organizationId === dto.currentScope?.organizationId && item.name === dto.currentScope.name)) {
    ctx.addIssue({ code: 'custom', message: 'Unknown current scope' });
  }
  const portfolioProfile = dto.continuationProfile?.value === 'PORTFOLIO_LEAD_ENTRY'
    && dto.continuationProfile.version === 1;
  if (dto.status === 'READY_AUTHORIZED_SCOPE' && (!dto.sourceBinding || !portfolioProfile
    || !dto.currentScope || !dto.portfolioAccess.portfolioRead || scopes.length < 1)) {
    ctx.addIssue({ code: 'custom', message: 'Unverified ready state' });
  }
  if (dto.status === 'SELECT_SCOPE' && (!dto.sourceBinding || !portfolioProfile || dto.scopeState !== 'MULTIPLE'
    || scopes.length < 2 || dto.currentScope || dto.portfolioAccess.portfolioRead)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid scope selection state' });
  }
  if (['READY_PROVISIONAL', 'NO_AUTHORIZED_SCOPE'].includes(dto.status)
    && (!dto.sourceBinding || !portfolioProfile || dto.scopeState !== 'NONE')) {
    ctx.addIssue({ code: 'custom', message: 'Invalid provisional scope state' });
  }
  if (dto.status === 'SCOPE_VALIDATION_FAILED' && dto.scopeState !== 'VALIDATION_FAILED') {
    ctx.addIssue({ code: 'custom', message: 'Invalid resolver failure state' });
  }
  if (['READY_PROVISIONAL', 'NO_AUTHORIZED_SCOPE', 'SCOPE_VALIDATION_FAILED'].includes(dto.status)
    && (scopes.length > 0 || dto.currentScope || dto.portfolioAccess.portfolioRead)) {
    ctx.addIssue({ code: 'custom', message: 'Unexpected tenant scope' });
  }
});

export const portfolioSetupContinueRequestSchema = z.object({
  expectedSessionRevision: z.number().int().nonnegative(),
  sourceBinding: setupSource.extend({ starteriaPath: pathVersion.extend({
    criticalHandoffId: z.string().min(1), criticalHandoffVersion: z.number().int().positive(),
    sourceContextRevision: z.number().int().nonnegative(),
  }).strict().optional() }).strict(),
  organizationId: z.string().min(1).optional(),
}).strict();
export const portfolioSetupContinueResponseSchema = z.object({
  dtoVersion: z.literal('portfolio-setup-continuity-write-v0.1'), snapshotId: z.string().min(1),
  snapshotGeneration: z.number().int().positive(), snapshotState: z.literal('CURRENT'),
  sessionRevision: z.number().int().nonnegative(), sourceBinding: portfolioSetupContinueRequestSchema.shape.sourceBinding,
  continuationProfile: z.object({ value: z.literal('PORTFOLIO_LEAD_ENTRY'), version: z.literal(1) }).strict(),
  organizationScopeId: z.string().min(1), nextAuthorizedSurface: z.literal('PORTFOLIO_HOME_BOOTSTRAP'),
  currentness: z.literal('REVALIDATED_AT_WRITE'), createdAt: z.string().datetime(),
}).strict();

export type PortfolioSetupContinuityRead = z.infer<typeof portfolioSetupContinuityReadSchema>;
export type PortfolioSetupContinueRequest = z.infer<typeof portfolioSetupContinueRequestSchema>;
export type PortfolioSetupContinueResponse = z.infer<typeof portfolioSetupContinueResponseSchema>;
