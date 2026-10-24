import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PortfolioEntrySessionService } from '../../portfolio-entry-sessions/application/portfolio-entry-session.service';
import { PrismaPortfolioEntrySessionRepository } from '../../portfolio-entry-sessions/infrastructure/prisma-portfolio-entry-session.repository';
import { PrismaCriticalHandoffGenerationRepository } from '../infrastructure/prisma-critical-handoff-generation.repository';

const describeIntegration = process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1' ? describe : describe.skip;
if (process.env.PORTFOLIO_ENTRY_DB_INTEGRATION === '1') {
  const databaseURL = process.env.DATABASE_URL;
  let database: URL | undefined;
  try { database = databaseURL ? new URL(databaseURL) : undefined; } catch { database = undefined; }
  if (!database || database.pathname !== '/starteria_e2e' || !['localhost', '127.0.0.1'].includes(database.hostname)) {
    throw new Error('Portfolio Entry Prisma integration tests require the disposable starteria_e2e database on localhost.');
  }
}

const prisma = new PrismaClient();
const repository = new PrismaCriticalHandoffGenerationRepository(prisma);
const sessions = new PrismaPortfolioEntrySessionRepository(prisma);
const versioning = { contractVersion: 'portfolio-entry-contract-v0.1', runtimeVersion: 'portfolio-entry-runtime-v0.2', schemaVersion: 'portfolio-entry-schema-v0.2', promptManifestId: 'portfolio-entry-prompts-v0.2' };
const createdSessionIds = new Set<string>();

describeIntegration('PrismaCriticalHandoffGenerationRepository', () => {
  afterEach(async () => {
    if (createdSessionIds.size) await prisma.portfolioEntrySession.deleteMany({ where: { id: { in: [...createdSessionIds] } } });
    createdSessionIds.clear();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('uses the unique key and database CAS to allow one concurrent claim and reclaim stale work', async () => {
    const service = new PortfolioEntrySessionService(sessions, { ttlMs: 60_000, versioning });
    const created = await service.createAnonymousSession({ rawEntry: 'Contexto de prueba para la conclusión.', entryOrigin: 'public_start' });
    createdSessionIds.add(created.session.id);
    const startedAt = new Date('2026-10-24T12:00:00.000Z');
    const input = { sessionId: created.session.id, sourceContextRevision: 1, expectedSessionRevision: 2, now: startedAt, maxDurationMs: 180_000 };

    const claims = await Promise.all([repository.claim(input), repository.claim(input)]);

    expect(claims.filter((claim) => claim.claimed)).toHaveLength(1);
    expect(claims[0].generation.id).toBe(claims[1].generation.id);
    const retry = await repository.claim({ ...input, now: new Date(startedAt.getTime() + 180_001) });
    expect(retry).toMatchObject({ claimed: true, generation: { status: 'GENERATING', attempt: 2 } });
  });
});
