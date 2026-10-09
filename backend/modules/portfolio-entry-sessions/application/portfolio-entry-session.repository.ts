import type { PortfolioEntryConfirmation } from '../domain/portfolio-entry-confirmation.types';
import type {
  PortfolioEntryHandoffRecord,
  PortfolioEntrySession,
  PortfolioEntryTurn,
} from '../domain/portfolio-entry-session.types';
import type { PortfolioEntryModelExecutionRecord } from '../observability/portfolio-entry-execution-metadata';
import type {
  ConfirmPortfolioEntryCriticalHandoffInput,
  CreatePortfolioEntryCriticalHandoffInput,
  PortfolioEntryCriticalHandoffLatestSnapshot,
  PortfolioEntryCriticalHandoffRecord,
} from '../domain/portfolio-entry-critical-handoff.types';

export type CreatePortfolioEntrySessionInput = PortfolioEntrySession;

export type SavePortfolioEntrySessionStateInput = {
  session: PortfolioEntrySession;
  expectedRevision: number;
};

export type ClaimPortfolioEntrySessionOwnershipInput = {
  sessionId: string;
  ownerUserId: string;
  expectedRevision: number;
  now: Date;
};

export interface PortfolioEntrySessionRepository {
  createSession(input: CreatePortfolioEntrySessionInput): Promise<PortfolioEntrySession>;
  findSessionById(sessionId: string): Promise<PortfolioEntrySession | null>;
  findSessionForPublicAccess(sessionId: string, publicAccessTokenHash: string): Promise<PortfolioEntrySession | null>;
  findSessionForOwner(sessionId: string, ownerUserId: string): Promise<PortfolioEntrySession | null>;
  saveSessionState(input: SavePortfolioEntrySessionStateInput): Promise<PortfolioEntrySession>;
  appendTurn(
    turn: PortfolioEntryTurn,
    session: PortfolioEntrySession,
    expectedRevision: number,
    expectedContextRevision?: number,
  ): Promise<PortfolioEntryTurn>;
  appendModelExecution(execution: PortfolioEntryModelExecutionRecord): Promise<PortfolioEntryModelExecutionRecord>;
  saveHandoff(handoff: PortfolioEntryHandoffRecord, session: PortfolioEntrySession, expectedRevision: number): Promise<PortfolioEntryHandoffRecord>;
  createCriticalHandoff(input: CreatePortfolioEntryCriticalHandoffInput): Promise<PortfolioEntryCriticalHandoffRecord>;
  confirmCriticalHandoff(input: ConfirmPortfolioEntryCriticalHandoffInput): Promise<PortfolioEntryCriticalHandoffLatestSnapshot>;
  getLatestCriticalHandoff(sessionId: string): Promise<PortfolioEntryCriticalHandoffLatestSnapshot>;
  readContextRevision(sessionId: string): Promise<number>;
  advanceContextRevision(sessionId: string, expectedContextRevision: number, now: Date): Promise<number>;
  saveConfirmation(confirmation: PortfolioEntryConfirmation, session: PortfolioEntrySession, expectedRevision: number): Promise<PortfolioEntryConfirmation>;
  claimOwnership(input: ClaimPortfolioEntrySessionOwnershipInput): Promise<PortfolioEntrySession>;
  touchActivity(sessionId: string, now: Date, expectedRevision: number): Promise<PortfolioEntrySession>;
  markExpired(sessionId: string, now: Date, expectedRevision: number): Promise<PortfolioEntrySession>;
  listTurns(sessionId: string): Promise<PortfolioEntryTurn[]>;
  listModelExecutions(sessionId: string): Promise<PortfolioEntryModelExecutionRecord[]>;
}
