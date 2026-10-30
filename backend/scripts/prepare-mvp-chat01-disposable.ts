import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  || parsed.port !== '55433'
  || parsed.pathname !== '/starteria_e2e') {
  throw new Error('MVP-CHAT-01 fixture refuses to run outside localhost:55433/starteria_e2e.');
}

const prisma = new PrismaClient();
const organizationId = 'mvp-chat01-org';
const ownerId = 'mvp-chat01-owner';
const hash = `sha256:${'c'.repeat(64)}`;

const scenarios = [
  { projectId: 'mvp-chat01-step0', cycleId: 'mvp-chat01-cycle0', step: 0, checkpoint: 'CP-0.1', routeType: 'explore_validate', depthLevel: 'standard', name: 'Aclarar el reto de activación comercial' },
  { projectId: 'mvp-chat01-step2', cycleId: 'mvp-chat01-cycle2', step: 2, checkpoint: null, routeType: 'reconstruct_existing', depthLevel: 'light', name: 'Diseñar una prueba mínima verificable' },
  { projectId: 'mvp-chat01-step4', cycleId: 'mvp-chat01-cycle4', step: 4, checkpoint: 'CP-4.1', routeType: 'execute_scale', depthLevel: 'deep', name: 'Preparar una decisión de continuidad' },
] as const;

async function main() {
  assert.equal(await prisma.organization.count({ where: { id: organizationId } }), 0, 'Recreate the disposable database before rerunning CHAT-01 fixtures.');
  await prisma.organization.create({ data: { id: organizationId, name: 'MVP-CHAT-01 QA descartable', slug: 'mvp-chat01-qa' } });
  await prisma.user.create({ data: {
    id: ownerId,
    email: 'mvp-chat01.owner@starteria.test',
    name: 'MVP-CHAT-01 Owner QA',
    role: 'participante',
    roles: ['participante'],
    initials: 'MC',
    skills: [],
    organizationId,
  } });
  await prisma.organizationMember.create({ data: { organizationId, userId: ownerId, role: 'owner' } });

  for (const scenario of scenarios) {
    await prisma.project.create({ data: {
      id: scenario.projectId,
      name: scenario.name,
      description: `Escenario sintético CHAT-01 para Step ${scenario.step}; no representa evidencia empresarial.`,
      ownerId,
      organizationId,
      status: 'IN_PROGRESS',
      currentStep: scenario.step,
      step0Status: scenario.step === 0 ? 'IN_PROGRESS' : 'COMPLETED',
      step0Data: {
        challengeType: 'operational',
        contextInitial: 'El equipo necesita reducir retrabajo sin inventar evidencia.',
        initialFocus: `Preparar el trabajo verificable de Step ${scenario.step}.`,
        expectedImpact: 'Tomar una decisión trazable con contexto suficiente.',
        mainRisk: 'Confundir una sugerencia conversacional con una confirmación humana.',
      },
      teamMembers: { create: { userId: ownerId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date(), modulePermissions: [] } },
      steps: { create: [1, 2, 3, 4].map((number) => ({
        number,
        name: `Step ${number}`,
        status: number < scenario.step ? 'APPROVED' : number === scenario.step ? 'IN_PROGRESS' : 'BLOCKED',
        progress: number < scenario.step ? 100 : 0,
      })) },
    } });
    await prisma.initiativeCycle.create({ data: {
      id: scenario.cycleId,
      projectId: scenario.projectId,
      cycleNumber: 1,
      startStep: 0,
      currentStep: scenario.step,
      status: 'active',
    } });
    const configurationId = `${scenario.projectId}-config`;
    const visibleName = scenario.step === 0
      ? 'Alinear el punto de partida'
      : scenario.step === 2
        ? 'Elegir la apuesta y diseñar la prueba'
        : 'Llevar la decisión a la organización';
    const objective = scenario.step === 0
      ? 'Aclarar el alcance, las restricciones y la decisión que debe habilitar el ciclo.'
      : scenario.step === 2
        ? 'Convertir el foco sustentado en una apuesta ejecutable y medible.'
        : 'Preparar la continuidad o el cierre desde los resultados confirmados.';
    const checkpointConfig = scenario.checkpoint ? [{
      id: scenario.checkpoint.toLowerCase().replace('.', '-'),
      step: scenario.step,
      code: scenario.checkpoint,
      title: `Revisión ${scenario.checkpoint}`,
      status: 'ready',
      outputKey: `Step${scenario.step}SyntheticOutput`,
      questions: [],
      completionCriteria: ['Contexto suficiente', 'Faltantes visibles', 'Decisión humana explícita'],
    }] : [];
    await prisma.adaptiveStepConfiguration.create({ data: {
      id: configurationId,
      projectId: scenario.projectId,
      cycleId: scenario.cycleId,
      stepNumber: scenario.step,
      version: 1,
      status: 'active',
      routeType: scenario.routeType,
      depthLevel: scenario.depthLevel,
      maturity: scenario.step >= 3 ? 'execution' : 'definition',
      configurationJson: {
        id: `step-${scenario.step}-${scenario.routeType}-v1`,
        step: scenario.step,
        version: 1,
        visibleName,
        objective,
        expectedOutput: `Resultado canónico de Step ${scenario.step}, sólo tras confirmación humana.`,
        routeType: scenario.routeType,
        depthLevel: scenario.depthLevel,
        checkpoints: checkpointConfig,
        qa: true,
        synthetic: true,
      },
      sourceContextJson: {
        routeType: scenario.routeType,
        depthLevel: scenario.depthLevel,
        mandate: `Avanzar Step ${scenario.step} sin alterar el Adaptive Core desde la conversación.`,
      },
    } });
    if (scenario.checkpoint) {
      await prisma.adaptiveCheckpointInstance.create({ data: {
        id: `${scenario.projectId}-checkpoint`,
        projectId: scenario.projectId,
        cycleId: scenario.cycleId,
        stepConfigurationId: configurationId,
        stepNumber: scenario.step,
        checkpointKey: scenario.checkpoint,
        sequence: 1,
        status: 'in_progress',
        materializedQuestionsJson: [{ id: `${scenario.checkpoint}-q1`, text: `¿Qué falta comprobar antes de revisar ${scenario.checkpoint}?`, required: true }],
      } });
    }
    const sessionId = `cmvpchat01sessionstep${scenario.step}`;
    await prisma.stepReasoningSession.create({ data: {
      id: sessionId,
      organizationId,
      projectId: scenario.projectId,
      cycleId: scenario.cycleId,
      stepNumber: scenario.step,
      createdById: ownerId,
      lastContextHash: hash,
    } });
    await prisma.stepReasoningTurn.createMany({ data: [
      {
        id: `${scenario.projectId}-turn1`, sessionId, clientTurnId: `00000000-0000-4000-8000-0000000000${scenario.step}1`, actorId: ownerId,
        inputText: `Quiero separar lo que sabemos de lo que falta comprobar en Step ${scenario.step}.`, sourceContextHash: hash,
        contextSnapshotJson: { qa: true, synthetic: true, stepNumber: scenario.step }, status: 'SUCCEEDED',
        assistantText: 'Respuesta determinista guardada para verificar historial y presentación. No contiene razonamiento LLM.',
        structuredOutputJson: { suggestions: [], warnings: ['Fixture de integración QA; no confirma checkpoints.'] },
        executionMode: 'qa_stub', requestId: `${scenario.projectId}-request1`, providerModel: 'qa-stub/mvp-chat01', promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:fixture', completedAt: new Date(),
      },
      {
        id: `${scenario.projectId}-turn2`, sessionId, clientTurnId: `00000000-0000-4000-8000-0000000000${scenario.step}2`, actorId: ownerId,
        inputText: `El siguiente foco debe respetar la ruta ${scenario.routeType} y profundidad ${scenario.depthLevel}.`, sourceContextHash: hash,
        contextSnapshotJson: { qa: true, synthetic: true, stepNumber: scenario.step }, status: 'SUCCEEDED',
        assistantText: 'Contexto recuperado desde la configuración persistida. La revisión oficial sigue separada.',
        structuredOutputJson: { suggestions: [], warnings: ['Fixture de integración QA; no es autoridad canónica.'] },
        executionMode: 'qa_stub', requestId: `${scenario.projectId}-request2`, providerModel: 'qa-stub/mvp-chat01', promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:fixture', completedAt: new Date(),
      },
    ] });
  }

  console.log(JSON.stringify({ database: `${parsed.hostname}:${parsed.port}${parsed.pathname}`, organizationId, ownerId, scenarios }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => { console.error(error); process.exitCode = 1; });
