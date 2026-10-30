import { AppError } from '../../shared/errors/AppError';

export type ActivationBriefEnvelope = {
  intent: string | null;
  scope: string | null;
  strategicContextRefs: unknown;
  inheritedContext: unknown;
  constraintsSnapshot: unknown;
  knownGaps: unknown;
  sourceRefs: unknown;
  provenance: unknown;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** ADR-008 envelope normalization. Missing context remains explicitly empty. */
export function normalizeActivationBriefEnvelope(body: Record<string, unknown>): ActivationBriefEnvelope {
  return {
    intent: text(body.intent),
    scope: text(body.scope),
    strategicContextRefs: record(body.strategicContextRefs),
    inheritedContext: record(body.inheritedContext),
    constraintsSnapshot: array(body.constraintsSnapshot),
    knownGaps: array(body.knownGaps),
    sourceRefs: array(body.sourceRefs),
    provenance: record(body.provenance),
  };
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && Boolean(value.trim());
}

/** Drafts may be incomplete. Human confirmation requires the minimum governed mandate. */
export function assertConfirmableActivationBriefVersion(version: ActivationBriefEnvelope): void {
  const inherited = record(version.inheritedContext);
  const strategic = record(version.strategicContextRefs);
  const provenance = record(version.provenance);
  const complete = hasText(version.intent)
    && hasText(version.scope)
    && hasText(strategic.objective)
    && hasText(inherited.challengeProblem)
    && hasText(inherited.expectedDeliverable)
    && hasText(inherited.decisionToEnable)
    && hasText(provenance.source);
  if (!complete) {
    throw AppError.conflict(
      'El Brief todavía no contiene el contexto mínimo para confirmarse',
      'ACTIVATION_BRIEF_INCOMPLETE',
    );
  }
}

/**
 * Prisma may surface a concurrent append to the same Brief as either a
 * serialization failure or the final `(briefId, versionNumber)` unique guard.
 * Only that expected sequence race is safe to retry; unrelated P2002 errors
 * remain contract conflicts and must not be hidden.
 */
export function isRetryableActivationBriefWriteConflict(error: unknown, retryVersionSequenceConflict: boolean): boolean {
  if (!error || typeof error !== 'object') return false;
  const prismaCode = 'code' in error ? error.code : null;
  const meta = 'meta' in error && error.meta && typeof error.meta === 'object'
    ? error.meta as { code?: unknown; target?: unknown }
    : null;
  if (prismaCode === 'P2034' || (prismaCode === 'P2010' && meta?.code === '40001')) return true;
  if (!retryVersionSequenceConflict || prismaCode !== 'P2002') return false;
  const target = Array.isArray(meta?.target) ? meta.target.map(String) : typeof meta?.target === 'string' ? [meta.target] : [];
  return target.some((field) => field.includes('briefId')) && target.some((field) => field.includes('versionNumber'));
}
