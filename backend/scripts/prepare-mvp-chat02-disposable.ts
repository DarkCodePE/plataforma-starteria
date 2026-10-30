import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  || parsed.port !== '55433'
  || parsed.pathname !== '/starteria_e2e') {
  throw new Error('MVP-CHAT-02 fixture refuses to run outside localhost:55433/starteria_e2e.');
}

const prisma = new PrismaClient();
const organizationId = 'mvp-chat01-org';
const ownerId = 'mvp-chat01-owner';
const hash = `sha256:${'d'.repeat(64)}`;

async function createProject(input: {
  id: string;
  name: string;
  currentStep: number;
  conversationStep: number;
  output?: boolean;
}) {
  const cycleId = `${input.id}-cycle`;
  await prisma.project.create({ data: {
    id: input.id,
    name: input.name,
    description: 'Escenario sintético CHAT-02. No representa evidencia empresarial.',
    ownerId,
    organizationId,
    status: 'IN_PROGRESS',
    currentStep: input.currentStep,
    step0Status: 'COMPLETED',
    step0Data: { contextInitial: 'Contexto sintético trazable.', initialFocus: 'Validar una prueba mínima.', expectedImpact: 'Decidir con evidencia.', mainRisk: 'Confundir progreso con confirmación.' },
    teamMembers: { create: { userId: ownerId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date(), modulePermissions: [] } },
    steps: { create: [1, 2, 3, 4].map(number => ({ number, name: `Step ${number}`, status: number < input.currentStep ? 'APPROVED' : number === input.currentStep ? 'IN_PROGRESS' : 'BLOCKED', progress: number < input.currentStep ? 100 : 0 })) },
  } });
  await prisma.initiativeCycle.create({ data: { id: cycleId, projectId: input.id, cycleNumber: 1, startStep: 0, currentStep: input.currentStep, status: 'active' } });

  const steps = [...new Set([input.conversationStep, input.currentStep])];
  for (const step of steps) {
    const configurationId = `${input.id}-config-${step}`;
    await prisma.adaptiveStepConfiguration.create({ data: {
      id: configurationId,
      projectId: input.id,
      cycleId,
      stepNumber: step,
      version: 1,
      status: 'active',
      routeType: step === 1 ? 'reconstruct_existing' : 'explore_validate',
      depthLevel: step === 1 ? 'light' : 'standard',
      maturity: step >= 3 ? 'execution' : 'definition',
      configurationJson: {
        id: `step-${step}-chat02-v1`, step, version: 1,
        visibleName: step === 1 ? 'Comprender el problema' : step === 2 ? 'Preparar una prueba' : 'Ejecutar y aprender',
        objective: step === 1 ? 'Comprender la realidad sin inventar un resultado histórico.' : step === 2 ? 'Preparar una prueba verificable y su medición.' : 'Ejecutar y aprender con evidencia trazable.',
        expectedOutput: step === 1 ? 'Foco sustentado' : step === 2 ? 'Prueba preparada' : 'Aprendizaje trazable',
        routeType: step === 1 ? 'reconstruct_existing' : 'explore_validate', depthLevel: step === 1 ? 'light' : 'standard',
        checkpoints: step === input.currentStep ? [{ id: `cp-${step}-1`, step, code: `CP-${step}.1`, title: 'Revisión canónica', status: 'in_progress', outputKey: `step${step}.result`, questions: [], completionCriteria: ['Confirmación humana explícita'] }] : [],
      },
      sourceContextJson: { mandate: `Avanzar Step ${step} sin que el chat confirme el Core.` },
    } });
    if (step === input.currentStep) {
      await prisma.adaptiveCheckpointInstance.create({ data: {
        id: `${input.id}-checkpoint-${step}`, projectId: input.id, cycleId, stepConfigurationId: configurationId,
        stepNumber: step, checkpointKey: `CP-${step}.1`, sequence: 1, status: 'in_progress',
        materializedQuestionsJson: [{ id: `q-${step}-1`, text: '¿Qué evidencia falta antes de confirmar?', required: true }],
      } });
    }
  }

  if (input.output) {
    await prisma.adaptiveStepOutput.create({ data: {
      id: `${input.id}-output-${input.conversationStep}`, projectId: input.id, cycleId,
      sourceConfigurationId: `${input.id}-config-${input.conversationStep}`, stepNumber: input.conversationStep,
      version: 1, status: 'confirmed', outputKey: `step${input.conversationStep}.execution-ready`,
      outputJson: { solution: 'Piloto acotado', measurementPlan: 'Comparar baseline y señal observada', synthesis: 'Prueba lista para ejecución controlada' },
      confirmedById: ownerId, confirmedAt: new Date('2026-10-28T08:30:00.000Z'),
    } });
  }

  const sessionId = `${input.id}-session-${input.conversationStep}`;
  await prisma.stepReasoningSession.create({ data: { id: sessionId, organizationId, projectId: input.id, cycleId, stepNumber: input.conversationStep, createdById: ownerId, lastContextHash: hash } });
  await prisma.stepReasoningTurn.create({ data: {
    id: `${input.id}-turn`, sessionId, clientTurnId: `00000000-0000-4000-8000-${input.conversationStep.toString().padStart(12, '0')}`,
    actorId: ownerId, inputText: `Contexto conversacional conservado para Step ${input.conversationStep}.`, sourceContextHash: hash,
    contextSnapshotJson: { qa: true, synthetic: true }, status: 'SUCCEEDED', assistantText: 'Historial sintético persistido; no confirma el Adaptive Core.',
    structuredOutputJson: { suggestions: [], warnings: ['QA stub'] }, executionMode: 'qa_stub', requestId: `${input.id}-request`,
    providerModel: 'qa-stub/mvp-chat02', promptVersion: 'steps/reasoning/v0.1', promptHash: 'sha256:fixture', completedAt: new Date(),
  } });
  return { cycleId };
}

async function main() {
  assert.equal(await prisma.organization.count({ where: { id: organizationId } }), 1, 'Run CHAT-01 disposable fixtures first.');
  await prisma.user.update({ where: { id: ownerId }, data: {
    passwordHash: await bcrypt.hash('demo123', 10), role: Role.portfolio_lead, roles: [Role.portfolio_lead], isActive: true, failedLoginAttempts: 0, lockedUntil: null,
  } });

  await createProject({ id: 'mvp-chat02-step2-completed', name: 'Prueba comercial confirmada', currentStep: 3, conversationStep: 2, output: true });
  await createProject({ id: 'mvp-chat02-historical-no-output', name: 'Histórico honesto sin output', currentStep: 2, conversationStep: 1 });

  const front = await prisma.strategicFront.create({ data: {
    id: 'mvp-chat02-front', name: 'Crecimiento verificable', strategicObjective: 'Mejorar activación sin fabricar evidencia', mainKpi: 'Activación', baseline: '20 %', target: '30 %', horizon: 'Q4', organizationId, ownerId, status: 'active',
  } });
  const challenge = await prisma.challenge.create({ data: {
    id: 'mvp-chat02-challenge', strategicFrontId: front.id, title: 'Validar activación comercial', objective: 'Identificar una señal repetible', status: 'activo_interno', challengeOwner: 'MVP-CHAT-02 Owner QA', ownerId,
  } });
  await prisma.initiativePortfolioMeta.create({ data: {
    id: 'mvp-chat02-meta', projectId: 'mvp-chat02-step2-completed', challengeId: challenge.id, strategicFrontId: front.id,
    currentStep: '3', status: 'en_step_3', estimatedContribution: 'medio', nextActionRecommended: 'Continuar ejecución controlada',
  } });
  const bootstrap = await prisma.portfolioBootstrapSession.create({ data: {
    id: 'mvp-chat02-bootstrap', userId: ownerId, organizationId, setupCompletedAt: new Date('2026-10-28T08:00:00.000Z'), setupCompletedByActorId: ownerId,
  } });
  const proposal = await prisma.portfolioOrganizationProposal.create({ data: {
    id: 'mvp-chat02-organization-proposal', bootstrapSessionId: bootstrap.id, organizationId, version: 1,
    sourceVersion: 'mvp-chat02.synthetic.v1', payloadHash: 'sha256:chat02-synthetic', payload: { fronts: [front.id] }, sourceRefs: [], provenance: { qa: true, synthetic: true }, reviewedBy: ownerId,
  } });
  await prisma.portfolioOrganizationMaterialization.create({ data: {
    id: 'mvp-chat02-organization-materialization', proposalId: proposal.id, bootstrapSessionId: bootstrap.id, organizationId,
    proposalVersion: 1, approvalFingerprint: 'sha256:chat02-approved', idempotencyKey: 'mvp-chat02-materialization-v1', canonicalMappings: { strategicFrontId: front.id, challengeId: challenge.id }, confirmedBy: ownerId,
  } });

  console.log(JSON.stringify({ database: `${parsed.hostname}:${parsed.port}${parsed.pathname}`, migration68Applied: false, owner: { email: 'mvp-chat01.owner@starteria.test', password: 'demo123' }, projects: ['mvp-chat01-step0', 'mvp-chat01-step2', 'mvp-chat01-step4', 'mvp-chat02-step2-completed', 'mvp-chat02-historical-no-output'] }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
