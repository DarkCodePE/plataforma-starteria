import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { AdaptiveCoreService } from '../modules/adaptive-core/adaptive-core.service';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsed = new URL(databaseUrl);

if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  || parsed.port !== '55437'
  || parsed.pathname !== '/starteria_e2e') {
  throw new Error('MVP-LITE01 fixture refuses to run outside localhost:55437/starteria_e2e.');
}

const prisma = new PrismaClient();
const adaptive = new AdaptiveCoreService(prisma);
const ids = {
  organization: 'mvp-lite01-org',
  owner: 'mvp-lite01-owner',
  project: 'mvp-lite01-step0',
};

async function main() {
  assert.equal(await prisma.project.count({ where: { id: ids.project } }), 0, 'Recreate the disposable database before rerunning this fixture.');

  await prisma.organization.create({
    data: { id: ids.organization, name: 'MVP-LITE01 QA sintético', slug: 'mvp-lite01-qa-sintetico' },
  });
  await prisma.user.create({
    data: {
      id: ids.owner,
      email: 'mvp-lite01.owner@starteria.test',
      name: 'MVP-LITE01 Owner QA',
      role: 'participante',
      roles: ['participante'],
      initials: 'ML',
      skills: [],
      organizationId: ids.organization,
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId: ids.organization, userId: ids.owner, role: 'owner' },
  });
  await prisma.project.create({
    data: {
      id: ids.project,
      name: 'Reducir el retrabajo de activación comercial',
      description: 'Escenario sintético y descartable para validar misión, Copilot Step 0 y persistencia conversacional.',
      ownerId: ids.owner,
      organizationId: ids.organization,
      status: 'IN_PROGRESS',
      currentStep: 0,
      step0Status: 'IN_PROGRESS',
      step0Data: {
        challengeType: 'operational',
        contextInitial: 'Los equipos repiten el traspaso de contexto antes de activar cada oportunidad.',
        initialFocus: 'Delimitar un ciclo pequeño y una decisión observable.',
        expectedImpact: 'Reducir el retrabajo sin ampliar el alcance del MVP.',
        mainRisk: 'Confundir una propuesta del Copilot con una confirmación humana.',
      },
      teamMembers: {
        create: {
          userId: ids.owner,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
          modulePermissions: [],
        },
      },
      steps: {
        create: [
          { number: 1, name: 'Establecer verdad y foco', status: 'NOT_STARTED', progress: 0 },
          { number: 2, name: 'Preparar el entregable', status: 'BLOCKED', progress: 0 },
          { number: 3, name: 'Ejecutar y aprender', status: 'BLOCKED', progress: 0 },
          { number: 4, name: 'Preparar la decisión', status: 'BLOCKED', progress: 0 },
        ],
      },
    },
  });

  const activation = await adaptive.activateInitiativeCycle(ids.project, ids.owner, 'participante', {
    idempotencyKey: 'mvp-lite01-step0-activate-v1',
    expectedVersion: 0,
    origin: { kind: 'DIRECT_PROJECT' },
  });

  console.log(JSON.stringify({ ids, activation: activation.activation, state: {
    cycle: activation.state.cycle,
    activeCheckpoint: activation.state.activeCheckpoint,
    configurationCount: activation.state.stepConfigurations.length,
    outputCount: activation.state.stepOutputs.length,
  } }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect());
