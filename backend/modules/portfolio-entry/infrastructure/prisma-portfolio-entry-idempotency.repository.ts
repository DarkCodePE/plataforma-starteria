import { Prisma, type PrismaClient } from '@prisma/client';
import {
  type CompletePortfolioEntryIdempotencyInput,
  type CreatePortfolioEntryIdempotencyInput,
  type PortfolioEntryIdempotencyRecord,
  type PortfolioEntryIdempotencyRepository,
  type PortfolioEntryIdempotencyStatus,
  type StorePortfolioEntryIdempotencyRecoveryInput,
} from '../application/portfolio-entry-idempotency.repository';

export class PrismaPortfolioEntryIdempotencyRepository implements PortfolioEntryIdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(operation: string, scope: string, idempotencyKey: string, now: Date): Promise<PortfolioEntryIdempotencyRecord | null> {
    const row = await this.prisma.portfolioEntryApiIdempotency.findUnique({
      where: { operation_scope_idempotencyKey: { operation, scope, idempotencyKey } },
    });
    if (!row || row.expiresAt <= now) return null;
    return toRecord(row);
  }

  async create(input: CreatePortfolioEntryIdempotencyInput): Promise<PortfolioEntryIdempotencyRecord> {
    try {
      const row = await this.prisma.portfolioEntryApiIdempotency.create({
        data: {
          id: input.id,
          operation: input.operation,
          scope: input.scope,
          sessionId: input.sessionId ?? null,
          idempotencyKey: input.idempotencyKey,
          requestPayloadHash: input.requestPayloadHash,
          status: 'IN_PROGRESS',
          expiresAt: input.expiresAt,
        },
      });
      return toRecord(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findActive(input.operation, input.scope, input.idempotencyKey, new Date());
        if (existing) return existing;
      }
      throw err;
    }
  }

  async complete(input: CompletePortfolioEntryIdempotencyInput): Promise<PortfolioEntryIdempotencyRecord> {
    const row = await this.prisma.portfolioEntryApiIdempotency.update({
      where: { id: input.id },
      data: {
        status: 'COMPLETED',
        responseSnapshot: input.responseSnapshot as Prisma.InputJsonValue,
      },
    });
    return toRecord(row);
  }

  async storeRecoveryHint(input: StorePortfolioEntryIdempotencyRecoveryInput): Promise<PortfolioEntryIdempotencyRecord> {
    const row = await this.prisma.portfolioEntryApiIdempotency.update({
      where: { id: input.id },
      data: {
        responseSnapshot: input.recoverySnapshot as Prisma.InputJsonValue,
      },
    });
    return toRecord(row);
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.portfolioEntryApiIdempotency.update({
      where: { id },
      data: { status: 'FAILED' },
    }).catch(() => undefined);
  }
}

function toRecord(row: {
  id: string;
  operation: string;
  scope: string;
  sessionId: string | null;
  idempotencyKey: string;
  requestPayloadHash: string;
  status: string;
  responseSnapshot: Prisma.JsonValue | null;
  createdAt: Date;
  expiresAt: Date;
}): PortfolioEntryIdempotencyRecord {
  return {
    id: row.id,
    operation: row.operation,
    scope: row.scope,
    sessionId: row.sessionId,
    idempotencyKey: row.idempotencyKey,
    requestPayloadHash: row.requestPayloadHash,
    status: row.status as PortfolioEntryIdempotencyStatus,
    responseSnapshot: row.responseSnapshot ?? undefined,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}
