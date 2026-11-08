import api, { parseApiError, type AuthError } from '../../../../app/services/api';

type ApiResponse<T> = { success: boolean; data: T };

export const PORTFOLIO_SEMANTIC_REQUEST_TIMEOUT_MS = 30_000;

export type PortfolioBootstrapSemanticEvidenceRef =
  | { kind: 'user_input'; quote: string }
  | { kind: 'context_review_field'; reviewVersion: number; fieldPath: string }
  | { kind: 'company_context_entry'; companyId: string; versionId: string; entryFingerprint: string };

export type PortfolioBootstrapSemanticFact = {
  conceptId: string;
  value: unknown;
  provenance: 'user_declared' | 'source_extracted';
  evidenceRefs: PortfolioBootstrapSemanticEvidenceRef[];
  confidence: number;
  status: 'observed' | 'confirmed' | 'retracted';
};

export type PortfolioBootstrapSemanticHypothesis = {
  hypothesisId: string;
  statement: string;
  provenance: 'copilot_inferred' | 'copilot_suggested';
  supportConceptIds: string[];
  confidence: number;
  status: 'proposed' | 'accepted' | 'rejected';
};

export type PortfolioBootstrapSemanticDisposition = {
  conceptId: string;
  disposition: 'unknown' | 'not_applicable';
  provenance: 'user_declared';
  evidenceRefs: Array<{ kind: 'user_input'; quote: string }>;
};

export type PortfolioBootstrapSemanticQuestion = {
  id: string;
  recap: string;
  question: string;
  reasonToAsk: string;
  resolves: string[];
};

export type PortfolioBootstrapSemanticConvergence = {
  status:
    | 'question_required'
    | 'ready_for_human_review'
    | 'user_chose_review_with_unknowns'
    | 'budget_checkpoint'
    | 'provider_retryable_failure'
    | 'safety_stop';
  reason: string;
};

export type PortfolioBootstrapSemanticQuestionBudget = { limit: number | null; used: number };

export type PortfolioBootstrapSemanticExecution = {
  provider: string | null;
  model: string | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  retryCount: number;
  fallbackUsed: boolean;
};

export type PortfolioBootstrapSemanticState = {
  id: string;
  sessionId: string;
  version: number;
  factLedger: Array<PortfolioBootstrapSemanticFact & { turnId: string; semanticVersion: number }>;
  hypotheses: Array<PortfolioBootstrapSemanticHypothesis & { turnId: string; semanticVersion: number }>;
  dispositions: Array<PortfolioBootstrapSemanticDisposition & { turnId: string; semanticVersion: number }>;
  answeredGaps: string[];
  questionHistory: Array<PortfolioBootstrapSemanticQuestion & { turnId: string; semanticVersion: number }>;
  answeredQuestionIds: string[];
  activeQuestion: PortfolioBootstrapSemanticQuestion | null;
  convergence: PortfolioBootstrapSemanticConvergence;
  questionBudget: PortfolioBootstrapSemanticQuestionBudget;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapSemanticTurn = {
  id: string;
  semanticVersion: number;
  organizationId: string | null;
  actorUserId: string;
  inputText: string;
  status: 'completed' | 'failed_retryable' | 'failed_terminal';
  attempt: number;
  attempts: unknown[];
  facts: PortfolioBootstrapSemanticFact[];
  hypotheses: PortfolioBootstrapSemanticHypothesis[];
  dispositions: PortfolioBootstrapSemanticDisposition[];
  answeredGaps: string[];
  answeredQuestionId: string | null;
  emittedQuestion: PortfolioBootstrapSemanticQuestion | null;
  convergence: PortfolioBootstrapSemanticConvergence;
  questionBudget: PortfolioBootstrapSemanticQuestionBudget;
  error: { code: string; retryable: boolean } | null;
  execution: PortfolioBootstrapSemanticExecution;
  createdAt: string;
};

export type PortfolioBootstrapSemanticSnapshot = {
  enabled: boolean;
  state: PortfolioBootstrapSemanticState | null;
  turns: PortfolioBootstrapSemanticTurn[];
};

export type SubmitPortfolioBootstrapSemanticTurnInput = {
  expectedVersion: number;
  inputText: string;
  answeredQuestionId: string | null;
};

export type PortfolioBootstrapSemanticTurnResult = {
  state: PortfolioBootstrapSemanticState;
  turn: PortfolioBootstrapSemanticTurn;
};

export class PortfolioBootstrapSemanticClientError extends Error {
  constructor(public readonly apiError: AuthError) {
    super(apiError.message);
    this.name = 'PortfolioBootstrapSemanticClientError';
  }
}

function semanticError(error: unknown, timeoutMessage: string): PortfolioBootstrapSemanticClientError {
  const code = (error as { code?: unknown })?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return new PortfolioBootstrapSemanticClientError({
      code: 'REQUEST_TIMEOUT',
      message: timeoutMessage,
      hint: 'Puedes reintentar: Starteria conservará la misma clave del turno.',
    });
  }
  return new PortfolioBootstrapSemanticClientError(parseApiError(error));
}

export async function getPortfolioBootstrapSemanticContext(
  sessionId: string,
): Promise<PortfolioBootstrapSemanticSnapshot> {
  try {
    const response = await api.get<ApiResponse<PortfolioBootstrapSemanticSnapshot>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/context/semantic`,
      { timeout: PORTFOLIO_SEMANTIC_REQUEST_TIMEOUT_MS },
    );
    return response.data.data;
  } catch (error) {
    throw semanticError(error, 'Tiempo de espera agotado al recuperar la conversación.');
  }
}

export async function submitPortfolioBootstrapSemanticTurn(
  sessionId: string,
  input: SubmitPortfolioBootstrapSemanticTurnInput,
  idempotencyKey: string,
): Promise<{ processing: boolean; result: PortfolioBootstrapSemanticTurnResult }> {
  try {
    const response = await api.post<ApiResponse<PortfolioBootstrapSemanticTurnResult>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/context/semantic/turns`,
      input,
      {
        headers: { 'Idempotency-Key': idempotencyKey },
        timeout: PORTFOLIO_SEMANTIC_REQUEST_TIMEOUT_MS,
      },
    );
    return { processing: response.status === 202, result: response.data.data };
  } catch (error) {
    throw semanticError(error, 'La interpretación está tardando más de lo previsto.');
  }
}
