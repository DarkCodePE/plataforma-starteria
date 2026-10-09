import type { PortfolioEntryAnalysisV2 } from '../../portfolio-entry-runtime/domain/analysis.schema';
import type { PortfolioEntryHandoffV2 } from '../../portfolio-entry-runtime/domain/handoff.schema';
import type {
  InteractionMode,
  ClarificationStatus,
  QuestionRecord,
  SessionContext,
  SessionTransition,
  UserExplorationChoice,
} from '../../portfolio-entry-runtime/domain/session.types';
import type {
  PortfolioEntryExecutionStatus,
  PortfolioEntrySessionLifecycleStatus,
} from './portfolio-entry-session.lifecycle';
import type { PortfolioEntryConfirmation } from './portfolio-entry-confirmation.types';
import type { PortfolioEntryOwnershipState } from './portfolio-entry-session-ownership';

export type PortfolioEntryOrigin = 'public_start' | 'authenticated_portfolio_entry' | 'imported_text';
export type PortfolioEntryProfile = 'PORTFOLIO_LEAD_ENTRY' | 'INITIATIVE_ENTRY';

export type PortfolioEntrySourceMetadata = {
  surface?: string;
  locale?: string;
  userAgentHash?: string;
  ipHash?: string;
  [key: string]: unknown;
};

export type PortfolioEntryVersioning = {
  contractVersion: string;
  runtimeVersion: string;
  schemaVersion: string;
  promptManifestId?: string;
};

export const PORTFOLIO_ENTRY_TURN_INPUT_INTENTS = ['answer', 'correction', 'checkpoint_choice'] as const;
export type PortfolioEntryTurnInputIntent = (typeof PORTFOLIO_ENTRY_TURN_INPUT_INTENTS)[number];

export type PortfolioEntryQuestionBudgetState = {
  quickQuestionBudget: 3;
  quickQuestionsAsked: number;
  explorationRound: number;
  questionsAskedCurrentRound: number;
};

export type PortfolioEntrySemanticState = {
  pendingInput?: PortfolioEntryPendingInput;
  initialEntryState?: PortfolioEntryAnalysisV2['initial_entry_state'];
  currentFrame?: PortfolioEntryAnalysisV2['current_frame'];
  primaryIntent?: PortfolioEntryAnalysisV2['primary_intent'];
  secondaryIntents?: PortfolioEntryAnalysisV2['secondary_intents'];
  extractedContext?: PortfolioEntryAnalysisV2['extracted_context'];
  ambiguities?: PortfolioEntryAnalysisV2['ambiguities'];
  contradictions?: PortfolioEntryAnalysisV2['contradictions'];
  reverseAlignment?: PortfolioEntryAnalysisV2['reverse_alignment'];
  unresolvedContext?: unknown[];
  provenance?: unknown;
  previousQuestions: QuestionRecord[];
  answeredGaps: string[];
  runtimeClarificationStatus?: ClarificationStatus;
  userExplorationChoice?: UserExplorationChoice;
};

export type PortfolioEntryPendingInputStatus =
  | 'RECEIVED'
  | 'ANALYSIS_PENDING'
  | 'ANALYZED'
  | 'FAILED_RETRYABLE'
  | 'SUPERSEDED';

export type PortfolioEntryPendingInput = {
  id: string;
  value: string;
  status: PortfolioEntryPendingInputStatus;
  receivedAt: string;
  updatedAt: string;
  provenance: {
    origin: 'USER_DECLARED';
    sourcePath: 'messages.message';
    sourceText: string;
  };
  analysisVersion?: string;
  failure?: { errorType: string; technicalError?: string };
};

export type PortfolioEntryHandoffRecord = {
  id: string;
  sessionId: string;
  version: number;
  handoff: PortfolioEntryHandoffV2;
  sourceTurnId?: string;
  status: PortfolioEntryHandoffV2['handoff_status'];
  versioning: PortfolioEntryVersioning;
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioEntryTurn = {
  id: string;
  sessionId: string;
  turnIndex: number;
  userInput: string;
  inputIntent?: PortfolioEntryTurnInputIntent;
  emittedQuestions: QuestionRecord[];
  matchedQuestionIds: string[];
  respondedResolves: string[];
  analysisSnapshot: PortfolioEntryAnalysisV2;
  semanticStateAfter: PortfolioEntrySemanticState;
  budgetBefore: number;
  budgetAfter: number;
  transition: SessionTransition;
  provenanceDelta?: unknown;
  versioning: PortfolioEntryVersioning;
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioEntrySession = {
  id: string;
  ownerUserId?: string | null;
  publicAccessTokenHash?: string | null;
  ownershipState: PortfolioEntryOwnershipState;
  rawEntry: string;
  entryOrigin: PortfolioEntryOrigin;
  sourceMetadata?: PortfolioEntrySourceMetadata;
  lifecycleStatus: PortfolioEntrySessionLifecycleStatus;
  executionStatus: PortfolioEntryExecutionStatus;
  interactionMode: InteractionMode;
  semanticState: PortfolioEntrySemanticState;
  questionBudget: PortfolioEntryQuestionBudgetState;
  latestAnalysis?: PortfolioEntryAnalysisV2 | null;
  continuationProfile?: PortfolioEntryProfile | null;
  latestHandoff?: PortfolioEntryHandoffRecord | null;
  confirmation?: PortfolioEntryConfirmation | null;
  versioning: PortfolioEntryVersioning;
  revision: number;
  contextRevision: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  expiredAt?: Date | null;
};

export function semanticStateFromRuntimeContext(
  context: SessionContext,
  analysis?: PortfolioEntryAnalysisV2,
): PortfolioEntrySemanticState {
  return {
    initialEntryState: analysis?.initial_entry_state,
    currentFrame: analysis?.current_frame,
    primaryIntent: analysis?.primary_intent,
    secondaryIntents: analysis?.secondary_intents,
    extractedContext: analysis?.extracted_context,
    ambiguities: analysis?.ambiguities,
    contradictions: analysis?.contradictions,
    reverseAlignment: analysis?.reverse_alignment,
    provenance: analysis?.provenance,
    previousQuestions: context.previous_questions,
    answeredGaps: context.answered_gaps,
    runtimeClarificationStatus: context.clarification_status,
    userExplorationChoice: context.user_exploration_choice,
  };
}
