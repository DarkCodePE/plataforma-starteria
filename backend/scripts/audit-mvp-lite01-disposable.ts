import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL ?? '';
const parsed = new URL(databaseUrl);

if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  || parsed.port !== '55437'
  || parsed.pathname !== '/starteria_e2e') {
  throw new Error('MVP-LITE01 audit refuses to run outside localhost:55437/starteria_e2e.');
}

const prisma = new PrismaClient();

async function main() {
  const step0Projects = await prisma.project.findMany({
    where: { currentStep: 0 },
    orderBy: { id: 'asc' },
    take: 30,
    select: {
      id: true,
      name: true,
      ownerId: true,
      organizationId: true,
      initiativeCycles: {
        where: { status: 'active' },
        select: { id: true, currentStep: true, status: true },
      },
      adaptiveStepConfigurations: {
        where: { stepNumber: 0 },
        select: { id: true, version: true },
      },
      adaptiveCheckpointInstances: {
        where: { stepNumber: 0 },
        select: { id: true, checkpointKey: true, status: true },
      },
      stepReasoningSessions: {
        select: { id: true, status: true, lastContextHash: true },
      },
    },
  });

  const migrationRows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at NULLS LAST
  `;

  console.log(JSON.stringify({
    database: `${parsed.hostname}:${parsed.port}${parsed.pathname}`,
    appliedMigrationCount: migrationRows.length,
    latestMigration: migrationRows.at(-1)?.migration_name ?? null,
    migration68Applied: migrationRows.some(row => row.migration_name === '20261027120000_ai03a_step_living_card'),
    step0Projects,
  }, null, 2));
}

main()
  .finally(async () => prisma.$disconnect());
