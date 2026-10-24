import api, { parseApiError, type AuthError } from '../../../../app/services/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export type PortfolioBootstrapAnchorStatus =
  | 'anchor_insufficient'
  | 'anchor_provisional'
  | 'anchor_sufficient'
  | 'anchor_confirmed'
  | 'anchor_conflicting';

export type PortfolioBootstrapAnchor = {
  id: string;
  bootstrapSessionId: string;
  outcomeStatement: string;
  contextSummary: string | null;
  decisionToEnable: string | null;
  businessSignalStatus: 'confirmed' | 'proxy' | 'suggested' | 'unknown' | 'conflicting';
  businessSignalValue: string | null;
  status: PortfolioBootstrapAnchorStatus;
  sourceRefs: unknown;
  provenanceStatus: 'raw_entry' | 'extracted' | 'ai_inferred' | 'ai_suggested' | 'user_confirmed';
  confirmedBy: string | null;
  confirmedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapSession = {
  id: string;
  userId: string;
  organizationId: string | null;
  sourceContinuationId: string | null;
  status:
    | 'active'
    | 'awaiting_anchor_review'
    | 'awaiting_work_intake'
    | 'awaiting_structuring'
    | 'awaiting_material_review'
    | 'awaiting_first_reading'
    | 'reading_published'
    | 'abandoned';
  bootstrapPhase:
    | 'B0_CONTINUE'
    | 'B1_ANCHOR'
    | 'B2_WORK_INTAKE'
    | 'B3_PROVISIONAL_STRUCTURING'
    | 'B4_MATERIAL_REVIEW'
    | 'B5_FIRST_READING';
  existingWorkStatus: PortfolioBootstrapExistingWorkStatus;
  setupCompletedAt?: string | null;
  setupCompletedByActorId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapExistingWorkStatus = 'unknown' | 'has_work' | 'no_existing_work';

export type PortfolioBootstrapWorkItem = {
  id: string;
  bootstrapSessionId: string;
  rawLabel: string;
  proposedName: string | null;
  proposedPurpose: string | null;
  sourceType: 'pasted_text' | 'manual_entry' | 'entry_context' | 'imported_file';
  status: 'detected' | 'needs_review' | 'pending' | 'confirmed_in_portfolio' | 'rejected';
  currentStateHint: 'idea' | 'candidate' | 'active' | 'paused' | 'completed' | 'unknown' | null;
  ownerCandidate: string | null;
  sourceRefs: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapImportMapping = {
  label?: string | null;
  owner?: string | null;
  state?: string | null;
  purpose?: string | null;
  signal?: string | null;
  notes?: string | null;
};

export type PortfolioBootstrapImportPreviewRow = {
  rowNumber: number;
  rawRow: Record<string, string>;
};

export type PortfolioBootstrapImportWarning = {
  code: string;
  message: string;
  rowNumber?: number;
};

export type PortfolioBootstrapImportBatch = {
  id: string;
  bootstrapSessionId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  status: 'uploaded' | 'mapping_required' | 'ready_to_import' | 'imported' | 'failed';
  rowCount: number;
  sheetName: string | null;
  rawHeaders: string[];
  confirmedMapping: PortfolioBootstrapImportMapping | null;
  suggestedMapping: PortfolioBootstrapImportMapping;
  previewRows: PortfolioBootstrapImportPreviewRow[];
  warnings: PortfolioBootstrapImportWarning[];
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapImportCommitResponse = {
  batch: PortfolioBootstrapImportBatch;
  workItems: PortfolioBootstrapWorkItem[];
  skippedRows: number;
  duplicateRows: number;
};

export type PortfolioBootstrapAnalysisRun = {
  id: string;
  bootstrapSessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  analyzerMode: 'deterministic' | 'real_ai';
  inputVersion: string;
  outputVersion: string | null;
  error: unknown;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type PortfolioBootstrapProposedMutation = {
  id: string;
  bootstrapSessionId: string;
  analysisRunId: string;
  targetType: 'work_item' | 'strategic_connection' | 'advancement_condition' | 'portfolio_anchor';
  targetId: string | null;
  mutationType: 'create' | 'update' | 'classify' | 'link' | 'unlink' | 'confirm' | 'reject';
  currentValue: unknown;
  originalProposedValue: unknown;
  proposedValue: unknown;
  rationale: string | null;
  reviewNote: string | null;
  sourceRefs: unknown;
  provenanceStatus: 'ai_inferred' | 'ai_suggested';
  uncertainty: 'low' | 'medium' | 'high';
  materiality: 'low' | 'material';
  confirmationRequired: boolean;
  status: 'proposed' | 'reviewed' | 'confirmed' | 'rejected' | 'superseded' | 'expired';
  reviewedBy: string | null;
  reviewedAt: string | null;
  correctedBy: string | null;
  correctedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioStrategicConnection = {
  id: string;
  bootstrapSessionId: string;
  workItemId: string;
  anchorId: string;
  sourceMutationId: string;
  status: 'confirmed_alignment' | 'partial_alignment' | 'alignment_unknown' | 'confirmed_misalignment' | 'out_of_current_priority';
  rationale: string | null;
  provenanceStatus: 'user_confirmed';
  sourceRefs: unknown;
  confirmedBy: string;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioAdvancementCondition = {
  id: string;
  bootstrapSessionId: string;
  workItemId: string | null;
  sourceMutationId: string;
  type: 'business_signal' | 'decision_path' | 'critical_dependency' | 'required_context' | 'ownership_visibility';
  status: string;
  statement: string;
  severity: 'info' | 'attention' | 'blocking';
  movementAffected: string | null;
  provenanceStatus: 'user_confirmed';
  sourceRefs: unknown;
  confirmedBy: string;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioAttentionItem = {
  type: 'missing_business_signal' | 'unresolved_dependency' | 'missing_decision_path' | 'information_conflict' | 'possible_misalignment' | 'ownership_gap' | 'missing_required_context';
  title: string;
  statement: string;
  whyItMatters: string;
  targetRef?: { type: 'work_item' | 'portfolio_anchor' | 'portfolio'; id: string };
  severity: 'info' | 'attention' | 'blocking';
  sourceRefs: unknown;
  nextAction?: string;
};

export type PortfolioReading = {
  id: string;
  bootstrapSessionId: string;
  anchorId: string;
  version: number;
  summary: string;
  totalWorkItems: number;
  confirmedConnections: number;
  uncertainConnections: number;
  signalGapCount: number;
  unresolvedDependencyCount: number;
  decisionPathGapCount: number;
  requiredContextGapCount: number;
  ownershipGapCount: number;
  possibleMisalignmentCount: number;
  confirmedMisalignmentCount: number;
  primaryAttentionItems: PortfolioAttentionItem[];
  nextBestAction: string;
  sourceBootstrapVersion: string;
  sourceAnchorVersion: number;
  sourceSnapshot: unknown;
  stateHash: string;
  homeState: 'HOME_D' | 'HOME_E';
  publishedBy: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapResponse = {
  sourceContinuation: { id: string; sessionId: string } | null;
  bootstrapSession: PortfolioBootstrapSession;
  anchor: PortfolioBootstrapAnchor | null;
  importBatches: PortfolioBootstrapImportBatch[];
  workItems: PortfolioBootstrapWorkItem[];
  proposedMutations: PortfolioBootstrapProposedMutation[];
  latestAnalysisRun: PortfolioBootstrapAnalysisRun | null;
  strategicConnections: PortfolioStrategicConnection[];
  advancementConditions: PortfolioAdvancementCondition[];
  latestReading: PortfolioReading | null;
};

export type PortfolioBootstrapWorkItemsResponse = {
  sessionId: string;
  existingWorkStatus: PortfolioBootstrapExistingWorkStatus;
  items: PortfolioBootstrapWorkItem[];
};

export type PortfolioBootstrapAnalyzeResponse = {
  analysisRunId: string;
  proposedMutations: PortfolioBootstrapProposedMutation[];
  homeState: 'HOME_C';
};

export type PortfolioBootstrapProposedMutationsResponse = {
  sessionId: string;
  proposedMutations: PortfolioBootstrapProposedMutation[];
  materialReviewComplete: boolean;
  nextAction: 'review_proposed_structure' | 'generate_first_portfolio_reading';
};

export type PortfolioBootstrapMutationReviewResponse = {
  mutation: PortfolioBootstrapProposedMutation;
  strategicConnection: PortfolioStrategicConnection | null;
  advancementCondition: PortfolioAdvancementCondition | null;
  materialReviewComplete: boolean;
  nextAction: 'review_proposed_structure' | 'generate_first_portfolio_reading';
};

export type PortfolioBootstrapReadingPublishResponse = {
  reading: PortfolioReading;
  homeState: 'HOME_D' | 'HOME_E';
  nextBestAction: string;
};

export type PortfolioOrganizationChallengeCandidate = {
  candidateId: string;
  title: string;
  problem: string;
  rationale: string;
  relatedInitiativeIds: string[];
  evidence: string[];
  gaps: string[];
  overlaps: string[];
};

export type PortfolioOrganizationFrontCandidate = {
  candidateId: string;
  name: string;
  focus: string;
  rationale: string;
  coverage: string;
  challenges: PortfolioOrganizationChallengeCandidate[];
};

export type PortfolioOrganizationPayload = {
  summary: string;
  fronts: PortfolioOrganizationFrontCandidate[];
  crossCuttingInitiativeIds: string[];
  outsideObjectiveInitiativeIds: string[];
  ungroupedInitiativeIds: string[];
};

export type PortfolioOrganizationMaterialization = {
  id: string;
  proposalVersion: number;
  canonicalMappings: {
    fronts: Array<{ candidateId: string; canonicalId: string }>;
    challenges: Array<{ candidateId: string; canonicalId: string; relatedInitiativeIds: string[] }>;
    specialDestinations?: {
      crossCuttingInitiativeIds: string[];
      outsideObjectiveInitiativeIds: string[];
      ungroupedInitiativeIds: string[];
    };
  };
  confirmedBy: string;
  confirmedAt: string;
};

export type PortfolioOrganizationProposal = {
  id: string;
  version: number;
  status: 'reviewed' | 'superseded' | 'materialized';
  sourceVersion: string;
  payload: PortfolioOrganizationPayload;
  sourceRefs: unknown;
  provenance: unknown;
  reviewedBy: string;
  reviewedAt: string;
  materialization: PortfolioOrganizationMaterialization | null;
};

export type UpdatePortfolioBootstrapAnchorInput = {
  outcomeStatement?: string;
  contextSummary?: string | null;
  decisionToEnable?: string | null;
  businessSignalStatus?: PortfolioBootstrapAnchor['businessSignalStatus'];
  businessSignalValue?: string | null;
  /** Source/provenance envelope retained by the provisional Anchor. */
  sourceRefs?: unknown;
};

export type ManualPortfolioBootstrapWorkItemInput = {
  label: string;
  purpose?: string;
  currentStateHint?: PortfolioBootstrapWorkItem['currentStateHint'];
};

export type UpdatePortfolioBootstrapWorkItemInput = {
  label?: string;
  purpose?: string | null;
  currentStateHint?: PortfolioBootstrapWorkItem['currentStateHint'];
};

export class PortfolioBootstrapClientError extends Error {
  constructor(public readonly apiError: AuthError) {
    super(apiError.message);
  }
}

export async function createOrReusePortfolioBootstrapSession(
  portfolioEntryContinuationId: string,
): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapResponse>>(
      '/portfolio-bootstrap/sessions/from-continuation',
      { portfolioEntryContinuationId },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

/** Opens the existing provisional bootstrap workflow from normal Portfolio Lead entry. */
export async function createOrReuseDirectPortfolioBootstrapSession(): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapResponse>>(
      '/portfolio-bootstrap/sessions/direct',
      {},
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

/** Reads an existing Copilot workspace without provisioning a new session. */
export async function getCurrentPortfolioBootstrapSession(): Promise<PortfolioBootstrapResponse | null> {
  try {
    const { data } = await api.get<ApiResponse<PortfolioBootstrapResponse | null>>(
      '/portfolio-bootstrap/sessions/current',
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function completePortfolioSetup(sessionId: string): Promise<{ completed: true; completedAt: string; summary: { sent: number; unsent: number; failed: number } }> {
  try {
    const { data } = await api.post<ApiResponse<{ completed: true; completedAt: string; summary: { sent: number; unsent: number; failed: number } }>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/complete-setup`,
      { confirmed: true },
      { headers: { 'Idempotency-Key': `portfolio-setup-complete:${sessionId}` } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function openAdditionalPortfolioFrontSetup(idempotencyKey: string): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapResponse>>(
      '/portfolio-bootstrap/sessions/additional-front',
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function createOrReusePortfolioSetupBootstrapSession(snapshotId: string): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapResponse>>(
      '/portfolio-bootstrap/sessions/from-portfolio-setup-continuity', { snapshotId });
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function getPortfolioBootstrapSession(sessionId: string): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.get<ApiResponse<PortfolioBootstrapResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}`,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function getPortfolioOrganizationProposal(sessionId: string): Promise<PortfolioOrganizationProposal | null> {
  try {
    const { data } = await api.get<ApiResponse<PortfolioOrganizationProposal | null>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/organization-proposal`,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function savePortfolioOrganizationProposal(
  sessionId: string,
  version: number,
  payload: PortfolioOrganizationPayload,
): Promise<PortfolioOrganizationProposal> {
  try {
    const { data } = await api.put<ApiResponse<PortfolioOrganizationProposal>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/organization-proposal`,
      { expectedVersion: version, payload },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function confirmPortfolioOrganizationProposal(
  sessionId: string,
  version: number,
): Promise<PortfolioOrganizationProposal> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioOrganizationProposal>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/organization-proposal/confirm`,
      { proposalVersion: version },
      { headers: { 'Idempotency-Key': stableClientIdempotencyKey('confirm-organization', `${sessionId}:${version}`) } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function updatePortfolioBootstrapAnchor(
  sessionId: string,
  input: UpdatePortfolioBootstrapAnchorInput,
): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.patch<ApiResponse<PortfolioBootstrapResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/anchor`,
      input,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function confirmPortfolioBootstrapAnchor(sessionId: string): Promise<PortfolioBootstrapResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/anchor/confirm`,
      {},
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function pastePortfolioBootstrapWorkItems(
  sessionId: string,
  text: string,
): Promise<PortfolioBootstrapWorkItemsResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapWorkItemsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/work-items/paste`,
      { text },
      { headers: { 'Idempotency-Key': stableClientIdempotencyKey('paste', text) } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function addManualPortfolioBootstrapWorkItem(
  sessionId: string,
  input: ManualPortfolioBootstrapWorkItemInput,
): Promise<PortfolioBootstrapWorkItemsResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapWorkItemsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/work-items/manual`,
      input,
      { headers: { 'Idempotency-Key': stableClientIdempotencyKey('manual', JSON.stringify(input)) } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function declareNoExistingPortfolioBootstrapWork(
  sessionId: string,
): Promise<PortfolioBootstrapWorkItemsResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapWorkItemsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/work-items/none`,
      {},
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function listPortfolioBootstrapWorkItems(
  sessionId: string,
): Promise<PortfolioBootstrapWorkItemsResponse> {
  try {
    const { data } = await api.get<ApiResponse<PortfolioBootstrapWorkItemsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/work-items`,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function uploadPortfolioBootstrapImport(
  sessionId: string,
  file: File,
): Promise<PortfolioBootstrapImportBatch> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapImportBatch>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/imports`,
      {
        fileName: file.name,
        fileType: file.type || inferFileType(file.name),
        fileSize: file.size,
        contentBase64: await fileToBase64(file),
      },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function updatePortfolioBootstrapImportMapping(
  sessionId: string,
  importId: string,
  confirmedMapping: PortfolioBootstrapImportMapping,
): Promise<PortfolioBootstrapImportBatch> {
  try {
    const { data } = await api.patch<ApiResponse<PortfolioBootstrapImportBatch>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/imports/${encodeURIComponent(importId)}/mapping`,
      { confirmedMapping },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function commitPortfolioBootstrapImport(
  sessionId: string,
  batch: PortfolioBootstrapImportBatch,
  confirmedMapping: PortfolioBootstrapImportMapping,
): Promise<PortfolioBootstrapImportCommitResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapImportCommitResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/imports/${encodeURIComponent(batch.id)}/commit`,
      {},
      { headers: { 'Idempotency-Key': stableClientIdempotencyKey('import', `${batch.fileHash}:${JSON.stringify(confirmedMapping)}`) } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function updatePortfolioBootstrapWorkItem(
  sessionId: string,
  workItemId: string,
  input: UpdatePortfolioBootstrapWorkItemInput,
): Promise<PortfolioBootstrapWorkItemsResponse> {
  try {
    const { data } = await api.patch<ApiResponse<PortfolioBootstrapWorkItemsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/work-items/${encodeURIComponent(workItemId)}`,
      input,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function removePortfolioBootstrapWorkItem(
  sessionId: string,
  workItemId: string,
): Promise<PortfolioBootstrapWorkItemsResponse> {
  try {
    const { data } = await api.delete<ApiResponse<PortfolioBootstrapWorkItemsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/work-items/${encodeURIComponent(workItemId)}`,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function analyzePortfolioBootstrapWork(
  sessionId: string,
): Promise<PortfolioBootstrapAnalyzeResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapAnalyzeResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/analyze`,
      {},
      { headers: { 'Idempotency-Key': stableClientIdempotencyKey('analyze', sessionId) } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function listPortfolioBootstrapProposedMutations(
  sessionId: string,
  filters: { status?: PortfolioBootstrapProposedMutation['status']; targetType?: PortfolioBootstrapProposedMutation['targetType'] } = {},
): Promise<PortfolioBootstrapProposedMutationsResponse> {
  try {
    const { data } = await api.get<ApiResponse<PortfolioBootstrapProposedMutationsResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/proposed-mutations`,
      { params: filters },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function confirmPortfolioBootstrapProposedMutation(
  sessionId: string,
  mutationId: string,
): Promise<PortfolioBootstrapMutationReviewResponse> {
  return reviewPortfolioBootstrapProposedMutation(sessionId, mutationId, 'confirm');
}

export async function reopenPortfolioBootstrapProposedMutationReview(
  sessionId: string,
  mutationId: string,
  reviewNote?: string,
): Promise<PortfolioBootstrapMutationReviewResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapMutationReviewResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/proposed-mutations/${encodeURIComponent(mutationId)}/reopen-review`,
      reviewNote ? { reviewNote } : {},
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function rejectPortfolioBootstrapProposedMutation(
  sessionId: string,
  mutationId: string,
  reviewNote?: string,
): Promise<PortfolioBootstrapMutationReviewResponse> {
  return reviewPortfolioBootstrapProposedMutation(sessionId, mutationId, 'reject', reviewNote);
}

export async function leavePortfolioBootstrapProposedMutationPending(
  sessionId: string,
  mutationId: string,
  reviewNote?: string,
): Promise<PortfolioBootstrapMutationReviewResponse> {
  return reviewPortfolioBootstrapProposedMutation(sessionId, mutationId, 'review', reviewNote);
}

export async function correctPortfolioBootstrapProposedMutation(
  sessionId: string,
  mutationId: string,
  proposedValue: unknown,
  reviewNote?: string,
): Promise<PortfolioBootstrapMutationReviewResponse> {
  try {
    const { data } = await api.patch<ApiResponse<PortfolioBootstrapMutationReviewResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/proposed-mutations/${encodeURIComponent(mutationId)}`,
      { proposedValue, ...(reviewNote ? { reviewNote } : {}) },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function publishPortfolioBootstrapFirstReading(
  sessionId: string,
): Promise<PortfolioBootstrapReadingPublishResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapReadingPublishResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/readings`,
      {},
      { headers: { 'Idempotency-Key': stableClientIdempotencyKey('reading', sessionId) } },
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

export async function getLatestPortfolioBootstrapReading(sessionId: string): Promise<PortfolioReading | null> {
  try {
    const { data } = await api.get<ApiResponse<PortfolioReading | null>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/readings/latest`,
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

async function reviewPortfolioBootstrapProposedMutation(
  sessionId: string,
  mutationId: string,
  action: 'confirm' | 'reject' | 'review',
  reviewNote?: string,
): Promise<PortfolioBootstrapMutationReviewResponse> {
  try {
    const { data } = await api.post<ApiResponse<PortfolioBootstrapMutationReviewResponse>>(
      `/portfolio-bootstrap/sessions/${encodeURIComponent(sessionId)}/proposed-mutations/${encodeURIComponent(mutationId)}/${action}`,
      reviewNote ? { reviewNote } : {},
    );
    return data.data;
  } catch (err) {
    throw new PortfolioBootstrapClientError(parseApiError(err));
  }
}

function stableClientIdempotencyKey(operation: string, payload: string): string {
  let hash = 0;
  const source = `${operation}:${payload.trim()}`;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(31, hash) + source.charCodeAt(index) | 0;
  }
  return `${operation}-${Math.abs(hash)}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.byteLength; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function inferFileType(fileName: string): string {
  return fileName.toLowerCase().endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv';
}
