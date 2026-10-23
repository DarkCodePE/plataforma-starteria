export type PortfolioEntryIdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type PortfolioEntryIdempotencyRecord = {
  id: string;
  operation: string;
  scope: string;
  sessionId?: string | null;
  idempotencyKey: string;
  requestPayloadHash: string;
  status: PortfolioEntryIdempotencyStatus;
  responseSnapshot?: unknown;
  createdAt: Date;
  expiresAt: Date;
};

export type CreatePortfolioEntryIdempotencyInput = {
  id?: string;
  operation: string;
  scope: string;
  sessionId?: string | null;
  idempotencyKey: string;
  requestPayloadHash: string;
  expiresAt: Date;
};

export type CompletePortfolioEntryIdempotencyInput = {
  id: string;
  responseSnapshot: unknown;
};

export type StorePortfolioEntryIdempotencyRecoveryInput = {
  id: string;
  recoverySnapshot: unknown;
};

export interface PortfolioEntryIdempotencyRepository {
  findActive(operation: string, scope: string, idempotencyKey: string, now: Date): Promise<PortfolioEntryIdempotencyRecord | null>;
  create(input: CreatePortfolioEntryIdempotencyInput): Promise<PortfolioEntryIdempotencyRecord>;
  storeRecoveryHint(input: StorePortfolioEntryIdempotencyRecoveryInput): Promise<PortfolioEntryIdempotencyRecord>;
  complete(input: CompletePortfolioEntryIdempotencyInput): Promise<PortfolioEntryIdempotencyRecord>;
  markFailed(id: string): Promise<void>;
}
