import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../adaptive-core.service';

const describeP8 = process.env.P8_SEMANTIC_E2E === '1' ? describe : describe.skip;
const prisma = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55433/starteria_e2e' } } });
const service = new AdaptiveCoreService(prisma);
const ownerId = 'p8-semantic-owner';
const projectId = 'p8-semantic-runtime-project';

async function clean() {
  const where = { projectId };
  await prisma.adaptiveAdaptationEvent.deleteMany({ where });
  await prisma.adaptiveProgressSignal.deleteMany({ where });
  await prisma.adaptiveCheckpointResponse.deleteMany({ where });
  await prisma.adaptiveCheckpointInstance.deleteMany({ where });
  await prisma.adaptiveStepOutput.deleteMany({ where });
  await prisma.adaptiveStepConfiguration.deleteMany({ where });
  await prisma.cycleStepState.deleteMany({ where: { cycle: where } });
  await prisma.initiativeCycle.deleteMany({ where });
  await prisma.sourceRef.deleteMany({ where });
  await prisma.teamMember.deleteMany({ where });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: ownerId } });
}

async function input(step: number, field: string, content: string, suffix: string, sourceRefIds: string[] = []) {
  return service.processSemanticStepInput(projectId, ownerId, 'participante', step, {
    idempotencyKey: `${projectId}-${suffix}`,
    field, content, sourceRefIds,
  });
}

describeP8('P8 persisted governed semantic cycle', () => {
  let sourceId = '';
  beforeAll(async () => {
    await clean();
    await prisma.user.create({ data: { id: ownerId, email: 'p8-semantic-owner@starteria.test', name: 'P8 Owner', role: 'participante', roles: ['participante'], initials: 'P8', skills: [] } });
    await prisma.project.create({ data: { id: projectId, name: 'P8 semantic cycle', ownerId, step0Status: 'IN_PROGRESS', step0Data: { adaptiveCore: { masterContext: { handoffMandate: { constraints: ['No data personal'] }, step0SemanticHandoff: { cardVersion: 5, sourceRefIds: [] } } } } } });
    await prisma.teamMember.create({ data: { projectId, userId: ownerId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } });
    await service.ensureInitialized(projectId, ownerId, 'participante');
    const cycle = await prisma.initiativeCycle.findFirstOrThrow({ where: { projectId, status: 'active' } });
    for (const step of [1, 2, 3, 4]) {
      await prisma.adaptiveStepConfiguration.create({ data: {
        projectId, cycleId: cycle.id, stepNumber: step, version: 1, status: 'active', routeType: 'explore_validate', depthLevel: 'standard', maturity: 'problem',
        configurationJson: { semantic: true, step }, sourceContextJson: { inherited: `step-${step}`, step0SemanticHandoff: { cardVersion: 5, gaps: ['known gap'] } },
      } });
    }
    await prisma.adaptiveStepOutput.createMany({ data: [
      { projectId, cycleId: cycle.id, stepNumber: 1, version: 1, status: 'confirmed', outputKey: 'ProblemFocusBrief', outputJson: { focus: 'original focus' } },
      { projectId, cycleId: cycle.id, stepNumber: 2, version: 1, status: 'confirmed', outputKey: 'ExperimentDesign', outputJson: { selectedBet: 'original work' } },
    ] });
    const source = await prisma.sourceRef.create({ data: { projectId, sourceType: 'USER_INPUT', reference: 'P8 measured source', originActorId: ownerId, originActorType: 'human' } });
    sourceId = source.id;
  });
  afterAll(async () => { await clean(); await prisma.$disconnect(); });

  it('persists Step 1 to 4 semantic Cards, handoffs, provenance and unknown without creating decisions', async () => {
    const unknown = await input(1, 'focus', 'No se', 's1-unknown');
    expect(unknown.card.unknowns).toContain('focus');
    await input(1, 'focus', 'Reducir retrabajo', 's1-focus');
    await input(1, 'fact', 'El equipo registra 12 casos', 's1-fact', [sourceId]);
    await input(1, 'hypothesis', 'Una plantilla reducira casos', 's1-hypothesis');
    const step1 = await input(1, 'evidence', 'Entrevista confirmada', 's1-evidence', [sourceId]);
    expect(step1.card.handoff).toMatchObject({ toStep: 2, sourceRefIds: [sourceId] });
    expect(step1.card.sources).toEqual([expect.objectContaining({ id: sourceId, validationStatus: 'unvalidated' })]);

    await input(2, 'selectedWork', 'Piloto de plantilla', 's2-work');
    await input(2, 'measurementPlan', 'Medir casos semanales', 's2-measure');
    const step2 = await input(2, 'capacityBoundary', 'Equipo comercial opera piloto', 's2-capacity');
    expect(step2.card.handoff).toMatchObject({ toStep: 3 });

    await input(3, 'execution', 'Ejecutamos piloto A', 's3-execution');
    await input(3, 'observation', '7 usuarios utilizaron la plantilla', 's3-observation', [sourceId]);
    const step3 = await input(3, 'interpretation', 'Senal inicialmente positiva', 's3-interpretation');
    expect(step3.card.values.observation.kind).toBe('observation');
    expect(step3.card.values.interpretation.kind).toBe('interpretation');

    await input(4, 'learning', 'El onboarding requiere acompanamiento', 's4-learning');
    await input(4, 'recommendation', 'Iterar con soporte', 's4-recommendation');
    const step4 = await input(4, 'decisionRequest', 'Sponsor debe decidir el siguiente horizonte', 's4-request');
    expect(step4.card.handoff).toMatchObject({ toStep: 'Decision' });
    expect(await prisma.decision.count({ where: { projectId } })).toBe(0);
  });

  it('records a Step 3 contradiction as directed review without a global reset and handles retry idempotently', async () => {
    const outputsBeforeRetry = await prisma.adaptiveStepOutput.count({ where: { projectId, outputKey: 'Step3SemanticCard' } });
    const step4VersionsBefore = await prisma.adaptiveStepOutput.count({ where: { projectId, outputKey: 'Step4SemanticCard' } });
    const contradicted = await input(3, 'observation', 'Solo 2 usuarios utilizaron la plantilla', 's3-contradiction', [sourceId]);
    expect(contradicted.card.requiresReview).toBe(true);
    expect(contradicted.card.contradictions).toEqual(expect.arrayContaining([expect.objectContaining({ previous: '7 usuarios utilizaron la plantilla' })]));
    const [step1Output, step2Output] = await Promise.all([
      prisma.adaptiveStepOutput.findFirstOrThrow({ where: { projectId, outputKey: 'ProblemFocusBrief' } }),
      prisma.adaptiveStepOutput.findFirstOrThrow({ where: { projectId, outputKey: 'ExperimentDesign' } }),
    ]);
    expect(step1Output.requiresReview).toBe(true);
    expect(step2Output.requiresReview).toBe(true);
    expect(await prisma.adaptiveStepOutput.count({ where: { projectId, outputKey: 'Step4SemanticCard' } })).toBe(step4VersionsBefore);
    await input(3, 'observation', 'texto ignorado en retry', 's3-contradiction', [sourceId]);
    expect(await prisma.adaptiveStepOutput.count({ where: { projectId, outputKey: 'Step3SemanticCard' } })).toBe(outputsBeforeRetry + 1);
    expect(await prisma.initiativeCycle.count({ where: { projectId } })).toBe(1);
  });
});
