import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  portfolioEntryAnalysisV2Schema,
  portfolioEntryFrameV2Schema,
  portfolioEntryIntentV2Schema,
  reverseAlignmentV2Schema,
} from '../../portfolio-entry-runtime/domain/analysis.schema';
import { portfolioEntryHandoffV2Schema } from '../../portfolio-entry-runtime/domain/handoff.schema';
import type { InteractionMode, QuestionRecord, SessionTransition } from '../../portfolio-entry-runtime/domain/session.types';
import {
  PORTFOLIO_ENTRY_CONFIRMATION_STATUSES,
  type PortfolioEntryConfirmation,
} from '../domain/portfolio-entry-confirmation.types';
import {
  parseCriticalHandoffPayload,
  type PortfolioEntryCriticalHandoffConfirmationState,
  type PortfolioEntryCriticalHandoffRecord,
} from '../domain/portfolio-entry-critical-handoff.types';
import {
  PORTFOLIO_ENTRY_EXECUTION_STATUSES,
  PORTFOLIO_ENTRY_SESSION_LIFECYCLE_STATUSES,
} from '../domain/portfolio-entry-session.lifecycle';
import {
  PORTFOLIO_ENTRY_OWNERSHIP_STATES,
  type PortfolioEntryOwnershipState,
} from '../domain/portfolio-entry-session-ownership';
import type {
  PortfolioEntryHandoffRecord,
  PortfolioEntryOrigin,
  PortfolioEntryProfile,
  PortfolioEntryQuestionBudgetState,
  PortfolioEntrySemanticState,
  PortfolioEntrySession,
  PortfolioEntrySourceMetadata,
  PortfolioEntryTurn,
  PortfolioEntryVersioning,
} from '../domain/portfolio-entry-session.types';
import { PORTFOLIO_ENTRY_TURN_INPUT_INTENTS } from '../domain/portfolio-entry-session.types';
import type { PortfolioEntryModelExecutionRecord } from '../observability/portfolio-entry-execution-metadata';

export const PORTFOLIO_ENTRY_ORIGINS = [
  'public_start',
  'authenticated_portfolio_entry',
  'imported_text',
] as const;

export const PORTFOLIO_ENTRY_INTERACTION_MODES = [
  'quick_clarification',
  'guided_exploration',
] as const;

export const PORTFOLIO_ENTRY_PROFILES = [
  'PORTFOLIO_LEAD_ENTRY',
  'INITIATIVE_ENTRY',
] as const;

const questionRecordSchema = z.object({
  id: z.string(),
  question: z.string(),
  reason_to_ask: z.string().nullable().optional(),
  question_type: z.string(),
  resolves: z.array(z.string()),
  turn_index: z.number(),
  interaction_mode: z.enum(PORTFOLIO_ENTRY_INTERACTION_MODES),
  asked_at_budget_remaining: z.number(),
});

const semanticStateSchema = z.object({
  pendingInput: z.object({
    id: z.string(),
    value: z.string(),
    status: z.enum(['RECEIVED', 'ANALYSIS_PENDING', 'ANALYZED', 'FAILED_RETRYABLE', 'SUPERSEDED']),
    receivedAt: z.string(),
    updatedAt: z.string(),
    provenance: z.object({ origin: z.literal('USER_DECLARED'), sourcePath: z.literal('messages.message'), sourceText: z.string() }),
    analysisVersion: z.string().optional(),
    failure: z.object({ errorType: z.string(), technicalError: z.string().optional() }).optional(),
  }).optional(),
  initialEntryState: portfolioEntryFrameV2Schema.optional(),
  currentFrame: portfolioEntryFrameV2Schema.optional(),
  primaryIntent: portfolioEntryIntentV2Schema.optional(),
  secondaryIntents: z.array(portfolioEntryIntentV2Schema).optional(),
  extractedContext: z.unknown().optional(),
  ambiguities: z.unknown().optional(),
  contradictions: z.unknown().optional(),
  reverseAlignment: reverseAlignmentV2Schema.optional(),
  unresolvedContext: z.array(z.unknown()).optional(),
  provenance: z.unknown().optional(),
  previousQuestions: z.array(questionRecordSchema),
  answeredGaps: z.array(z.string()),
  runtimeClarificationStatus: z.enum([
    'not_started',
    'in_progress',
    'exploration_offered',
    'guided_exploration',
    'ready_for_handoff',
    'ended_with_uncertainty',
    'abandoned',
  ]).optional(),
  userExplorationChoice: z.enum(['not_offered', 'accept', 'reject', 'provisional_route']).optional(),
});

const questionBudgetSchema = z.object({
  quickQuestionBudget: z.literal(3),
  quickQuestionsAsked: z.number(),
  explorationRound: z.number(),
  questionsAskedCurrentRound: z.number(),
});

const sourceMetadataSchema = z.record(z.unknown());

const sessionTransitionSchema = z.object({
  from_status: z.string(),
  to_status: z.string(),
  from_mode: z.enum(PORTFOLIO_ENTRY_INTERACTION_MODES),
  to_mode: z.enum(PORTFOLIO_ENTRY_INTERACTION_MODES),
  reason: z.string(),
  trigger: z.string(),
  budget_before: z.number(),
  budget_after: z.number(),
});

const executionPurposeSchema = z.enum(['analysis_turn', 'handoff_generation', 'technical_smoke']);

function parseJson<T>(schema: z.ZodTypeAny, value: unknown, field: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid persisted Portfolio Entry JSON at ${field}: ${parsed.error.message}`);
  }
  return parsed.data as T;
}

function assertEnumValue<T extends string>(
  values: readonly T[],
  value: string,
  field: string,
): T {
  if (!values.includes(value as T)) {
    throw new Error(`Invalid persisted Portfolio Entry value at ${field}: ${value}`);
  }
  return value as T;
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function toNullableInputJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return toInputJson(value);
}

export type PrismaPortfolioEntrySessionRow = {
  id: string;
  ownerUserId: string | null;
  publicAccessTokenHash: string | null;
  ownershipState: string;
  rawEntry: string;
  entryOrigin: string;
  sourceMetadata: Prisma.JsonValue | null;
  lifecycleStatus: string;
  executionStatus: string;
  interactionMode: string;
  semanticState: Prisma.JsonValue;
  questionBudget: Prisma.JsonValue;
  latestAnalysis: Prisma.JsonValue | null;
  continuationProfile: string | null;
  contractVersion: string;
  runtimeVersion: string;
  schemaVersion: string;
  promptManifestId: string | null;
  revision: number;
  contextRevision: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  expiredAt: Date | null;
};

export type PrismaPortfolioEntryTurnRow = {
  id: string;
  sessionId: string;
  turnIndex: number;
  userInput: string;
  inputIntent: string;
  emittedQuestions: Prisma.JsonValue;
  matchedQuestionIds: Prisma.JsonValue;
  respondedResolves: Prisma.JsonValue;
  analysisSnapshot: Prisma.JsonValue;
  semanticStateAfter: Prisma.JsonValue;
  questionBudgetBefore: Prisma.JsonValue;
  questionBudgetAfter: Prisma.JsonValue;
  transition: Prisma.JsonValue;
  provenanceDelta: Prisma.JsonValue | null;
  contractVersion: string;
  runtimeVersion: string;
  schemaVersion: string;
  promptManifestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PrismaPortfolioEntryHandoffRow = {
  id: string;
  sessionId: string;
  version: number;
  sourceTurnId: string | null;
  handoffPayload: Prisma.JsonValue;
  handoffStatus: string;
  schemaVersion: string;
  runtimeVersion: string;
  promptManifestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PrismaPortfolioEntryCriticalHandoffRow = {
  id: string;
  sessionId: string;
  artifactVersion: number;
  schemaVersion: string;
  sourceContextRevision: number;
  sourceTurnId: string | null;
  payload: Prisma.JsonValue;
  confirmationState: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PrismaPortfolioEntryConfirmationRow = {
  id: string;
  sessionId: string;
  handoffId: string;
  version: number;
  status: string;
  acceptedFields: Prisma.JsonValue;
  correctedFields: Prisma.JsonValue;
  rejectedFields: Prisma.JsonValue;
  notes: string | null;
  confirmedByUserId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PrismaPortfolioEntryModelExecutionRow = {
  id: string;
  sessionId: string;
  turnId: string | null;
  handoffId: string | null;
  purpose: string;
  provider: string;
  requestedModel: string;
  providerReportedModel: string | null;
  callId: string | null;
  durationMs: number;
  retryCount: number;
  retryReason: string | null;
  usage: Prisma.JsonValue | null;
  technicalError: Prisma.JsonValue | null;
  schemaErrors: Prisma.JsonValue;
  parsedOutputPresent: boolean;
  validatedOutputPresent: boolean;
  createdAt: Date;
};

export class PrismaPortfolioEntrySessionMapper {
  toSession(
    row: PrismaPortfolioEntrySessionRow,
    latestHandoff: PortfolioEntryHandoffRecord | null = null,
    confirmation: PortfolioEntryConfirmation | null = null,
  ): PortfolioEntrySession {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      publicAccessTokenHash: row.publicAccessTokenHash,
      ownershipState: assertEnumValue(PORTFOLIO_ENTRY_OWNERSHIP_STATES, row.ownershipState, 'session.ownershipState'),
      rawEntry: row.rawEntry,
      entryOrigin: assertEnumValue(PORTFOLIO_ENTRY_ORIGINS, row.entryOrigin, 'session.entryOrigin'),
      sourceMetadata: row.sourceMetadata === null
        ? undefined
        : parseJson<PortfolioEntrySourceMetadata>(sourceMetadataSchema, row.sourceMetadata, 'session.sourceMetadata'),
      lifecycleStatus: assertEnumValue(PORTFOLIO_ENTRY_SESSION_LIFECYCLE_STATUSES, row.lifecycleStatus, 'session.lifecycleStatus'),
      executionStatus: assertEnumValue(PORTFOLIO_ENTRY_EXECUTION_STATUSES, row.executionStatus, 'session.executionStatus'),
      interactionMode: assertEnumValue(PORTFOLIO_ENTRY_INTERACTION_MODES, row.interactionMode, 'session.interactionMode'),
      semanticState: parseJson<PortfolioEntrySemanticState>(semanticStateSchema, row.semanticState, 'session.semanticState'),
      questionBudget: parseJson<PortfolioEntryQuestionBudgetState>(questionBudgetSchema, row.questionBudget, 'session.questionBudget'),
      latestAnalysis: row.latestAnalysis === null
        ? null
        : parseJson(portfolioEntryAnalysisV2Schema, row.latestAnalysis, 'session.latestAnalysis'),
      continuationProfile: row.continuationProfile === null
        ? null
        : assertEnumValue(PORTFOLIO_ENTRY_PROFILES, row.continuationProfile, 'session.continuationProfile') as PortfolioEntryProfile,
      latestHandoff,
      confirmation,
      versioning: this.versioningFromRow(row),
      revision: row.revision,
      contextRevision: row.contextRevision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastActivityAt: row.lastActivityAt,
      expiresAt: row.expiresAt,
      expiredAt: row.expiredAt,
    };
  }

  toTurn(row: PrismaPortfolioEntryTurnRow): PortfolioEntryTurn {
    return {
      id: row.id,
      sessionId: row.sessionId,
      turnIndex: row.turnIndex,
      userInput: row.userInput,
      inputIntent: assertEnumValue(PORTFOLIO_ENTRY_TURN_INPUT_INTENTS, row.inputIntent, 'turn.inputIntent'),
      emittedQuestions: parseJson<QuestionRecord[]>(z.array(questionRecordSchema), row.emittedQuestions, 'turn.emittedQuestions'),
      matchedQuestionIds: parseJson<string[]>(z.array(z.string()), row.matchedQuestionIds, 'turn.matchedQuestionIds'),
      respondedResolves: parseJson<string[]>(z.array(z.string()), row.respondedResolves, 'turn.respondedResolves'),
      analysisSnapshot: parseJson(portfolioEntryAnalysisV2Schema, row.analysisSnapshot, 'turn.analysisSnapshot'),
      semanticStateAfter: parseJson<PortfolioEntrySemanticState>(semanticStateSchema, row.semanticStateAfter, 'turn.semanticStateAfter'),
      budgetBefore: parseJson<number>(z.number(), row.questionBudgetBefore, 'turn.questionBudgetBefore'),
      budgetAfter: parseJson<number>(z.number(), row.questionBudgetAfter, 'turn.questionBudgetAfter'),
      transition: parseJson<SessionTransition>(sessionTransitionSchema, row.transition, 'turn.transition'),
      provenanceDelta: row.provenanceDelta ?? undefined,
      versioning: this.versioningFromRow(row),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toHandoff(row: PrismaPortfolioEntryHandoffRow): PortfolioEntryHandoffRecord {
    const handoff = parseJson<PortfolioEntryHandoffRecord['handoff']>(
      portfolioEntryHandoffV2Schema,
      row.handoffPayload,
      'handoff.handoffPayload',
    );
    if (handoff.handoff_status !== row.handoffStatus) {
      throw new Error('Invalid persisted Portfolio Entry handoff status mismatch.');
    }
    return {
      id: row.id,
      sessionId: row.sessionId,
      version: row.version,
      handoff,
      sourceTurnId: row.sourceTurnId ?? undefined,
      status: handoff.handoff_status,
      versioning: this.versioningFromRow(row),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toCriticalHandoff(row: PrismaPortfolioEntryCriticalHandoffRow): PortfolioEntryCriticalHandoffRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      artifactVersion: row.artifactVersion,
      schemaVersion: row.schemaVersion,
      sourceContextRevision: row.sourceContextRevision,
      sourceTurnId: row.sourceTurnId ?? undefined,
      payload: parseCriticalHandoffPayload(row.schemaVersion, row.payload),
      confirmationState: assertEnumValue(
        ['provisional', 'confirmed'] as const satisfies readonly PortfolioEntryCriticalHandoffConfirmationState[],
        row.confirmationState,
        'criticalHandoff.confirmationState',
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toConfirmation(row: PrismaPortfolioEntryConfirmationRow): PortfolioEntryConfirmation {
    return {
      id: row.id,
      sessionId: row.sessionId,
      handoffId: row.handoffId,
      version: row.version,
      status: assertEnumValue(PORTFOLIO_ENTRY_CONFIRMATION_STATUSES, row.status, 'confirmation.status'),
      acceptedFields: parseJson<string[]>(z.array(z.string()), row.acceptedFields, 'confirmation.acceptedFields'),
      correctedFields: parseJson<Record<string, unknown>>(z.record(z.unknown()), row.correctedFields, 'confirmation.correctedFields'),
      rejectedFields: parseJson<string[]>(z.array(z.string()), row.rejectedFields, 'confirmation.rejectedFields'),
      notes: row.notes ?? undefined,
      confirmedByUserId: row.confirmedByUserId,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  toModelExecution(row: PrismaPortfolioEntryModelExecutionRow): PortfolioEntryModelExecutionRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      turnId: row.turnId,
      handoffId: row.handoffId,
      purpose: parseJson<PortfolioEntryModelExecutionRecord['purpose']>(executionPurposeSchema, row.purpose, 'modelExecution.purpose'),
      provider: row.provider,
      requestedModel: row.requestedModel,
      providerReportedModel: row.providerReportedModel,
      callId: row.callId ?? '',
      durationMs: row.durationMs,
      retryCount: row.retryCount,
      usage: row.usage ?? undefined,
      technicalError: typeof row.technicalError === 'string' ? row.technicalError : null,
      schemaErrors: parseJson<string[]>(z.array(z.string()), row.schemaErrors, 'modelExecution.schemaErrors'),
      parsedOutputPresent: row.parsedOutputPresent,
      validatedOutputPresent: row.validatedOutputPresent,
      createdAt: row.createdAt,
    };
  }

  sessionCreateData(session: PortfolioEntrySession): Prisma.PortfolioEntrySessionUncheckedCreateInput {
    return {
      id: session.id,
      ownerUserId: session.ownerUserId ?? null,
      publicAccessTokenHash: session.publicAccessTokenHash ?? null,
      ownershipState: session.ownershipState,
      rawEntry: session.rawEntry,
      entryOrigin: session.entryOrigin,
      sourceMetadata: session.sourceMetadata === undefined ? Prisma.JsonNull : toInputJson(session.sourceMetadata),
      lifecycleStatus: session.lifecycleStatus,
      executionStatus: session.executionStatus,
      interactionMode: session.interactionMode,
      semanticState: toInputJson(session.semanticState),
      questionBudget: toInputJson(session.questionBudget),
      latestAnalysis: session.latestAnalysis === undefined || session.latestAnalysis === null
        ? Prisma.JsonNull
        : toInputJson(session.latestAnalysis),
      continuationProfile: session.continuationProfile ?? null,
      contractVersion: session.versioning.contractVersion,
      runtimeVersion: session.versioning.runtimeVersion,
      schemaVersion: session.versioning.schemaVersion,
      promptManifestId: session.versioning.promptManifestId ?? null,
      revision: session.revision,
      contextRevision: session.contextRevision,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      expiredAt: session.expiredAt ?? null,
    };
  }

  sessionMutableData(session: PortfolioEntrySession): Prisma.PortfolioEntrySessionUncheckedUpdateManyInput {
    return {
      ownerUserId: session.ownerUserId ?? null,
      publicAccessTokenHash: session.publicAccessTokenHash ?? null,
      ownershipState: session.ownershipState,
      lifecycleStatus: session.lifecycleStatus,
      executionStatus: session.executionStatus,
      interactionMode: session.interactionMode,
      semanticState: toInputJson(session.semanticState),
      questionBudget: toInputJson(session.questionBudget),
      latestAnalysis: session.latestAnalysis === undefined || session.latestAnalysis === null
        ? Prisma.JsonNull
        : toInputJson(session.latestAnalysis),
      continuationProfile: session.continuationProfile ?? null,
      revision: session.revision,
      // contextRevision changes only through the dedicated repository primitive.
      updatedAt: session.updatedAt,
      lastActivityAt: session.lastActivityAt,
      expiredAt: session.expiredAt ?? null,
    };
  }

  turnCreateData(turn: PortfolioEntryTurn): Prisma.PortfolioEntryTurnUncheckedCreateInput {
    return {
      id: turn.id,
      sessionId: turn.sessionId,
      turnIndex: turn.turnIndex,
      userInput: turn.userInput,
      inputIntent: turn.inputIntent ?? 'answer',
      emittedQuestions: toInputJson(turn.emittedQuestions),
      matchedQuestionIds: toInputJson(turn.matchedQuestionIds),
      respondedResolves: toInputJson(turn.respondedResolves),
      analysisSnapshot: toInputJson(turn.analysisSnapshot),
      semanticStateAfter: toInputJson(turn.semanticStateAfter),
      questionBudgetBefore: toInputJson(turn.budgetBefore),
      questionBudgetAfter: toInputJson(turn.budgetAfter),
      transition: toInputJson(turn.transition),
      provenanceDelta: turn.provenanceDelta === undefined ? Prisma.JsonNull : toInputJson(turn.provenanceDelta),
      contractVersion: turn.versioning.contractVersion,
      runtimeVersion: turn.versioning.runtimeVersion,
      schemaVersion: turn.versioning.schemaVersion,
      promptManifestId: turn.versioning.promptManifestId ?? null,
      createdAt: turn.createdAt,
      updatedAt: turn.updatedAt,
    };
  }

  handoffCreateData(handoff: PortfolioEntryHandoffRecord): Prisma.PortfolioEntryHandoffUncheckedCreateInput {
    return {
      id: handoff.id,
      sessionId: handoff.sessionId,
      version: handoff.version,
      sourceTurnId: handoff.sourceTurnId ?? null,
      handoffPayload: toInputJson(handoff.handoff),
      handoffStatus: handoff.status,
      schemaVersion: handoff.versioning.schemaVersion,
      runtimeVersion: handoff.versioning.runtimeVersion,
      promptManifestId: handoff.versioning.promptManifestId ?? null,
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    };
  }

  criticalHandoffCreateData(
    handoff: PortfolioEntryCriticalHandoffRecord,
  ): Prisma.PortfolioEntryCriticalHandoffUncheckedCreateInput {
    return {
      id: handoff.id,
      sessionId: handoff.sessionId,
      artifactVersion: handoff.artifactVersion,
      schemaVersion: handoff.schemaVersion,
      sourceContextRevision: handoff.sourceContextRevision,
      sourceTurnId: handoff.sourceTurnId ?? null,
      payload: toInputJson(parseCriticalHandoffPayload(handoff.schemaVersion, handoff.payload)),
      createdAt: handoff.createdAt,
      updatedAt: handoff.updatedAt,
    };
  }

  confirmationCreateData(confirmation: PortfolioEntryConfirmation): Prisma.PortfolioEntryConfirmationUncheckedCreateInput {
    return {
      id: confirmation.id,
      sessionId: confirmation.sessionId,
      handoffId: confirmation.handoffId,
      version: confirmation.version,
      status: confirmation.status,
      acceptedFields: toInputJson(confirmation.acceptedFields),
      correctedFields: toInputJson(confirmation.correctedFields),
      rejectedFields: toInputJson(confirmation.rejectedFields),
      notes: confirmation.notes ?? null,
      confirmedByUserId: confirmation.confirmedByUserId ?? null,
      confirmedAt: confirmation.confirmedAt ?? null,
      createdAt: confirmation.createdAt,
      updatedAt: confirmation.updatedAt,
    };
  }

  modelExecutionCreateData(
    execution: PortfolioEntryModelExecutionRecord,
  ): Prisma.PortfolioEntryModelExecutionUncheckedCreateInput {
    return {
      id: execution.id,
      sessionId: execution.sessionId,
      turnId: execution.turnId ?? null,
      handoffId: execution.handoffId ?? null,
      purpose: execution.purpose,
      provider: execution.provider,
      requestedModel: execution.requestedModel,
      providerReportedModel: execution.providerReportedModel ?? null,
      callId: execution.callId || null,
      durationMs: execution.durationMs,
      retryCount: execution.retryCount,
      retryReason: null,
      usage: execution.usage === undefined ? Prisma.JsonNull : toInputJson(execution.usage),
      technicalError: execution.technicalError ? toInputJson(execution.technicalError) : Prisma.JsonNull,
      schemaErrors: toInputJson(execution.schemaErrors),
      parsedOutputPresent: execution.parsedOutputPresent,
      validatedOutputPresent: execution.validatedOutputPresent,
      createdAt: execution.createdAt,
    };
  }

  private versioningFromRow(row: {
    contractVersion?: string;
    runtimeVersion: string;
    schemaVersion: string;
    promptManifestId: string | null;
  }) {
    return {
      contractVersion: row.contractVersion ?? '',
      runtimeVersion: row.runtimeVersion,
      schemaVersion: row.schemaVersion,
      promptManifestId: row.promptManifestId ?? undefined,
    };
  }
}
