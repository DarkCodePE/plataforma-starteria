import assert from 'node:assert/strict';
import { EvidenceStatus, EvidenceType, PrismaClient, SourceRefType, TruthEvidenceStatus } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  || parsed.port !== '55433'
  || parsed.pathname !== '/starteria_e2e') {
  throw new Error('STEPS-UX03 fixture refuses to run outside localhost:55433/starteria_e2e.');
}

const prisma = new PrismaClient();
const projectId = 'steps-ux03-continuous';
const ownerId = 'mvp-chat01-owner';
const organizationId = 'mvp-chat01-org';
const cycleId = `${projectId}-cycle`;
const configurationId = `${projectId}-config-2`;

const checkpoints = [
  { id: 'ux03-cp-21', step: 2, code: 'CP-2.1', title: 'Criterios de diseño', status: 'in_progress', outputKey: 'DesignCriteria', questions: [], completionCriteria: ['Criterios explícitos'] },
  { id: 'ux03-cp-22', step: 2, code: 'CP-2.2', title: 'Alternativas', status: 'locked', outputKey: 'AlternativeSet', questions: [], completionCriteria: ['Alternativas comparables'] },
  { id: 'ux03-cp-23', step: 2, code: 'CP-2.3', title: 'Apuesta elegida', status: 'locked', outputKey: 'SelectedBet', questions: [], completionCriteria: ['Apuesta y plan B'] },
  { id: 'ux03-cp-24', step: 2, code: 'CP-2.4', title: 'Diseño de la prueba', status: 'locked', outputKey: 'ExecutionDesign', questions: [], completionCriteria: ['Prueba medible'] },
  { id: 'ux03-cp-25', step: 2, code: 'CP-2.5', title: 'Preparación', status: 'locked', outputKey: 'ReadinessCheck', questions: [], completionCriteria: ['Readiness explícito'] },
];

async function main() {
  assert.equal(await prisma.organization.count({ where: { id: organizationId } }), 1, 'Run CHAT-01 disposable fixtures first.');
  assert.equal(await prisma.user.count({ where: { id: ownerId } }), 1, 'CHAT-01 Owner is required.');
  if (await prisma.project.count({ where: { id: projectId } })) {
    await prisma.stepReasoningTurn.deleteMany({ where: { session: { projectId } } });
    await prisma.stepReasoningSession.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } });
  }

  await prisma.project.create({ data: {
    id: projectId,
    name: 'Continuidad UX03 verificable',
    description: 'Escenario sintético descartable para probar una transición canónica continua.',
    ownerId,
    organizationId,
    status: 'IN_PROGRESS',
    currentStep: 2,
    step0Status: 'COMPLETED',
    step0Data: { synthetic: true, objective: 'Probar continuidad sin alterar QA protegida.' },
    teamMembers: { create: { userId: ownerId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date(), modulePermissions: [] } },
    steps: { create: [
      { number: 1, name: 'Comprender', status: 'APPROVED', progress: 100 },
      { number: 2, name: 'Preparar una prueba', status: 'IN_PROGRESS', progress: 0 },
      { number: 3, name: 'Ejecutar y aprender', status: 'BLOCKED', progress: 0 },
      { number: 4, name: 'Preparar decisión', status: 'BLOCKED', progress: 0 },
    ] },
  } });
  await prisma.sourceRef.create({ data: {
    id: 'steps-ux03-source',
    projectId,
    sourceType: SourceRefType.USER_INPUT,
    reference: 'steps-ux03://synthetic/design-source',
    originActorId: ownerId,
    originActorType: 'human',
    metadataJson: { qa: true, synthetic: true },
  } });
  await prisma.evidence.create({ data: {
    id: 'steps-ux03-evidence',
    projectId,
    name: 'Evidencia sintética de alternativas UX03',
    type: EvidenceType.OTHER,
    stepRef: 2,
    ownerId,
    status: EvidenceStatus.UPLOADED,
    sourceRefId: 'steps-ux03-source',
    truthStatus: TruthEvidenceStatus.supports,
    provenance: { qa: true, synthetic: true },
  } });
  await prisma.initiativeCycle.create({ data: { id: cycleId, projectId, cycleNumber: 1, startStep: 0, currentStep: 2, status: 'active' } });
  await prisma.adaptiveStepConfiguration.create({ data: {
    id: configurationId,
    projectId,
    cycleId,
    stepNumber: 2,
    version: 1,
    status: 'active',
    routeType: 'explore_validate',
    depthLevel: 'standard',
    maturity: 'definition',
    configurationJson: {
      id: 'step-2-ux03-v1',
      step: 2,
      version: 1,
      visibleName: 'Preparar una prueba',
      objective: 'Preparar una prueba ejecutable y acordar de antemano cómo se medirá.',
      expectedOutput: 'Prueba preparada con medición y criterios go/no-go',
      routeType: 'explore_validate',
      depthLevel: 'standard',
      maturity: 'definition',
      checkpoints,
    },
    sourceContextJson: { mandate: 'Validar una transición UX03 con datos sintéticos.', synthetic: true },
  } });
  await prisma.adaptiveCheckpointInstance.create({ data: {
    id: `${projectId}-checkpoint-21`,
    projectId,
    cycleId,
    stepConfigurationId: configurationId,
    stepNumber: 2,
    checkpointKey: 'CP-2.1',
    sequence: 1,
    status: 'in_progress',
    materializedQuestionsJson: [],
  } });
  const sessionId = `${projectId}-session-2`;
  await prisma.stepReasoningSession.create({ data: {
    id: sessionId,
    organizationId,
    projectId,
    cycleId,
    stepNumber: 2,
    createdById: ownerId,
    lastContextHash: `sha256:${'e'.repeat(64)}`,
  } });
  await prisma.stepReasoningTurn.create({ data: {
    id: `${projectId}-turn`,
    sessionId,
    clientTurnId: '00000000-0000-4000-8000-000000000203',
    actorId: ownerId,
    inputText: 'Necesito preparar una prueba medible sin inventar resultados.',
    sourceContextHash: `sha256:${'e'.repeat(64)}`,
    contextSnapshotJson: { qa: true, synthetic: true },
    status: 'SUCCEEDED',
    assistantText: 'Historial sintético persistido; revisa los criterios canónicos antes de confirmar.',
    structuredOutputJson: { suggestions: [], warnings: ['QA stub'] },
    executionMode: 'qa_stub',
    requestId: `${projectId}-request`,
    providerModel: 'qa-stub/steps-ux03',
    promptVersion: 'steps/reasoning/v0.1',
    promptHash: 'sha256:fixture',
    completedAt: new Date(),
  } });

  console.log(JSON.stringify({ database: `${parsed.hostname}:${parsed.port}${parsed.pathname}`, projectId, cycleId, ownerId, activeCheckpoint: 'CP-2.1', synthetic: true }, null, 2));
}

main().finally(async () => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
