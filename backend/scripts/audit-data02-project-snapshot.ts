import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? '';
const projectId = process.env.DATA02_PROJECT_ID ?? '';
const parsed = new URL(databaseUrl);

const allowedAuditHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

if (!allowedAuditHosts.has(parsed.hostname) || !['55436', '55437'].includes(parsed.port) || !projectId) {
  throw new Error('DATA-02 read audit only accepts an explicit project on localhost ports 55436 or 55437.');
}

const prisma = new PrismaClient();

async function main() {
  const [
    project,
    steps,
    cycles,
    configurations,
    checkpoints,
    responses,
    outputs,
    progress,
    events,
    sourceRefs,
    claims,
    evidence,
    validations,
    sessions,
    assignments,
    portfolioMeta,
  ] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true, organizationId: true, status: true, currentStep: true, step0Status: true, lastModified: true } }),
    prisma.step.findMany({ where: { projectId }, orderBy: { number: 'asc' }, select: { id: true, number: true, status: true, progress: true, stepData: true, updatedAt: true } }),
    prisma.initiativeCycle.findMany({ where: { projectId }, orderBy: { cycleNumber: 'asc' }, select: { id: true, cycleNumber: true, startStep: true, currentStep: true, status: true, updatedAt: true } }),
    prisma.adaptiveStepConfiguration.findMany({ where: { projectId }, orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }], select: { id: true, cycleId: true, stepNumber: true, version: true, status: true, routeType: true, depthLevel: true, maturity: true, requiresReview: true, updatedAt: true } }),
    prisma.adaptiveCheckpointInstance.findMany({ where: { projectId }, orderBy: [{ stepNumber: 'asc' }, { sequence: 'asc' }], select: { id: true, cycleId: true, checkpointKey: true, stepNumber: true, status: true, sequence: true, updatedAt: true } }),
    prisma.adaptiveCheckpointResponse.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, checkpointInstanceId: true, createdAt: true } }),
    prisma.adaptiveStepOutput.findMany({ where: { projectId }, orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }], select: { id: true, cycleId: true, sourceConfigurationId: true, stepNumber: true, version: true, status: true, requiresReview: true, confirmedAt: true, updatedAt: true } }),
    prisma.adaptiveProgressSignal.findUnique({ where: { projectId }, select: { id: true, updatedAt: true } }),
    prisma.adaptiveAdaptationEvent.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, eventType: true, idempotencyKey: true, createdAt: true } }),
    prisma.sourceRef.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, sourceType: true, createdAt: true } }),
    prisma.truthClaim.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, verificationState: true, createdAt: true, updatedAt: true } }),
    prisma.evidence.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, truthStatus: true, createdAt: true, updatedAt: true } }),
    prisma.truthValidation.findMany({ where: { projectId }, orderBy: { validatedAt: 'asc' }, select: { id: true, result: true, validatorType: true, validatedAt: true } }),
    prisma.stepReasoningSession.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, stepNumber: true, status: true, updatedAt: true } }),
    prisma.portfolioHandoffAssignment.findMany({ where: { initiativeId: projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, state: true, version: true, updatedAt: true } }),
    prisma.initiativePortfolioMeta.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true, status: true, currentStep: true, updatedAt: true } }),
  ]);

  console.log(JSON.stringify({
    database: `${parsed.hostname}:${parsed.port}${parsed.pathname}`,
    project,
    steps,
    cycles,
    configurations,
    checkpoints,
    responses,
    outputs,
    progress,
    events,
    sourceRefs,
    claims,
    evidence,
    validations,
    sessions,
    assignments,
    portfolioMeta,
  }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
