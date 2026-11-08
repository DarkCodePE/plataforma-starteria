import api, { parseApiError, type AuthError } from '../../../../app/services/api';

type ApiResponse<T> = { success: boolean; data: T };

export const PORTFOLIO_CONTEXT_REQUEST_TIMEOUT_MS = 15_000;

export type PortfolioBootstrapContextFieldProvenance =
  | 'user_declared'
  | 'source_extracted'
  | 'copilot_inferred'
  | 'copilot_suggested'
  | 'unknown';

export type PortfolioBootstrapContextSourceRef =
  | { kind: 'user_input' | 'decision_brief' }
  | { kind: 'copilot_inference' | 'copilot_suggestion'; reference?: string }
  | { kind: 'context_narrative_quote'; reviewId: string; reviewVersion: number; fieldPath: 'situation'; quote: string }
  | { kind: 'semantic_fact_quote'; turnId: string; semanticVersion: number; quote: string }
  | {
      kind: 'company_context_entry';
      dimension: string;
      fieldKey: string;
      sourceId: string | null;
      entryId?: string;
      entryFingerprint: string;
    };

export type PortfolioBootstrapContextField = {
  value: string | null;
  provenance: PortfolioBootstrapContextFieldProvenance;
  sourceRef?: PortfolioBootstrapContextSourceRef;
};

export type PortfolioBootstrapContextPayload = {
  situation: PortfolioBootstrapContextField;
  area: PortfolioBootstrapContextField;
  stakeholder: PortfolioBootstrapContextField;
  pilotExperience: PortfolioBootstrapContextField;
  constraints: PortfolioBootstrapContextField[];
  assumptions: PortfolioBootstrapContextField[];
  gaps: string[];
};

export type PortfolioBootstrapCompanyContextSource = {
  companyId: string;
  versionId: string;
  versionNumber: number;
};

export type PortfolioBootstrapContextReview = {
  id: string;
  sessionId: string;
  status: 'draft' | 'confirmed';
  version: number;
  draft: PortfolioBootstrapContextPayload;
  confirmedSnapshot: PortfolioBootstrapContextPayload | null;
  effectiveContext: PortfolioBootstrapContextPayload | null;
  hasPendingCorrection: boolean;
  sourceCompanyContext: PortfolioBootstrapCompanyContextSource | null;
  draftSourceCompanyContext: PortfolioBootstrapCompanyContextSource | null;
  confirmedSourceCompanyContext: PortfolioBootstrapCompanyContextSource | null;
  effectiveSourceCompanyContext: PortfolioBootstrapCompanyContextSource | null;
  draftProvenance: unknown;
  confirmedProvenance: unknown | null;
  effectiveProvenance: unknown | null;
  sourceOutdated: boolean;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavePortfolioBootstrapContextDraftInput = {
  expectedVersion: number;
  context: PortfolioBootstrapContextPayload;
  sourceCompanyContext: PortfolioBootstrapCompanyContextSource | null;
};

export function createEmptyPortfolioBootstrapContext(): PortfolioBootstrapContextPayload {
  const unknown = (): PortfolioBootstrapContextField => ({ value: null, provenance: 'unknown' });
  return {
    situation: unknown(),
    area: unknown(),
    stakeholder: unknown(),
    pilotExperience: unknown(),
    constraints: [],
    assumptions: [],
    gaps: [],
  };
}

export type PortfolioBootstrapContextProposal = {
  id: string;
  targetField: 'pilotExperience';
  value: string;
  status: 'UNREVIEWED';
  sourceKind: 'persisted_user_narrative' | 'semantic_fact';
  sourceRef: Extract<PortfolioBootstrapContextSourceRef, { kind: 'context_narrative_quote' | 'semantic_fact_quote' }>;
};

export type PortfolioBootstrapContextProjection = {
  reviewVersion: number | null;
  proposals: PortfolioBootstrapContextProposal[];
};

export class PortfolioBootstrapContextClientError extends Error {
  constructor(public readonly apiError: AuthError) {
    super(apiError.message);
    this.name = 'PortfolioBootstrapContextClientError';
  }
}

async function contextRequest<T>(
  request: () => Promise<{ data: ApiResponse<T> }>,
  timeoutMessage: string,
): Promise<T> {
  try {
    return (await request()).data.data;
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      throw new PortfolioBootstrapContextClientError({
        code: 'REQUEST_TIMEOUT',
        message: timeoutMessage,
        hint: 'Reintenta la operación; se conservará la misma clave idempotente.',
      });
    }
    throw new PortfolioBootstrapContextClientError(parseApiError(error));
  }
}

export function getPortfolioBootstrapContext(sessionId: string): Promise<PortfolioBootstrapContextReview | null> {
  return contextRequest(() => api.get<ApiResponse<PortfolioBootstrapContextReview | null>>(
    `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/context`,
    { timeout: PORTFOLIO_CONTEXT_REQUEST_TIMEOUT_MS },
  ), 'Tiempo de espera agotado al cargar el contexto.');
}

export function getPortfolioBootstrapContextProposals(
  sessionId: string,
): Promise<PortfolioBootstrapContextProjection> {
  return contextRequest(() => api.get<ApiResponse<PortfolioBootstrapContextProjection>>(
    `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/context/proposals`,
    { timeout: PORTFOLIO_CONTEXT_REQUEST_TIMEOUT_MS },
  ), 'Tiempo de espera agotado al revisar hechos ya declarados.');
}

export function savePortfolioBootstrapContextDraft(
  sessionId: string,
  input: SavePortfolioBootstrapContextDraftInput,
  idempotencyKey: string,
): Promise<PortfolioBootstrapContextReview> {
  return contextRequest(() => api.put<ApiResponse<PortfolioBootstrapContextReview>>(
    `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/context/draft`,
    input,
    {
      headers: { 'Idempotency-Key': idempotencyKey },
      timeout: PORTFOLIO_CONTEXT_REQUEST_TIMEOUT_MS,
    },
  ), 'Tiempo de espera agotado al guardar el contexto.');
}

export function confirmPortfolioBootstrapContext(
  sessionId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<PortfolioBootstrapContextReview> {
  return contextRequest(() => api.post<ApiResponse<PortfolioBootstrapContextReview>>(
    `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/context/confirm`,
    { expectedVersion },
    {
      headers: { 'Idempotency-Key': idempotencyKey },
      timeout: PORTFOLIO_CONTEXT_REQUEST_TIMEOUT_MS,
    },
  ), 'Tiempo de espera agotado al confirmar el contexto.');
}
