import { describe, expect, it } from 'vitest';
import { evaluatePortfolioE5Eligibility } from '../portfolio-e5-eligibility';

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    status: 'awaiting_material_review',
    bootstrapPhase: 'B4_MATERIAL_REVIEW',
    existingWorkStatus: 'has_work',
    anchor: { id: 'anchor-1', status: 'anchor_confirmed', version: 1 },
    workItems: [{ id: 'work-1', status: 'detected', updatedAt: new Date('2026-11-03T00:00:00.000Z') }],
    analysisRuns: [{ id: 'analysis-1', status: 'completed', inputVersion: 'input-1', outputVersion: 'output-1' }],
    proposedMutations: [],
    advancementConditions: [],
    updatedAt: new Date('2026-11-03T00:00:00.000Z'),
    ...overrides,
  };
}

describe('KAN-217 backend-authoritative E5 eligibility', () => {
  it('allows the persisted no-work path without analysis when it has zero work items', () => {
    const result = evaluatePortfolioE5Eligibility(session({
      bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING',
      existingWorkStatus: 'no_existing_work',
      workItems: [],
      analysisRuns: [],
    }));

    expect(result).toMatchObject({
      allowed: true,
      reasonCodes: ['NO_EXISTING_WORK_ELIGIBLE'],
      blockers: [],
    });
    expect(result.snapshotVersion).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed when the no-work declaration conflicts with persisted work', () => {
    const result = evaluatePortfolioE5Eligibility(session({ existingWorkStatus: 'no_existing_work' }));

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain('NO_WORK_ITEMS_CONFLICT');
  });

  it('keeps hard blockers fail-closed on the no-work path', () => {
    const result = evaluatePortfolioE5Eligibility(session({
      bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING',
      existingWorkStatus: 'no_existing_work',
      workItems: [],
      analysisRuns: [],
      advancementConditions: [{
        id: 'condition-no-work', severity: 'blocking', disposition: 'active', dispositionVersion: 1,
      }],
    }));

    expect(result).toMatchObject({
      allowed: false,
      reasonCodes: ['HARD_BLOCKERS_ACTIVE'],
      blockers: [{ id: 'condition-no-work', kind: 'confirmed_condition' }],
    });
  });

  it('blocks proposed and reviewed hard findings but does not block soft pending findings', () => {
    const result = evaluatePortfolioE5Eligibility(session({
      proposedMutations: [
        { id: 'hard-proposed', status: 'proposed', proposedValue: { severity: 'blocking' }, updatedAt: new Date('2026-11-03T00:01:00.000Z') },
        { id: 'hard-reviewed', status: 'reviewed', proposedValue: { severity: 'blocking' }, updatedAt: new Date('2026-11-03T00:02:00.000Z') },
        { id: 'soft-reviewed', status: 'reviewed', proposedValue: { severity: 'attention' }, updatedAt: new Date('2026-11-03T00:03:00.000Z') },
      ],
    }));

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(['HARD_BLOCKERS_PENDING']);
    expect(result.blockers.map((blocker) => blocker.id)).toEqual(['hard-proposed', 'hard-reviewed']);
  });

  it('blocks active confirmed hard conditions and allows resolved or dismissed ones', () => {
    const active = evaluatePortfolioE5Eligibility(session({
      advancementConditions: [{
        id: 'condition-1', severity: 'blocking', disposition: 'active', dispositionVersion: 1,
        movementAffected: 'Organización', updatedAt: new Date('2026-11-03T00:04:00.000Z'),
      }],
    }));
    const resolved = evaluatePortfolioE5Eligibility(session({
      advancementConditions: [{
        id: 'condition-1', severity: 'blocking', disposition: 'resolved', dispositionVersion: 2,
        movementAffected: 'Organización', updatedAt: new Date('2026-11-03T00:05:00.000Z'),
      }],
    }));

    expect(active.allowed).toBe(false);
    expect(active.reasonCodes).toContain('HARD_BLOCKERS_ACTIVE');
    expect(active.blockers).toEqual([expect.objectContaining({ id: 'condition-1', kind: 'confirmed_condition' })]);
    expect(resolved).toMatchObject({
      allowed: true,
      reasonCodes: ['ANALYZED_WORK_ELIGIBLE'],
      blockers: [],
    });
    expect(resolved.snapshotVersion).not.toBe(active.snapshotVersion);
  });

  it('requires a confirmed anchor and completed B4 analysis for has-work', () => {
    const result = evaluatePortfolioE5Eligibility(session({
      bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING',
      anchor: { id: 'anchor-1', status: 'anchor_sufficient', version: 1 },
      analysisRuns: [{ id: 'analysis-1', status: 'failed', inputVersion: 'input-1', outputVersion: null }],
    }));

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(expect.arrayContaining(['ANCHOR_NOT_CONFIRMED', 'ANALYSIS_NOT_COMPLETED']));
  });

  it('fails closed for abandoned sessions even when all other evidence is eligible', () => {
    const result = evaluatePortfolioE5Eligibility(session({ status: 'abandoned' }));

    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(['SESSION_INACTIVE']);
  });
});
