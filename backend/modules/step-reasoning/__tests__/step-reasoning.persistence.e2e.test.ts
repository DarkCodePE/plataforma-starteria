import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { StepContextBuilder } from '../context-builder';
import { PrismaStepReasoningRepository } from '../repository';
import { StepReasoningService } from '../service';

const describeDb = process.env.STEP_REASONING_DB_E2E === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const organizationId = 'org-step-reasoning-e2e';
const actorId = 'user-step-reasoning-e2e';
const outsiderId = 'user-step-reasoning-outsider-e2e';
const projectId = 'project-step-reasoning-e2e';
const cycleId = 'cycle-step-reasoning-e2e';
const clientTurnId = '2d034bae-50df-4e1c-823d-1f63d654a9e8';

async function clean() {
  await prisma.stepReasoningSession.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: { in: [actorId, outsiderId] } } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}

describeDb('Step Reasoning PostgreSQL persistence', () => {
  beforeAll(async () => {
    await clean();
    await prisma.organization.create({ data: { id: organizationId, name: 'Step Reasoning Synthetic QA', slug: 'step-reasoning-synthetic-qa', seatLimit: 2 } });
    await prisma.user.createMany({ data: [
      { id: actorId, email: 'step-reasoning@synthetic.test', name: 'Synthetic Actor', role: 'participante', roles: ['participante'], initials: 'SA', skills: [], organizationId },
      { id: outsiderId, email: 'step-reasoning-outsider@synthetic.test', name: 'Synthetic Outsider', role: 'participante', roles: ['participante'], initials: 'SO', skills: [], organizationId },
    ] });
    await prisma.organizationMember.create({ data: { organizationId, userId: actorId, role: 'owner' } });
    await prisma.project.create({ data: { id: projectId, name: 'Synthetic Step 0 initiative', description: 'A synthetic retrabajo case.', ownerId: actorId, organizationId, currentStep: 0, step0Data: { quePasaQueQuieres: 'Retrabajo entre dos áreas.' } } });
    await prisma.teamMember.create({ data: { projectId, userId: actorId, role: 'OWNER', status: 'ACTIVE', modulePermissions: [] } });
    await prisma.initiativeCycle.create({ data: { id: cycleId, projectId, cycleNumber: 1, currentStep: 0, startStep: 0, status: 'active' } });
    await prisma.adaptiveStepConfiguration.create({ data: {
      id: 'step-reasoning-config-e2e', projectId, cycleId, stepNumber: 0, version: 1, status: 'active',
      routeType: 'explore_validate', depthLevel: 'standard', configurationJson: {}, sourceContextJson: { mandate: 'Aclarar el problema sintético.' },
    } });
    await prisma.adaptiveCheckpointInstance.create({ data: {
      id: 'step-reasoning-checkpoint-e2e', projectId, cycleId, stepConfigurationId: 'step-reasoning-config-e2e',
      stepNumber: 0, checkpointKey: 'CP-0.1', sequence: 1, status: 'in_progress',
      materializedQuestionsJson: [{ id: 'q1', text: '¿Dónde ocurre el retrabajo?', required: true }],
    } });
  });

  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('creates one durable logical turn under concurrent duplicate submissions without Core mutation', async () => {
    const bridge = {
      callAiService: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
        return {
          message: 'Aclaremos primero dónde aparece el retrabajo.',
          nextInteraction: { kind: 'ask', question: '¿En qué parte del proceso aparece?' },
          known: ['Existe retrabajo declarado.'], unknown: ['No hay frecuencia confirmada.'], contradictions: [],
          suggestions: [{ field: 'problemStatement', proposedValue: 'Retrabajo entre áreas', rationale: 'Síntesis del mensaje.', status: 'UNREVIEWED', sourceRefs: ['user.turn'] }],
          warnings: ['La causa no está confirmada.'], isReadyForHumanReview: false,
          model: 'openrouter:synthetic/model', promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:synthetic',
        };
      }),
    };
    const makeService = () => new StepReasoningService(new StepContextBuilder(prisma), new PrismaStepReasoningRepository(prisma), bridge as any, 'live_llm');
    const beforeProject = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const beforeCoreCounts = await Promise.all([
      prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
      prisma.adaptiveStepOutput.count({ where: { projectId } }),
      prisma.adaptiveAdaptationEvent.count({ where: { projectId } }),
    ]);
    const input = { clientTurnId, message: 'Hay retrabajo, pero no sé dónde medir.', mode: 'work_with_me' as const, retryFailed: false };
    const [first, second] = await Promise.all([
      makeService().submitTurn(projectId, 0, { id: actorId, role: 'participante' }, input, 'request-concurrent-a'),
      makeService().submitTurn(projectId, 0, { id: actorId, role: 'participante' }, input, 'request-concurrent-b'),
    ]);

    expect([first.turn.status, second.turn.status]).toContain('SUCCEEDED');
    expect(bridge.callAiService).toHaveBeenCalledTimes(1);
    expect(await prisma.stepReasoningTurn.count({ where: { clientTurnId } })).toBe(1);
    expect(await prisma.stepReasoningSession.count({ where: { projectId, createdById: actorId } })).toBe(1);

    const restored = await makeService().loadSession(projectId, 0, { id: actorId, role: 'participante' });
    expect(restored.turns).toHaveLength(1);
    expect(restored.turns[0]).toMatchObject({ clientTurnId, status: 'SUCCEEDED', assistantText: 'Aclaremos primero dónde aparece el retrabajo.' });

    const afterProject = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const afterCoreCounts = await Promise.all([
      prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
      prisma.adaptiveStepOutput.count({ where: { projectId } }),
      prisma.adaptiveAdaptationEvent.count({ where: { projectId } }),
    ]);
    expect(afterProject.lastModified).toEqual(beforeProject.lastModified);
    expect(afterCoreCounts).toEqual(beforeCoreCounts);
  });

  it('denies an actor outside the project and never sends their message to the provider', async () => {
    const bridge = { callAiService: vi.fn() };
    const service = new StepReasoningService(new StepContextBuilder(prisma), new PrismaStepReasoningRepository(prisma), bridge as any, 'live_llm');
    await expect(service.submitTurn(projectId, 0, { id: outsiderId, role: 'participante' }, {
      clientTurnId: '4bb5f956-6ff3-4f1f-b252-d74547c1af94', message: 'Mensaje ajeno', mode: 'work_with_me', retryFailed: false,
    }, 'request-outsider')).rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
    expect(bridge.callAiService).not.toHaveBeenCalled();
  });

  it('retries a failed provider call on the same durable turn without duplicating it', async () => {
    const retryId = '7de8b171-0f9f-4b2e-9e5c-460abf83e1f1';
    const success = {
      message: 'Retomamos el mismo turno.',
      nextInteraction: { kind: 'ask', question: '¿Qué señal observarás?' },
      known: [], unknown: ['Señal pendiente.'], contradictions: [], suggestions: [], warnings: [], isReadyForHumanReview: false,
      model: 'openrouter:synthetic/model', promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:synthetic',
    };
    const bridge = { callAiService: vi.fn().mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'AI_UPSTREAM_TIMEOUT' })).mockResolvedValueOnce(success) };
    const service = new StepReasoningService(new StepContextBuilder(prisma), new PrismaStepReasoningRepository(prisma), bridge as any, 'live_llm');
    const turnInput = { clientTurnId: retryId, message: 'Conserva este input.', mode: 'work_with_me' as const, retryFailed: false };
    const failed = await service.submitTurn(projectId, 0, { id: actorId, role: 'participante' }, turnInput, 'request-retry-a');
    expect(failed.turn).toMatchObject({ status: 'FAILED', errorCode: 'AI_UPSTREAM_TIMEOUT' });
    const retried = await service.submitTurn(projectId, 0, { id: actorId, role: 'participante' }, { ...turnInput, retryFailed: true }, 'request-retry-b');
    expect(retried.turn).toMatchObject({ status: 'SUCCEEDED', assistantText: 'Retomamos el mismo turno.' });
    expect(await prisma.stepReasoningTurn.count({ where: { clientTurnId: retryId } })).toBe(1);
    expect(bridge.callAiService).toHaveBeenCalledTimes(2);
  });

  it('persists a distinct Step 2 conversation without requiring or creating a checkpoint', async () => {
    await prisma.initiativeCycle.update({ where: { id: cycleId }, data: { currentStep: 2 } });
    await prisma.project.update({ where: { id: projectId }, data: { currentStep: 2 } });
    await prisma.adaptiveStepConfiguration.create({ data: {
      id: 'step-reasoning-config-step2-e2e', projectId, cycleId, stepNumber: 2, version: 1, status: 'active',
      routeType: 'execute_scale', depthLevel: 'light', configurationJson: {}, sourceContextJson: { mandate: 'Diseñar una prueba mínima.' },
    } });
    const bridge = { callAiService: vi.fn(async () => ({
      message: 'Respuesta determinista para probar la integración de Step 2.',
      nextInteraction: { kind: 'ask', question: '¿Qué señal observarás?' },
      known: [], unknown: ['Señal pendiente.'], contradictions: [], suggestions: [], warnings: [], isReadyForHumanReview: false,
      model: 'qa-stub/step-reasoning-v1', promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:synthetic',
    })) };
    const service = new StepReasoningService(new StepContextBuilder(prisma), new PrismaStepReasoningRepository(prisma), bridge as any, 'live_llm');
    const coreSnapshot = await Promise.all([
      prisma.adaptiveCheckpointInstance.count({ where: { projectId, stepNumber: 2 } }),
      prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
      prisma.adaptiveStepOutput.count({ where: { projectId } }),
      prisma.truthClaim.count({ where: { projectId } }),
      prisma.evidence.count({ where: { projectId } }),
      prisma.sourceRef.count({ where: { projectId } }),
      prisma.truthValidation.count({ where: { projectId } }),
      prisma.adaptiveAdaptationEvent.count({ where: { projectId } }),
      prisma.initiativeCycle.findUnique({ where: { id: cycleId }, select: { currentStep: true, status: true, updatedAt: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { currentStep: true, lastModified: true } }),
    ]);
    const result = await service.submitTurn(projectId, 2, { id: actorId, role: 'participante' }, {
      clientTurnId: '4ce42f0e-7004-42da-9006-cf9287082ca2', message: 'Quiero concretar una prueba mínima.', mode: 'work_with_me', retryFailed: false,
    }, 'request-step2');
    expect(result.session).toMatchObject({ stepNumber: 2, cycleId });
    expect(result.turn).toMatchObject({ status: 'SUCCEEDED', executionMode: 'qa_stub' });
    const restored = await service.loadSession(projectId, 2, { id: actorId, role: 'participante' });
    expect(restored.turns).toHaveLength(1);
    expect(await prisma.stepReasoningSession.count({ where: { projectId, stepNumber: 0 } })).toBe(1);
    expect(await prisma.stepReasoningSession.count({ where: { projectId, stepNumber: 2 } })).toBe(1);
    expect(await Promise.all([
      prisma.adaptiveCheckpointInstance.count({ where: { projectId, stepNumber: 2 } }),
      prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
      prisma.adaptiveStepOutput.count({ where: { projectId } }),
      prisma.truthClaim.count({ where: { projectId } }),
      prisma.evidence.count({ where: { projectId } }),
      prisma.sourceRef.count({ where: { projectId } }),
      prisma.truthValidation.count({ where: { projectId } }),
      prisma.adaptiveAdaptationEvent.count({ where: { projectId } }),
      prisma.initiativeCycle.findUnique({ where: { id: cycleId }, select: { currentStep: true, status: true, updatedAt: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { currentStep: true, lastModified: true } }),
    ])).toEqual(coreSnapshot);
  });
});
