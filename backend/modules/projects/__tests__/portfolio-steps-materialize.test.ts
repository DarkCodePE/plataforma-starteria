/**
 * portfolio-steps-materialize.test.ts — milestone #7 (portfolio-steps-integration).
 *
 * Complements create-initiative-team.test.ts (which pins the TEAM materialization).
 * This suite pins the OTHER half of the portfolio-lead → participant Steps bridge:
 * creating an iniciativa from a reto must materialize a NAVIGABLE steps project and
 * a portfolio-tracking meta row pointing at Step 0.
 *
 *   - Steps 1..4 are seeded (DEFAULT_STEPS): Step 1 NOT_STARTED, Steps 2..4 BLOCKED,
 *     while a challenge-linked initiative enters the explicit Step 0 activation gate.
 *   - InitiativePortfolioMeta is upserted with status='en_step_0' and the reto's
 *     strategicFrontId, so the iniciativa shows up under its frente → reto for the
 *     portfolio dashboard without any re-capture.
 *
 * Fast + deterministic (mock tx) — no docker/AI dependency. The full real-stack chain
 * is covered by front/e2e/portfolio-steps-integration.spec.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { ProjectService } from '../project.service';

function makeTx(overrides: Record<string, any> = {}) {
  return {
    project: {
      create: vi.fn().mockResolvedValue({ id: 'newproj', steps: [], teamMembers: [], evidence: [] }),
    },
    challenge: {
      findUnique: vi.fn().mockResolvedValue({ id: 'ch1', strategicFrontId: 'sf1' }),
    },
    initiativePortfolioMeta: {
      upsert: vi.fn().mockResolvedValue({ id: 'meta1' }),
    },
    challengeTeamMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    teamMember: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    user: { findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) },
    challenge: { findUnique: vi.fn().mockResolvedValue({
      id: 'ch1',
      strategicFrontId: 'sf1',
      strategicFront: { organizationId: 'org-1' },
    }) },
    organizationMember: { findMany: vi.fn().mockResolvedValue([]) },
    organizationPortfolioAccessGrant: { findMany: vi.fn().mockResolvedValue([]) },
  } as any;
}

const baseData = { name: 'Mi Iniciativa', description: 'd' } as any;

describe('ProjectService.createProject — steps + meta materialization (milestone #7)', () => {
  it('seeds Steps 1..4 while challenge-linked initiatives enter at Step 0', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx));

    await svc.createProject('owner', { ...baseData, challengeId: 'ch1' });

    expect(tx.project.create).toHaveBeenCalledTimes(1);
    const createArg = tx.project.create.mock.calls[0][0].data;

    // Challenge-linked initiatives require the explicit Step 0 activation gate.
    expect(createArg.currentStep).toBe(0);
    expect(createArg.step0Status).toBe('IN_PROGRESS');

    // Steps 1..4 are materialized inline.
    const seededSteps = createArg.steps.create as Array<{ number: number; status: string; modules: any }>;
    expect(seededSteps.map((s) => s.number).sort()).toEqual([1, 2, 3, 4]);
    expect(seededSteps.find((s) => s.number === 1)!.status).toBe('NOT_STARTED');
    for (const n of [2, 3, 4]) {
      expect(seededSteps.find((s) => s.number === n)!.status).toBe('BLOCKED');
    }
    // Step 1 has at least one module so the flow is actually navigable.
    expect(seededSteps.find((s) => s.number === 1)!.modules.create.length).toBeGreaterThan(0);
  });

  it('links the iniciativa to its frente → reto at Step 0 for portfolio tracking', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx));

    await svc.createProject('owner', { ...baseData, challengeId: 'ch1' });

    expect(tx.initiativePortfolioMeta.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = tx.initiativePortfolioMeta.upsert.mock.calls[0][0];
    // Idempotent on (projectId, challengeId).
    expect(upsertArg.where.projectId_challengeId).toEqual({ projectId: 'newproj', challengeId: 'ch1' });
    // The create payload carries the reto's frente link + the Step-0 tracking status.
    expect(upsertArg.create).toEqual(
      expect.objectContaining({
        projectId: 'newproj',
        challengeId: 'ch1',
        strategicFrontId: 'sf1',
        status: 'en_step_0',
      }),
    );
  });

  it('a standalone iniciativa (no reto) still seeds the navigable Steps flow', async () => {
    const tx = makeTx();
    const svc = new ProjectService(makePrisma(tx));

    await svc.createProject('owner', baseData);

    // Steps are always seeded, even without a portfolio link…
    const createArg = tx.project.create.mock.calls[0][0].data;
    expect((createArg.steps.create as any[]).map((s) => s.number).sort()).toEqual([1, 2, 3, 4]);
    // …but no portfolio meta row is created.
    expect(tx.initiativePortfolioMeta.upsert).not.toHaveBeenCalled();
  });
});
