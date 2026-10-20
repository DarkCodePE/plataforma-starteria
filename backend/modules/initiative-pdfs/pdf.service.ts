/**
 * Business logic for the initiative-pdfs module.
 *
 * Responsibilities:
 *   - Validate ownership / state preconditions for every transition.
 *   - Persist the `InitiativePdf`, `PdfExtractionRun`, `PdfFieldProposal` rows.
 *   - Delegate filesystem I/O to `IPdfStorage` (LocalDiskPdfStorage in V1).
 *   - Delegate ai-service calls to `AiServiceClient`.
 *   - Write `AuditLog` rows for every user-visible action (PRD-002 US-014).
 *
 * Errors ALWAYS flow through `AppError` so the ADR-010 envelope is preserved
 * by the central handler.
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  PrismaClient,
  InitiativePdf as PrismaInitiativePdf,
  PdfExtractionRun as PrismaPdfExtractionRun,
  PdfFieldProposal as PrismaPdfFieldProposal,
} from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { IPdfStorage } from './storage.service';
import { AiServiceClient } from './ai-client';
import {
  ConfidenceBandValue,
  ExtractionRunStatusValue,
  ExtractionRunWireStatus,
  InitiativePdfDTO,
  PROPOSAL_RESOLVED_STATUSES,
  PdfExtractionRunDTO,
  PdfFieldProposalDTO,
  ProvenanceEnvelope,
} from './pdf.types';
import { MAX_PDF_BYTES, ALLOWED_PDF_MIME } from './pdf.schemas';
import { flattenFieldProposals } from './extraction-flatten';
import { toWireProposal, type WireAutofillProposal } from './wire-proposal';

interface UploadInput {
  projectId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  idempotencyKey?: string;
}

interface ExtractInput {
  projectId: string;
  pdfId: string;
  actorId: string;
  targetStep?: string;
  language?: 'es' | 'en';
  requestId?: string;
}

interface ResolveProposalInput {
  projectId: string;
  runId: string;
  fieldPath: string;
  actorId: string;
  finalValue?: unknown;
}

function bandFor(confidence: number): ConfidenceBandValue {
  if (confidence >= 0.8) return 'HIGH';
  if (confidence >= 0.6) return 'MED';
  return 'LOW';
}

function toPdfDTO(row: PrismaInitiativePdf): InitiativePdfDTO {
  return {
    pdfId: row.id,
    projectId: row.projectId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    status: row.status,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt.toISOString(),
    languageDetected: row.languageDetected,
    retentionUntil: row.retentionUntil?.toISOString() ?? null,
  };
}

/**
 * Map the DB run status (UPPERCASE Prisma enum) to the lowercase wire status the
 * web client compares against (`usePdfAutofill`). Without this the client never
 * matches `'completed'` and polls until timeout — that was BUG-001. `COST_CAPPED`
 * collapses to `failed` (the client has no cost-cap state; detail in errorReason).
 * Exported so the contract can be unit-tested directly.
 */
export function toWireStatus(status: ExtractionRunStatusValue): ExtractionRunWireStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'RUNNING':
      return 'running';
    case 'FAILED':
    case 'COST_CAPPED':
      return 'failed';
    case 'PENDING':
    default:
      return 'queued';
  }
}

function toRunDTO(row: PrismaPdfExtractionRun): PdfExtractionRunDTO {
  return {
    runId: row.id,
    pdfId: row.pdfId,
    projectId: row.projectId,
    status: toWireStatus(row.status),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    costUsd: row.costUsd ? Number(row.costUsd) : null,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    model: row.model,
    language: row.language,
    errorReason: row.errorReason,
  };
}

function toProposalDTO(row: PrismaPdfFieldProposal): PdfFieldProposalDTO {
  return {
    id: row.id,
    runId: row.runId,
    fieldPath: row.fieldPath,
    proposedValue: row.proposedValue,
    provenance: row.provenance as unknown as ProvenanceEnvelope,
    confidence: row.confidence,
    confidenceBand: row.confidenceBand,
    status: row.status,
    finalValue: row.finalValue ?? undefined,
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

export class PdfService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: IPdfStorage,
    private readonly aiClient: AiServiceClient,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND', {
        hint: 'Verifica el ID o vuelve al listado.',
      });
    }
    return project;
  }

  private async writeAudit(opts: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    details?: Record<string, unknown>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: opts.userId,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId,
        details: (opts.details ?? {}) as any,
      },
    });
  }

  // ─── Uploads (endpoint 1) ─────────────────────────────────────────────────

  async uploadPdf(input: UploadInput): Promise<InitiativePdfDTO> {
    await this.assertProject(input.projectId);

    if (input.mimeType !== ALLOWED_PDF_MIME) {
      throw AppError.badRequest(
        'Solo se aceptan archivos PDF.',
        'PDF_MIME_INVALID',
        { field: 'mimeType', hint: 'Sube un archivo .pdf valido.' },
      );
    }
    if (!input.bytes || input.bytes.byteLength === 0) {
      throw AppError.badRequest('Archivo vacio.', 'PDF_EMPTY', { hint: 'Vuelve a intentar la carga.' });
    }
    if (input.bytes.byteLength > MAX_PDF_BYTES) {
      throw AppError.badRequest(
        `El PDF excede el limite de ${MAX_PDF_BYTES} bytes.`,
        'PDF_TOO_LARGE',
        { hint: 'Reduce el tamano del archivo a menos de 50 MB.' },
      );
    }

    const idempotencyKey = input.idempotencyKey?.trim() || undefined;
    const requestFingerprint = createHash('sha256')
      .update(input.mimeType)
      .update('\0')
      .update(input.fileName)
      .update('\0')
      .update(input.bytes)
      .digest('hex');

    if (idempotencyKey) {
      const existing = await this.prisma.initiativePdf.findFirst({
        where: { projectId: input.projectId, idempotencyKey },
      });
      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          throw AppError.conflict('La clave de idempotencia ya fue usada para otro archivo.', 'PDF_IDEMPOTENCY_CONFLICT');
        }
        return toPdfDTO(existing);
      }
    }

    const pdfId = randomUUID();
    const saved = await this.storage.savePdf({
      projectId: input.projectId,
      pdfId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });

    try {
      const row = await this.prisma.initiativePdf.create({
        data: {
          id: pdfId,
          projectId: input.projectId,
          fileKey: saved.fileKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: saved.fileSize,
          uploadedBy: input.uploadedBy,
          idempotencyKey,
          requestFingerprint: idempotencyKey ? requestFingerprint : null,
          status: 'UPLOADED',
        },
      });

      await this.writeAudit({
        userId: input.uploadedBy,
        action: 'pdf.upload',
        resource: 'InitiativePdf',
        resourceId: row.id,
        details: {
          projectId: row.projectId,
          fileName: row.fileName,
          fileSize: row.fileSize,
        },
      });

      return toPdfDTO(row);
    } catch (err: any) {
      // Rollback the disk write so we never leave orphaned blobs.
      await this.storage.deletePdf(saved.fileKey).catch(() => undefined);
      // A concurrent retry can lose the unique-index race after both callers
      // checked for an existing command. Return the original persisted result.
      if (idempotencyKey && err?.code === 'P2002') {
        const existing = await this.prisma.initiativePdf.findFirst({
          where: { projectId: input.projectId, idempotencyKey },
        });
        if (existing?.requestFingerprint === requestFingerprint) return toPdfDTO(existing);
        if (existing) throw AppError.conflict('La clave de idempotencia ya fue usada para otro archivo.', 'PDF_IDEMPOTENCY_CONFLICT');
      }
      throw err;
    }
  }

  // ─── Extraction trigger (endpoint 2) ──────────────────────────────────────

  async startExtraction(input: ExtractInput): Promise<PdfExtractionRunDTO> {
    const pdf = await this.prisma.initiativePdf.findFirst({
      where: { id: input.pdfId, projectId: input.projectId, deletedAt: null },
    });
    if (!pdf) {
      throw AppError.notFound('PDF', 'PDF_NOT_FOUND', { hint: 'Verifica que el PDF exista en la iniciativa.' });
    }
    if (pdf.status === 'DELETED') {
      throw AppError.conflict('El PDF ya fue eliminado.', 'PDF_DELETED');
    }

    // Create the run row up-front so the audit trail covers ai-service failures.
    const runId = randomUUID();
    const startedAt = new Date();
    const run = await this.prisma.pdfExtractionRun.create({
      data: {
        id: runId,
        pdfId: pdf.id,
        projectId: pdf.projectId,
        status: 'PENDING',
        startedAt,
        language: input.language ?? null,
      },
    });

    await this.writeAudit({
      userId: input.actorId,
      action: 'pdf.extract.requested',
      resource: 'PdfExtractionRun',
      resourceId: run.id,
      details: {
        projectId: pdf.projectId,
        pdfId: pdf.id,
        targetStep: input.targetStep ?? null,
        language: input.language ?? null,
      },
    });

    // Fire the ai-service call. TASK-007 will replace the shared-token client with HMAC.
    // We try once; failure flips the run to FAILED so the caller can retry.
    try {
      const bytes = await this.storage.readPdf(pdf.fileKey);
      const ack = await this.aiClient.callPdfExtract({
        projectId: pdf.projectId,
        pdfId: pdf.id,
        fileName: pdf.fileName,
        pdfBase64: bytes.toString('base64'),
        language: input.language,
        targetStep: input.targetStep,
        requestId: input.requestId,
      });
      // Map ai-service status string to our enum if needed.
      const mapped: ExtractionRunStatusValue =
        ack.status === 'completed'
          ? 'COMPLETED'
          : ack.status === 'failed'
          ? 'FAILED'
          : ack.status === 'running'
          ? 'RUNNING'
          : 'PENDING';
      const updated = await this.prisma.pdfExtractionRun.update({
        where: { id: run.id },
        data: { status: mapped, aiRunId: ack.runId ?? null },
      });
      return toRunDTO(updated);
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 280) : 'unknown_error';
      const failed = await this.prisma.pdfExtractionRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorReason: reason, finishedAt: new Date() },
      });
      await this.writeAudit({
        userId: input.actorId,
        action: 'pdf.extract.failed',
        resource: 'PdfExtractionRun',
        resourceId: failed.id,
        details: { errorReason: reason },
      });
      // Surface a 502 — the run row already records the failure.
      throw AppError.badRequest(
        'No se pudo iniciar la extraccion.',
        'PDF_EXTRACTION_UNAVAILABLE',
        { hint: 'Reintenta en unos segundos.' },
      );
    }
  }

  // ─── Run polling (endpoint 3) ─────────────────────────────────────────────

  async getRun(projectId: string, runId: string): Promise<PdfExtractionRunDTO> {
    let run = await this.prisma.pdfExtractionRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) {
      throw AppError.notFound('Extraccion', 'PDF_RUN_NOT_FOUND');
    }
    // If local state is still pending/running and we have an upstream runId,
    // poll the ai-service and sync. On completion, persist the proposals.
    // NOTE: ai-service also pushes via webhook (`applyUpstreamRunUpdate` below)
    // when extraction finishes, so this reactive fetch is mostly a fallback for
    // missed webhooks. Keeping both paths makes the system robust either way.
    if ((run.status === 'PENDING' || run.status === 'RUNNING') && run.aiRunId) {
      try {
        const upstream = await this.aiClient.fetchRunState(run.aiRunId);
        run = await this.syncRunFromUpstream(run, upstream);
      } catch (err) {
        // Polling failure is non-fatal; we'll retry on next poll. Just log to the audit trail once.
        const reason = err instanceof Error ? err.message.slice(0, 280) : 'unknown';
        await this.writeAudit({
          userId: 'system',
          action: 'pdf.extract.poll_failed',
          resource: 'PdfExtractionRun',
          resourceId: run.id,
          details: { errorReason: reason },
        });
      }
    }
    return toRunDTO(run);
  }

  // ─── Upstream sync (shared by polling + webhook) ──────────────────────────

  /**
   * Map an `RunStateResponse`-shaped payload from ai-service into our DB enum.
   * Exported as a constant so the webhook handler can pre-validate the body.
   */
  private mapUpstreamStatus(upstreamStatus: string | undefined): ExtractionRunStatusValue {
    switch ((upstreamStatus ?? '').toLowerCase()) {
      case 'completed':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
      case 'cost_capped':
        return 'COST_CAPPED';
      case 'running':
        return 'RUNNING';
      default:
        return 'PENDING';
    }
  }

  /**
   * Apply an upstream RunState snapshot to a loaded `PdfExtractionRun` row.
   * Idempotent: if the mapped status equals the current one, returns the row
   * unchanged. On terminal COMPLETED, persists proposals.
   *
   * Used by both the reactive polling path (`getRun`) and the webhook handler
   * (`applyUpstreamRunUpdate`).
   */
  private async syncRunFromUpstream(
    run: PrismaPdfExtractionRun,
    upstream: {
      status?: string;
      costUsd?: number | null;
      errorReason?: string | null;
      proposals?: Record<string, unknown> | null;
    },
  ): Promise<PrismaPdfExtractionRun> {
    const mapped = this.mapUpstreamStatus(upstream.status);
    if (mapped === run.status) return run;

    const update: {
      status: ExtractionRunStatusValue;
      costUsd?: number | null;
      errorReason?: string | null;
      finishedAt?: Date;
    } = { status: mapped };
    if (upstream.costUsd != null) update.costUsd = upstream.costUsd;
    if (upstream.errorReason) update.errorReason = upstream.errorReason.slice(0, 280);
    if (mapped === 'COMPLETED' || mapped === 'FAILED' || mapped === 'COST_CAPPED') {
      update.finishedAt = new Date();
    }

    const updated = await this.prisma.pdfExtractionRun.update({
      where: { id: run.id },
      data: update,
    });
    if (mapped === 'COMPLETED' && upstream.proposals) {
      await this.persistProposals(updated.id, updated.projectId, upstream.proposals);
    }
    return updated;
  }

  /**
   * Webhook entry point — applies an upstream RunState push keyed by the
   * ai-service's `runId` (stored on our row as `aiRunId`).
   * Returns:
   *   - `null` if no `PdfExtractionRun` exists with that aiRunId (handler 404s);
   *   - The updated DTO otherwise.
   * Safe to call repeatedly with the same payload (idempotent via
   * `syncRunFromUpstream`).
   */
  async applyUpstreamRunUpdate(
    aiRunId: string,
    upstream: {
      status?: string;
      costUsd?: number | null;
      errorReason?: string | null;
      proposals?: Record<string, unknown> | null;
    },
  ): Promise<PdfExtractionRunDTO | null> {
    const run = await this.prisma.pdfExtractionRun.findFirst({
      where: { aiRunId },
    });
    if (!run) return null;
    const updated = await this.syncRunFromUpstream(run, upstream);
    return toRunDTO(updated);
  }

  /**
   * Walks the InitiativeExtraction tree returned by ai-service and persists each
   * leaf FieldProposal as a row keyed by its dotted fieldPath. Idempotent: uses
   * upsert by (runId, fieldPath).
   */
  private async persistProposals(
    runId: string,
    projectId: string,
    extraction: Record<string, unknown>,
  ): Promise<void> {
    const flat = flattenFieldProposals(extraction);
    if (flat.length === 0) return;
    await this.prisma.$transaction(
      flat.map((p) =>
        this.prisma.pdfFieldProposal.upsert({
          where: { runId_fieldPath: { runId, fieldPath: p.fieldPath } },
          create: {
            runId,
            projectId,
            fieldPath: p.fieldPath,
            proposedValue: p.value as object,
            provenance: p.provenance as object,
            confidence: p.confidence,
            confidenceBand: p.confidenceBand,
            status: 'PENDING',
          },
          update: {
            proposedValue: p.value as object,
            provenance: p.provenance as object,
            confidence: p.confidence,
            confidenceBand: p.confidenceBand,
          },
        }),
      ),
    );
  }

  // ─── Proposals listing (endpoint 4) ───────────────────────────────────────

  /**
   * Returns the PDF metadata associated with a given run. Used by the controller
   * to populate `sourcePdfId` / `sourcePdfName` on wire-format proposals.
   */
  async getPdfMetaForRun(
    projectId: string,
    runId: string,
  ): Promise<{ pdfId: string; fileName: string } | null> {
    const run = await this.prisma.pdfExtractionRun.findFirst({
      where: { id: runId, projectId },
      include: { pdf: { select: { id: true, fileName: true } } },
    });
    if (!run?.pdf) return null;
    return { pdfId: run.pdf.id, fileName: run.pdf.fileName };
  }

  /**
   * Wire-format variant: returns `WireAutofillProposal[]` matching the frontend
   * DTO (lowercase enums, primary+secondary provenance, pdfId/pdfName included).
   * Use this from controllers; `listProposals` returns the storage shape and is
   * retained for internal/test consumers.
   */
  async listWireProposals(
    projectId: string,
    runId: string,
  ): Promise<WireAutofillProposal[]> {
    const proposals = await this.listProposals(projectId, runId);
    const meta = (await this.getPdfMetaForRun(projectId, runId)) ?? {
      pdfId: 'unknown',
      fileName: 'unknown.pdf',
    };
    return proposals.map((dto) => toWireProposal(dto, meta));
  }

  /**
   * Wire-format variant scoped to a PROJECT (not a single run). Used by the
   * frontend's hydration path (`GET /initiatives/:id/autofill-proposals`) so a
   * page mount can re-render proposals after refresh without knowing which run
   * produced them.
   *
   * When `runIdFilter` is provided, behavior matches `listWireProposals`
   * (single-run scope, requires that run to exist + be COMPLETED).
   * When omitted, returns ALL proposals across every COMPLETED run for the
   * project, sorted by `fieldPath`. PDF metadata (`pdfId`/`pdfName`) for each
   * proposal is resolved per-row via the run's `pdf` relation so multi-PDF
   * projects keep accurate provenance.
   *
   * Returns `[]` (not 404) when the project has no runs / no proposals — the
   * hydrator polls this endpoint defensively on mount and an empty list is the
   * legitimate "nothing to show yet" answer.
   */
  async listWireProposalsForProject(
    projectId: string,
    runIdFilter?: string,
  ): Promise<WireAutofillProposal[]> {
    // Confirm the project exists so we return 404 (not silent []) on bad ids —
    // matches the other listing endpoints.
    await this.assertProject(projectId);

    if (runIdFilter) {
      // Single-run path mirrors the existing list-by-run endpoint exactly.
      return this.listWireProposals(projectId, runIdFilter);
    }

    // Pull every COMPLETED run for the project and its proposals in one shot.
    // We use `findMany` (no JOIN gymnastics) so the query stays simple and
    // typed; the dataset is bounded by `runs × proposals_per_run` which is
    // ~50 rows per run × a handful of runs per initiative.
    const runs = await this.prisma.pdfExtractionRun.findMany({
      where: { projectId, status: 'COMPLETED' },
      include: { pdf: { select: { id: true, fileName: true } } },
    });
    if (runs.length === 0) return [];

    const runIds = runs.map((r) => r.id);
    const rows = await this.prisma.pdfFieldProposal.findMany({
      where: { runId: { in: runIds } },
      orderBy: { fieldPath: 'asc' },
    });

    const metaByRun = new Map<string, { pdfId: string; fileName: string }>();
    for (const run of runs) {
      if (run.pdf) {
        metaByRun.set(run.id, { pdfId: run.pdf.id, fileName: run.pdf.fileName });
      }
    }
    const fallbackMeta = { pdfId: 'unknown', fileName: 'unknown.pdf' };

    return rows.map((row) =>
      toWireProposal(toProposalDTO(row), metaByRun.get(row.runId) ?? fallbackMeta),
    );
  }

  async listProposals(projectId: string, runId: string): Promise<PdfFieldProposalDTO[]> {
    const run = await this.prisma.pdfExtractionRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) {
      throw AppError.notFound('Extraccion', 'PDF_RUN_NOT_FOUND');
    }
    if (run.status !== 'COMPLETED') {
      throw AppError.conflict(
        'La extraccion aun no esta completada.',
        'PDF_RUN_NOT_READY',
        { hint: 'Espera a que el estado sea COMPLETED.' },
      );
    }
    const rows = await this.prisma.pdfFieldProposal.findMany({
      where: { runId },
      orderBy: { fieldPath: 'asc' },
    });
    return rows.map(toProposalDTO);
  }

  // ─── Proposal resolution (endpoints 5/6/7) ────────────────────────────────

  private async loadProposal(projectId: string, runId: string, fieldPath: string) {
    const proposal = await this.prisma.pdfFieldProposal.findFirst({
      where: { runId, projectId, fieldPath },
    });
    if (!proposal) {
      throw AppError.notFound('Propuesta', 'PDF_PROPOSAL_NOT_FOUND');
    }
    if (PROPOSAL_RESOLVED_STATUSES.includes(proposal.status)) {
      throw AppError.conflict(
        'La propuesta ya fue resuelta.',
        'PDF_PROPOSAL_ALREADY_RESOLVED',
      );
    }
    return proposal;
  }

  async confirmProposal(input: ResolveProposalInput): Promise<PdfFieldProposalDTO> {
    const proposal = await this.loadProposal(input.projectId, input.runId, input.fieldPath);

    const updated = await this.prisma.pdfFieldProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'CONFIRMED',
        finalValue: proposal.proposedValue as any,
        confirmedBy: input.actorId,
        confirmedAt: new Date(),
      },
    });

    await this.writeAudit({
      userId: input.actorId,
      action: 'pdf.proposal.confirmed',
      resource: 'PdfFieldProposal',
      resourceId: updated.id,
      details: {
        projectId: input.projectId,
        runId: input.runId,
        fieldPath: input.fieldPath,
        before: { status: proposal.status },
        after: { status: 'CONFIRMED', finalValue: updated.finalValue },
      },
    });

    return toProposalDTO(updated);
  }

  async editProposal(input: ResolveProposalInput): Promise<PdfFieldProposalDTO> {
    const proposal = await this.loadProposal(input.projectId, input.runId, input.fieldPath);

    const updated = await this.prisma.pdfFieldProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'EDITED',
        finalValue: input.finalValue as any,
        confirmedBy: input.actorId,
        confirmedAt: new Date(),
      },
    });

    await this.writeAudit({
      userId: input.actorId,
      action: 'pdf.proposal.edited',
      resource: 'PdfFieldProposal',
      resourceId: updated.id,
      details: {
        projectId: input.projectId,
        runId: input.runId,
        fieldPath: input.fieldPath,
        before: { status: proposal.status, value: proposal.proposedValue },
        after: { status: 'EDITED', finalValue: updated.finalValue },
      },
    });

    return toProposalDTO(updated);
  }

  async discardProposal(input: ResolveProposalInput): Promise<PdfFieldProposalDTO> {
    const proposal = await this.loadProposal(input.projectId, input.runId, input.fieldPath);

    const updated = await this.prisma.pdfFieldProposal.update({
      where: { id: proposal.id },
      data: {
        status: 'DISCARDED',
        finalValue: undefined,
        confirmedBy: input.actorId,
        confirmedAt: new Date(),
      },
    });

    await this.writeAudit({
      userId: input.actorId,
      action: 'pdf.proposal.discarded',
      resource: 'PdfFieldProposal',
      resourceId: updated.id,
      details: {
        projectId: input.projectId,
        runId: input.runId,
        fieldPath: input.fieldPath,
        before: { status: proposal.status },
        after: { status: 'DISCARDED' },
      },
    });

    return toProposalDTO(updated);
  }

  // ─── State-machine guard (US-017) ─────────────────────────────────────────

  /**
   * Count pending proposals across all extraction runs for a project.
   * Callers (e.g. `portfolio.service.upsertInitiativeMeta`) use this to block
   * the `en_step_4 → esperando_revision` transition while autofill remains
   * unresolved.
   */
  async pendingProposalsForProject(projectId: string): Promise<{
    pendingCount: number;
    pendingFieldPaths: string[];
  }> {
    const pending = await this.prisma.pdfFieldProposal.findMany({
      where: { projectId, status: 'PENDING' },
      select: { fieldPath: true },
    });
    return {
      pendingCount: pending.length,
      pendingFieldPaths: pending.map((p) => p.fieldPath),
    };
  }

  // Helper used internally; exported for tests.
  static confidenceBandFor(confidence: number): ConfidenceBandValue {
    return bandFor(confidence);
  }
}
