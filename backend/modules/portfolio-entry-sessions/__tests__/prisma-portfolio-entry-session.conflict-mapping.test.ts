import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PortfolioEntrySessionError } from '../application/portfolio-entry-session-errors';
import { PrismaPortfolioEntrySessionRepository } from '../infrastructure/prisma-portfolio-entry-session.repository';

const confirmationInput = {
  sessionId: 'session-1',
  artifactId: 'critical-handoff-1',
  expectedArtifactVersion: 1,
  expectedContextRevision: 0,
  confirmingActorId: 'user-1',
  confirmedAt: new Date('2026-10-09T10:00:00.000Z'),
  now: new Date('2026-10-09T10:00:00.000Z'),
};

describe('Prisma Portfolio Entry session conflict mapping', () => {
  it('maps P2010 with a PostgreSQL serialization failure SQLSTATE to a domain conflict', async () => {
    const error = prismaError('P2010', {
      code: '40001',
      message: 'could not serialize access due to concurrent update',
    });

    await expect(repositoryRejectingRawQuery(error).confirmCriticalHandoff(confirmationInput))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('maps P2010 with PostgreSQL deadlock SQLSTATE to a domain conflict', async () => {
    const error = prismaError('P2010', {
      code: '40P01',
      message: 'deadlock detected',
    });

    await expect(repositoryRejectingRawQuery(error).confirmCriticalHandoff(confirmationInput))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('lets an unrelated P2010 raw-query error escape unchanged', async () => {
    const error = prismaError('P2010', { code: '42601', message: 'syntax error' });

    await expect(repositoryRejectingRawQuery(error).confirmCriticalHandoff(confirmationInput))
      .rejects.toBe(error);
  });

  it('keeps P2034 mapped to a domain conflict', async () => {
    const error = prismaError('P2034');

    await expect(repositoryRejectingTransaction(error).confirmCriticalHandoff(confirmationInput))
      .rejects.toMatchObject({ code: 'PORTFOLIO_ENTRY_SESSION_CONFLICT' });
  });

  it('passes PortfolioEntrySessionError through unchanged', async () => {
    const error = PortfolioEntrySessionError.conflict();

    await expect(repositoryRejectingRawQuery(error).confirmCriticalHandoff(confirmationInput))
      .rejects.toBe(error);
  });
});

function prismaError(code: string, meta?: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
    code,
    clientVersion: 'test',
    ...(meta ? { meta } : {}),
  });
}

function repositoryRejectingRawQuery(error: unknown): PrismaPortfolioEntrySessionRepository {
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: { $queryRaw: () => Promise<never> }) => Promise<unknown>) => {
      return callback({ $queryRaw: async () => { throw error; } });
    }),
  };
  return new PrismaPortfolioEntrySessionRepository(prisma as unknown as PrismaClient);
}

function repositoryRejectingTransaction(error: unknown): PrismaPortfolioEntrySessionRepository {
  const prisma = { $transaction: vi.fn(async () => { throw error; }) };
  return new PrismaPortfolioEntrySessionRepository(prisma as unknown as PrismaClient);
}
