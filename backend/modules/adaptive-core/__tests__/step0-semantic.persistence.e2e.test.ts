import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../adaptive-core.service';

const describeP7 = process.env.P7_SEMANTIC_E2E === '1' ? describe : describe.skip;
const databaseUrl = process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55433/starteria_e2e';
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const service = new AdaptiveCoreService(prisma);
const ownerId = 'p7-semantic-owner';
const ids = { routeA: 'p7-semantic-route-a', routeB: 'p7-semantic-route-b', routeC: 'p7-semantic-route-c' };

async function clean() {
  const where = { projectId: { in: Object.values(ids) } };
  await prisma.adaptiveAdaptationEvent.deleteMany({ where });
  await prisma.adaptiveProgressSignal.deleteMany({ where });
  await prisma.adaptiveCheckpointResponse.deleteMany({ where });
  await prisma.adaptiveCheckpointInstance.deleteMany({ where });
  await prisma.adaptiveStepOutput.deleteMany({ where });
  await prisma.adaptiveStepConfiguration.deleteMany({ where });
  await prisma.cycleStepState.deleteMany({ where: { cycle: where } });
  await prisma.initiativeCycle.deleteMany({ where });
  await prisma.sourceRef.deleteMany({ where });
  await prisma.project.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.user.deleteMany({ where: { id: ownerId } });
}

async function submit(projectId: string, suffix: string, fieldHint: 'objective' | 'scope' | 'owner' | 'priorityHypothesis' | 'decisionCriteria', content: string, extra: Record<string, unknown> = {}) {
  return service.processStep0SemanticInput(projectId, ownerId, 'participante', {
    idempotencyKey: `${projectId}-${suffix}`,
    fieldHint,
    content,
    ...extra,
  } as any);
}

describeP7('P7 Step 0 semantic Card persistence', () => {
  beforeAll(async () => {
    await clean();
    await prisma.user.create({ data: { id: ownerId, email: 'p7-semantic-owner@starteria.test', name: 'P7 Owner', role: 'participante', roles: ['participante'], initials: 'P7', skills: [] } });
    await prisma.project.createMany({
      data: [
        { id: ids.routeA, name: 'Reducir retrabajo comercial', ownerId, step0Status: 'IN_PROGRESS', step0Data: { adaptiveCore: { masterContext: { handoffMandate: { constraints: ['No modificar datos personales'], sourceRefs: ['brief-a'] }, challengeSnapshot: { id: 'challenge-a', title: 'Reto A' } } } } },
        { id: ids.routeB, name: 'Iniciativa heredada', ownerId, step0Status: 'IN_PROGRESS', step0Data: { adaptiveCore: { masterContext: { routeType: 'reconstruct_existing', handoffMandate: { constraints: ['Mantener historial existente'] }, recoveredHistory: { outputs: 2, gaps: ['Criterio de decisión pendiente'] } } } } },
        { id: ids.routeC, name: 'Iniciativa independiente', ownerId, step0Status: 'IN_PROGRESS', step0Data: { adaptiveCore: { masterContext: { routeType: 'lightweight_plan' } } } },
      ],
    });
    await prisma.teamMember.createMany({
      data: Object.values(ids).map(projectId => ({ projectId, userId: ownerId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] })),
    });
    await prisma.sourceRef.create({ data: { id: 'p7-route-b-source', projectId: ids.routeB, sourceType: 'CONTEXT_SOURCE', reference: 'Fuente heredada Route B', originActorId: ownerId, originActorType: 'system' } });
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('Route A persists semantic deltas, provenance, retry receipts and human-only checkpoint readiness', async () => {
    await submit(ids.routeA, 'objective', 'objective', 'Reducir retrabajo comercial');
    await submit(ids.routeA, 'scope', 'scope', 'Equipo comercial de Madrid; excluye pricing.');
    await submit(ids.routeA, 'owner', 'owner', 'Ana, responsable comercial.');
    await submit(ids.routeA, 'hypothesis', 'priorityHypothesis', 'Si simplificamos el tablero, el uso crecerá.', { newSource: { reference: 'Entrevista con Ana' } });
    const complete = await submit(ids.routeA, 'criteria', 'decisionCriteria', 'Tres entrevistas y una métrica base permiten decidir.');
    expect(complete.card.sufficiency).toMatchObject({ sufficient: true });
    expect(complete.card.checkpoint).toMatchObject({ state: 'ready_for_human_confirmation', humanConfirmationRequired: true });
    expect(complete.card.handoff).toMatchObject({ toStep: 1, structured: true });
    expect(complete.card.sources).toEqual(expect.arrayContaining([expect.objectContaining({ reference: 'Entrevista con Ana', validationStatus: 'unvalidated' })]));

    const replay = await submit(ids.routeA, 'criteria', 'decisionCriteria', 'Esto no debe aplicarse en retry.');
    expect(replay.card.fields.decisionCriteria?.value).toBe('Tres entrevistas y una métrica base permiten decidir.');
    expect(await prisma.adaptiveAdaptationEvent.count({ where: { projectId: ids.routeA, idempotencyKey: `${ids.routeA}-criteria` } })).toBe(1);
    expect(await prisma.sourceRef.count({ where: { projectId: ids.routeA, reference: 'Entrevista con Ana' } })).toBe(1);
  });

  it('keeps unknown, irrelevant input and a contradiction without silently overwriting Route A history', async () => {
    const unknown = await submit(ids.routeA, 'unknown-owner', 'owner', 'No sé');
    expect(unknown.card.unknowns).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'owner' })]));
    const versionsBeforeIrrelevant = await prisma.adaptiveStepOutput.count({ where: { projectId: ids.routeA, outputKey: 'Step0SemanticCard' } });
    const irrelevant = await service.processStep0SemanticInput(ids.routeA, ownerId, 'participante', { idempotencyKey: `${ids.routeA}-irrelevant`, content: 'Me gusta la pizza y el fútbol.' } as any);
    expect(irrelevant.card.fields).toEqual(unknown.card.fields);
    expect(await prisma.adaptiveStepOutput.count({ where: { projectId: ids.routeA, outputKey: 'Step0SemanticCard' } })).toBe(versionsBeforeIrrelevant);
    const contradiction = await submit(ids.routeA, 'contradiction', 'scope', 'Toda la compañía.');
    expect(contradiction.card.requiresReview).toBe(true);
    expect(contradiction.card.contradictions).toEqual(expect.arrayContaining([expect.objectContaining({ previous: 'Equipo comercial de Madrid; excluye pricing.', proposed: 'Toda la compañía.' })]));
    const versions = await prisma.adaptiveStepOutput.findMany({ where: { projectId: ids.routeA, outputKey: 'Step0SemanticCard' }, orderBy: { version: 'asc' } });
    expect(versions.length).toBeGreaterThan(4);
    expect(versions.some(row => (row.outputJson as any).fields?.scope?.value === 'Equipo comercial de Madrid; excluye pricing.')).toBe(true);
  });

  it('Route B recovers inherited context and existing SourceRefs without duplicating the Initiative', async () => {
    const state = await service.processStep0SemanticInput(ids.routeB, ownerId, 'participante', {
      idempotencyKey: `${ids.routeB}-known`, fieldHint: 'objective', content: 'Iniciativa heredada', sourceRefIds: ['p7-route-b-source'],
    });
    expect(state.card.inheritedContext).toMatchObject({ routeType: 'reconstruct_existing', recoveredHistory: { outputs: 2 } });
    expect(state.card.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'p7-route-b-source', reference: 'Fuente heredada Route B' })]));
    expect(await prisma.project.count({ where: { id: ids.routeB } })).toBe(1);
  });

  it('Route C works without a fabricated Front or Challenge', async () => {
    const state = await submit(ids.routeC, 'objective', 'objective', 'Iniciativa independiente');
    expect(state.card.inheritedContext.challengeSnapshot).toBeNull();
    expect(await prisma.project.count({ where: { id: ids.routeC } })).toBe(1);
  });
});
