import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../modules/adaptive-core/adaptive-core.service';
import { TruthService } from '../modules/truth/truth.service';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsedDatabaseUrl = new URL(databaseUrl);

const allowedFixtureHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

if (!allowedFixtureHosts.has(parsedDatabaseUrl.hostname) || parsedDatabaseUrl.port !== '55437' || parsedDatabaseUrl.pathname !== '/starteria_e2e') {
  throw new Error('DATA-02 fixture refuses to run outside localhost:55437/starteria_e2e.');
}

const prisma = new PrismaClient();
const adaptive = new AdaptiveCoreService(prisma);
const truth = new TruthService(prisma);
const projectId = 'data02-synthetic-canonical-b';
const ownerId = 'data02-owner-b';
const validatorId = 'data02-validator-b';
const otherUserId = 'data02-other-tenant';
const organizationId = 'data02-org-b';
const otherOrganizationId = 'data02-org-other';
const actor = { id: ownerId, role: 'participante' as const };

async function snapshot() {
  const [
    project,
    steps,
    cycles,
    configurations,
    checkpoints,
    responses,
    outputs,
    sourceRefs,
    claims,
    evidence,
    validations,
    sessions,
  ] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true, currentStep: true, step0Status: true, lastModified: true } }),
    prisma.step.findMany({ where: { projectId }, orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, progress: true, stepData: true, updatedAt: true } }),
    prisma.initiativeCycle.count({ where: { projectId } }),
    prisma.adaptiveStepConfiguration.count({ where: { projectId } }),
    prisma.adaptiveCheckpointInstance.count({ where: { projectId } }),
    prisma.adaptiveCheckpointResponse.count({ where: { projectId } }),
    prisma.adaptiveStepOutput.count({ where: { projectId } }),
    prisma.sourceRef.count({ where: { projectId } }),
    prisma.truthClaim.count({ where: { projectId } }),
    prisma.evidence.count({ where: { projectId } }),
    prisma.truthValidation.count({ where: { projectId } }),
    prisma.stepReasoningSession.count({ where: { projectId } }),
  ]);
  return { project, steps, cycles, configurations, checkpoints, responses, outputs, sourceRefs, claims, evidence, validations, sessions };
}

async function main() {
  assert.equal(await prisma.project.count({ where: { id: projectId } }), 0, 'Scenario B already exists; recreate the disposable database.');

  await prisma.organization.createMany({
    data: [
      { id: organizationId, name: 'DATA-02 QA sintético', slug: 'data02-qa-sintetico' },
      { id: otherOrganizationId, name: 'DATA-02 otro tenant', slug: 'data02-otro-tenant' },
    ],
  });
  await prisma.user.createMany({
    data: [
      { id: ownerId, email: 'data02.owner@starteria.test', name: 'DATA-02 Owner QA', role: 'participante', roles: ['participante'], initials: 'D2', skills: [], organizationId },
      { id: validatorId, email: 'data02.validator@starteria.test', name: 'DATA-02 Validator QA', role: 'mentor', roles: ['mentor'], initials: 'DV', skills: [], organizationId },
      { id: otherUserId, email: 'data02.other@starteria.test', name: 'DATA-02 Other Tenant', role: 'viewer', roles: ['viewer'], initials: 'OT', skills: [], organizationId: otherOrganizationId },
    ],
  });
  await prisma.organizationMember.createMany({
    data: [
      { organizationId, userId: ownerId, role: 'owner' },
      { organizationId, userId: validatorId, role: 'member' },
      { organizationId: otherOrganizationId, userId: otherUserId, role: 'owner' },
    ],
  });
  await prisma.project.create({
    data: {
      id: projectId,
      name: 'QA sintético · continuidad canónica reconstruida',
      description: 'Escenario DATA-02 sintético. No representa evidencia empresarial.',
      ownerId,
      organizationId,
      status: 'IN_PROGRESS',
      step0Status: 'IN_PROGRESS',
      step0Data: {
        challengeType: 'operational',
        contextInitial: 'Iniciativa existente importada para reconstrucción documental controlada.',
        initialFocus: 'Reconstruir el contexto, ownership y supuestos de una iniciativa existente.',
        expectedImpact: 'Continuidad verificable sin atribuir resultados retrospectivos.',
        mainRisk: 'Confundir avance previo con evidencia confirmada.',
        pendingQuestions: [{ question: '¿Qué soporte verificable permite continuar?' }],
        nextRecommendedStep: 'Reconstruir contexto y validar soporte.',
      },
    },
  });
  await prisma.teamMember.createMany({
    data: [
      { projectId, userId: ownerId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date(), modulePermissions: [] },
      { projectId, userId: validatorId, role: 'EDITOR', status: 'ACTIVE', joinedAt: new Date(), modulePermissions: [] },
    ],
  });
  await prisma.step.createMany({
    data: [
      { projectId, number: 1, name: 'Claridad en el desafío', status: 'NOT_STARTED', progress: 0 },
      { projectId, number: 2, name: 'Diseñar solución', status: 'BLOCKED', progress: 0 },
      { projectId, number: 3, name: 'Probar en pequeño', status: 'BLOCKED', progress: 0 },
      { projectId, number: 4, name: 'Contar la historia', status: 'BLOCKED', progress: 0 },
    ],
  });

  // SEC-02B made cycle activation an explicit, authorized and idempotent command.
  // This fixture runs only in the guarded disposable database above.
  await adaptive.activateInitiativeCycle(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-activate-v1',
    expectedVersion: 0,
    origin: { kind: 'DIRECT_PROJECT' },
  });

  await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp01',
    checkpointKey: 'CP-0.1',
    responses: { objective: 'Reconstruir una iniciativa existente sin inventar resultados.', challengeType: 'operational' },
  });
  await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp02',
    checkpointKey: 'CP-0.2',
    responses: { scope: 'Equipo de operaciones QA', owner_and_actor_required: 'Owner QA autorizado' },
  });
  const step0DraftState = await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp03',
    checkpointKey: 'CP-0.3',
    responses: { priorityHypothesis: 'La reconstrucción trazable reduce ambigüedad.', decisionCriteria: 'Fuente, actor y decisión quedan verificables.' },
  });
  const step0Draft = step0DraftState.stepOutputs.find((output) => output.step === 0);
  assert.equal(step0Draft?.status, 'draft');
  await adaptive.confirmStep0Brief(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-step0-confirm',
    brief: step0Draft?.output as Record<string, unknown>,
    confirmed: true,
  });

  await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp11',
    checkpointKey: 'CP-1.1',
    responses: {
      mainHypothesis: 'El contexto reconstruido permite una decisión de continuidad responsable.',
      criticalAssumption: 'Las fuentes conservan procedencia verificable.',
      learningQuestion: '¿La evidencia disponible soporta continuar al diseño?',
      riskOfBeingWrong: 'Avanzar con una interpretación retrospectiva falsa.',
      dependentDecision: 'Activar Step 2 sólo tras soporte humano validado.',
    },
  });
  await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp12',
    checkpointKey: 'CP-1.2',
    responses: {
      methods: ['revisión documental', 'contraste con owner QA'],
      sourcesAndActors: ['Registro sintético QA', 'Owner QA autorizado'],
      responsibleAndDates: ['Owner QA - 2026-10-27'],
      expectedEvidenceAndSufficiency: 'Una fuente enlazada, evidencia coherente y validación humana.',
    },
  });

  const source = await truth.createSourceRef({
    projectId,
    sourceType: 'USER_INPUT',
    reference: 'data02://qa-synthetic/source-1',
  }, actor);
  const claim = await truth.createClaim({
    projectId,
    subjectType: 'initiative',
    subjectId: projectId,
    claimType: 'hypothesis',
    statement: 'El escenario sintético dispone de soporte suficiente para validar la continuidad.',
    createdByType: 'human',
    sourceRefIds: [],
  }, actor);
  const evidence = await truth.attachEvidence({
    projectId,
    targetClaimId: claim.id,
    sourceRefId: source.id,
    name: 'Evidencia sintética DATA-02',
    evidenceType: 'OTHER',
    truthStatus: 'supports',
    stepRef: 1,
    provenance: { environment: 'QA disposable', synthetic: true, goal: 'MVP-DATA-02' },
  }, actor);
  await truth.recordValidation({
    projectId,
    claimId: claim.id,
    evidenceId: evidence.id,
    result: 'supported',
    validatorType: 'human',
    validatorRole: 'mentor',
    rationale: 'Validación humana QA del escenario sintético; no es evidencia empresarial.',
  }, { id: validatorId, role: 'mentor' });

  await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp13',
    checkpointKey: 'CP-1.3',
    responses: {
      evidenceItems: [{ id: evidence.id, summary: 'Soporte sintético enlazado y validado.', classification: 'supports', sourceRefs: [source.id] }],
      evidenceClassifications: ['supports'],
      sourceRefs: [source.id],
    },
    truthBindings: { claimId: claim.id, evidenceIds: [evidence.id], sourceRefIds: [source.id] },
  });
  const step1DraftState = await adaptive.confirmCheckpoint(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-cp14',
    checkpointKey: 'CP-1.4',
    responses: {
      synthesis: 'La evidencia sintética soporta continuar sin atribuir resultados reales.',
      updatedFocusAndHypothesis: 'Diseñar continuidad sobre contexto reconstruido y trazable.',
      continuityDecision: 'mantener',
    },
  });
  const step1Draft = step1DraftState.stepOutputs.find((output) => output.step === 1);
  assert.equal(step1Draft?.status, 'draft');
  await adaptive.confirmStep1Output(projectId, ownerId, 'participante', {
    idempotencyKey: 'data02-b-step1-confirm',
    brief: step1Draft?.output as Record<string, unknown>,
    confirmed: true,
  });

  const beforeReads = await snapshot();
  const firstRead = await adaptive.getState(projectId, ownerId, 'participante');
  const secondRead = await adaptive.getState(projectId, ownerId, 'participante');
  const afterReads = await snapshot();

  assert.deepEqual(afterReads, beforeReads, 'Repeated reads changed canonical state.');
  assert.equal(firstRead.cycle.currentStep, 2);
  assert.equal(secondRead.activeCheckpoint?.checkpointKey, 'CP-2.1');
  assert.equal(firstRead.stepConfigurations.find((configuration) => configuration.step === 2)?.routeType, 'reconstruct_existing');

  const confirmedOutputs = await prisma.adaptiveStepOutput.findMany({
    where: { projectId, status: 'confirmed', stepNumber: { in: [0, 1] } },
    orderBy: { stepNumber: 'asc' },
    select: { stepNumber: true, version: true, status: true, sourceConfigurationId: true, requiresReview: true, confirmedAt: true },
  });
  assert.deepEqual(confirmedOutputs.map((output) => output.stepNumber), [0, 1]);
  assert.ok(confirmedOutputs.every((output) => output.version === 1 && output.sourceConfigurationId && output.confirmedAt));
  assert.equal(await prisma.adaptiveCheckpointInstance.count({ where: { projectId, checkpointKey: 'CP-2.1' } }), 1);
  await assert.rejects(() => adaptive.getState(projectId, otherUserId, 'viewer'), (error: unknown) => {
    return typeof error === 'object'
      && error !== null
      && 'statusCode' in error
      && [403, 404].includes((error as { statusCode: number }).statusCode);
  });

  console.log(JSON.stringify({
    database: `${parsedDatabaseUrl.hostname}:${parsedDatabaseUrl.port}${parsedDatabaseUrl.pathname}`,
    projectId,
    synthetic: true,
    routeType: firstRead.stepConfigurations.find((configuration) => configuration.step === 2)?.routeType,
    depthLevel: firstRead.stepConfigurations.find((configuration) => configuration.step === 2)?.depthLevel,
    maturity: firstRead.stepConfigurations.find((configuration) => configuration.step === 2)?.maturity,
    cycle: firstRead.cycle,
    activeCheckpoint: firstRead.activeCheckpoint?.checkpointKey,
    confirmedOutputs,
    counts: afterReads,
    repeatedReadStable: true,
    foreignTenantReadDenied: true,
  }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
