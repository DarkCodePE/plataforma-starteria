import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { canClaimPortfolioEntrySession } from '../domain/portfolio-entry-session-ownership';
import {
  type ConfirmPortfolioEntryCriticalHandoffInput,
  nextCriticalHandoffArtifactVersion,
  parseCriticalHandoffPayload,
  parseCriticalHandoffLifecycle,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
  type CreatePortfolioEntryCriticalHandoffInput,
  type PortfolioEntryCriticalHandoffRecord,
} from '../domain/portfolio-entry-critical-handoff.types';
import type { PortfolioEntryConfirmation } from '../domain/portfolio-entry-confirmation.types';
import type {
  PortfolioEntryHandoffRecord,
  PortfolioEntrySession,
  PortfolioEntryTurn,
} from '../domain/portfolio-entry-session.types';
import { PortfolioEntrySessionError } from '../application/portfolio-entry-session-errors';
import type {
  ClaimPortfolioEntrySessionOwnershipInput,
  CreatePortfolioEntrySessionInput,
  PortfolioEntrySessionRepository,
  SavePortfolioEntrySessionStateInput,
} from '../application/portfolio-entry-session.repository';
import type { PortfolioEntryModelExecutionRecord } from '../observability/portfolio-entry-execution-metadata';
import {
  PrismaPortfolioEntrySessionMapper,
  type PrismaPortfolioEntryConfirmationRow,
  type PrismaPortfolioEntryCriticalHandoffRow,
  type PrismaPortfolioEntryHandoffRow,
  type PrismaPortfolioEntrySessionRow,
} from './prisma-portfolio-entry-session.mapper';

type PrismaTx = Prisma.TransactionClient;

export class PrismaPortfolioEntrySessionRepository implements PortfolioEntrySessionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly mapper = new PrismaPortfolioEntrySessionMapper(),
  ) {}

  async createSession(input: CreatePortfolioEntrySessionInput): Promise<PortfolioEntrySession> {
    const row = await this.prisma.portfolioEntrySession.create({
      data: this.mapper.sessionCreateData(input),
    });
    return this.mapper.toSession(row);
  }

  async findSessionById(sessionId: string): Promise<PortfolioEntrySession | null> {
    return this.findSession({ id: sessionId });
  }

  async findSessionForPublicAccess(
    sessionId: string,
    publicAccessTokenHash: string,
  ): Promise<PortfolioEntrySession | null> {
    return this.findSession({
      id: sessionId,
      publicAccessTokenHash,
    });
  }

  async findSessionForOwner(sessionId: string, ownerUserId: string): Promise<PortfolioEntrySession | null> {
    return this.findSession({
      id: sessionId,
      ownerUserId,
      ownershipState: 'CLAIMED',
    });
  }

  async saveSessionState(input: SavePortfolioEntrySessionStateInput): Promise<PortfolioEntrySession> {
    assertNextRevision(input.session, input.expectedRevision);
    const result = await this.prisma.portfolioEntrySession.updateMany({
      where: { id: input.session.id, revision: input.expectedRevision },
      data: this.mapper.sessionMutableData(input.session),
    });
    if (result.count !== 1) throw await this.conflictOrNotFound(input.session.id);
    return this.requireSession(input.session.id);
  }

  async appendTurn(
    turn: PortfolioEntryTurn,
    session: PortfolioEntrySession,
    expectedRevision: number,
    expectedContextRevision?: number,
  ): Promise<PortfolioEntryTurn> {
    assertSameSession(turn.sessionId, session.id);
    assertNextRevision(session, expectedRevision);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (expectedContextRevision !== undefined) {
          await advanceContextRevisionInTransaction(tx, session.id, expectedContextRevision, session.updatedAt);
        }
        const updated = await tx.portfolioEntrySession.updateMany({
          where: { id: session.id, revision: expectedRevision },
          data: this.mapper.sessionMutableData(session),
        });
        if (updated.count !== 1) throw PortfolioEntrySessionError.conflict();
        const row = await tx.portfolioEntryTurn.create({
          data: this.mapper.turnCreateData(turn),
        });
        return this.mapper.toTurn(row);
      });
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async appendModelExecution(
    execution: PortfolioEntryModelExecutionRecord,
  ): Promise<PortfolioEntryModelExecutionRecord> {
    await this.assertSessionExists(execution.sessionId);
    await this.assertChildReferencesBelongToSession(this.prisma, execution);
    try {
      const row = await this.prisma.portfolioEntryModelExecution.create({
        data: this.mapper.modelExecutionCreateData(execution),
      });
      return this.mapper.toModelExecution(row);
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async saveHandoff(
    handoff: PortfolioEntryHandoffRecord,
    session: PortfolioEntrySession,
    expectedRevision: number,
  ): Promise<PortfolioEntryHandoffRecord> {
    assertSameSession(handoff.sessionId, session.id);
    assertNextRevision(session, expectedRevision);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (handoff.sourceTurnId) {
          await this.assertTurnBelongsToSession(tx, handoff.sourceTurnId, handoff.sessionId);
        }
        const updated = await tx.portfolioEntrySession.updateMany({
          where: { id: session.id, revision: expectedRevision },
          data: this.mapper.sessionMutableData(session),
        });
        if (updated.count !== 1) throw PortfolioEntrySessionError.conflict();
        const row = await tx.portfolioEntryHandoff.create({
          data: this.mapper.handoffCreateData(handoff),
        });
        return this.mapper.toHandoff(row);
      });
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async createCriticalHandoff(
    input: CreatePortfolioEntryCriticalHandoffInput,
  ): Promise<PortfolioEntryCriticalHandoffRecord> {
    assertContextRevision(input.sourceContextRevision);
    const payload = parseCriticalHandoffPayload(PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, input.payload);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const session = await tx.portfolioEntrySession.findUnique({
          where: { id: input.sessionId },
          select: { contextRevision: true, revision: true },
        });
        if (!session) throw PortfolioEntrySessionError.notFound();
        if (session.contextRevision !== input.sourceContextRevision
          || (input.expectedSessionRevision !== undefined && session.revision !== input.expectedSessionRevision)) {
          throw PortfolioEntrySessionError.conflict();
        }

        const latestTurn = await tx.portfolioEntryTurn.findFirst({
          where: { sessionId: input.sessionId, inputIntent: { in: ['answer', 'correction'] } },
          orderBy: [{ turnIndex: 'desc' }, { createdAt: 'desc' }],
          select: { id: true },
        });
        let sourceTurnId = latestTurn?.id ?? null;
        if (input.sourceTurnId) {
          await this.assertTurnBelongsToSession(tx, input.sourceTurnId, input.sessionId);
          if (latestTurn?.id !== input.sourceTurnId) throw PortfolioEntrySessionError.conflict();
          sourceTurnId = input.sourceTurnId;
        }

        const latest = await tx.portfolioEntryCriticalHandoff.findFirst({
          where: { sessionId: input.sessionId },
          orderBy: { artifactVersion: 'desc' },
          select: {
            artifactVersion: true,
            sourceContextRevision: true,
            confirmationState: true,
            confirmedAt: true,
            confirmedByUserId: true,
          },
        });
        if (latest) {
          parseCriticalHandoffLifecycle(latest.confirmationState, latest.confirmedAt, latest.confirmedByUserId);
        }
        if (latest?.confirmationState === 'confirmed'
          && input.sourceContextRevision <= latest.sourceContextRevision) throw PortfolioEntrySessionError.conflict();
        const now = new Date();
        const artifact: PortfolioEntryCriticalHandoffRecord = {
          id: randomUUID(),
          sessionId: input.sessionId,
          artifactVersion: nextCriticalHandoffArtifactVersion(latest?.artifactVersion),
          schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
          sourceContextRevision: input.sourceContextRevision,
          sourceTurnId: sourceTurnId ?? undefined,
          payload,
          confirmationState: 'provisional',
          confirmedAt: null,
          confirmedByUserId: null,
          createdAt: now,
          updatedAt: now,
        };
        return tx.portfolioEntryCriticalHandoff.create({
          data: this.mapper.criticalHandoffCreateData(artifact),
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.mapper.toCriticalHandoff(row as PrismaPortfolioEntryCriticalHandoffRow);
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async getLatestCriticalHandoff(sessionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.portfolioEntrySession.findUnique({
        where: { id: sessionId },
        select: { contextRevision: true },
      });
      if (!session) throw PortfolioEntrySessionError.notFound();
      const row = await tx.portfolioEntryCriticalHandoff.findFirst({
        where: { sessionId },
        orderBy: { artifactVersion: 'desc' },
      });
      return {
        artifact: row ? this.mapper.toCriticalHandoff(row as PrismaPortfolioEntryCriticalHandoffRow) : null,
        currentContextRevision: session.contextRevision,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async confirmCriticalHandoff(input: ConfirmPortfolioEntryCriticalHandoffInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the same session row written by answer/correction revision CAS. The lock
        // remains held through the artifact CAS, giving confirmation and context advance
        // one database serialization point without changing contextRevision.
        const lockedSessions = await tx.$queryRaw<Array<{
          contextRevision: number;
          ownerUserId: string | null;
          ownershipState: string;
        }>>(Prisma.sql`
          SELECT "contextRevision", "ownerUserId", "ownershipState"
          FROM "PortfolioEntrySession"
          WHERE "id" = ${input.sessionId}
          FOR UPDATE
        `);
        const session = lockedSessions[0];
        if (!session) throw PortfolioEntrySessionError.notFound();
        if (session.ownershipState !== 'CLAIMED' || session.ownerUserId !== input.confirmingActorId) {
          throw PortfolioEntrySessionError.conflict();
        }

        const latest = await tx.portfolioEntryCriticalHandoff.findFirst({
          where: { sessionId: input.sessionId },
          orderBy: { artifactVersion: 'desc' },
        });
        if (!latest
          || latest.id !== input.artifactId
          || latest.artifactVersion !== input.expectedArtifactVersion
          || latest.sourceContextRevision !== input.expectedContextRevision
          || session.contextRevision !== input.expectedContextRevision) {
          throw PortfolioEntrySessionError.conflict();
        }
        const currentArtifact = this.mapper.toCriticalHandoff(latest as PrismaPortfolioEntryCriticalHandoffRow);

        if (currentArtifact.confirmationState === 'confirmed') {
          return {
            artifact: currentArtifact,
            currentContextRevision: session.contextRevision,
          };
        }
        if (currentArtifact.confirmationState !== 'provisional') throw PortfolioEntrySessionError.conflict();

        const changed = await tx.portfolioEntryCriticalHandoff.updateMany({
          where: {
            id: input.artifactId,
            sessionId: input.sessionId,
            artifactVersion: input.expectedArtifactVersion,
            sourceContextRevision: input.expectedContextRevision,
            confirmationState: 'provisional',
            confirmedAt: null,
            confirmedByUserId: null,
          },
          data: {
            confirmationState: 'confirmed',
            confirmedAt: input.confirmedAt,
            confirmedByUserId: input.confirmingActorId,
          },
        });
        if (changed.count !== 1) throw PortfolioEntrySessionError.conflict();

        const confirmed = await tx.portfolioEntryCriticalHandoff.findUnique({ where: { id: input.artifactId } });
        if (!confirmed) throw PortfolioEntrySessionError.conflict();
        return {
          artifact: this.mapper.toCriticalHandoff(confirmed as PrismaPortfolioEntryCriticalHandoffRow),
          currentContextRevision: session.contextRevision,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async readContextRevision(sessionId: string): Promise<number> {
    const session = await this.prisma.portfolioEntrySession.findUnique({
      where: { id: sessionId },
      select: { contextRevision: true },
    });
    if (!session) throw PortfolioEntrySessionError.notFound();
    return session.contextRevision;
  }

  async advanceContextRevision(
    sessionId: string,
    expectedContextRevision: number,
    now: Date,
  ): Promise<number> {
    assertContextRevision(expectedContextRevision);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await advanceContextRevisionInTransaction(tx, sessionId, expectedContextRevision, now);
        const updatedSession = await tx.portfolioEntrySession.findUnique({
          where: { id: sessionId },
          select: { contextRevision: true },
        });
        if (!updatedSession) throw PortfolioEntrySessionError.notFound();
        return updatedSession.contextRevision;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async saveConfirmation(
    confirmation: PortfolioEntryConfirmation,
    session: PortfolioEntrySession,
    expectedRevision: number,
  ): Promise<PortfolioEntryConfirmation> {
    assertSameSession(confirmation.sessionId, session.id);
    assertNextRevision(session, expectedRevision);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertHandoffBelongsToSession(tx, confirmation.handoffId, confirmation.sessionId);
        const updated = await tx.portfolioEntrySession.updateMany({
          where: { id: session.id, revision: expectedRevision },
          data: this.mapper.sessionMutableData(session),
        });
        if (updated.count !== 1) throw PortfolioEntrySessionError.conflict();
        const row = await tx.portfolioEntryConfirmation.create({
          data: this.mapper.confirmationCreateData(confirmation),
        });
        return this.mapper.toConfirmation(row);
      });
    } catch (err) {
      throw mapPrismaConflict(err);
    }
  }

  async claimOwnership(input: ClaimPortfolioEntrySessionOwnershipInput): Promise<PortfolioEntrySession> {
    const existing = await this.prisma.portfolioEntrySession.findUnique({ where: { id: input.sessionId } });
    if (!existing) throw PortfolioEntrySessionError.notFound();
    if (existing.revision !== input.expectedRevision) throw PortfolioEntrySessionError.conflict();
    if (!canClaimPortfolioEntrySession(existing)) throw PortfolioEntrySessionError.invalidOwnershipClaim();

    const result = await this.prisma.portfolioEntrySession.updateMany({
      where: {
        id: input.sessionId,
        revision: input.expectedRevision,
        ownershipState: 'ANONYMOUS',
        ownerUserId: null,
      },
      data: {
        ownerUserId: input.ownerUserId,
        ownershipState: 'CLAIMED',
        revision: { increment: 1 },
        updatedAt: input.now,
        lastActivityAt: input.now,
      },
    });
    if (result.count !== 1) throw PortfolioEntrySessionError.conflict();
    return this.requireSession(input.sessionId);
  }

  async touchActivity(sessionId: string, now: Date, expectedRevision: number): Promise<PortfolioEntrySession> {
    const existing = await this.prisma.portfolioEntrySession.findUnique({ where: { id: sessionId } });
    if (!existing) throw PortfolioEntrySessionError.notFound();
    if (existing.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();
    if (existing.expiredAt || existing.lifecycleStatus === 'EXPIRED') throw PortfolioEntrySessionError.expired();

    const result = await this.prisma.portfolioEntrySession.updateMany({
      where: {
        id: sessionId,
        revision: expectedRevision,
        expiredAt: null,
        lifecycleStatus: { not: 'EXPIRED' },
      },
      data: {
        revision: { increment: 1 },
        updatedAt: now,
        lastActivityAt: now,
      },
    });
    if (result.count !== 1) throw PortfolioEntrySessionError.conflict();
    return this.requireSession(sessionId);
  }

  async markExpired(sessionId: string, now: Date, expectedRevision: number): Promise<PortfolioEntrySession> {
    const existing = await this.prisma.portfolioEntrySession.findUnique({ where: { id: sessionId } });
    if (!existing) throw PortfolioEntrySessionError.notFound();
    if (existing.revision !== expectedRevision) throw PortfolioEntrySessionError.conflict();

    const result = await this.prisma.portfolioEntrySession.updateMany({
      where: {
        id: sessionId,
        revision: expectedRevision,
        expiredAt: null,
        lifecycleStatus: { not: 'EXPIRED' },
      },
      data: {
        lifecycleStatus: 'EXPIRED',
        expiredAt: now,
        revision: { increment: 1 },
        updatedAt: now,
      },
    });
    if (result.count !== 1) throw PortfolioEntrySessionError.conflict();
    return this.requireSession(sessionId);
  }

  async listTurns(sessionId: string): Promise<PortfolioEntryTurn[]> {
    const rows = await this.prisma.portfolioEntryTurn.findMany({
      where: { sessionId },
      orderBy: [{ turnIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.mapper.toTurn(row));
  }

  async listModelExecutions(sessionId: string): Promise<PortfolioEntryModelExecutionRecord[]> {
    const rows = await this.prisma.portfolioEntryModelExecution.findMany({
      where: { sessionId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.mapper.toModelExecution(row));
  }

  private async findSession(where: Prisma.PortfolioEntrySessionWhereInput): Promise<PortfolioEntrySession | null> {
    const row = await this.prisma.portfolioEntrySession.findFirst({ where });
    if (!row) return null;
    return this.toFullSession(row);
  }

  private async requireSession(sessionId: string): Promise<PortfolioEntrySession> {
    const session = await this.findSessionById(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    return session;
  }

  private async toFullSession(row: PrismaPortfolioEntrySessionRow): Promise<PortfolioEntrySession> {
    const [handoffRow, confirmationRow] = await Promise.all([
      this.prisma.portfolioEntryHandoff.findFirst({
        where: { sessionId: row.id },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.portfolioEntryConfirmation.findFirst({
        where: { sessionId: row.id },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    return this.mapper.toSession(
      row,
      handoffRow ? this.mapper.toHandoff(handoffRow as PrismaPortfolioEntryHandoffRow) : null,
      confirmationRow ? this.mapper.toConfirmation(confirmationRow as PrismaPortfolioEntryConfirmationRow) : null,
    );
  }

  private async assertSessionExists(sessionId: string): Promise<void> {
    const existing = await this.prisma.portfolioEntrySession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!existing) throw PortfolioEntrySessionError.notFound();
  }

  private async assertChildReferencesBelongToSession(
    tx: PrismaClient | PrismaTx,
    execution: PortfolioEntryModelExecutionRecord,
  ): Promise<void> {
    if (execution.turnId) await this.assertTurnBelongsToSession(tx, execution.turnId, execution.sessionId);
    if (execution.handoffId) await this.assertHandoffBelongsToSession(tx, execution.handoffId, execution.sessionId);
  }

  private async assertTurnBelongsToSession(tx: PrismaClient | PrismaTx, turnId: string, sessionId: string): Promise<void> {
    const turn = await tx.portfolioEntryTurn.findUnique({
      where: { id: turnId },
      select: { sessionId: true },
    });
    if (!turn || turn.sessionId !== sessionId) throw PortfolioEntrySessionError.conflict();
  }

  private async assertHandoffBelongsToSession(tx: PrismaClient | PrismaTx, handoffId: string, sessionId: string): Promise<void> {
    const handoff = await tx.portfolioEntryHandoff.findUnique({
      where: { id: handoffId },
      select: { sessionId: true },
    });
    if (!handoff || handoff.sessionId !== sessionId) throw PortfolioEntrySessionError.conflict();
  }

  private async conflictOrNotFound(sessionId: string): Promise<PortfolioEntrySessionError> {
    const exists = await this.prisma.portfolioEntrySession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    return exists ? PortfolioEntrySessionError.conflict() : PortfolioEntrySessionError.notFound();
  }
}

function assertSameSession(childSessionId: string, sessionId: string): void {
  if (childSessionId !== sessionId) throw PortfolioEntrySessionError.conflict();
}

function assertNextRevision(session: PortfolioEntrySession, expectedRevision: number): void {
  if (session.revision !== expectedRevision + 1) {
    throw PortfolioEntrySessionError.conflict();
  }
}

async function advanceContextRevisionInTransaction(
  tx: PrismaTx,
  sessionId: string,
  expectedContextRevision: number,
  now: Date,
): Promise<void> {
  assertContextRevision(expectedContextRevision);
  const updated = await tx.portfolioEntrySession.updateMany({
    where: { id: sessionId, contextRevision: expectedContextRevision },
    data: { contextRevision: { increment: 1 }, updatedAt: now },
  });
  if (updated.count === 1) return;
  const existing = await tx.portfolioEntrySession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!existing) throw PortfolioEntrySessionError.notFound();
  throw PortfolioEntrySessionError.conflict();
}

function assertContextRevision(contextRevision: number): void {
  if (!Number.isSafeInteger(contextRevision) || contextRevision < 0 || contextRevision >= 2_147_483_647) {
    throw PortfolioEntrySessionError.conflict();
  }
}

function mapPrismaConflict(err: unknown): never {
  if (err instanceof PortfolioEntrySessionError) throw err;
  if (isPrismaConcurrencyConflict(err)) throw PortfolioEntrySessionError.conflict();
  throw err;
}

function isPrismaConcurrencyConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code === 'P2002' || err.code === 'P2003' || err.code === 'P2034') return true;
  if (err.code !== 'P2010' || !isRecord(err.meta)) return false;

  const sqlState = err.meta.code;
  return sqlState === '40001' || sqlState === '40P01';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
