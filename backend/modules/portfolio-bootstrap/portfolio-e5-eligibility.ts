import { createHash } from 'node:crypto';

export type PortfolioE5EligibilityReasonCode =
  | 'NO_EXISTING_WORK_ELIGIBLE'
  | 'ANALYZED_WORK_ELIGIBLE'
  | 'SESSION_INACTIVE'
  | 'ANCHOR_NOT_CONFIRMED'
  | 'EXISTING_WORK_STATUS_UNKNOWN'
  | 'NO_WORK_ITEMS_CONFLICT'
  | 'WORK_ITEMS_REQUIRED'
  | 'ANALYSIS_NOT_COMPLETED'
  | 'HARD_BLOCKERS_PENDING'
  | 'HARD_BLOCKERS_ACTIVE';

export type PortfolioE5EligibilityBlocker = {
  kind: 'proposed_mutation' | 'confirmed_condition';
  id: string;
  status: string;
  severity: 'blocking';
  disposition?: string;
  dispositionVersion?: number;
};

export type PortfolioE5Eligibility = {
  allowed: boolean;
  reasonCodes: PortfolioE5EligibilityReasonCode[];
  blockers: PortfolioE5EligibilityBlocker[];
  snapshotVersion: string;
};

type EligibilitySession = {
  id: string;
  status?: string;
  existingWorkStatus: string;
  bootstrapPhase: string;
  anchor?: { id: string; status: string; version: number } | null;
  workItems: Array<{ id: string; status: string; updatedAt?: Date | string }>;
  analysisRuns: Array<{ id: string; status: string; inputVersion?: string | null; outputVersion?: string | null }>;
  proposedMutations: Array<{
    id: string;
    status: string;
    proposedValue: unknown;
    updatedAt?: Date | string;
  }>;
  advancementConditions: Array<{
    id: string;
    severity: string;
    disposition?: string;
    dispositionVersion?: number;
    movementAffected?: string | null;
    updatedAt?: Date | string;
  }>;
  updatedAt?: Date | string;
};

export function evaluatePortfolioE5Eligibility(session: EligibilitySession): PortfolioE5Eligibility {
  const reasons: PortfolioE5EligibilityReasonCode[] = [];
  const blockers: PortfolioE5EligibilityBlocker[] = [];
  const activeWorkItems = session.workItems.filter((item) => item.status !== 'rejected');

  if (session.status === 'abandoned') reasons.push('SESSION_INACTIVE');
  if (session.anchor?.status !== 'anchor_confirmed') reasons.push('ANCHOR_NOT_CONFIRMED');

  for (const mutation of session.proposedMutations) {
    const proposed = asRecord(mutation.proposedValue);
    if (['proposed', 'reviewed'].includes(mutation.status) && proposed?.severity === 'blocking') {
      blockers.push({ kind: 'proposed_mutation', id: mutation.id, status: mutation.status, severity: 'blocking' });
    }
  }
  for (const condition of session.advancementConditions) {
    if (condition.severity === 'blocking' && (condition.disposition ?? 'active') === 'active') {
      blockers.push({
        kind: 'confirmed_condition',
        id: condition.id,
        status: 'confirmed',
        severity: 'blocking',
        disposition: condition.disposition ?? 'active',
        dispositionVersion: condition.dispositionVersion ?? 1,
      });
    }
  }
  blockers.sort((left, right) => left.id.localeCompare(right.id));

  if (session.existingWorkStatus === 'no_existing_work') {
    if (activeWorkItems.length > 0) reasons.push('NO_WORK_ITEMS_CONFLICT');
  } else if (session.existingWorkStatus === 'has_work') {
    if (activeWorkItems.length === 0) reasons.push('WORK_ITEMS_REQUIRED');
    const analysis = session.analysisRuns[0];
    if (!analysis || analysis.status !== 'completed' || !analysis.outputVersion || !['B4_MATERIAL_REVIEW', 'B5_FIRST_READING'].includes(session.bootstrapPhase)) {
      reasons.push('ANALYSIS_NOT_COMPLETED');
    }
  } else {
    reasons.push('EXISTING_WORK_STATUS_UNKNOWN');
  }

  if (blockers.some((blocker) => blocker.kind === 'proposed_mutation')) reasons.push('HARD_BLOCKERS_PENDING');
  if (blockers.some((blocker) => blocker.kind === 'confirmed_condition')) reasons.push('HARD_BLOCKERS_ACTIVE');
  if (reasons.length === 0) {
    reasons.push(session.existingWorkStatus === 'no_existing_work'
      ? 'NO_EXISTING_WORK_ELIGIBLE'
      : 'ANALYZED_WORK_ELIGIBLE');
  }

  const allowed = reasons.length === 1
    && ['NO_EXISTING_WORK_ELIGIBLE', 'ANALYZED_WORK_ELIGIBLE'].includes(reasons[0]);
  return {
    allowed,
    reasonCodes: reasons,
    blockers,
    snapshotVersion: hash({
      sessionId: session.id,
      status: session.status,
      existingWorkStatus: session.existingWorkStatus,
      bootstrapPhase: session.bootstrapPhase,
      anchor: session.anchor ?? null,
      workItems: session.workItems,
      analysisRuns: session.analysisRuns,
      proposedMutations: session.proposedMutations,
      advancementConditions: session.advancementConditions,
      updatedAt: session.updatedAt,
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
