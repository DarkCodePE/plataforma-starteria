import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.KAN180_ACCEPTANCE_DATABASE_URL;
if (!databaseUrl) throw new Error('KAN180_ACCEPTANCE_DATABASE_URL is required');

async function main(): Promise<void> {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const [sent, created, projectedAssignments, completed, fronts, projects, attempts] = await Promise.all([
      prisma.portfolioHandoffAssignment.count({ where: { organizationId: 'pl06b-e2e-org', state: 'SENT' } }),
      prisma.portfolioHandoffAssignment.count({ where: { organizationId: 'pl06b-e2e-org', state: 'CREATED' } }),
      prisma.portfolioHandoffProjection.count({ where: { organizationId: 'pl06b-e2e-org' } }),
      prisma.portfolioBootstrapSession.count({ where: { id: 'pl06b-e2e-bootstrap', setupCompletedAt: { not: null } } }),
      prisma.strategicFront.count({ where: { organizationId: 'pl06b-e2e-org' } }),
      prisma.initiativePortfolioMeta.count({ where: { project: { organizationId: 'pl06b-e2e-org' } } }),
      prisma.portfolioHandoffDeliveryAttempt.count({ where: { assignment: { organizationId: 'pl06b-e2e-org' }, status: 'SUCCEEDED' } }),
    ]);
    const result = { sent, created, projectedAssignments, completed, fronts, projects, successfulDeliveryAttempts: attempts };
    if (sent !== 2 || created !== 2 || projectedAssignments !== 4 || completed !== 1 || fronts < 1 || projects !== 2 || attempts < 2) {
      throw new Error(`KAN-180 acceptance database mismatch: ${JSON.stringify(result)}`);
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
