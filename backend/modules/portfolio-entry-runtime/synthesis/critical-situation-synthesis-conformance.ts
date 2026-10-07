import {
  criticalSituationSynthesisSchema,
  type CriticalSituationEpistemicRole,
  type CriticalSituationSynthesis,
  type CriticalSituationSynthesisProvenanceRecord,
} from '../domain/critical-situation-synthesis.schema';
import type { CriticalSituationSynthesisAuthorizedSnapshot } from './critical-situation-synthesis-input';

export type CriticalSituationSynthesisConformanceIssue = {
  code:
    | 'schema'
    | 'product_boundary_violation'
    | 'missing_reference'
    | 'tension_projection_mismatch'
    | 'missing_claim_provenance'
    | 'invalid_fact_provenance'
    | 'invalid_provenance_reference'
    | 'uncertainty_not_derived';
  path: string;
  message: string;
};

export type CriticalSituationSynthesisConformanceResult = {
  valid: boolean;
  issues: CriticalSituationSynthesisConformanceIssue[];
  value?: CriticalSituationSynthesis;
};

const situationClaimGroups = [
  'current_situation',
  'existing_work_or_assets',
  'known_evidence',
  'constraints',
  'actors_and_authority',
  'dependencies',
  'uncertainties',
  'time_pressure',
  'existing_alternatives',
] as const;

const prohibitedProductBoundaryFields = new Set([
  'organization',
  'organization_id',
  'strategic_front',
  'strategic_front_id',
  'challenge',
  'challenge_id',
  'initiative',
  'initiative_id',
  'step',
  'steps',
  'portfolio_setup',
  'canonical_entity',
  'canonical_id',
  'authentication',
  'conversion',
  'question_plan',
  'question_budget',
  'controller_decisions',
  'session_controller',
  'handoff',
  'web_search',
  'connected_systems',
  'organizational_db',
]);

const acceptedProvenanceOrigins = new Set([
  'USER_DECLARED',
  'EXTRACTED_FROM_USER_TEXT',
  'AI_INFERRED',
  'AI_SUGGESTED',
]);
const acceptedReviewDispositions = new Set([
  'UNREVIEWED',
  'USER_CONFIRMED',
  'USER_REJECTED',
  'SUPERSEDED',
]);

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableValue(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function getKnownBoundaryKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((nested, index) => getKnownBoundaryKeys(nested, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  const keys = Object.keys(value as Record<string, unknown>);
  const found = keys
    .filter((key) => prohibitedProductBoundaryFields.has(key.toLowerCase()))
    .map((key) => (path ? `${path}.${key}` : key));
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    found.push(...getKnownBoundaryKeys(nested, path ? `${path}.${key}` : key));
  }
  return found;
}

function collectClaimRefs(value: CriticalSituationSynthesis): Array<{
  claimRef: string;
  epistemicRole?: CriticalSituationEpistemicRole;
  support?: string[];
}> {
  const claims: Array<{ claimRef: string; epistemicRole?: CriticalSituationEpistemicRole; support?: string[] }> = [];
  const model = value.situation_model;
  if (model.desired_change) {
    claims.push({ claimRef: 'situation_model.desired_change', epistemicRole: model.desired_change.epistemic_role, support: model.desired_change.support });
  }
  if (model.decision_to_enable) {
    claims.push({ claimRef: 'situation_model.decision_to_enable', epistemicRole: model.decision_to_enable.epistemic_role, support: model.decision_to_enable.support });
  }
  for (const field of situationClaimGroups) {
    model[field].forEach((claim, index) => {
      claims.push({ claimRef: `situation_model.${field}[${index}]`, epistemicRole: claim.epistemic_role, support: claim.support });
    });
  }
  if (value.situation_insight.statement !== null) {
    claims.push({ claimRef: 'situation_insight.statement', epistemicRole: value.situation_insight.epistemic_role, support: value.situation_insight.support });
  }
  value.material_tensions.forEach((tension, index) => claims.push({ claimRef: `material_tensions[${index}].statement`, support: tension.support }));
  value.decision_frame.decision_to_prepare && claims.push({ claimRef: 'decision_frame.decision_to_prepare' });
  claims.push({ claimRef: 'decision_frame.decision_authority' });
  value.decision_frame.materially_distinct_paths.forEach((_, index) => claims.push({ claimRef: `decision_frame.materially_distinct_paths[${index}]` }));
  value.decision_frame.distinguishing_conditions.forEach((_, index) => claims.push({ claimRef: `decision_frame.distinguishing_conditions[${index}]` }));
  value.decision_frame.timing_or_constraints.forEach((_, index) => claims.push({ claimRef: `decision_frame.timing_or_constraints[${index}]` }));
  value.decision_frame.unresolved_basis.forEach((_, index) => claims.push({ claimRef: `decision_frame.unresolved_basis[${index}]` }));
  value.usable_now.forEach((item, index) => claims.push({ claimRef: `usable_now[${index}]`, support: item.source_refs }));
  value.decision_changing_unknowns.forEach((unknown, index) => claims.push({
    claimRef: `decision_changing_unknowns[${index}].uncertainty`,
    support: unknown.current_evidence ?? [],
  }));
  if (value.candidate_first_movement) {
    for (const field of ['movement', 'why_now', 'what_it_may_clarify', 'decision_supported', 'boundary']) {
      claims.push({ claimRef: `candidate_first_movement.${field}`, epistemicRole: 'PROPOSAL' });
    }
    value.candidate_first_movement.existing_assets_used.forEach((_, index) => {
      claims.push({ claimRef: `candidate_first_movement.existing_assets_used[${index}]`, epistemicRole: 'PROPOSAL' });
    });
  }
  return claims;
}

function sourceReferences(value: CriticalSituationSynthesis): Array<{ path: string; refs: string[] }> {
  const references: Array<{ path: string; refs: string[] }> = [];
  const add = (path: string, refs: string[]) => references.push({ path, refs });
  const model = value.situation_model;
  if (model.desired_change) add('situation_model.desired_change.support', model.desired_change.support);
  if (model.decision_to_enable) add('situation_model.decision_to_enable.support', model.decision_to_enable.support);
  for (const field of situationClaimGroups) {
    model[field].forEach((claim, index) => add(`situation_model.${field}[${index}].support`, claim.support));
  }
  for (const [index, tension] of model.material_tensions.entries()) add(`situation_model.material_tensions[${index}].support`, tension.support);
  add('situation_insight.support', value.situation_insight.support);
  value.material_tensions.forEach((tension, index) => add(`material_tensions[${index}].support`, tension.support));
  value.usable_now.forEach((item, index) => add(`usable_now[${index}].source_refs`, item.source_refs));
  value.decision_changing_unknowns.forEach((unknown, index) => {
    if (unknown.current_evidence) add(`decision_changing_unknowns[${index}].current_evidence`, unknown.current_evidence);
  });
  value.provenance.forEach((record, index) => add(`provenance[${index}].source_refs`, record.source_refs));
  return references;
}

function sourceCanGroundFact(snapshot: CriticalSituationSynthesisAuthorizedSnapshot, ref: string): boolean {
  const source = snapshot.items.find((item) => item.ref === ref);
  if (!source) return false;
  if (source.kind === 'user_message' || source.kind === 'user_correction') return true;
  if (!source.provenance || typeof source.provenance !== 'object' || Array.isArray(source.provenance)) return false;
  const provenance = source.provenance as Record<string, unknown>;
  const origin = provenance.origin;
  const disposition = provenance.review_disposition;
  if (typeof origin !== 'string' || !acceptedProvenanceOrigins.has(origin)) return false;
  if (typeof disposition === 'string' && !acceptedReviewDispositions.has(disposition)) return false;
  if (disposition === 'USER_REJECTED' || disposition === 'SUPERSEDED') return false;
  return origin === 'USER_DECLARED'
    || (origin === 'EXTRACTED_FROM_USER_TEXT' && disposition === 'USER_CONFIRMED');
}

function hasFactGrounding(
  records: CriticalSituationSynthesisProvenanceRecord[],
  snapshot: CriticalSituationSynthesisAuthorizedSnapshot,
  claimSupport: string[],
): boolean {
  return records.some((record) => {
    if (record.review_disposition === 'USER_REJECTED' || record.review_disposition === 'SUPERSEDED') return false;
    const outputOriginCanGround = record.origin === 'USER_DECLARED'
      || (record.origin === 'EXTRACTED_FROM_USER_TEXT' && record.review_disposition === 'USER_CONFIRMED');
    return outputOriginCanGround && record.source_refs.some((ref) => claimSupport.includes(ref) && sourceCanGroundFact(snapshot, ref));
  });
}

function derivedUncertaintyStatement(unknowns: CriticalSituationSynthesis['decision_changing_unknowns']): string {
  return unknowns.map((unknown) => unknown.uncertainty).join(' | ');
}

/**
 * Deterministic conformance only: structural constraints, provenance/reference
 * integrity, and observable product boundaries. Strategic quality remains a
 * human/semantic review concern.
 */
export function validateCriticalSituationSynthesisConformance(
  candidate: unknown,
  snapshot: CriticalSituationSynthesisAuthorizedSnapshot,
): CriticalSituationSynthesisConformanceResult {
  const parsed = criticalSituationSynthesisSchema.safeParse(candidate);
  if (!parsed.success) {
    const boundaryFields = getKnownBoundaryKeys(candidate);
    const issues: CriticalSituationSynthesisConformanceIssue[] = parsed.error.issues.map((issue) => {
      const isBoundary = issue.code === 'unrecognized_keys'
        && issue.keys?.some((key) => prohibitedProductBoundaryFields.has(key.toLowerCase()));
      return {
        code: isBoundary ? 'product_boundary_violation' : 'schema',
        path: issue.path.join('.'),
        message: issue.message,
      };
    });
    for (const path of boundaryFields) {
      if (!issues.some((issue) => issue.code === 'product_boundary_violation' && issue.path === path)) {
        issues.push({ code: 'product_boundary_violation', path, message: `Prohibited product-boundary field: ${path}.` });
      }
    }
    return { valid: false, issues };
  }

  const value = parsed.data;
  const issues: CriticalSituationSynthesisConformanceIssue[] = [];
  const availableRefs = new Set(snapshot.source_refs);
  const provenanceById = new Map<string, CriticalSituationSynthesisProvenanceRecord>();
  const provenanceByClaim = new Map<string, CriticalSituationSynthesisProvenanceRecord[]>();
  const expectedClaims = collectClaimRefs(value);
  const expectedClaimRefs = new Set(expectedClaims.map((claim) => claim.claimRef));

  for (const [index, record] of value.provenance.entries()) {
    if (provenanceById.has(record.id)) {
      issues.push({ code: 'invalid_provenance_reference', path: `provenance[${index}].id`, message: `Duplicate provenance id ${record.id}.` });
    }
    provenanceById.set(record.id, record);
    const records = provenanceByClaim.get(record.claim_ref) ?? [];
    records.push(record);
    provenanceByClaim.set(record.claim_ref, records);
    if (!expectedClaimRefs.has(record.claim_ref)) {
      issues.push({ code: 'invalid_provenance_reference', path: `provenance[${index}].claim_ref`, message: `No output claim exists at ${record.claim_ref}.` });
    }
  }

  for (const [index, item] of value.usable_now.entries()) {
    for (const ref of item.provenance_refs) {
      const referencedRecord = provenanceById.get(ref);
      if (!referencedRecord) {
        issues.push({ code: 'invalid_provenance_reference', path: `usable_now[${index}].provenance_refs`, message: `Unknown provenance id ${ref}.` });
      } else if (referencedRecord.claim_ref !== `usable_now[${index}]`) {
        issues.push({ code: 'invalid_provenance_reference', path: `usable_now[${index}].provenance_refs`, message: `Provenance id ${ref} belongs to ${referencedRecord.claim_ref}, not this usable-now item.` });
      }
    }
  }

  for (const claim of expectedClaims) {
    const records = provenanceByClaim.get(claim.claimRef) ?? [];
    if (records.length === 0) {
      issues.push({ code: 'missing_claim_provenance', path: claim.claimRef, message: 'Material output claim needs claim-level provenance.' });
      continue;
    }
    for (const ref of claim.support ?? []) {
      if (!records.some((record) => record.source_refs.includes(ref))) {
        issues.push({ code: 'invalid_provenance_reference', path: claim.claimRef, message: `No claim-level provenance record links support reference ${ref}.` });
      }
    }
    if (claim.epistemicRole === 'FACT') {
      if (!claim.support || claim.support.length === 0 || !hasFactGrounding(records, snapshot, claim.support)) {
        issues.push({
          code: 'invalid_fact_provenance',
          path: claim.claimRef,
          message: 'FACT needs a source reference and direct user support (or a user-confirmed extraction); AI inference/suggestion alone is not FACT.',
        });
      }
    }
  }

  for (const reference of sourceReferences(value)) {
    for (const ref of reference.refs) {
      if (!availableRefs.has(ref)) {
        issues.push({ code: 'missing_reference', path: reference.path, message: `Source reference ${ref} is absent from the authorized input snapshot.` });
      }
    }
  }

  if (stableValue(value.situation_model.material_tensions) !== stableValue(value.material_tensions)) {
    issues.push({
      code: 'tension_projection_mismatch',
      path: 'situation_model.material_tensions',
      message: 'SituationModel and output material_tensions must be the same conceptual collection.',
    });
  }

  if (value.decision_changing_unknowns.length === 0 && value.uncertainty_statement != null) {
    issues.push({ code: 'uncertainty_not_derived', path: 'uncertainty_statement', message: 'An uncertainty statement cannot exist without declared decision-changing unknowns.' });
  } else if (value.decision_changing_unknowns.length > 0 && value.uncertainty_statement != null
    && value.uncertainty_statement !== derivedUncertaintyStatement(value.decision_changing_unknowns)) {
    issues.push({ code: 'uncertainty_not_derived', path: 'uncertainty_statement', message: 'The statement must be the deterministic summary of the declared unknowns only.' });
  }

  const boundaryFields = getKnownBoundaryKeys(candidate);
  for (const path of boundaryFields) {
    issues.push({ code: 'product_boundary_violation', path, message: `Prohibited product-boundary field: ${path}.` });
  }

  return issues.length === 0 ? { valid: true, issues, value } : { valid: false, issues };
}
