import { randomUUID } from 'node:crypto';
import {
  type CompletePortfolioEntryIdempotencyInput,
  type CreatePortfolioEntryIdempotencyInput,
  type PortfolioEntryIdempotencyRecord,
  type PortfolioEntryIdempotencyRepository,
  type StorePortfolioEntryIdempotencyRecoveryInput,
} from '../application/portfolio-entry-idempotency.repository';

export class InMemoryPortfolioEntryIdempotencyRepository implements PortfolioEntryIdempotencyRepository {
  private readonly records = new Map<string, PortfolioEntryIdempotencyRecord>();

  async findActive(operation: string, scope: string, idempotencyKey: string, now: Date): Promise<PortfolioEntryIdempotencyRecord | null> {
    const record = this.records.get(toKey(operation, scope, idempotencyKey));
    if (!record || record.expiresAt <= now) return null;
    return clone(record);
  }

  async create(input: CreatePortfolioEntryIdempotencyInput): Promise<PortfolioEntryIdempotencyRecord> {
    const key = toKey(input.operation, input.scope, input.idempotencyKey);
    if (this.records.has(key)) {
      const existing = this.records.get(key)!;
      if (existing.expiresAt > new Date()) return clone(existing);
    }
    const record: PortfolioEntryIdempotencyRecord = {
      id: input.id ?? randomUUID(),
      operation: input.operation,
      scope: input.scope,
      sessionId: input.sessionId ?? null,
      idempotencyKey: input.idempotencyKey,
      requestPayloadHash: input.requestPayloadHash,
      status: 'IN_PROGRESS',
      createdAt: new Date(),
      expiresAt: input.expiresAt,
    };
    this.records.set(key, clone(record));
    return clone(record);
  }

  async complete(input: CompletePortfolioEntryIdempotencyInput): Promise<PortfolioEntryIdempotencyRecord> {
    const record = [...this.records.values()].find((candidate) => candidate.id === input.id);
    if (!record) throw new Error('Idempotency record not found.');
    record.status = 'COMPLETED';
    record.responseSnapshot = cloneJson(input.responseSnapshot);
    return clone(record);
  }

  async storeRecoveryHint(input: StorePortfolioEntryIdempotencyRecoveryInput): Promise<PortfolioEntryIdempotencyRecord> {
    const record = [...this.records.values()].find((candidate) => candidate.id === input.id);
    if (!record) throw new Error('Idempotency record not found.');
    record.responseSnapshot = cloneJson(input.recoverySnapshot);
    return clone(record);
  }

  async markFailed(id: string): Promise<void> {
    const record = [...this.records.values()].find((candidate) => candidate.id === id);
    if (record) record.status = 'FAILED';
  }
}

function toKey(operation: string, scope: string, idempotencyKey: string): string {
  return `${operation}:${scope}:${idempotencyKey}`;
}

function clone(record: PortfolioEntryIdempotencyRecord): PortfolioEntryIdempotencyRecord {
  return {
    ...record,
    responseSnapshot: cloneJson(record.responseSnapshot),
    createdAt: new Date(record.createdAt),
    expiresAt: new Date(record.expiresAt),
  };
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
