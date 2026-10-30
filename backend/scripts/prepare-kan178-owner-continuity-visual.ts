import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { hashRefreshToken } from '../modules/auth/token.service';

const databaseUrl = process.env.DATABASE_URL ?? '';
const isOriginalKan178Database = databaseUrl.includes('127.0.0.1:55450/starteria_kan178_continuity');
const isMvpIntegrationDatabase = process.env.MVP_INT01_QA === '1'
  && databaseUrl.includes('127.0.0.1:55436/postgres');
if (!isOriginalKan178Database && !isMvpIntegrationDatabase) {
  throw new Error('KAN-178 visual fixtures require the isolated KAN-178 or MVP-INT-01 QA database.');
}
const password = process.env.KAN178_E2E_PASSWORD;
if (!password) throw new Error('KAN178_E2E_PASSWORD is required.');

const prisma = new PrismaClient();
const invitations = [
  { id: 'kan178-ready-invitation', assignmentId: 'kan178-assignment-ready', token: 'kan178-owner-ready-invitation-token-0000000000000000000000000001' },
  { id: 'kan178-activation-invitation', assignmentId: 'kan178-assignment-activation', token: 'kan178-owner-activation-token-000000000000000000000000000002' },
  { id: 'kan178-challenge-invitation', assignmentId: 'kan178-assignment-challenge', token: 'kan178-owner-challenge-token-0000000000000000000000000000003' },
];

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: 'kan178-owner' }, select: { id: true } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { passwordHash: await bcrypt.hash(password, 10), isActive: true, failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.project.update({ where: { id: 'kan178-project-ready' }, data: { currentStep: 2, step0Status: 'COMPLETED' } });
  await prisma.step.update({ where: { projectId_number: { projectId: 'kan178-project-ready', number: 1 } }, data: { status: 'APPROVED', progress: 100 } });
  await prisma.step.update({ where: { projectId_number: { projectId: 'kan178-project-ready', number: 2 } }, data: { status: 'IN_PROGRESS' } });
  const cycle = await prisma.initiativeCycle.upsert({
    where: { projectId_cycleNumber: { projectId: 'kan178-project-ready', cycleNumber: 1 } },
    update: { currentStep: 2, status: 'active' },
    create: { id: 'kan178-ready-cycle', projectId: 'kan178-project-ready', cycleNumber: 1, startStep: 0, currentStep: 2, status: 'active' },
  });
  for (const state of [
    { stepNumber: 0, state: 'confirmed' as const },
    { stepNumber: 1, state: 'confirmed' as const },
    { stepNumber: 2, state: 'active' as const },
  ]) {
    await prisma.cycleStepState.upsert({
      where: { cycleId_stepNumber: { cycleId: cycle.id, stepNumber: state.stepNumber } },
      update: { state: state.state },
      create: { cycleId: cycle.id, stepNumber: state.stepNumber, state: state.state },
    });
  }
  await prisma.adaptiveStepConfiguration.upsert({
    where: { cycleId_stepNumber_version: { cycleId: cycle.id, stepNumber: 2, version: 1 } },
    update: {
      projectId: 'kan178-project-ready', status: 'active', routeType: 'explore_validate', depthLevel: 'standard', maturity: 'execution',
      configurationJson: { step: 2, visibleName: 'Diseñar apuesta y experimento', stablePurpose: 'Continuar desde el estado real', shortTitle: 'Diseñar apuesta', description: 'Continuar desde el estado real', objective: 'Retomar trabajo persistido', expectedOutput: 'Apuesta validable', nextAction: 'Continuar Step 2', checkpoints: [] },
      sourceContextJson: {},
    },
    create: {
      projectId: 'kan178-project-ready', cycleId: cycle.id, stepNumber: 2, version: 1, status: 'active',
      routeType: 'explore_validate', depthLevel: 'standard', maturity: 'execution',
      configurationJson: { step: 2, visibleName: 'Diseñar apuesta y experimento', stablePurpose: 'Continuar desde el estado real', shortTitle: 'Diseñar apuesta', description: 'Continuar desde el estado real', objective: 'Retomar trabajo persistido', expectedOutput: 'Apuesta validable', nextAction: 'Continuar Step 2', checkpoints: [] },
      sourceContextJson: {},
    },
  });
  await prisma.adaptiveProgressSignal.upsert({
    where: { projectId: 'kan178-project-ready' },
    update: { cycleId: cycle.id, stepNumber: 2, health: 'in_progress', signalJson: { step: 2, health: 'in_progress', summary: 'Continuar Step 2', nextAction: 'Continuar Step 2' } },
    create: { id: 'kan178-ready-signal', projectId: 'kan178-project-ready', cycleId: cycle.id, stepNumber: 2, health: 'in_progress', signalJson: { step: 2, health: 'in_progress', summary: 'Continuar Step 2', nextAction: 'Continuar Step 2' } },
  });
  await prisma.adaptiveCheckpointInstance.updateMany({
    where: { projectId: 'kan178-project-ready', status: { in: ['ready', 'in_progress'] } },
    data: { status: 'completed', completedAt: new Date() },
  });
  await prisma.user.update({
    where: { id: 'kan178-lead' },
    data: { passwordHash: await bcrypt.hash(password, 10), isActive: true, failedLoginAttempts: 0, lockedUntil: null },
  });
  for (const invitation of invitations) {
    const assignment = await prisma.portfolioHandoffAssignment.findUniqueOrThrow({ where: { id: invitation.assignmentId }, select: { state: true } });
    if (assignment.state !== 'STARTED') throw new Error(`Assignment ${invitation.assignmentId} must already be STARTED.`);
    await prisma.portfolioHandoffInvitation.upsert({
      where: { id: invitation.id },
      update: { tokenHash: hashRefreshToken(invitation.token), claimedByUserId: owner.id, claimedAt: new Date(), revokedAt: null, expiresAt: null },
      create: { id: invitation.id, assignmentId: invitation.assignmentId, tokenHash: hashRefreshToken(invitation.token), claimedByUserId: owner.id, claimedAt: new Date() },
    });
  }
  const [assignments, projects, steps, operationalConfig, operationalSignal] = await Promise.all([
    prisma.portfolioHandoffAssignment.count({ where: { id: { in: invitations.map((item) => item.assignmentId) }, state: 'STARTED' } }),
    prisma.project.count({ where: { id: { startsWith: 'kan178-project-' } } }),
    prisma.step.count({ where: { projectId: { startsWith: 'kan178-project-' } } }),
    prisma.adaptiveStepConfiguration.findUnique({ where: { cycleId_stepNumber_version: { cycleId: cycle.id, stepNumber: 2, version: 1 } }, select: { cycleId: true, stepNumber: true, status: true } }),
    prisma.adaptiveProgressSignal.findUnique({ where: { projectId: 'kan178-project-ready' }, select: { cycleId: true, stepNumber: true, signalJson: true } }),
  ]);
  const signalStep = operationalSignal?.signalJson && typeof operationalSignal.signalJson === 'object' && !Array.isArray(operationalSignal.signalJson)
    ? (operationalSignal.signalJson as Record<string, unknown>).step
    : null;
  if (assignments !== 3 || projects !== 3 || steps !== 5 || operationalConfig?.stepNumber !== 2 || operationalSignal?.stepNumber !== 2 || signalStep !== 2) {
    throw new Error('KAN-178 visual fixture integrity check failed.');
  }
  console.log(`KAN178_VISUAL_FIXTURES_READY assignments=3 projects=3 steps=5 operationalStep=${signalStep} cycle=${cycle.id} database=${isMvpIntegrationDatabase ? 'mvp_int01_qa' : 'starteria_kan178_continuity'}`);
}

async function inspect() {
  const [cycles, configs, signal] = await Promise.all([
    prisma.initiativeCycle.findMany({
      where: { projectId: 'kan178-project-ready' },
      select: { id: true, cycleNumber: true, currentStep: true, status: true, _count: { select: { stepConfigurations: true, progressSignals: true } } },
      orderBy: { cycleNumber: 'asc' },
    }),
    prisma.adaptiveStepConfiguration.findMany({
      where: { projectId: 'kan178-project-ready' },
      select: { cycleId: true, stepNumber: true, version: true, status: true },
      orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }],
    }),
    prisma.adaptiveProgressSignal.findUnique({
      where: { projectId: 'kan178-project-ready' },
      select: { cycleId: true, stepNumber: true, signalJson: true },
    }),
  ]);
  const signalStep = signal?.signalJson && typeof signal.signalJson === 'object' && !Array.isArray(signal.signalJson)
    ? (signal.signalJson as Record<string, unknown>).step
    : null;
  console.log(JSON.stringify({ cycles, configs, signal: signal ? { cycleId: signal.cycleId, stepNumber: signal.stepNumber, signalStep } : null }));
}

(process.argv.includes('--inspect-only') ? inspect() : main()).finally(() => prisma.$disconnect());
