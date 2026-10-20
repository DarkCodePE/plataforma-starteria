import { describe, expect, it, vi } from 'vitest';
import { PortfolioHandoffReconstructionService } from '../application/portfolio-handoff-reconstruction.service';

const actor = { id: 'owner-1', role: 'owner' };

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    sourceRef: { findMany: vi.fn(async () => [{ id: 'source-1', sourceType: 'document', title: 'Mandato' }]) },
    evidence: { findMany: vi.fn(async () => [{ id: 'evidence-1', name: 'Entrevista', type: 'document' }]) },
    truthClaim: { findMany: vi.fn(async () => [{ id: 'claim-1', subjectType: 'context', verificationState: 'unvalidated' }]) },
    initiativeContextSnapshot: { findMany: vi.fn(async () => [{ id: 'snapshot-1', createdAt: new Date() }]) },
    initiativeCycle: { findFirst: vi.fn(async () => ({ id: 'cycle-1', cycleNumber: 2, status: 'ACTIVE' })) },
    adaptiveStepConfiguration: { findFirst: vi.fn(async () => ({ id: 'configuration-1', stepNumber: 2, status: 'active' })) },
    adaptiveStepOutput: { findMany: vi.fn(async () => [{ id: 'output-1', stepNumber: 1, version: 1 }]) },
    adaptiveAdaptationEvent: { findMany: vi.fn(async () => [{ id: 'event-1', eventType: 'step_output_versioned' }]) },
    ...overrides,
  } as any;
}

function makeAssignments(overrides: Record<string, any> = {}) {
  return {
    findById: vi.fn(async () => ({
      id: 'handoff-1',
      targetKind: 'EXISTING_INITIATIVE',
      initiativeId: 'project-1',
      state: 'STARTED',
      members: [{ role: 'OWNER', userId: 'owner-1' }],
      ...overrides,
    })),
  } as any;
}

function makeProjects() {
  return {
    getProjectForRead: vi.fn(async () => ({ id: 'project-1', name: 'Iniciativa heredada' })),
  } as any;
}

describe('PortfolioHandoffReconstructionService', () => {
  it('recovers the same existing Project in read-only form without choosing a Step', async () => {
    const prisma = makePrisma();
    const projects = makeProjects();
    const service = new PortfolioHandoffReconstructionService(prisma, makeAssignments(), projects);

    const result = await service.readExistingInitiative({ assignmentId: 'handoff-1', actor });

    expect(result.initiativeId).toBe('project-1');
    expect(result.continuityState).toBe('CURRENT_GOVERNED_CORE_STATE');
    expect(result.currentGovernedState).toEqual({ cycleId: 'cycle-1', cycleNumber: 2, stepNumber: 2 });
    expect(result.recovered).toEqual(expect.objectContaining({ sourceRefs: 1, evidence: 1, claims: 1, outputs: 1 }));
    expect(result.gaps).toEqual([]);
    expect(projects.getProjectForRead).toHaveBeenCalledWith('project-1', 'owner-1', 'owner');
    expect(prisma.initiativeCycle.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'project-1', status: 'active' } }));
  });

  it('requires continuity review when no safe active Core configuration exists and exposes gaps without writing history', async () => {
    const prisma = makePrisma({
      sourceRef: { findMany: vi.fn(async () => []) },
      evidence: { findMany: vi.fn(async () => []) },
      truthClaim: { findMany: vi.fn(async () => []) },
      initiativeContextSnapshot: { findMany: vi.fn(async () => []) },
      initiativeCycle: { findFirst: vi.fn(async () => null) },
      adaptiveStepConfiguration: { findFirst: vi.fn(async () => null) },
      adaptiveStepOutput: { findMany: vi.fn(async () => []) },
      adaptiveAdaptationEvent: { findMany: vi.fn(async () => []) },
    });
    const service = new PortfolioHandoffReconstructionService(prisma, makeAssignments(), makeProjects());

    const result = await service.readExistingInitiative({ assignmentId: 'handoff-1', actor });

    expect(result.continuityState).toBe('CONTINUITY_REVIEW_REQUIRED');
    expect(result.currentGovernedState).toBeNull();
    expect(result.gaps.map((gap: any) => gap.code)).toEqual(expect.arrayContaining([
      'SOURCES_NOT_RECOVERED', 'EVIDENCE_NOT_RECOVERED', 'HISTORY_NOT_RECOVERED', 'ACTIVE_CORE_STATE_UNAVAILABLE',
    ]));
    for (const value of Object.values(prisma)) {
      expect(value).not.toHaveProperty('create');
      expect(value).not.toHaveProperty('update');
    }
  });

  it('denies a non-owner before reading any Project data', async () => {
    const prisma = makePrisma();
    const projects = makeProjects();
    const service = new PortfolioHandoffReconstructionService(prisma, makeAssignments(), projects);

    await expect(service.readExistingInitiative({ assignmentId: 'handoff-1', actor: { id: 'other', role: 'owner' } }))
      .rejects.toMatchObject({ code: 'HANDOFF_RECONSTRUCTION_ACCESS_DENIED' });
    expect(projects.getProjectForRead).not.toHaveBeenCalled();
    expect(prisma.sourceRef.findMany).not.toHaveBeenCalled();
  });
});
