import { describe, expect, it } from 'vitest';
import { StepContextBuilder } from '../context-builder';

function fakePrisma(projectName: string, memberUserId = 'user-1') {
  const project = {
    id: 'project-1',
    name: projectName,
    description: `${projectName} synthetic description`,
    status: 'DRAFT',
    ownerId: 'user-1',
    organizationId: 'org-project',
    currentStep: 0,
    step0Data: { quePasaQueQuieres: `Problema de ${projectName}` },
    lastModified: new Date('2026-10-26T10:00:00Z'),
    teamMembers: memberUserId ? [{ userId: memberUserId, role: 'OWNER', status: 'ACTIVE' }] : [],
    portfolioMeta: [],
    contextSnapshots: [],
    steps: [],
  };
  return {
    project: { findUnique: async () => project },
    organizationMember: { findFirst: async ({ where }: any) => where.organizationId === 'org-project' && where.userId === memberUserId ? { id: 'org-member-1' } : null },
    initiativeGovernance: { findUnique: async () => null },
    initiativeCycle: { findFirst: async () => ({ id: 'cycle-1', cycleNumber: 1, currentStep: 0, status: 'active', updatedAt: new Date('2026-10-26T10:00:00Z') }) },
    adaptiveStepConfiguration: { findFirst: async () => ({ version: 1, routeType: 'explore_validate', depthLevel: 'standard', sourceContextJson: { mandate: 'Aclarar el problema' }, configurationJson: {} }) },
    adaptiveCheckpointInstance: { findFirst: async () => ({ checkpointKey: 'CP-0.1', title: 'Enmarcar la iniciativa', status: 'in_progress', questionsJson: [{ id: 'q1', text: '¿Qué ocurre?' }] }) },
    adaptiveCheckpointResponse: { findMany: async () => [] },
    adaptiveStepOutput: { findMany: async () => [] },
    evidence: { findMany: async () => [] },
    sourceRef: { findMany: async () => [] },
    truthClaim: { findMany: async () => [] },
  } as any;
}

describe('StepContextBuilder', () => {
  it('builds a read-only Step 0 context with a stable source hash', async () => {
    const builder = new StepContextBuilder(fakePrisma('Proyecto Alfa'));
    const first = await builder.build({ projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 0 }, 'write');
    const second = await builder.build({ projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 0 }, 'write');
    expect(first.sourceContextHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second.sourceContextHash).toBe(first.sourceContextHash);
    expect(first.allowedOperations).toEqual(['reason', 'suggest']);
    expect(first.project.organizationId).toBe('org-project');
  });

  it('produces different context hashes for different project content', async () => {
    const alpha = await new StepContextBuilder(fakePrisma('Proyecto Alfa')).build({ projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 0 }, 'read');
    const beta = await new StepContextBuilder(fakePrisma('Proyecto Beta')).build({ projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 0 }, 'read');
    expect(alpha.sourceContextHash).not.toBe(beta.sourceContextHash);
  });

  it('denies a participant who is not on the project before building provider context', async () => {
    const builder = new StepContextBuilder(fakePrisma('Proyecto Alfa', ''));
    await expect(builder.build({ projectId: 'project-1', actorId: 'other-user', actorRole: 'participante', stepNumber: 0 }, 'read'))
      .rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
  });

  it('fails closed when the actor has no membership in the Project tenant', async () => {
    const prisma = fakePrisma('Proyecto Alfa');
    prisma.organizationMember.findFirst = async () => null;
    const builder = new StepContextBuilder(prisma);
    await expect(builder.build({ projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 0 }, 'read'))
      .rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });

  it('builds Step 2 from its active configuration without inventing a checkpoint', async () => {
    const prisma = fakePrisma('Proyecto Step 2');
    prisma.initiativeCycle.findFirst = async () => ({ id: 'cycle-2', cycleNumber: 1, currentStep: 2, status: 'active' });
    prisma.adaptiveCheckpointInstance.findFirst = async () => null;
    let outputWhere: any;
    prisma.adaptiveStepOutput.findMany = async ({ where }: any) => {
      outputWhere = where;
      return [{ stepNumber: 1, outputKey: 'step1.synthesis', version: 2, outputJson: { focus: 'real' } }];
    };
    const context = await new StepContextBuilder(prisma).build({
      projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 2,
    }, 'read');
    expect(context.step).toMatchObject({ number: 2, routeType: 'explore_validate', depthLevel: 'standard' });
    expect(context.checkpoint).toEqual({ key: null, title: null, status: null, questions: [] });
    expect(context.previousConfirmedOutputs).toHaveLength(1);
    expect(outputWhere).toMatchObject({ projectId: 'project-1', cycleId: 'cycle-2', status: 'confirmed', stepNumber: { lt: 2 } });
  });

  it('allows a historical GET in the same cycle but keeps POST on the operational Step', async () => {
    const prisma = fakePrisma('Proyecto historico');
    prisma.initiativeCycle.findFirst = async () => ({ id: 'cycle-2', cycleNumber: 1, currentStep: 2, status: 'active' });
    const builder = new StepContextBuilder(prisma);

    const historical = await builder.build({
      projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 1,
    }, 'read');
    expect(historical.step.number).toBe(1);

    await expect(builder.build({
      projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 1,
    }, 'write')).rejects.toMatchObject({ code: 'STEP_REASONING_STEP_CONFLICT' });
  });

  it('fails closed when no operational cycle is active', async () => {
    const prisma = fakePrisma('Proyecto sin ciclo');
    prisma.initiativeCycle.findFirst = async () => null;
    await expect(new StepContextBuilder(prisma).build({
      projectId: 'project-1', actorId: 'user-1', actorRole: 'participante', stepNumber: 0,
    }, 'read')).rejects.toMatchObject({ code: 'STEP_REASONING_OPERATIONAL_CYCLE_REQUIRED' });
  });
});
