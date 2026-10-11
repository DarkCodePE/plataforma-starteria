import { createHash } from 'node:crypto';
import { z } from 'zod';

export const CONTINUATION_114F_FORMAT = 'PORTFOLIO_SETUP_114F_V1' as const;

const carriedFieldSchema = z.object({
  text: z.string().trim().min(1).max(500),
  sourceRef: z.string().min(1).max(128),
  origin: z.enum(['USER_DECLARED', 'EXTRACTED_FROM_USER_TEXT', 'AI_INFERRED', 'AI_SUGGESTED']),
  truthClass: z.enum(['PROVISIONAL_USER_CONTEXT', 'CONFIRMED_REPRESENTATION', 'ORGANIZATIONAL_AUTHORITY_REQUIRED']),
}).strict();

export const carriedProjectionSchema = z.object({
  criticalReading: carriedFieldSchema.optional(),
  decisionFrame: carriedFieldSchema.optional(),
  knownContext: z.array(carriedFieldSchema).max(10).optional(),
  confirmedRepresentation: carriedFieldSchema.optional(),
  firstMoveSuggestion: carriedFieldSchema.optional(),
}).strict();

const openItemSchema = z.object({
  sourceRef: z.string().min(1).max(128),
  kind: z.enum(['SOURCE_CURRENTNESS_BLOCKER', 'ACCESS_SCOPE_BLOCKER', 'ORGANIZATIONAL_AUTHORITY_BLOCKER', 'EXTERNAL_EVIDENCE_BLOCKER', 'DOWNSTREAM_NON_BLOCKING']),
  description: z.string().trim().min(1).max(300),
  impact: z.string().trim().max(300).optional(),
  evidenceRequired: z.string().trim().max(300).optional(),
  status: z.string().max(64).optional(),
  nextOwner: z.string().max(128).optional(),
}).strict();

export const openItemsSchema = z.array(openItemSchema).max(20);

export type SnapshotMaterialBinding = {
  sessionId: string;
  ownerUserId: string;
  sourceContextRevision: number;
  criticalHandoffId: string;
  criticalHandoffVersion: number;
  criticalHandoffSchemaVersion: string;
  criticalHandoffConfirmedAt: string;
  starteriaPath: { projectionVersion: string; schemaVersion: string; boundaryVersion: string } | null;
  continuationProfile: 'PORTFOLIO_LEAD_ENTRY' | 'INITIATIVE_ENTRY';
  continuationProfileVersion: number;
  profileEvidenceRef: string;
  organizationScopeId: string | null;
  operation: string;
};

type ContinuationDataRow = {
  id: string;
  sessionId: string;
  continuedByUserId: string;
  snapshotFormat: string | null;
  snapshotGeneration: number | null;
  snapshotState: string | null;
  sourceContextRevision: number | null;
  criticalHandoffId: string | null;
  criticalHandoffVersion: number | null;
  criticalHandoffSchemaVersion: string | null;
  criticalHandoffConfirmedAt: Date | null;
  starteriaPathProjectionVersion: string | null;
  starteriaPathSchemaVersion: string | null;
  starteriaPathBoundaryVersion: string | null;
  continuationProfile: string | null;
  continuationProfileVersion: number | null;
  profileEvidenceRef: string | null;
  organizationScopeId: string | null;
  snapshotOperation: string | null;
  idempotencyKeyHash: string | null;
  requestFingerprint: string | null;
  sourceBindingHash: string | null;
  supersededAt: Date | null;
  supersededById: string | null;
  carriedProjection: unknown;
  openItems: unknown;
};

export type ContinuationClassification =
  | { kind: 'LEGACY_UNBOUND'; id: string; sessionId: string }
  | { kind: 'INVALID_114F_SNAPSHOT'; id: string; reason: string }
  | {
      kind: '114F_SNAPSHOT'; id: string; sessionId: string; ownerUserId: string; generation: number;
      source: { contextRevision: number; criticalHandoffId: string; criticalHandoffVersion: number; criticalHandoffSchemaVersion: string | null; confirmedAt: Date; bindingHash: string;
        starteriaPath: { projectionVersion: string; schemaVersion: string; boundaryVersion: string } | null };
      profile: { value: 'PORTFOLIO_LEAD_ENTRY' | 'INITIATIVE_ENTRY'; version: number; evidenceRef: string };
      scope: { organizationId: string | null; accessAuthority: 'REVALIDATE_SCOPED_ACCESS' };
      operation: { name: string; keyHash: string; requestFingerprint: string };
      lifecycle: { state: 'CURRENT' | 'SUPERSEDED'; supersededAt: Date | null; supersededById: string | null };
      carriedProjection: z.infer<typeof carriedProjectionSchema> | null;
      openItems: z.infer<typeof openItemsSchema>;
    };

/** Data classification only. Currentness and scoped grants must be rechecked at each future read. */
export function classifyContinuationRow(row: ContinuationDataRow): ContinuationClassification {
  if (row.snapshotFormat === null) return { kind: 'LEGACY_UNBOUND', id: row.id, sessionId: row.sessionId };
  const invalid = (reason: string): ContinuationClassification => ({ kind: 'INVALID_114F_SNAPSHOT', id: row.id, reason });
  if (row.snapshotFormat !== CONTINUATION_114F_FORMAT) return invalid('unsupported_format');
  if (!positive(row.snapshotGeneration) || !nonnegative(row.sourceContextRevision)
    || !row.criticalHandoffId || !positive(row.criticalHandoffVersion) || !row.criticalHandoffSchemaVersion || !row.criticalHandoffConfirmedAt
    || !row.continuedByUserId || !positive(row.continuationProfileVersion) || !row.profileEvidenceRef
    || !row.snapshotOperation || !row.idempotencyKeyHash || !row.requestFingerprint || !row.sourceBindingHash) {
    return invalid('incomplete_binding');
  }
  if (row.continuationProfile !== 'PORTFOLIO_LEAD_ENTRY' && row.continuationProfile !== 'INITIATIVE_ENTRY') return invalid('profile_conflict');
  if (row.snapshotState !== 'CURRENT' && row.snapshotState !== 'SUPERSEDED') return invalid('invalid_lifecycle');
  if (row.snapshotState === 'SUPERSEDED' && !row.supersededAt) return invalid('incomplete_supersession');
  const pathVersions = [row.starteriaPathProjectionVersion, row.starteriaPathSchemaVersion, row.starteriaPathBoundaryVersion];
  if (pathVersions.some(Boolean) && !pathVersions.every(Boolean)) return invalid('incomplete_path_binding');
  const carriedProjection = row.carriedProjection == null ? null : carriedProjectionSchema.safeParse(row.carriedProjection);
  if (carriedProjection && !carriedProjection.success) return invalid('invalid_carried_projection');
  const openItems = openItemsSchema.safeParse(row.openItems ?? []);
  if (!openItems.success) return invalid('invalid_open_items');
  return {
    kind: '114F_SNAPSHOT', id: row.id, sessionId: row.sessionId, ownerUserId: row.continuedByUserId,
    generation: row.snapshotGeneration,
    source: { contextRevision: row.sourceContextRevision, criticalHandoffId: row.criticalHandoffId,
      criticalHandoffVersion: row.criticalHandoffVersion, criticalHandoffSchemaVersion: row.criticalHandoffSchemaVersion,
      confirmedAt: row.criticalHandoffConfirmedAt, bindingHash: row.sourceBindingHash,
      starteriaPath: row.starteriaPathProjectionVersion && row.starteriaPathSchemaVersion && row.starteriaPathBoundaryVersion
        ? { projectionVersion: row.starteriaPathProjectionVersion, schemaVersion: row.starteriaPathSchemaVersion, boundaryVersion: row.starteriaPathBoundaryVersion }
        : null },
    profile: { value: row.continuationProfile, version: row.continuationProfileVersion, evidenceRef: row.profileEvidenceRef },
    scope: { organizationId: row.organizationScopeId, accessAuthority: 'REVALIDATE_SCOPED_ACCESS' },
    operation: { name: row.snapshotOperation, keyHash: row.idempotencyKeyHash, requestFingerprint: row.requestFingerprint },
    lifecycle: { state: row.snapshotState, supersededAt: row.supersededAt, supersededById: row.supersededById },
    carriedProjection: carriedProjection ? carriedProjection.data : null,
    openItems: openItems.data,
  };
}

export function sourceBindingFingerprint(value: SnapshotMaterialBinding): string {
  return createHash('sha256').update(JSON.stringify(sortObject(value))).digest('hex');
}

function positive(value: number | null): value is number { return Number.isInteger(value) && value !== null && value > 0; }
function nonnegative(value: number | null): value is number { return Number.isInteger(value) && value !== null && value >= 0; }

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortObject(item)]));
  return value;
}

