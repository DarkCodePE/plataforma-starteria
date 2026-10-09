import { randomUUID } from 'node:crypto';
import type { PortfolioEntryConfirmation } from '../domain/portfolio-entry-confirmation.types';
import {
  isCriticalHandoffCurrent,
  nextCriticalHandoffArtifactVersion,
  parseCriticalHandoffPayload,
  parseCriticalHandoffLifecycle,
  type ConfirmPortfolioEntryCriticalHandoffInput,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
  type CreatePortfolioEntryCriticalHandoffInput,
  type PortfolioEntryCriticalHandoffRecord,
} from '../domain/portfolio-entry-critical-handoff.types';
import { canClaimPortfolioEntrySession } from '../domain/portfolio-entry-session-ownership';
import type {
  PortfolioEntryHandoffRecord,
  PortfolioEntrySession,
  PortfolioEntryTurn,
} from '../domain/portfolio-entry-session.types';
import type {
  ClaimPortfolioEntrySessionOwnershipInput,
  CreatePortfolioEntrySessionInput,
  PortfolioEntrySessionRepository,
  SavePortfolioEntrySessionStateInput,
} from '../application/portfolio-entry-session.repository';
import { PortfolioEntrySessionError } from '../application/portfolio-entry-session-errors';
import type { PortfolioEntryModelExecutionRecord } from '../observability/portfolio-entry-execution-metadata';

export class InMemoryPortfolioEntrySessionRepository implements PortfolioEntrySessionRepository {
  private readonly sessions = new Map<string, PortfolioEntrySession>();
  private readonly turns = new Map<string, PortfolioEntryTurn[]>();
  private readonly executions = new Map<string, PortfolioEntryModelExecutionRecord[]>();
  private readonly handoffs = new Map<string, PortfolioEntryHandoffRecord[]>();
  private readonly criticalHandoffs = new Map<string, PortfolioEntryCriticalHandoffRecord[]>();
  private readonly confirmations = new Map<string, PortfolioEntryConfirmation[]>();

  async createSession(input: CreatePortfolioEntrySessionInput): Promise<PortfolioEntrySession> {
    this.sessions.set(input.id, cloneSession(input));
    this.turns.set(input.id, []);
    this.executions.set(input.id, []);
    this.handoffs.set(input.id, []);
    this.criticalHandoffs.set(input.id, []);
    this.confirmations.set(input.id, []);
    return cloneSession(input);
  }

  async findSessionById(sessionId: string): Promise<PortfolioEntrySession | null> {
    return cloneNullableSession(this.sessions.get(sessionId) ?? null);
  }

  async findSessionForPublicAccess(
    sessionId: string,
    publicAccessTokenHash: string,
  ): Promise<PortfolioEntrySession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.publicAccessTokenHash) return null;
    if (session.publicAccessTokenHash !== publicAccessTokenHash) return null;
    return cloneSession(session);
  }

  async findSessionForOwner(sessionId: string, ownerUserId: string): Promise<PortfolioEntrySession | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.ownerUserId !== ownerUserId || session.ownershipState !== 'CLAIMED') return null;
    return cloneSession(session);
  }

  async saveSessionState(input: SavePortfolioEntrySessionStateInput): Promise<PortfolioEntrySession> {
    const existing = this.sessions.get(input.session.id);
    if (!existing) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(existing, input.expectedRevision);
    const updated = { ...input.session, contextRevision: existing.contextRevision };
    this.sessions.set(input.session.id, cloneSession(updated));
    return cloneSession(updated);
  }

  async appendTurn(
    turn: PortfolioEntryTurn,
    session: PortfolioEntrySession,
    expectedRevision: number,
    expectedContextRevision?: number,
  ): Promise<PortfolioEntryTurn> {
    const existing = this.turns.get(turn.sessionId);
    const existingSession = this.sessions.get(turn.sessionId);
    if (!existing || !existingSession) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(existingSession, expectedRevision);
    if (expectedContextRevision !== undefined && (
      existingSession.contextRevision !== expectedContextRevision
      || !Number.isSafeInteger(expectedContextRevision)
      || expectedContextRevision < 0
      || expectedContextRevision >= 2_147_483_647
    )) throw PortfolioEntrySessionError.conflict();
    const expectedIndex = existing.length + 1;
    if (turn.turnIndex !== expectedIndex) {
      throw PortfolioEntrySessionError.conflict();
    }
    const stored = cloneTurn(turn);
    existing.push(stored);
    this.sessions.set(session.id, cloneSession({
      ...session,
      contextRevision: expectedContextRevision === undefined
        ? existingSession.contextRevision
        : expectedContextRevision + 1,
    }));
    return cloneTurn(stored);
  }

  async appendModelExecution(
    execution: PortfolioEntryModelExecutionRecord,
  ): Promise<PortfolioEntryModelExecutionRecord> {
    const existing = this.executions.get(execution.sessionId);
    if (!existing || !this.sessions.has(execution.sessionId)) throw PortfolioEntrySessionError.notFound();
    assertExecutionReferencesBelongToSession(execution, this.turns, this.handoffs);
    const stored = cloneExecution(execution);
    existing.push(stored);
    return cloneExecution(stored);
  }

  async saveHandoff(
    handoff: PortfolioEntryHandoffRecord,
    session: PortfolioEntrySession,
    expectedRevision: number,
  ): Promise<PortfolioEntryHandoffRecord> {
    const existing = this.handoffs.get(handoff.sessionId);
    const existingSession = this.sessions.get(handoff.sessionId);
    if (!existing || !existingSession) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(existingSession, expectedRevision);
    if (handoff.sourceTurnId && !this.turns.get(handoff.sessionId)?.some((turn) => turn.id === handoff.sourceTurnId)) {
      throw PortfolioEntrySessionError.conflict();
    }
    const latestVersion = existing.at(-1)?.version ?? 0;
    if (handoff.version !== latestVersion + 1) {
      throw PortfolioEntrySessionError.conflict();
    }
    const stored = cloneHandoff(handoff);
    existing.push(stored);
    this.sessions.set(session.id, cloneSession({ ...session, contextRevision: existingSession.contextRevision }));
    return cloneHandoff(stored);
  }

  async createCriticalHandoff(input: CreatePortfolioEntryCriticalHandoffInput): Promise<PortfolioEntryCriticalHandoffRecord> {
    const session = this.sessions.get(input.sessionId);
    const existing = this.criticalHandoffs.get(input.sessionId);
    if (!session || !existing) throw PortfolioEntrySessionError.notFound();
    if (session.contextRevision !== input.sourceContextRevision
      || (input.expectedSessionRevision !== undefined && session.revision !== input.expectedSessionRevision)) {
      throw PortfolioEntrySessionError.conflict();
    }

    const latestTurn = [...(this.turns.get(input.sessionId) ?? [])]
      .filter((turn) => turn.inputIntent === 'answer' || turn.inputIntent === 'correction')
      .sort((left, right) => right.turnIndex - left.turnIndex || right.createdAt.getTime() - left.createdAt.getTime())[0];
    if (input.sourceTurnId && (!latestTurn || latestTurn.id !== input.sourceTurnId)) {
      throw PortfolioEntrySessionError.conflict();
    }
    if (input.sourceTurnId && latestTurn.sessionId !== input.sessionId) {
      throw PortfolioEntrySessionError.conflict();
    }

    const latestArtifact = existing.at(-1);
    if (latestArtifact) {
      parseCriticalHandoffLifecycle(latestArtifact.confirmationState, latestArtifact.confirmedAt, latestArtifact.confirmedByUserId);
    }
    if (latestArtifact?.confirmationState === 'confirmed'
      && input.sourceContextRevision <= latestArtifact.sourceContextRevision) throw PortfolioEntrySessionError.conflict();
    const latestVersion = latestArtifact?.artifactVersion;
    const now = new Date();
    const stored: PortfolioEntryCriticalHandoffRecord = {
      id: randomUUID(),
      sessionId: input.sessionId,
      artifactVersion: nextCriticalHandoffArtifactVersion(latestVersion),
      schemaVersion: PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
      sourceContextRevision: input.sourceContextRevision,
      sourceTurnId: latestTurn?.id,
      payload: parseCriticalHandoffPayload(PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION, input.payload),
      confirmationState: 'provisional',
      confirmedAt: null,
      confirmedByUserId: null,
      createdAt: now,
      updatedAt: now,
    };
    existing.push(stored);
    return cloneCriticalHandoff(stored);
  }

  async confirmCriticalHandoff(input: ConfirmPortfolioEntryCriticalHandoffInput) {
    const session = this.sessions.get(input.sessionId);
    const artifacts = this.criticalHandoffs.get(input.sessionId);
    if (!session || !artifacts) throw PortfolioEntrySessionError.notFound();
    if (session.ownershipState !== 'CLAIMED' || session.ownerUserId !== input.confirmingActorId) {
      throw PortfolioEntrySessionError.unauthorized();
    }

    const latest = [...artifacts].sort((left, right) => right.artifactVersion - left.artifactVersion)[0] ?? null;
    const artifact = artifacts.find((candidate) => candidate.id === input.artifactId) ?? null;
    if (artifact) parseCriticalHandoffLifecycle(artifact.confirmationState, artifact.confirmedAt, artifact.confirmedByUserId);
    if (!artifact
      || !latest
      || artifact.id !== latest.id
      || artifact.artifactVersion !== input.expectedArtifactVersion
      || artifact.sourceContextRevision !== input.expectedContextRevision
      || session.contextRevision !== input.expectedContextRevision
      || !isCriticalHandoffCurrent(artifact, latest, session.contextRevision)) {
      throw PortfolioEntrySessionError.conflict();
    }

    if (artifact.confirmationState === 'confirmed') {
      return { artifact: cloneCriticalHandoff(artifact), currentContextRevision: session.contextRevision };
    }
    if (artifact.confirmationState !== 'provisional') throw PortfolioEntrySessionError.conflict();

    const confirmed = cloneCriticalHandoff({
      ...artifact,
      confirmationState: 'confirmed',
      confirmedAt: input.confirmedAt,
      confirmedByUserId: input.confirmingActorId,
      updatedAt: input.confirmedAt,
    });
    const index = artifacts.findIndex((candidate) => candidate.id === input.artifactId);
    artifacts[index] = confirmed;
    return { artifact: cloneCriticalHandoff(confirmed), currentContextRevision: session.contextRevision };
  }

  async getLatestCriticalHandoff(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    const latest = [...(this.criticalHandoffs.get(sessionId) ?? [])]
      .sort((left, right) => right.artifactVersion - left.artifactVersion)[0];
    return {
      artifact: latest ? cloneCriticalHandoff(latest) : null,
      currentContextRevision: session.contextRevision,
    };
  }

  async readContextRevision(sessionId: string): Promise<number> {
    const session = this.sessions.get(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    return session.contextRevision;
  }

  async advanceContextRevision(sessionId: string, expectedContextRevision: number, now: Date): Promise<number> {
    const session = this.sessions.get(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    if (session.contextRevision !== expectedContextRevision || !Number.isSafeInteger(expectedContextRevision)
      || expectedContextRevision < 0 || expectedContextRevision >= 2_147_483_647) {
      throw PortfolioEntrySessionError.conflict();
    }
    const updated = {
      ...cloneSession(session),
      contextRevision: expectedContextRevision + 1,
      updatedAt: now,
    };
    this.sessions.set(sessionId, updated);
    return updated.contextRevision;
  }

  async saveConfirmation(
    confirmation: PortfolioEntryConfirmation,
    session: PortfolioEntrySession,
    expectedRevision: number,
  ): Promise<PortfolioEntryConfirmation> {
    const existing = this.confirmations.get(confirmation.sessionId);
    const existingSession = this.sessions.get(confirmation.sessionId);
    if (!existing || !existingSession) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(existingSession, expectedRevision);
    if (!this.handoffs.get(confirmation.sessionId)?.some((handoff) => handoff.id === confirmation.handoffId)) {
      throw PortfolioEntrySessionError.conflict();
    }
    const latestVersion = existing.at(-1)?.version ?? 0;
    if (confirmation.version !== latestVersion + 1) {
      throw PortfolioEntrySessionError.conflict();
    }
    const stored = cloneConfirmation(confirmation);
    existing.push(stored);
    this.sessions.set(session.id, cloneSession({ ...session, contextRevision: existingSession.contextRevision }));
    return cloneConfirmation(stored);
  }

  async claimOwnership(input: ClaimPortfolioEntrySessionOwnershipInput): Promise<PortfolioEntrySession> {
    const session = this.sessions.get(input.sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(session, input.expectedRevision);
    if (!canClaimPortfolioEntrySession(session)) throw PortfolioEntrySessionError.invalidOwnershipClaim();
    const claimed: PortfolioEntrySession = {
      ...cloneSession(session),
      ownerUserId: input.ownerUserId,
      ownershipState: 'CLAIMED',
      revision: session.revision + 1,
      updatedAt: input.now,
      lastActivityAt: input.now,
    };
    this.sessions.set(claimed.id, cloneSession(claimed));
    return cloneSession(claimed);
  }

  async touchActivity(sessionId: string, now: Date, expectedRevision: number): Promise<PortfolioEntrySession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(session, expectedRevision);
    if (session.expiredAt || session.lifecycleStatus === 'EXPIRED') throw PortfolioEntrySessionError.expired();
    const touched = { ...cloneSession(session), revision: session.revision + 1, updatedAt: now, lastActivityAt: now };
    this.sessions.set(sessionId, touched);
    return cloneSession(touched);
  }

  async markExpired(sessionId: string, now: Date, expectedRevision: number): Promise<PortfolioEntrySession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw PortfolioEntrySessionError.notFound();
    assertExpectedRevision(session, expectedRevision);
    const expired: PortfolioEntrySession = {
      ...cloneSession(session),
      lifecycleStatus: 'EXPIRED',
      expiredAt: session.expiredAt ?? now,
      revision: session.revision + 1,
      updatedAt: now,
    };
    this.sessions.set(sessionId, expired);
    return cloneSession(expired);
  }

  async listTurns(sessionId: string): Promise<PortfolioEntryTurn[]> {
    return (this.turns.get(sessionId) ?? []).map(cloneTurn);
  }

  async listModelExecutions(sessionId: string): Promise<PortfolioEntryModelExecutionRecord[]> {
    return (this.executions.get(sessionId) ?? []).map(cloneExecution);
  }
}

function cloneNullableSession(session: PortfolioEntrySession | null): PortfolioEntrySession | null {
  return session ? cloneSession(session) : null;
}

function cloneSession(session: PortfolioEntrySession): PortfolioEntrySession {
  return {
    ...session,
    sourceMetadata: cloneJson(session.sourceMetadata),
    semanticState: cloneJson(session.semanticState),
    questionBudget: cloneJson(session.questionBudget),
    latestAnalysis: cloneJson(session.latestAnalysis),
    latestHandoff: session.latestHandoff ? cloneHandoff(session.latestHandoff) : null,
    confirmation: session.confirmation ? cloneConfirmation(session.confirmation) : null,
    versioning: { ...session.versioning },
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
    lastActivityAt: new Date(session.lastActivityAt),
    expiresAt: new Date(session.expiresAt),
    expiredAt: session.expiredAt ? new Date(session.expiredAt) : null,
  };
}

function cloneTurn(turn: PortfolioEntryTurn): PortfolioEntryTurn {
  return {
    ...turn,
    emittedQuestions: cloneJson(turn.emittedQuestions),
    matchedQuestionIds: [...turn.matchedQuestionIds],
    respondedResolves: [...turn.respondedResolves],
    analysisSnapshot: cloneJson(turn.analysisSnapshot),
    semanticStateAfter: cloneJson(turn.semanticStateAfter),
    transition: cloneJson(turn.transition),
    provenanceDelta: cloneJson(turn.provenanceDelta),
    versioning: { ...turn.versioning },
    createdAt: new Date(turn.createdAt),
    updatedAt: new Date(turn.updatedAt),
  };
}

function cloneHandoff(handoff: PortfolioEntryHandoffRecord): PortfolioEntryHandoffRecord {
  return {
    ...handoff,
    handoff: cloneJson(handoff.handoff),
    versioning: { ...handoff.versioning },
    createdAt: new Date(handoff.createdAt),
    updatedAt: new Date(handoff.updatedAt),
  };
}

function cloneCriticalHandoff(handoff: PortfolioEntryCriticalHandoffRecord): PortfolioEntryCriticalHandoffRecord {
  parseCriticalHandoffLifecycle(handoff.confirmationState, handoff.confirmedAt, handoff.confirmedByUserId);
  return {
    ...handoff,
    payload: cloneJson(handoff.payload),
    confirmedAt: handoff.confirmedAt ? new Date(handoff.confirmedAt) : null,
    createdAt: new Date(handoff.createdAt),
    updatedAt: new Date(handoff.updatedAt),
  };
}

function cloneConfirmation(confirmation: PortfolioEntryConfirmation): PortfolioEntryConfirmation {
  return {
    ...confirmation,
    acceptedFields: [...confirmation.acceptedFields],
    correctedFields: cloneJson(confirmation.correctedFields),
    rejectedFields: [...confirmation.rejectedFields],
    confirmedAt: confirmation.confirmedAt ? new Date(confirmation.confirmedAt) : null,
    createdAt: new Date(confirmation.createdAt),
    updatedAt: new Date(confirmation.updatedAt),
  };
}

function cloneExecution(execution: PortfolioEntryModelExecutionRecord): PortfolioEntryModelExecutionRecord {
  return {
    ...execution,
    usage: cloneJson(execution.usage),
    schemaErrors: [...execution.schemaErrors],
    createdAt: new Date(execution.createdAt),
  };
}

function assertExpectedRevision(session: PortfolioEntrySession, expectedRevision: number): void {
  if (session.revision !== expectedRevision) {
    throw PortfolioEntrySessionError.conflict();
  }
}

function assertExecutionReferencesBelongToSession(
  execution: PortfolioEntryModelExecutionRecord,
  turns: Map<string, PortfolioEntryTurn[]>,
  handoffs: Map<string, PortfolioEntryHandoffRecord[]>,
): void {
  if (execution.turnId && !turns.get(execution.sessionId)?.some((turn) => turn.id === execution.turnId)) {
    throw PortfolioEntrySessionError.conflict();
  }
  if (execution.handoffId && !handoffs.get(execution.sessionId)?.some((handoff) => handoff.id === execution.handoffId)) {
    throw PortfolioEntrySessionError.conflict();
  }
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
