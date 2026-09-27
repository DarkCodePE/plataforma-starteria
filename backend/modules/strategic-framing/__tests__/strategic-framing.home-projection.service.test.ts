import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { StrategicFramingHomeProjectionService } from '../strategic-framing.home-projection.service';

const read = permissionsForRoles(['portfolio_lead']);

function state(id: string, updatedAt: string, overrides: Record<string, unknown> = {}) {
  return { id, organizationId: 'org-1', sourceMode: 'enterprise_direct', intendedMovement: `Move ${id}`, sufficiencyStatus: 'sufficient', blockers: [], prioritizationState: { schemaVersion: 1, nonCanonical: true, focusSlots: 2, focusRationale: null, candidates: [] }, challengeStructuringState: { schemaVersion: 1, nonCanonical: true, candidates: [] }, updatedAt, ...overrides };
}

function db(states: any[], promotions: any[] = [], challenges: any[] = [], fronts: any[] = []) {
  return {
    strategicFramingProvisionalState: { count: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(states.filter((item) => item.organizationId === where.organizationId).length)), findMany: vi.fn().mockImplementation(({ where }: any) => Promise.resolve(states.filter((item) => item.organizationId === where.organizationId))) },
    strategicFramingPromotion: { findMany: vi.fn().mockResolvedValue(promotions) },
    challenge: { findMany: vi.fn().mockResolvedValue(challenges) },
    strategicFront: { findMany: vi.fn().mockResolvedValue(fronts) },
  } as any;
}

const input = { actorUserId: 'user-1', organizationId: 'org-1', permissions: read };

describe('StrategicFramingHomeProjectionService', () => {
  it('returns an available empty projection', async () => {
    await expect(new StrategicFramingHomeProjectionService(db([])).getProjection(input)).resolves.toEqual({ availability: 'available', totalStateCount: 0, items: [], hasMore: false });
  });

  it('projects one state without inferring a Front', async () => {
    const result = await new StrategicFramingHomeProjectionService(db([state('state-1', '2026-09-27T10:00:00.000Z')])).getProjection(input);
    expect(result).toMatchObject({ availability: 'available', items: [{ stateId: 'state-1', workspaceHref: '/portfolio/framing/state-1', promotions: [], attention: { required: false, reasons: [] } }] });
  });

  it('orders attention first, then updatedAt and id, and preserves the total', async () => {
    const states = Array.from({ length: 6 }, (_, i) => state(`state-${i}`, '2026-09-27T10:00:00.000Z'));
    states[0].blockers = ['blocked'];
    states[1].updatedAt = '2026-09-27T12:00:00.000Z';
    const result = await new StrategicFramingHomeProjectionService(db(states)).getProjection(input);
    expect(result).toMatchObject({ totalStateCount: 6, hasMore: true });
    expect((result as any).items.map((item: any) => item.stateId)).toEqual(['state-0', 'state-1', 'state-2', 'state-3', 'state-4']);
  });

  it('derives prioritization, null focus slots, and insufficient framing', async () => {
    const prioritization = { schemaVersion: 1, nonCanonical: true, focusSlots: null, focusRationale: null, candidates: [
      { candidateId: 'gap-1', humanDisposition: 'address_now' }, { candidateId: 'gap-2', humanDisposition: 'observe' }, { candidateId: 'gap-3', humanDisposition: 'discard' }, { candidateId: 'gap-4', humanDisposition: 'undecided' },
    ] };
    const result = await new StrategicFramingHomeProjectionService(db([state('state-1', '2026-09-27T10:00:00.000Z', { sufficiencyStatus: 'insufficient', blockers: ['x'], prioritizationState: prioritization })])).getProjection(input);
    expect(result).toMatchObject({ items: [{ prioritization: { addressNow: 1, observe: 1, discard: 1, undecided: 1, focusSlots: null }, sufficiency: { status: 'insufficient', blockerCount: 1 }, attention: { reasons: ['insufficient_framing', 'blockers_present', 'address_now_without_confirmed_candidate'] } }] });
  });

  it('uses sourceCandidateIds for coverage and computes partial promotion', async () => {
    const source = { candidateId: 'gap-1', humanDisposition: 'address_now' };
    const confirmed = { challengeCandidateId: 'cc-1', sourceCandidateIds: ['gap-1'], statement: 'Challenge', relatedWorkRefs: [], structureKind: 'one_challenge' };
    const result = await new StrategicFramingHomeProjectionService(db([state('state-1', '2026-09-27T10:00:00.000Z', { prioritizationState: { candidates: [source], focusSlots: 1 }, challengeStructuringState: { candidates: [confirmed] } })], [{ id: 'promotion-1', stateId: 'state-1', challengeCandidateId: 'cc-2', challengeId: 'challenge-2', promotedAt: '2026-09-27T11:00:00.000Z' }], [{ id: 'challenge-2', title: 'Canonical', strategicFrontId: 'front-2' }], [{ id: 'front-2', name: 'Front' }])).getProjection(input);
    expect(result).toMatchObject({ items: [{ structuring: { confirmedCandidates: 1, unpromotedCandidates: 1 }, attention: { reasons: ['confirmed_candidate_not_promoted'] }, promotions: [{ challengeHref: '/retos/challenge-2', strategicFrontId: 'front-2', strategicFrontName: 'Front' }] }] });
  });

  it('keeps missing Challenge and Front references unresolved', async () => {
    const promotions = [{ id: 'promotion-1', stateId: 'state-1', challengeCandidateId: 'cc-1', challengeId: 'missing', promotedAt: '2026-09-27T11:00:00.000Z' }];
    const result = await new StrategicFramingHomeProjectionService(db([state('state-1', '2026-09-27T10:00:00.000Z')], promotions, [], [])).getProjection(input);
    expect(result).toMatchObject({ items: [{ promotions: [{ challengeTitle: null, strategicFrontId: null, strategicFrontName: null, challengeHref: null }] }] });
  });

  it('batches all related reads and never performs per-state or per-challenge lookups', async () => {
    const database = db([state('state-1', '2026-09-27T10:00:00.000Z'), state('state-2', '2026-09-27T11:00:00.000Z')], [
      { id: 'p-1', stateId: 'state-1', challengeCandidateId: 'cc-1', challengeId: 'c-1', promotedAt: '2026-09-27T11:00:00.000Z' },
      { id: 'p-2', stateId: 'state-2', challengeCandidateId: 'cc-2', challengeId: 'c-2', promotedAt: '2026-09-27T12:00:00.000Z' },
    ], [{ id: 'c-1', title: 'One', strategicFrontId: 'f-1' }, { id: 'c-2', title: 'Two', strategicFrontId: 'f-2' }], [{ id: 'f-1', name: 'F1' }, { id: 'f-2', name: 'F2' }]);
    await new StrategicFramingHomeProjectionService(database).getProjection(input);
    expect(database.strategicFramingProvisionalState.findMany).toHaveBeenCalledTimes(1);
    expect(database.strategicFramingPromotion.findMany).toHaveBeenCalledTimes(1);
    expect(database.challenge.findMany).toHaveBeenCalledTimes(1);
    expect(database.strategicFront.findMany).toHaveBeenCalledTimes(1);
  });

  it('isolates organization scope and does not trust a browser organization', async () => {
    const database = db([state('org-1-state', '2026-09-27T10:00:00.000Z'), state('org-2-state', '2026-09-27T11:00:00.000Z', { organizationId: 'other-org' })]);
    await expect(new StrategicFramingHomeProjectionService(database).getProjection(input)).resolves.toMatchObject({ totalStateCount: 1, items: [{ stateId: 'org-1-state' }] });
    expect(database.strategicFramingProvisionalState.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }));
    expect(database.strategicFramingProvisionalState.findMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'other-org' } }));
  });

  it('propagates forbidden errors and returns unavailable only for dependency failures', async () => {
    await expect(new StrategicFramingHomeProjectionService(db([])).getProjection({ ...input, permissions: new Set() })).rejects.toMatchObject({ code: 'SF_HOME_FORBIDDEN' });
    const failed = db([]); failed.strategicFramingProvisionalState.count.mockRejectedValue(new Error('db down'));
    await expect(new StrategicFramingHomeProjectionService(failed).getProjection(input)).resolves.toEqual({ availability: 'unavailable', reason: 'read_failed' });
  });
});
