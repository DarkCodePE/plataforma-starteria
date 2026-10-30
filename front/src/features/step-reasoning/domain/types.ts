export type StepReasoningTurnStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type StepReasoningExecutionMode = 'live_llm' | 'qa_stub' | 'limited_fallback' | null;
export type StepReasoningStepNumber = 0 | 1 | 2 | 3 | 4;

export interface StepReasoningSuggestion {
  field: string;
  proposedValue: string;
  rationale?: string;
  status: 'UNREVIEWED';
  sourceRefs?: string[];
}

export interface StepReasoningTurn {
  id: string;
  clientTurnId: string;
  inputText: string;
  assistantText: string | null;
  status: StepReasoningTurnStatus;
  executionMode: StepReasoningExecutionMode;
  errorCode?: string | null;
  structuredOutput?: { suggestions?: StepReasoningSuggestion[]; warnings?: string[] } | null;
  createdAt?: string;
}

export interface StepReasoningSession {
  id: string;
  cycleId: string;
  contextHash: string;
}

export interface StepReasoningSessionView {
  session: StepReasoningSession | null;
  turns: StepReasoningTurn[];
  context?: {
    cycleId: string;
    contextHash: string;
    step?: { routeType?: string | null; depthLevel?: string | null; configVersion?: number | null };
    checkpoint?: { key?: string | null; title?: string | null };
  };
}

export interface StepReasoningTurnResult {
  session: StepReasoningSession;
  turn: StepReasoningTurn;
  idempotentReplay?: boolean;
}

export interface StepReasoningClient {
  getSession(projectId: string, stepNumber: StepReasoningStepNumber): Promise<StepReasoningSessionView>;
  sendTurn(projectId: string, stepNumber: StepReasoningStepNumber, input: {
    sessionId?: string;
    clientTurnId: string;
    expectedCycleId?: string;
    expectedContextHash?: string;
    message: string;
    mode: 'work_with_me';
    retryFailed?: boolean;
  }): Promise<StepReasoningTurnResult>;
}
