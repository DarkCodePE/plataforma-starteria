/* ------------------------------------------------------------------ */
/*  pdfAutofillService.ts - HTTP layer for PDF autofill (TASK-009)       */
/*                                                                       */
/*  Wraps the endpoints defined in SPEC-002 / TASK-006:                  */
/*    - POST   /initiatives/:id/pdfs                  multipart upload   */
/*    - POST   /initiatives/:id/pdfs/:pdfId/extract                       */
/*    - GET    /initiatives/:id/pdfs/runs/:runId                          */
/*    - GET    /initiatives/:id/autofill-proposals                        */
/*    - POST   /initiatives/:id/pdfs/runs/:runId/proposals/:fp/confirm    */
/*    - POST   /initiatives/:id/pdfs/runs/:runId/proposals/:fp/edit       */
/*    - DELETE /initiatives/:id/pdfs/runs/:runId/proposals/:fp            */
/*    - POST   /initiatives/:id/pdfs/runs/:runId/proposals/:fp/restore    */
/*    - POST   /initiatives/:id/pdfs/runs/:runId/proposals/:fp/resolve-conflict */
/*                                                                       */
/*  All calls flow through `services/api.ts`, which attaches the JWT,    */
/*  refreshes on 401, and normalises the error envelope.                 */
/* ------------------------------------------------------------------ */

import api from './api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------- Public DTOs ----------

export type ConfidenceBand = 'high' | 'medium' | 'low';
export type ProposalStatus = 'unconfirmed' | 'confirmed' | 'edited' | 'discarded';

export interface ProvenanceEntry {
  sourcePdfId: string;
  sourcePdfName: string;
  pageNumbers: number[];
  quotedExcerpt: string;
  originalExcerpt?: string;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
}

export interface ConflictOption {
  sourceId: string;
  proposedValue: unknown;
  provenance: ProvenanceEntry;
}

export interface AutofillProposalDto {
  fieldPath: string;
  proposedValue: unknown;
  finalValue?: unknown;
  status: ProposalStatus;
  provenance: ProvenanceEntry;
  secondarySources?: ProvenanceEntry[];
  conflict?: { competingValues: ConflictOption[] };
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  runId: string;
  omissionReason?: string;
}

export interface PdfUploadResult {
  pdfId: string;
  fileName: string;
  sizeBytes: number;
  pageCount?: number;
}

export interface ExtractionRunStart {
  runId: string;
  pollUrl?: string;
  estimatedSec?: number;
}

export type ExtractionRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled';

export interface ExtractionRunStatusResponse {
  runId: string;
  status: ExtractionRunStatus;
  progress?: number;
  errorCode?: string;
  errorMessage?: string;
}

// ---------- Endpoints ----------

/** Upload a PDF. One file at a time.
 *
 * Backend (TASK-006) uses `express.raw({ type: 'application/pdf' })`, so the body
 * is the raw bytes (not multipart) and the original filename travels in the
 * `X-File-Name` header. This avoids requiring multer on the backend.
 */
export async function uploadPdf(
  initiativeId: string,
  file: File,
  onProgress?: (pct: number) => void,
  idempotencyKey?: string,
): Promise<PdfUploadResult> {
  const buffer = await file.arrayBuffer();
  // Encode filename for safe transport in HTTP header (RFC 8187 — non-ASCII safe).
  const safeName = encodeURIComponent(file.name);
  const { data } = await api.post<ApiResponse<PdfUploadResult>>(
    `/initiatives/${initiativeId}/pdfs`,
    buffer,
    {
      headers: {
        'Content-Type': 'application/pdf',
        'X-File-Name': safeName,
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    },
  );
  return data.data;
}

/** Kick off an extraction run for a given PDF.
 *
 * Backend (TASK-006 `extractRequestSchema`) is `.strict()` and accepts:
 *   - `targetStep`: 'step_0' | 'step_1' | ... | 'step_4'   (optional)
 *   - `language`:   'es' | 'en'                            (optional)
 * `scope`/`'all'` are not in the schema — sending them returns HTTP 400
 * VALIDATION_ERROR. For the full sweep, OMIT `targetStep`.
 */
export async function startExtractionRun(
  initiativeId: string,
  pdfId: string,
  scope: 'step0' | 'step1' | 'step2' | 'step3' | 'step4' | 'all' = 'all',
): Promise<ExtractionRunStart> {
  const body: { targetStep?: 'step_0' | 'step_1' | 'step_2' | 'step_3' | 'step_4'; language?: 'es' | 'en' } = {
    language: 'es',
  };
  if (scope !== 'all') {
    // Map frontend scope (`step0`) → backend enum (`step_0`).
    body.targetStep = scope.replace('step', 'step_') as
      | 'step_0' | 'step_1' | 'step_2' | 'step_3' | 'step_4';
  }
  const { data } = await api.post<ApiResponse<ExtractionRunStart>>(
    `/initiatives/${initiativeId}/pdfs/${pdfId}/extract`,
    body,
  );
  return data.data;
}

/** Poll the status of an extraction run. */
export async function getExtractionRunStatus(
  initiativeId: string,
  runId: string,
): Promise<ExtractionRunStatusResponse> {
  const { data } = await api.get<ApiResponse<ExtractionRunStatusResponse>>(
    `/initiatives/${initiativeId}/pdfs/runs/${runId}`,
  );
  return data.data;
}

/** Fetch all proposals for an initiative (or a specific run). */
export async function listProposals(
  initiativeId: string,
  runId?: string,
): Promise<AutofillProposalDto[]> {
  const url = runId
    ? `/initiatives/${initiativeId}/autofill-proposals?runId=${encodeURIComponent(runId)}`
    : `/initiatives/${initiativeId}/autofill-proposals`;
  const { data } = await api.get<ApiResponse<AutofillProposalDto[]>>(url);
  return data.data;
}

/** Confirm a proposal as-is. */
export async function confirmProposal(
  initiativeId: string,
  runId: string,
  fieldPath: string,
): Promise<AutofillProposalDto> {
  const { data } = await api.post<ApiResponse<AutofillProposalDto>>(
    `/initiatives/${initiativeId}/pdfs/runs/${runId}/proposals/${encodeURIComponent(fieldPath)}/confirm`,
  );
  return data.data;
}

/** Edit a proposal: persists `finalValue` and marks the row as `edited`. */
export async function editProposal(
  initiativeId: string,
  runId: string,
  fieldPath: string,
  finalValue: unknown,
): Promise<AutofillProposalDto> {
  const { data } = await api.post<ApiResponse<AutofillProposalDto>>(
    `/initiatives/${initiativeId}/pdfs/runs/${runId}/proposals/${encodeURIComponent(fieldPath)}/edit`,
    { finalValue },
  );
  return data.data;
}

/** Discard a proposal. */
export async function discardProposal(
  initiativeId: string,
  runId: string,
  fieldPath: string,
): Promise<void> {
  await api.delete<ApiResponse<{ ok: true }>>(
    `/initiatives/${initiativeId}/pdfs/runs/${runId}/proposals/${encodeURIComponent(fieldPath)}`,
  );
}

/** Restore a previously discarded proposal. */
export async function restoreProposal(
  initiativeId: string,
  runId: string,
  fieldPath: string,
): Promise<AutofillProposalDto> {
  const { data } = await api.post<ApiResponse<AutofillProposalDto>>(
    `/initiatives/${initiativeId}/pdfs/runs/${runId}/proposals/${encodeURIComponent(fieldPath)}/restore`,
  );
  return data.data;
}

/** Resolve a multi-PDF conflict by selecting one source. */
export async function resolveConflict(
  initiativeId: string,
  runId: string,
  fieldPath: string,
  chosenSourceId: string,
): Promise<AutofillProposalDto> {
  const { data } = await api.post<ApiResponse<AutofillProposalDto>>(
    `/initiatives/${initiativeId}/pdfs/runs/${runId}/proposals/${encodeURIComponent(fieldPath)}/resolve-conflict`,
    { chosenSourceId },
  );
  return data.data;
}
