import crypto from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { AppError } from '../../shared/errors/AppError';
import { can, type Permission } from '../../shared/authz/permissions';
import { ScopedPortfolioAccessService } from '../../shared/authz/scoped-portfolio-access.service';
import { logger } from '../../shared/utils/logger';
import { deriveAnchorStatus, derivePortfolioAnchorFromContinuation } from './portfolio-anchor-derivation';
import { DeterministicPortfolioBootstrapAnalyzer, type PortfolioBootstrapAnalysisOutput, type PortfolioBootstrapAnalyzer } from './portfolio-bootstrap.analyzer';
import type {
  CorrectProposedMutationBody,
  ManualWorkItemBody,
  PasteWorkItemsBody,
  UpdateImportMappingBody,
  UpdateAnchorBody,
  UpdateWorkItemBody,
  UploadImportBody,
} from './portfolio-bootstrap.schemas';

export type PortfolioBootstrapDto = {
  sourceContinuation: { id: string; sessionId: string } | null;
  bootstrapSession: {
    id: string;
    userId: string;
    organizationId: string | null;
    sourceContinuationId: string | null;
    status: string;
    bootstrapPhase: string;
    existingWorkStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  anchor: PortfolioAnchorDto | null;
  importBatches: PortfolioBootstrapImportBatchDto[];
  workItems: PortfolioBootstrapWorkItemDto[];
  proposedMutations: PortfolioBootstrapProposedMutationDto[];
  latestAnalysisRun: PortfolioBootstrapAnalysisRunDto | null;
  strategicConnections: PortfolioStrategicConnectionDto[];
  advancementConditions: PortfolioAdvancementConditionDto[];
  latestReading: PortfolioReadingDto | null;
};

type PortfolioAnchorDto = {
  id: string;
  bootstrapSessionId: string;
  outcomeStatement: string;
  contextSummary: string | null;
  decisionToEnable: string | null;
  businessSignalStatus: string;
  businessSignalValue: string | null;
  status: string;
  sourceRefs: unknown;
  provenanceStatus: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapWorkItemDto = {
  id: string;
  bootstrapSessionId: string;
  rawLabel: string;
  proposedName: string | null;
  proposedPurpose: string | null;
  sourceType: string;
  status: string;
  currentStateHint: string | null;
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

export type PortfolioBootstrapImportBatchDto = {
  id: string;
  bootstrapSessionId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  status: string;
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

export type PortfolioBootstrapImportCommitDto = {
  batch: PortfolioBootstrapImportBatchDto;
  workItems: PortfolioBootstrapWorkItemDto[];
  skippedRows: number;
  duplicateRows: number;
};

export type PortfolioBootstrapWorkItemsDto = {
  sessionId: string;
  existingWorkStatus: string;
  items: PortfolioBootstrapWorkItemDto[];
};

export type PortfolioBootstrapAnalysisRunDto = {
  id: string;
  bootstrapSessionId: string;
  status: string;
  analyzerMode: string;
  inputVersion: string;
  outputVersion: string | null;
  error: unknown;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type PortfolioBootstrapProposedMutationDto = {
  id: string;
  bootstrapSessionId: string;
  analysisRunId: string;
  targetType: string;
  targetId: string | null;
  mutationType: string;
  currentValue: unknown;
  originalProposedValue: unknown;
  proposedValue: unknown;
  rationale: string | null;
  reviewNote: string | null;
  sourceRefs: unknown;
  provenanceStatus: string;
  uncertainty: string;
  materiality: string;
  confirmationRequired: boolean;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  correctedBy: string | null;
  correctedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioBootstrapAnalyzeDto = {
  analysisRunId: string;
  proposedMutations: PortfolioBootstrapProposedMutationDto[];
  homeState: 'HOME_C';
};

export type PortfolioBootstrapProposedMutationsDto = {
  sessionId: string;
  proposedMutations: PortfolioBootstrapProposedMutationDto[];
  materialReviewComplete: boolean;
  nextAction: 'review_proposed_structure' | 'generate_first_portfolio_reading';
};

export type PortfolioBootstrapMutationReviewDto = {
  mutation: PortfolioBootstrapProposedMutationDto;
  strategicConnection: PortfolioStrategicConnectionDto | null;
  advancementCondition: PortfolioAdvancementConditionDto | null;
  materialReviewComplete: boolean;
  nextAction: 'review_proposed_structure' | 'generate_first_portfolio_reading';
};

export type PortfolioBootstrapReadingPublishDto = {
  reading: PortfolioReadingDto;
  homeState: 'HOME_D' | 'HOME_E';
  nextBestAction: string;
};

export type PortfolioReadingDto = {
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
  primaryAttentionItems: unknown;
  nextBestAction: string;
  sourceBootstrapVersion: string;
  sourceAnchorVersion: number;
  sourceSnapshot: unknown;
  stateHash: string;
  homeState: string;
  publishedBy: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioStrategicConnectionDto = {
  id: string;
  bootstrapSessionId: string;
  workItemId: string;
  anchorId: string;
  sourceMutationId: string;
  status: string;
  rationale: string | null;
  provenanceStatus: string;
  sourceRefs: unknown;
  confirmedBy: string;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioAdvancementConditionDto = {
  id: string;
  bootstrapSessionId: string;
  workItemId: string | null;
  sourceMutationId: string;
  type: string;
  status: string;
  statement: string;
  severity: string;
  movementAffected: string | null;
  provenanceStatus: string;
  sourceRefs: unknown;
  confirmedBy: string;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
};

export class PortfolioBootstrapService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
    private readonly analyzer: PortfolioBootstrapAnalyzer = new DeterministicPortfolioBootstrapAnalyzer(),
  ) {}

  async createOrReuseFromContinuation(input: {
    portfolioEntryContinuationId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    requestId?: string;
  }): Promise<PortfolioBootstrapDto> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const db = tx as any;
        const continuation = await db.portfolioEntryPortfolioContinuation.findUnique({
          where: { id: input.portfolioEntryContinuationId },
        });
        if (!continuation) throw AppError.notFound('Portfolio Entry continuation', 'PORTFOLIO_BOOTSTRAP_CONTINUATION_NOT_FOUND');
        if (continuation.continuedByUserId !== input.authenticatedUserId) {
          throw AppError.forbidden('No autorizado.', 'PORTFOLIO_BOOTSTRAP_CONTINUATION_FORBIDDEN');
        }
        const scope = continuation.portfolioScope && typeof continuation.portfolioScope === 'object'
          ? (continuation.portfolioScope as Record<string, unknown>)
          : null;
        const organizationId = typeof scope?.organizationId === 'string' ? scope.organizationId : null;
        const hasScopedRead = organizationId
          ? await new ScopedPortfolioAccessService(db).canUserAccessPortfolio({
            userId: input.authenticatedUserId,
            organizationId,
            capability: 'portfolio:read',
          })
          : false;
        if (!organizationId || (!can(input.permissions, 'portfolio:read') && !hasScopedRead)) {
          throw AppError.forbidden('No tienes acceso a este espacio de Portfolio.', 'PORTFOLIO_BOOTSTRAP_SCOPED_PORTFOLIO_ACCESS_REQUIRED');
        }

        const existing = await this.findActiveSession(db, input.authenticatedUserId, continuation.id);
        if (existing) {
          await this.writeAudit(db, input.authenticatedUserId, 'portfolio_bootstrap_session_reused', existing.id, {
            sourceContinuationId: continuation.id,
          });
          return existing;
        }

        const derived = derivePortfolioAnchorFromContinuation(continuation);
        const session = await db.portfolioBootstrapSession.create({
          data: {
            userId: input.authenticatedUserId,
            organizationId,
            sourceContinuationId: continuation.id,
            status: derived.status === 'anchor_sufficient' ? 'awaiting_work_intake' : 'awaiting_anchor_review',
            bootstrapPhase: derived.status === 'anchor_sufficient' ? 'B2_WORK_INTAKE' : 'B1_ANCHOR',
          },
          include: this.sessionInclude(),
        });
        const anchor = await db.portfolioAnchor.create({
          data: {
            bootstrapSessionId: session.id,
            outcomeStatement: derived.outcomeStatement,
            contextSummary: derived.contextSummary,
            decisionToEnable: derived.decisionToEnable,
            businessSignalStatus: derived.businessSignalStatus,
            businessSignalValue: derived.businessSignalValue,
            status: derived.status,
            sourceRefs: derived.sourceRefs,
            provenanceStatus: derived.provenanceStatus,
          },
        });
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_bootstrap_session_created', session.id, {
          sourceContinuationId: continuation.id,
        });
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_anchor_derived', anchor.id, {
          sessionId: session.id,
          sourceContinuationId: continuation.id,
        });
        return { ...session, anchor, sourceContinuation: continuation };
      });

      return this.toDto(result);
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const recovered = await (this.prisma as any).portfolioBootstrapSession.findFirst({
          where: {
            userId: input.authenticatedUserId,
            sourceContinuationId: input.portfolioEntryContinuationId,
            status: { not: 'abandoned' },
          },
          include: this.sessionInclude(),
        });
        if (recovered) return this.toDto(recovered);
      }
      logger.error({ requestId: input.requestId, err }, 'portfolio_bootstrap_from_continuation_failed');
      throw err;
    }
  }

  async getSession(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapDto> {
    const row = await (this.prisma as any).portfolioBootstrapSession.findUnique({
      where: { id: input.sessionId },
      include: this.sessionInclude(),
    });
    if (!row) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
    await this.authorizeSessionCapability({
      db: this.prisma as any,
      session: row,
      authenticatedUserId: input.authenticatedUserId,
      permissions: input.permissions,
      capability: 'portfolio:read',
    });
    return this.toDto(row);
  }

  async updateAnchor(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: UpdateAnchorBody;
  }): Promise<PortfolioBootstrapDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const anchor = session.anchor;
      if (!anchor) throw AppError.conflict('La sesion no tiene anchor.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_MISSING');
      if (anchor.status === 'anchor_confirmed') {
        throw AppError.conflict('El anchor confirmado no se actualiza silenciosamente.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_ALREADY_CONFIRMED');
      }

      await this.recordHistory(db, anchor, 'portfolio_anchor_updated', input.authenticatedUserId);
      const nextData = {
        outcomeStatement: input.body.outcomeStatement ?? anchor.outcomeStatement,
        contextSummary: input.body.contextSummary === undefined ? anchor.contextSummary : input.body.contextSummary,
        decisionToEnable: input.body.decisionToEnable === undefined ? anchor.decisionToEnable : input.body.decisionToEnable,
        businessSignalStatus: input.body.businessSignalStatus ?? anchor.businessSignalStatus,
        businessSignalValue: input.body.businessSignalValue === undefined ? anchor.businessSignalValue : input.body.businessSignalValue,
        sourceRefs: input.body.sourceRefs === undefined ? anchor.sourceRefs : input.body.sourceRefs as Prisma.InputJsonValue,
      };
      const updated = await db.portfolioAnchor.update({
        where: { id: anchor.id },
        data: {
          ...nextData,
          status: deriveAnchorStatus(nextData),
          provenanceStatus: 'extracted',
          confirmedBy: null,
          confirmedAt: null,
          version: { increment: 1 },
        },
      });
      const updatedSession = await db.portfolioBootstrapSession.update({
        where: { id: session.id },
        data: {
          status: updated.status === 'anchor_sufficient' ? 'awaiting_work_intake' : 'awaiting_anchor_review',
          bootstrapPhase: updated.status === 'anchor_sufficient' ? 'B2_WORK_INTAKE' : 'B1_ANCHOR',
        },
        include: this.sessionInclude(),
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_anchor_updated', updated.id, { sessionId: session.id });
      return updatedSession;
    });
    return this.toDto(result);
  }

  async confirmAnchor(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const anchor = session.anchor;
      if (!anchor) throw AppError.conflict('La sesion no tiene anchor.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_MISSING');
      if (anchor.status === 'anchor_confirmed') return session;
      if (anchor.status !== 'anchor_sufficient') {
        throw AppError.conflict('El anchor aun no es confirmable.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_NOT_CONFIRMABLE');
      }

      // Claim this exact confirmable version before writing history. Concurrent
      // transactions may both have read the same version, but only one can
      // satisfy this compare-and-set after PostgreSQL serializes the row write.
      const claimed = await db.portfolioAnchor.updateMany({
        where: { id: anchor.id, version: anchor.version, status: 'anchor_sufficient' },
        data: {
          status: 'anchor_confirmed',
          provenanceStatus: 'user_confirmed',
          confirmedBy: input.authenticatedUserId,
          confirmedAt: this.now(),
          version: { increment: 1 },
        },
      });

      if (claimed.count === 0) {
        // Another authorized confirmation may have committed while this
        // request waited on the conditional update. Re-read through the
        // transaction and re-check access before returning its result.
        const current = await db.portfolioBootstrapSession.findUnique({
          where: { id: session.id },
          include: this.sessionInclude(),
        });
        if (!current) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
        await this.authorizeSessionCapability({
          db,
          session: current,
          authenticatedUserId: input.authenticatedUserId,
          permissions: input.permissions,
          capability: 'portfolio:write',
        });
        if (current.anchor?.status === 'anchor_confirmed') return current;
        throw AppError.conflict('El anchor cambio durante la confirmacion.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_NOT_CONFIRMABLE');
      }

      await this.recordHistory(db, anchor, 'portfolio_anchor_confirmed', input.authenticatedUserId);
      const updatedSession = await db.portfolioBootstrapSession.update({
        where: { id: session.id },
        data: { status: 'awaiting_work_intake', bootstrapPhase: 'B2_WORK_INTAKE' },
        include: this.sessionInclude(),
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_anchor_confirmed', anchor.id, { sessionId: session.id });
      return updatedSession;
    });
    return this.toDto(result);
  }

  async pasteWorkItems(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: PasteWorkItemsBody;
    idempotencyKey?: string;
  }): Promise<PortfolioBootstrapWorkItemsDto> {
    const rawInput = input.body.text;
    const labels = parsePastedWorkItems(rawInput);
    if (labels.length === 0) {
      throw AppError.badRequest('Pega al menos un elemento de trabajo.', 'PORTFOLIO_BOOTSTRAP_WORK_TEXT_EMPTY');
    }
    const requestHash = makeRequestHash('paste', rawInput, input.idempotencyKey);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const existingSource = await db.portfolioBootstrapWorkIntakeSource.findUnique({
        where: {
          bootstrapSessionId_requestHash: {
            bootstrapSessionId: session.id,
            requestHash,
          },
        },
      });
      if (existingSource) return this.listWorkItemsForSession(db, session.id);

      const source = await db.portfolioBootstrapWorkIntakeSource.create({
        data: {
          bootstrapSessionId: session.id,
          sourceType: 'pasted_text',
          rawInput,
          requestHash,
          idempotencyKey: input.idempotencyKey,
          createdBy: input.authenticatedUserId,
        },
      });
      const sourceRef = {
        sourceId: source.id,
        sourceType: 'pasted_text',
        rawInput,
        createdBy: input.authenticatedUserId,
        createdAt: source.createdAt.toISOString(),
      };
      await db.portfolioBootstrapWorkItem.createMany({
        data: labels.map((label, index) => ({
          bootstrapSessionId: session.id,
          sourceId: source.id,
          rawLabel: label,
          proposedName: label,
          sourceType: 'pasted_text',
          status: 'detected',
          sourceRefs: { ...sourceRef, line: index + 1 },
          createdBy: input.authenticatedUserId,
        })),
      });
      await this.markWorkIntakeComplete(db, session.id, 'has_work');
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_intake_started', session.id, { sourceType: 'pasted_text' });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_items_detected', session.id, {
        sourceId: source.id,
        itemCount: labels.length,
      });
      return this.listWorkItemsForSession(db, session.id);
    });
  }

  async addManualWorkItem(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: ManualWorkItemBody;
    idempotencyKey?: string;
  }): Promise<PortfolioBootstrapWorkItemsDto> {
    const normalized = {
      label: input.body.label.trim(),
      purpose: input.body.purpose?.trim() ?? null,
      currentStateHint: input.body.currentStateHint ?? null,
    };
    const requestHash = makeRequestHash('manual', JSON.stringify(normalized), input.idempotencyKey);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const existingSource = await db.portfolioBootstrapWorkIntakeSource.findUnique({
        where: {
          bootstrapSessionId_requestHash: {
            bootstrapSessionId: session.id,
            requestHash,
          },
        },
      });
      if (existingSource) return this.listWorkItemsForSession(db, session.id);

      const source = await db.portfolioBootstrapWorkIntakeSource.create({
        data: {
          bootstrapSessionId: session.id,
          sourceType: 'manual_entry',
          rawInput: normalized.label,
          requestHash,
          idempotencyKey: input.idempotencyKey,
          createdBy: input.authenticatedUserId,
        },
      });
      await db.portfolioBootstrapWorkItem.create({
        data: {
          bootstrapSessionId: session.id,
          sourceId: source.id,
          rawLabel: normalized.label,
          proposedName: normalized.label,
          proposedPurpose: normalized.purpose,
          sourceType: 'manual_entry',
          status: 'pending',
          currentStateHint: normalized.currentStateHint,
          sourceRefs: {
            sourceId: source.id,
            sourceType: 'manual_entry',
            rawInput: normalized.label,
            createdBy: input.authenticatedUserId,
            createdAt: source.createdAt.toISOString(),
          },
          createdBy: input.authenticatedUserId,
        },
      });
      await this.markWorkIntakeComplete(db, session.id, 'has_work');
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_intake_started', session.id, { sourceType: 'manual_entry' });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_items_detected', session.id, {
        sourceId: source.id,
        itemCount: 1,
      });
      return this.listWorkItemsForSession(db, session.id);
    });
  }

  async declareNoExistingWork(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapWorkItemsDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      await this.markWorkIntakeComplete(db, session.id, 'no_existing_work');
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_no_existing_work_selected', session.id, {
        existingWorkStatus: 'no_existing_work',
      });
      return this.listWorkItemsForSession(db, session.id);
    });
  }

  async listWorkItems(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapWorkItemsDto> {
    const db = this.prisma as any;
    const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
    await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:read' });
    return this.listWorkItemsForSession(db, input.sessionId);
  }

  async uploadImport(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: UploadImportBody;
  }): Promise<PortfolioBootstrapImportBatchDto> {
    const file = decodeImportFile(input.body);
    const parsed = parseImportFile(file);
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const suggestedMapping = suggestImportMapping(parsed.headers);

    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const existing = await db.portfolioBootstrapImportBatch.findUnique({
        where: {
          bootstrapSessionId_fileHash: {
            bootstrapSessionId: session.id,
            fileHash,
          },
        },
      });
      if (existing) return this.importBatchToDto(existing);

      const batch = await db.portfolioBootstrapImportBatch.create({
        data: {
          bootstrapSessionId: session.id,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          fileHash,
          status: suggestedMapping.label ? 'mapping_required' : 'uploaded',
          rowCount: parsed.rows.length,
          sheetName: parsed.sheetName,
          rawHeaders: parsed.headers as Prisma.InputJsonValue,
          confirmedMapping: null,
          previewRows: parsed.rows as Prisma.InputJsonValue,
          warnings: parsed.warnings as Prisma.InputJsonValue,
          uploadedBy: input.authenticatedUserId,
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_import_batch_uploaded', batch.id, {
        sessionId: session.id,
        fileName: file.fileName,
        fileHash,
        rowCount: parsed.rows.length,
      });
      return this.importBatchToDto(batch);
    });
  }

  async getImport(input: {
    sessionId: string;
    importId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapImportBatchDto> {
    const db = this.prisma as any;
    const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
    await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:read' });
    const batch = await db.portfolioBootstrapImportBatch.findFirst({
      where: { id: input.importId, bootstrapSessionId: input.sessionId },
    });
    if (!batch) throw AppError.notFound('Portfolio Bootstrap import', 'PORTFOLIO_BOOTSTRAP_IMPORT_NOT_FOUND');
    return this.importBatchToDto(batch);
  }

  async updateImportMapping(input: {
    sessionId: string;
    importId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: UpdateImportMappingBody;
  }): Promise<PortfolioBootstrapImportBatchDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const batch = await db.portfolioBootstrapImportBatch.findFirst({
        where: { id: input.importId, bootstrapSessionId: input.sessionId },
      });
      if (!batch) throw AppError.notFound('Portfolio Bootstrap import', 'PORTFOLIO_BOOTSTRAP_IMPORT_NOT_FOUND');
      if (batch.status === 'imported') {
        throw AppError.conflict('La importacion ya fue incorporada.', 'PORTFOLIO_BOOTSTRAP_IMPORT_ALREADY_IMPORTED');
      }
      const headers = asStringArray(batch.rawHeaders);
      const mapping = normalizeImportMapping(input.body.confirmedMapping, headers);
      if (!mapping.label) {
        throw AppError.badRequest('El mapping de nombre es obligatorio.', 'PORTFOLIO_BOOTSTRAP_IMPORT_LABEL_MAPPING_REQUIRED');
      }
      const updated = await db.portfolioBootstrapImportBatch.update({
        where: { id: batch.id },
        data: {
          confirmedMapping: mapping as Prisma.InputJsonValue,
          status: 'ready_to_import',
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_import_mapping_confirmed', batch.id, {
        sessionId: input.sessionId,
        mapping,
      });
      return this.importBatchToDto(updated);
    });
  }

  async commitImport(input: {
    sessionId: string;
    importId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey?: string;
  }): Promise<PortfolioBootstrapImportCommitDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const batch = await db.portfolioBootstrapImportBatch.findFirst({
        where: { id: input.importId, bootstrapSessionId: input.sessionId },
      });
      if (!batch) throw AppError.notFound('Portfolio Bootstrap import', 'PORTFOLIO_BOOTSTRAP_IMPORT_NOT_FOUND');
      if (batch.status === 'imported') {
        const items = await db.portfolioBootstrapWorkItem.findMany({
          where: { bootstrapSessionId: input.sessionId, importBatchId: batch.id, status: { not: 'rejected' } },
          orderBy: { createdAt: 'asc' },
        });
        return {
          batch: this.importBatchToDto(batch),
          workItems: items.map((item: any) => this.workItemToDto(item)),
          skippedRows: 0,
          duplicateRows: 0,
        };
      }
      if (batch.status !== 'ready_to_import' || !batch.confirmedMapping) {
        throw AppError.conflict('Confirma el mapping antes de importar.', 'PORTFOLIO_BOOTSTRAP_IMPORT_MAPPING_REQUIRED');
      }

      const mapping = normalizeImportMapping(batch.confirmedMapping, asStringArray(batch.rawHeaders));
      if (!mapping.label) {
        throw AppError.badRequest('El mapping de nombre es obligatorio.', 'PORTFOLIO_BOOTSTRAP_IMPORT_LABEL_MAPPING_REQUIRED');
      }
      const rows = asImportRows(batch.previewRows);
      const requestHash = makeRequestHash('import', `${batch.fileHash}:${stableJson(mapping)}`, input.idempotencyKey);
      const existingSource = await db.portfolioBootstrapWorkIntakeSource.findUnique({
        where: {
          bootstrapSessionId_requestHash: {
            bootstrapSessionId: input.sessionId,
            requestHash,
          },
        },
      });
      if (existingSource) {
        await db.portfolioBootstrapImportBatch.update({
          where: { id: batch.id },
          data: { status: 'imported' },
        });
        const items = await db.portfolioBootstrapWorkItem.findMany({
          where: { bootstrapSessionId: input.sessionId, importBatchId: batch.id, status: { not: 'rejected' } },
          orderBy: { createdAt: 'asc' },
        });
        return {
          batch: this.importBatchToDto({ ...batch, status: 'imported' }),
          workItems: items.map((item: any) => this.workItemToDto(item)),
          skippedRows: 0,
          duplicateRows: 0,
        };
      }

      const source = await db.portfolioBootstrapWorkIntakeSource.create({
        data: {
          bootstrapSessionId: input.sessionId,
          sourceType: 'imported_file',
          rawInput: batch.fileName,
          requestHash,
          idempotencyKey: input.idempotencyKey,
          createdBy: input.authenticatedUserId,
        },
      });
      const { items, warnings, duplicateRows, skippedRows } = buildWorkItemsFromImport(batch, rows, mapping, source, input.authenticatedUserId);
      if (items.length === 0) {
        await db.portfolioBootstrapImportBatch.update({
          where: { id: batch.id },
          data: { status: 'failed', warnings: warnings as Prisma.InputJsonValue },
        });
        throw AppError.badRequest('No hay filas con nombre importable.', 'PORTFOLIO_BOOTSTRAP_IMPORT_NO_IMPORTABLE_ROWS');
      }
      await db.portfolioBootstrapWorkItem.createMany({ data: items });
      const updatedBatch = await db.portfolioBootstrapImportBatch.update({
        where: { id: batch.id },
        data: {
          status: 'imported',
          warnings: warnings as Prisma.InputJsonValue,
        },
      });
      await this.markWorkIntakeComplete(db, input.sessionId, 'has_work');
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_intake_started', input.sessionId, { sourceType: 'imported_file' });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_import_batch_committed', batch.id, {
        sessionId: input.sessionId,
        sourceId: source.id,
        importedCount: items.length,
        skippedRows,
        duplicateRows,
      });
      const importedItems = await db.portfolioBootstrapWorkItem.findMany({
        where: { bootstrapSessionId: input.sessionId, importBatchId: batch.id, status: { not: 'rejected' } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        batch: this.importBatchToDto(updatedBatch),
        workItems: importedItems.map((item: any) => this.workItemToDto(item)),
        skippedRows,
        duplicateRows,
      };
    });
  }

  async updateWorkItem(input: {
    sessionId: string;
    workItemId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: UpdateWorkItemBody;
  }): Promise<PortfolioBootstrapWorkItemsDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const item = await db.portfolioBootstrapWorkItem.findFirst({
        where: { id: input.workItemId, bootstrapSessionId: input.sessionId, status: { not: 'rejected' } },
      });
      if (!item) throw AppError.notFound('Portfolio Bootstrap work item', 'PORTFOLIO_BOOTSTRAP_WORK_ITEM_NOT_FOUND');
      await db.portfolioBootstrapWorkItem.update({
        where: { id: item.id },
        data: {
          rawLabel: input.body.label?.trim() ?? item.rawLabel,
          proposedName: input.body.label?.trim() ?? item.proposedName,
          proposedPurpose: input.body.purpose === undefined ? item.proposedPurpose : input.body.purpose,
          currentStateHint: input.body.currentStateHint === undefined ? item.currentStateHint : input.body.currentStateHint,
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_item_updated', item.id, { sessionId: input.sessionId });
      return this.listWorkItemsForSession(db, input.sessionId);
    });
  }

  async removeWorkItem(input: {
    sessionId: string;
    workItemId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapWorkItemsDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      const item = await db.portfolioBootstrapWorkItem.findFirst({
        where: { id: input.workItemId, bootstrapSessionId: input.sessionId, status: { not: 'rejected' } },
      });
      if (!item) throw AppError.notFound('Portfolio Bootstrap work item', 'PORTFOLIO_BOOTSTRAP_WORK_ITEM_NOT_FOUND');
      await db.portfolioBootstrapWorkItem.update({
        where: { id: item.id },
        data: { status: 'rejected' },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_work_item_removed', item.id, { sessionId: input.sessionId });
      return this.listWorkItemsForSession(db, input.sessionId);
    });
  }

  async analyze(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey?: string;
  }): Promise<PortfolioBootstrapAnalyzeDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      if (!session.anchor) throw AppError.conflict('La sesion no tiene anchor.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_MISSING');
      if (session.existingWorkStatus === 'no_existing_work') {
        throw AppError.conflict('No hay trabajo existente declarado para analizar.', 'PORTFOLIO_BOOTSTRAP_NO_WORK_TO_ANALYZE');
      }

      const workItems = (session.workItems ?? []).filter((item: any) => item.status !== 'rejected');
      if (session.existingWorkStatus !== 'has_work' || workItems.length === 0) {
        throw AppError.conflict('Primero incorpora trabajo existente.', 'PORTFOLIO_BOOTSTRAP_WORK_REQUIRED');
      }

      const inputVersion = makeAnalysisInputVersion(session.anchor, workItems, input.idempotencyKey);
      const existingRun = await db.portfolioBootstrapAnalysisRun.findUnique({
        where: {
          bootstrapSessionId_inputVersion: {
            bootstrapSessionId: session.id,
            inputVersion,
          },
        },
        include: { proposedMutations: true },
      });
      if (existingRun?.status === 'completed') {
        return {
          analysisRunId: existingRun.id,
          proposedMutations: existingRun.proposedMutations.map((mutation: any) => this.proposedMutationToDto(mutation)),
          homeState: 'HOME_C',
        };
      }

      await db.portfolioBootstrapProposedMutation.updateMany({
        where: {
          bootstrapSessionId: session.id,
          status: 'proposed',
          analysisRun: { inputVersion: { not: inputVersion } },
        },
        data: { status: 'superseded' },
      });

      const run = existingRun ?? await db.portfolioBootstrapAnalysisRun.create({
        data: {
          bootstrapSessionId: session.id,
          status: 'processing',
          analyzerMode: this.analyzer.mode,
          inputVersion,
          createdBy: input.authenticatedUserId,
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_bootstrap_analysis_started', run.id, {
        sessionId: session.id,
        analyzerMode: this.analyzer.mode,
      });

      try {
        const output = await this.analyzer.analyze({
          anchor: {
            id: session.anchor.id,
            outcomeStatement: session.anchor.outcomeStatement,
            contextSummary: session.anchor.contextSummary,
            decisionToEnable: session.anchor.decisionToEnable,
            businessSignalValue: session.anchor.businessSignalValue,
            version: session.anchor.version,
            sourceRefs: session.anchor.sourceRefs,
          },
          workItems: workItems.map((item: any) => ({
            id: item.id,
            rawLabel: item.rawLabel,
            proposedName: item.proposedName,
            proposedPurpose: item.proposedPurpose,
            currentStateHint: item.currentStateHint,
            sourceRefs: item.sourceRefs,
          })),
        });
        const proposedMutationsData = proposedMutationsFromAnalysis(session.id, run.id, output);
        await db.portfolioBootstrapProposedMutation.createMany({ data: proposedMutationsData });
        await db.portfolioBootstrapAnalysisRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            outputVersion: 'portfolio-bootstrap-analysis-output-v0.1',
            completedAt: this.now(),
          },
        });
        await db.portfolioBootstrapSession.update({
          where: { id: session.id },
          data: { status: 'awaiting_material_review', bootstrapPhase: 'B4_MATERIAL_REVIEW' },
        });
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_bootstrap_analysis_completed', run.id, {
          sessionId: session.id,
          proposedMutationCount: proposedMutationsData.length,
        });
        await Promise.all(proposedMutationsData.map((mutation) => this.writeAudit(
          db,
          input.authenticatedUserId,
          'portfolio_mutation_proposed',
          run.id,
          { sessionId: session.id, targetType: mutation.targetType, targetId: mutation.targetId },
        )));

        const proposedMutations = await db.portfolioBootstrapProposedMutation.findMany({
          where: { analysisRunId: run.id },
          orderBy: { createdAt: 'asc' },
        });
        return {
          analysisRunId: run.id,
          proposedMutations: proposedMutations.map((mutation: any) => this.proposedMutationToDto(mutation)),
          homeState: 'HOME_C',
        };
      } catch (err) {
        await db.portfolioBootstrapAnalysisRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error: { message: err instanceof Error ? err.message : 'analysis failed' },
            completedAt: this.now(),
          },
        });
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_bootstrap_analysis_failed', run.id, {
          sessionId: session.id,
        });
        throw err;
      }
    });
  }

  async listProposedMutations(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    status?: string;
    targetType?: string;
  }): Promise<PortfolioBootstrapProposedMutationsDto> {
    const db = this.prisma as any;
    const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
    await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:read' });
    const proposedMutations = await db.portfolioBootstrapProposedMutation.findMany({
      where: {
        bootstrapSessionId: input.sessionId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.targetType ? { targetType: input.targetType } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    const materialReviewComplete = await this.isMaterialReviewComplete(db, session.id);
    return {
      sessionId: input.sessionId,
      proposedMutations: proposedMutations.map((mutation: any) => this.proposedMutationToDto(mutation)),
      materialReviewComplete,
      nextAction: materialReviewComplete ? 'generate_first_portfolio_reading' : 'review_proposed_structure',
    };
  }

  async publishFirstReading(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    idempotencyKey?: string;
  }): Promise<PortfolioBootstrapReadingPublishDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_reading_publish_started', session.id, {
        sessionId: session.id,
      });
      try {
        this.assertReadingPublishable(session);
        const materialReviewComplete = await this.isMaterialReviewComplete(db, session.id);
        if (!materialReviewComplete) {
          throw AppError.conflict('La revision material aun no es suficiente.', 'PORTFOLIO_BOOTSTRAP_REVIEW_INCOMPLETE');
        }
        const staleRequired = await db.portfolioBootstrapProposedMutation.count({
          where: {
            bootstrapSessionId: session.id,
            materiality: 'material',
            confirmationRequired: true,
            status: { in: ['superseded', 'expired'] },
          },
        });
        if (staleRequired > 0) {
          throw AppError.conflict('Hay propuestas stale que requieren reanalisis o revision.', 'PORTFOLIO_BOOTSTRAP_READING_STALE_STATE');
        }

        const snapshot = buildReadingSnapshot(session);
        const stateHash = hashJson(snapshot);
        const idempotencyKey = input.idempotencyKey?.trim() || null;
        if (idempotencyKey) {
          const existing = await db.portfolioReading.findFirst({
            where: { bootstrapSessionId: session.id, stateHash, idempotencyKey },
          });
          if (existing) return this.readingPublishResult(existing);
        }

        const latest = await db.portfolioReading.findFirst({
          where: { bootstrapSessionId: session.id },
          orderBy: { version: 'desc' },
        });
        const readingData = derivePortfolioReading(session, snapshot, stateHash, idempotencyKey, input.authenticatedUserId, this.now());
        const reading = await db.portfolioReading.create({
          data: {
            ...readingData,
            version: (latest?.version ?? 0) + 1,
          },
        });
        await db.portfolioBootstrapSession.update({
          where: { id: session.id },
          data: { status: 'reading_published', bootstrapPhase: 'B5_FIRST_READING' },
        });
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_reading_published', reading.id, {
          sessionId: session.id,
          version: reading.version,
          homeState: reading.homeState,
        });
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_home_transitioned_to_operational', session.id, {
          sessionId: session.id,
          homeState: reading.homeState,
        });
        return this.readingPublishResult(reading);
      } catch (err) {
        await this.writeAudit(db, input.authenticatedUserId, 'portfolio_reading_publish_failed', session.id, {
          sessionId: session.id,
          reason: err instanceof Error ? err.message : 'unknown',
        });
        throw err;
      }
    });
  }

  async getLatestReading(input: {
    sessionId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioReadingDto | null> {
    const db = this.prisma as any;
    const session = await this.requireOwnedSession(db, input.sessionId, input.authenticatedUserId);
    await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:read' });
    const reading = await db.portfolioReading.findFirst({
      where: { bootstrapSessionId: input.sessionId },
      orderBy: { version: 'desc' },
    });
    return reading ? this.readingToDto(reading) : null;
  }

  async confirmProposedMutation(input: {
    sessionId: string;
    mutationId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
  }): Promise<PortfolioBootstrapMutationReviewDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const { session, mutation } = await this.requireOwnedMutation(db, input.sessionId, input.mutationId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      if (mutation.status === 'confirmed') {
        return this.reviewResult(db, session.id, mutation);
      }
      this.assertReviewableMutation(mutation);

      const reviewedAt = this.now();
      let strategicConnection = null;
      let advancementCondition = null;
      if (mutation.targetType === 'strategic_connection') {
        strategicConnection = await this.applyStrategicConnection(db, session, mutation, input.authenticatedUserId, reviewedAt);
      } else if (mutation.targetType === 'advancement_condition' || mutation.targetType === 'portfolio_anchor') {
        advancementCondition = await this.applyAdvancementCondition(db, session, mutation, input.authenticatedUserId, reviewedAt);
      } else if (mutation.targetType === 'work_item' && mutation.targetId) {
        await db.portfolioBootstrapWorkItem.updateMany({
          where: { id: mutation.targetId, bootstrapSessionId: session.id, status: { not: 'rejected' } },
          data: { status: 'confirmed_in_portfolio' },
        });
      }

      const updated = await db.portfolioBootstrapProposedMutation.update({
        where: { id: mutation.id },
        data: {
          status: 'confirmed',
          reviewedBy: input.authenticatedUserId,
          reviewedAt,
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_mutation_confirmed', mutation.id, {
        sessionId: session.id,
        targetType: mutation.targetType,
        targetId: mutation.targetId,
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_mutation_reviewed', mutation.id, {
        sessionId: session.id,
        status: 'confirmed',
      });
      await this.advanceIfMaterialReviewComplete(db, session.id, input.authenticatedUserId);
      return this.reviewResult(db, session.id, updated, strategicConnection, advancementCondition);
    });
  }

  async rejectProposedMutation(input: {
    sessionId: string;
    mutationId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    reviewNote?: string;
  }): Promise<PortfolioBootstrapMutationReviewDto> {
    return this.reviewWithoutApplying(input, 'rejected', 'portfolio_mutation_rejected');
  }

  async leaveProposedMutationPending(input: {
    sessionId: string;
    mutationId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    reviewNote?: string;
  }): Promise<PortfolioBootstrapMutationReviewDto> {
    return this.reviewWithoutApplying(input, 'reviewed', 'portfolio_mutation_left_pending');
  }

  async correctProposedMutation(input: {
    sessionId: string;
    mutationId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    body: CorrectProposedMutationBody;
  }): Promise<PortfolioBootstrapMutationReviewDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const { session, mutation } = await this.requireOwnedMutation(db, input.sessionId, input.mutationId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      this.assertReviewableMutation(mutation);
      const updated = await db.portfolioBootstrapProposedMutation.update({
        where: { id: mutation.id },
        data: {
          proposedValue: input.body.proposedValue as Prisma.InputJsonValue,
          originalProposedValue: mutation.originalProposedValue ?? mutation.proposedValue,
          status: 'reviewed',
          reviewNote: input.body.reviewNote,
          correctedBy: input.authenticatedUserId,
          correctedAt: this.now(),
          reviewedBy: input.authenticatedUserId,
          reviewedAt: this.now(),
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_mutation_corrected', mutation.id, {
        sessionId: session.id,
        targetType: mutation.targetType,
        targetId: mutation.targetId,
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_mutation_reviewed', mutation.id, {
        sessionId: session.id,
        status: 'reviewed',
      });
      return this.reviewResult(db, session.id, updated);
    });
  }

  private async authorizeSessionCapability(input: {
    db: any;
    session: any;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    capability: 'portfolio:read' | 'portfolio:write';
  }): Promise<void> {
    this.assertOwner(input.session, input.authenticatedUserId);
    if (can(input.permissions, input.capability)) return;

    const organizationId = typeof input.session.organizationId === 'string' ? input.session.organizationId : null;
    const allowed = organizationId
      ? await new ScopedPortfolioAccessService(input.db).canUserAccessPortfolio({
        userId: input.authenticatedUserId,
        organizationId,
        capability: input.capability,
      })
      : false;
    if (!allowed) {
      const mode = input.capability === 'portfolio:read' ? 'leer' : 'modificar';
      const code = input.capability === 'portfolio:read'
        ? 'PORTFOLIO_BOOTSTRAP_READ_REQUIRED'
        : 'PORTFOLIO_BOOTSTRAP_WRITE_REQUIRED';
      throw AppError.forbidden(`No tienes permiso Portfolio para ${mode} Bootstrap.`, code);
    }
  }

  private assertOwner(session: any, userId: string): void {
    if (session.userId !== userId) throw AppError.forbidden('No autorizado.', 'PORTFOLIO_BOOTSTRAP_FORBIDDEN');
  }

  private sessionInclude() {
    return {
      anchor: true,
      sourceContinuation: true,
      importBatches: { orderBy: { createdAt: 'desc' } },
      workItems: { orderBy: { createdAt: 'asc' } },
      proposedMutations: { orderBy: { createdAt: 'asc' } },
      analysisRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
      strategicConnections: { orderBy: { createdAt: 'asc' } },
      advancementConditions: { orderBy: { createdAt: 'asc' } },
      readings: { orderBy: { version: 'desc' }, take: 1 },
    };
  }

  private async findActiveSession(db: any, userId: string, sourceContinuationId: string): Promise<any | null> {
    return db.portfolioBootstrapSession.findFirst({
      where: { userId, sourceContinuationId, status: { not: 'abandoned' } },
      include: this.sessionInclude(),
    });
  }

  private async requireOwnedSession(db: any, sessionId: string, userId: string): Promise<any> {
    const session = await db.portfolioBootstrapSession.findUnique({
      where: { id: sessionId },
      include: this.sessionInclude(),
    });
    if (!session) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
    this.assertOwner(session, userId);
    return session;
  }

  private async recordHistory(db: any, anchor: any, action: string, actorUserId: string): Promise<void> {
    await db.portfolioAnchorHistory.create({
      data: {
        anchorId: anchor.id,
        bootstrapSessionId: anchor.bootstrapSessionId,
        version: anchor.version,
        action,
        actorUserId,
        snapshot: this.anchorSnapshot(anchor),
      },
    });
  }

  private async markWorkIntakeComplete(db: any, sessionId: string, existingWorkStatus: 'has_work' | 'no_existing_work'): Promise<void> {
    await db.portfolioBootstrapSession.update({
      where: { id: sessionId },
      data: {
        existingWorkStatus,
        status: 'awaiting_structuring',
        bootstrapPhase: 'B3_PROVISIONAL_STRUCTURING',
      },
    });
  }

  private async listWorkItemsForSession(db: any, sessionId: string): Promise<PortfolioBootstrapWorkItemsDto> {
    const session = await db.portfolioBootstrapSession.findUnique({
      where: { id: sessionId },
      select: { id: true, existingWorkStatus: true },
    });
    if (!session) throw AppError.notFound('Portfolio Bootstrap session', 'PORTFOLIO_BOOTSTRAP_SESSION_NOT_FOUND');
    const items = await db.portfolioBootstrapWorkItem.findMany({
      where: { bootstrapSessionId: sessionId, status: { not: 'rejected' } },
      orderBy: { createdAt: 'asc' },
    });
    return this.workItemsResult(session.id, session.existingWorkStatus, items);
  }

  private async requireOwnedMutation(db: any, sessionId: string, mutationId: string, userId: string): Promise<{ session: any; mutation: any }> {
    const session = await this.requireOwnedSession(db, sessionId, userId);
    const mutation = await db.portfolioBootstrapProposedMutation.findFirst({
      where: { id: mutationId, bootstrapSessionId: session.id },
    });
    if (!mutation) throw AppError.notFound('Portfolio Bootstrap proposed mutation', 'PORTFOLIO_BOOTSTRAP_MUTATION_NOT_FOUND');
    return { session, mutation };
  }

  private assertReviewableMutation(mutation: any): void {
    if (mutation.status === 'superseded' || mutation.status === 'expired') {
      throw AppError.conflict('La propuesta ya no puede gobernar el estado Bootstrap.', 'PORTFOLIO_BOOTSTRAP_MUTATION_STALE');
    }
    if (mutation.status === 'confirmed' || mutation.status === 'rejected') {
      throw AppError.conflict('La propuesta ya fue resuelta.', 'PORTFOLIO_BOOTSTRAP_MUTATION_ALREADY_RESOLVED');
    }
  }

  private assertReadingPublishable(session: any): void {
    if (!session.anchor) {
      throw AppError.conflict('La sesion no tiene anchor.', 'PORTFOLIO_BOOTSTRAP_ANCHOR_MISSING');
    }
    if (session.status !== 'awaiting_first_reading' && session.status !== 'reading_published') {
      throw AppError.conflict('La sesion aun no esta lista para publicar lectura.', 'PORTFOLIO_BOOTSTRAP_READING_NOT_READY');
    }
  }

  private async reviewWithoutApplying(input: {
    sessionId: string;
    mutationId: string;
    authenticatedUserId: string;
    permissions: ReadonlySet<Permission>;
    reviewNote?: string;
  }, status: 'reviewed' | 'rejected', auditAction: string): Promise<PortfolioBootstrapMutationReviewDto> {
    return this.prisma.$transaction(async (tx) => {
      const db = tx as any;
      const { session, mutation } = await this.requireOwnedMutation(db, input.sessionId, input.mutationId, input.authenticatedUserId);
      await this.authorizeSessionCapability({ db, session, authenticatedUserId: input.authenticatedUserId, permissions: input.permissions, capability: 'portfolio:write' });
      if (mutation.status === status) return this.reviewResult(db, session.id, mutation);
      this.assertReviewableMutation(mutation);
      const updated = await db.portfolioBootstrapProposedMutation.update({
        where: { id: mutation.id },
        data: {
          status,
          reviewNote: input.reviewNote,
          reviewedBy: input.authenticatedUserId,
          reviewedAt: this.now(),
        },
      });
      await this.writeAudit(db, input.authenticatedUserId, auditAction, mutation.id, {
        sessionId: session.id,
        targetType: mutation.targetType,
        targetId: mutation.targetId,
      });
      await this.writeAudit(db, input.authenticatedUserId, 'portfolio_mutation_reviewed', mutation.id, {
        sessionId: session.id,
        status,
      });
      await this.advanceIfMaterialReviewComplete(db, session.id, input.authenticatedUserId);
      return this.reviewResult(db, session.id, updated);
    });
  }

  private async applyStrategicConnection(db: any, session: any, mutation: any, confirmedBy: string, confirmedAt: Date): Promise<any> {
    const existing = await db.portfolioStrategicConnection.findUnique({
      where: { sourceMutationId: mutation.id },
    });
    if (existing) return existing;
    if (!mutation.targetId || !session.anchor?.id) {
      throw AppError.conflict('La propuesta no tiene work item o anchor aplicable.', 'PORTFOLIO_BOOTSTRAP_MUTATION_TARGET_MISSING');
    }
    const value = mutation.proposedValue as { status?: string; rationale?: string } | null;
    return db.portfolioStrategicConnection.create({
      data: {
        bootstrapSessionId: session.id,
        workItemId: mutation.targetId,
        anchorId: session.anchor.id,
        sourceMutationId: mutation.id,
        status: toGovernedStrategicConnectionStatus(value?.status),
        rationale: value?.rationale ?? mutation.rationale,
        provenanceStatus: 'user_confirmed',
        sourceRefs: {
          sourceRefs: mutation.sourceRefs,
          analysisRunId: mutation.analysisRunId,
          mutationId: mutation.id,
          originalProvenanceStatus: mutation.provenanceStatus,
          originalProposedValue: mutation.originalProposedValue ?? mutation.proposedValue,
          reviewedProposedValue: mutation.proposedValue,
        } as Prisma.InputJsonValue,
        confirmedBy,
        confirmedAt,
      },
    });
  }

  private async applyAdvancementCondition(db: any, session: any, mutation: any, confirmedBy: string, confirmedAt: Date): Promise<any> {
    const existing = await db.portfolioAdvancementCondition.findUnique({
      where: { sourceMutationId: mutation.id },
    });
    if (existing) return existing;
    const value = mutation.proposedValue as {
      workItemId?: string;
      type?: string;
      statement?: string;
      status?: string;
      severity?: string;
      movementAffected?: string;
      conflict?: string;
    } | null;
    const type = toAdvancementConditionType(value?.type, mutation.targetType);
    const severity = toAdvancementSeverity(value?.severity, value?.movementAffected);
    return db.portfolioAdvancementCondition.create({
      data: {
        bootstrapSessionId: session.id,
        workItemId: mutation.targetId ?? value?.workItemId ?? null,
        sourceMutationId: mutation.id,
        type,
        status: value?.status ?? (mutation.targetType === 'portfolio_anchor' ? 'anchor_attention_confirmed' : 'confirmed'),
        statement: value?.statement ?? value?.conflict ?? mutation.rationale ?? 'Condicion confirmada por Portfolio Lead.',
        severity,
        movementAffected: severity === 'blocking' ? value?.movementAffected ?? 'Siguiente movimiento del portfolio' : value?.movementAffected ?? null,
        provenanceStatus: 'user_confirmed',
        sourceRefs: {
          sourceRefs: mutation.sourceRefs,
          analysisRunId: mutation.analysisRunId,
          mutationId: mutation.id,
          originalProvenanceStatus: mutation.provenanceStatus,
          originalProposedValue: mutation.originalProposedValue ?? mutation.proposedValue,
          reviewedProposedValue: mutation.proposedValue,
        } as Prisma.InputJsonValue,
        confirmedBy,
        confirmedAt,
      },
    });
  }

  private async isMaterialReviewComplete(db: any, sessionId: string): Promise<boolean> {
    const unresolved = await db.portfolioBootstrapProposedMutation.count({
      where: {
        bootstrapSessionId: sessionId,
        materiality: 'material',
        confirmationRequired: true,
        OR: [
          { status: 'proposed' },
          { status: 'reviewed', correctedAt: { not: null } },
        ],
      },
    });
    return unresolved === 0;
  }

  private async advanceIfMaterialReviewComplete(db: any, sessionId: string, actorUserId: string): Promise<void> {
    const complete = await this.isMaterialReviewComplete(db, sessionId);
    if (!complete) return;
    const current = await db.portfolioBootstrapSession.findUnique({
      where: { id: sessionId },
      select: { bootstrapPhase: true },
    });
    await db.portfolioBootstrapSession.update({
      where: { id: sessionId },
      data: { status: 'awaiting_first_reading', bootstrapPhase: 'B5_FIRST_READING' },
    });
    if (current?.bootstrapPhase !== 'B5_FIRST_READING') {
      await this.writeAudit(db, actorUserId, 'portfolio_material_review_completed', sessionId, {
        sessionId,
        nextAction: 'generate_first_portfolio_reading',
      });
    }
  }

  private async reviewResult(
    db: any,
    sessionId: string,
    mutation: any,
    strategicConnection: any = null,
    advancementCondition: any = null,
  ): Promise<PortfolioBootstrapMutationReviewDto> {
    const materialReviewComplete = await this.isMaterialReviewComplete(db, sessionId);
    return {
      mutation: this.proposedMutationToDto(mutation),
      strategicConnection: strategicConnection ? this.strategicConnectionToDto(strategicConnection) : null,
      advancementCondition: advancementCondition ? this.advancementConditionToDto(advancementCondition) : null,
      materialReviewComplete,
      nextAction: materialReviewComplete ? 'generate_first_portfolio_reading' : 'review_proposed_structure',
    };
  }

  private readingPublishResult(reading: any): PortfolioBootstrapReadingPublishDto {
    return {
      reading: this.readingToDto(reading),
      homeState: reading.homeState,
      nextBestAction: reading.nextBestAction,
    };
  }

  private workItemsResult(sessionId: string, existingWorkStatus: string, items: any[]): PortfolioBootstrapWorkItemsDto {
    return {
      sessionId,
      existingWorkStatus,
      items: items.map((item) => this.workItemToDto(item)),
    };
  }

  private workItemToDto(item: any): PortfolioBootstrapWorkItemDto {
    return {
      id: item.id,
      bootstrapSessionId: item.bootstrapSessionId,
      rawLabel: item.rawLabel,
      proposedName: item.proposedName,
      proposedPurpose: item.proposedPurpose,
      sourceType: item.sourceType,
      status: item.status,
      currentStateHint: item.currentStateHint,
      ownerCandidate: item.ownerCandidate,
      sourceRefs: item.sourceRefs,
      createdBy: item.createdBy,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private importBatchToDto(batch: any): PortfolioBootstrapImportBatchDto {
    const rawHeaders = asStringArray(batch.rawHeaders);
    return {
      id: batch.id,
      bootstrapSessionId: batch.bootstrapSessionId,
      fileName: batch.fileName,
      fileType: batch.fileType,
      fileSize: batch.fileSize,
      fileHash: batch.fileHash,
      status: batch.status,
      rowCount: batch.rowCount,
      sheetName: batch.sheetName ?? null,
      rawHeaders,
      confirmedMapping: batch.confirmedMapping ? normalizeImportMapping(batch.confirmedMapping, rawHeaders) : null,
      suggestedMapping: suggestImportMapping(rawHeaders),
      previewRows: asImportRows(batch.previewRows),
      warnings: asImportWarnings(batch.warnings),
      uploadedBy: batch.uploadedBy,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    };
  }

  private analysisRunToDto(run: any): PortfolioBootstrapAnalysisRunDto {
    return {
      id: run.id,
      bootstrapSessionId: run.bootstrapSessionId,
      status: run.status,
      analyzerMode: run.analyzerMode,
      inputVersion: run.inputVersion,
      outputVersion: run.outputVersion,
      error: run.error,
      createdBy: run.createdBy,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }

  private proposedMutationToDto(mutation: any): PortfolioBootstrapProposedMutationDto {
    return {
      id: mutation.id,
      bootstrapSessionId: mutation.bootstrapSessionId,
      analysisRunId: mutation.analysisRunId,
      targetType: mutation.targetType,
      targetId: mutation.targetId,
      mutationType: mutation.mutationType,
      currentValue: mutation.currentValue,
      originalProposedValue: mutation.originalProposedValue,
      proposedValue: mutation.proposedValue,
      rationale: mutation.rationale,
      reviewNote: mutation.reviewNote,
      sourceRefs: mutation.sourceRefs,
      provenanceStatus: mutation.provenanceStatus,
      uncertainty: mutation.uncertainty,
      materiality: mutation.materiality,
      confirmationRequired: mutation.confirmationRequired,
      status: mutation.status,
      reviewedBy: mutation.reviewedBy,
      reviewedAt: mutation.reviewedAt?.toISOString() ?? null,
      correctedBy: mutation.correctedBy,
      correctedAt: mutation.correctedAt?.toISOString() ?? null,
      createdAt: mutation.createdAt.toISOString(),
      updatedAt: mutation.updatedAt.toISOString(),
    };
  }

  private strategicConnectionToDto(connection: any): PortfolioStrategicConnectionDto {
    return {
      id: connection.id,
      bootstrapSessionId: connection.bootstrapSessionId,
      workItemId: connection.workItemId,
      anchorId: connection.anchorId,
      sourceMutationId: connection.sourceMutationId,
      status: connection.status,
      rationale: connection.rationale,
      provenanceStatus: connection.provenanceStatus,
      sourceRefs: connection.sourceRefs,
      confirmedBy: connection.confirmedBy,
      confirmedAt: connection.confirmedAt.toISOString(),
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  private advancementConditionToDto(condition: any): PortfolioAdvancementConditionDto {
    return {
      id: condition.id,
      bootstrapSessionId: condition.bootstrapSessionId,
      workItemId: condition.workItemId,
      sourceMutationId: condition.sourceMutationId,
      type: condition.type,
      status: condition.status,
      statement: condition.statement,
      severity: condition.severity,
      movementAffected: condition.movementAffected,
      provenanceStatus: condition.provenanceStatus,
      sourceRefs: condition.sourceRefs,
      confirmedBy: condition.confirmedBy,
      confirmedAt: condition.confirmedAt.toISOString(),
      createdAt: condition.createdAt.toISOString(),
      updatedAt: condition.updatedAt.toISOString(),
    };
  }

  private readingToDto(reading: any): PortfolioReadingDto {
    return {
      id: reading.id,
      bootstrapSessionId: reading.bootstrapSessionId,
      anchorId: reading.anchorId,
      version: reading.version,
      summary: reading.summary,
      totalWorkItems: reading.totalWorkItems,
      confirmedConnections: reading.confirmedConnections,
      uncertainConnections: reading.uncertainConnections,
      signalGapCount: reading.signalGapCount,
      unresolvedDependencyCount: reading.unresolvedDependencyCount,
      decisionPathGapCount: reading.decisionPathGapCount,
      requiredContextGapCount: reading.requiredContextGapCount,
      ownershipGapCount: reading.ownershipGapCount,
      possibleMisalignmentCount: reading.possibleMisalignmentCount,
      confirmedMisalignmentCount: reading.confirmedMisalignmentCount,
      primaryAttentionItems: reading.primaryAttentionItems,
      nextBestAction: reading.nextBestAction,
      sourceBootstrapVersion: reading.sourceBootstrapVersion,
      sourceAnchorVersion: reading.sourceAnchorVersion,
      sourceSnapshot: reading.sourceSnapshot,
      stateHash: reading.stateHash,
      homeState: reading.homeState,
      publishedBy: reading.publishedBy,
      publishedAt: reading.publishedAt.toISOString(),
      createdAt: reading.createdAt.toISOString(),
      updatedAt: reading.updatedAt.toISOString(),
    };
  }

  private async writeAudit(db: any, actorUserId: string, action: string, resourceId: string, details: Record<string, unknown>): Promise<void> {
    await db.auditLog.create({
      data: {
        userId: actorUserId,
        action,
        resource: 'PortfolioBootstrap',
        resourceId,
        details: { ...details, timestamp: this.now().toISOString() } as Prisma.InputJsonValue,
      },
    });
  }

  private anchorSnapshot(anchor: any): Prisma.InputJsonValue {
    return {
      id: anchor.id,
      bootstrapSessionId: anchor.bootstrapSessionId,
      outcomeStatement: anchor.outcomeStatement,
      contextSummary: anchor.contextSummary,
      decisionToEnable: anchor.decisionToEnable,
      businessSignalStatus: anchor.businessSignalStatus,
      businessSignalValue: anchor.businessSignalValue,
      status: anchor.status,
      sourceRefs: anchor.sourceRefs,
      provenanceStatus: anchor.provenanceStatus,
      confirmedBy: anchor.confirmedBy,
      confirmedAt: anchor.confirmedAt?.toISOString?.() ?? anchor.confirmedAt ?? null,
      version: anchor.version,
    } as Prisma.InputJsonValue;
  }

  private toDto(row: any): PortfolioBootstrapDto {
    return {
      sourceContinuation: row.sourceContinuation
        ? { id: row.sourceContinuation.id, sessionId: row.sourceContinuation.sessionId }
        : row.sourceContinuationId
          ? { id: row.sourceContinuationId, sessionId: '' }
          : null,
      bootstrapSession: {
        id: row.id,
        userId: row.userId,
        organizationId: row.organizationId,
        sourceContinuationId: row.sourceContinuationId,
        status: row.status,
        bootstrapPhase: row.bootstrapPhase,
        existingWorkStatus: row.existingWorkStatus ?? 'unknown',
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
      anchor: row.anchor ? {
        id: row.anchor.id,
        bootstrapSessionId: row.anchor.bootstrapSessionId,
        outcomeStatement: row.anchor.outcomeStatement,
        contextSummary: row.anchor.contextSummary,
        decisionToEnable: row.anchor.decisionToEnable,
        businessSignalStatus: row.anchor.businessSignalStatus,
        businessSignalValue: row.anchor.businessSignalValue,
        status: row.anchor.status,
        sourceRefs: row.anchor.sourceRefs,
        provenanceStatus: row.anchor.provenanceStatus,
        confirmedBy: row.anchor.confirmedBy,
        confirmedAt: row.anchor.confirmedAt?.toISOString() ?? null,
        version: row.anchor.version,
        createdAt: row.anchor.createdAt.toISOString(),
        updatedAt: row.anchor.updatedAt.toISOString(),
      } : null,
      workItems: (row.workItems ?? [])
        .filter((item: any) => item.status !== 'rejected')
        .map((item: any) => this.workItemToDto(item)),
      importBatches: (row.importBatches ?? []).map((batch: any) => this.importBatchToDto(batch)),
      proposedMutations: (row.proposedMutations ?? []).map((mutation: any) => this.proposedMutationToDto(mutation)),
      latestAnalysisRun: row.analysisRuns?.[0] ? this.analysisRunToDto(row.analysisRuns[0]) : null,
      strategicConnections: (row.strategicConnections ?? []).map((connection: any) => this.strategicConnectionToDto(connection)),
      advancementConditions: (row.advancementConditions ?? []).map((condition: any) => this.advancementConditionToDto(condition)),
      latestReading: row.readings?.[0] ? this.readingToDto(row.readings[0]) : null,
    };
  }
}

type DecodedImportFile = {
  fileName: string;
  fileType: string;
  fileSize: number;
  buffer: Buffer;
};

type ParsedImportFile = {
  headers: string[];
  rows: PortfolioBootstrapImportPreviewRow[];
  sheetName: string | null;
  warnings: PortfolioBootstrapImportWarning[];
};

function decodeImportFile(body: UploadImportBody): DecodedImportFile {
  const buffer = Buffer.from(body.contentBase64, 'base64');
  if (buffer.length === 0 || buffer.length !== body.fileSize) {
    throw AppError.badRequest('El archivo no se pudo leer correctamente.', 'PORTFOLIO_BOOTSTRAP_IMPORT_INVALID_FILE');
  }
  return {
    fileName: sanitizeFileName(body.fileName),
    fileType: body.fileType.trim(),
    fileSize: body.fileSize,
    buffer,
  };
}

function parseImportFile(file: DecodedImportFile): ParsedImportFile {
  const extension = file.fileName.toLowerCase().split('.').pop();
  if (extension === 'csv' || file.fileType.includes('csv')) return parseCsvImport(file);
  if (extension === 'xlsx' || file.fileType.includes('spreadsheet')) return parseXlsxImport(file);
  throw AppError.badRequest('Solo se aceptan archivos CSV o XLSX.', 'PORTFOLIO_BOOTSTRAP_IMPORT_UNSUPPORTED_FILE');
}

function parseCsvImport(file: DecodedImportFile): ParsedImportFile {
  const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
  const matrix = parseCsv(text);
  return matrixToImportRows(matrix, null);
}

function parseXlsxImport(file: DecodedImportFile): ParsedImportFile {
  try {
    const workbook = XLSX.read(file.buffer, { type: 'buffer', raw: false, cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw AppError.badRequest('El archivo XLSX no contiene hojas.', 'PORTFOLIO_BOOTSTRAP_IMPORT_EMPTY_FILE');
    }
    const matrix = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      blankrows: false,
      defval: '',
    });
    return matrixToImportRows(matrix, sheetName);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.badRequest('El archivo XLSX esta corrupto, cifrado o no es legible.', 'PORTFOLIO_BOOTSTRAP_IMPORT_XLSX_UNREADABLE');
  }
}

function matrixToImportRows(matrix: unknown[][], sheetName: string | null): ParsedImportFile {
  if (matrix.length === 0) {
    throw AppError.badRequest('El archivo esta vacio.', 'PORTFOLIO_BOOTSTRAP_IMPORT_EMPTY_FILE');
  }
  const headerRowIndex = matrix.findIndex((row) => row.some((cell) => sanitizeCell(cell).trim()));
  if (headerRowIndex < 0) {
    throw AppError.badRequest('El archivo no contiene encabezados.', 'PORTFOLIO_BOOTSTRAP_IMPORT_HEADERS_REQUIRED');
  }
  const headers = matrix[headerRowIndex].map((cell) => sanitizeCell(cell)).filter(Boolean);
  if (headers.length === 0) {
    throw AppError.badRequest('El archivo no contiene encabezados.', 'PORTFOLIO_BOOTSTRAP_IMPORT_HEADERS_REQUIRED');
  }
  const warnings: PortfolioBootstrapImportWarning[] = [];
  const rows = matrix.slice(headerRowIndex + 1)
    .map((row, index) => {
      const rawRow: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        rawRow[header] = sanitizeCell(row[headerIndex]);
      });
      return { rowNumber: headerRowIndex + index + 2, rawRow };
    })
    .filter((row) => Object.values(row.rawRow).some((value) => value.trim()));
  if (rows.length === 0) {
    throw AppError.badRequest('El archivo no contiene filas de trabajo.', 'PORTFOLIO_BOOTSTRAP_IMPORT_EMPTY_ROWS');
  }
  if (rows.length > 1000) {
    throw AppError.badRequest('El archivo supera el limite de 1000 filas.', 'PORTFOLIO_BOOTSTRAP_IMPORT_TOO_MANY_ROWS');
  }
  return { headers, rows, sheetName, warnings };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function suggestImportMapping(headers: string[]): PortfolioBootstrapImportMapping {
  const mapping: PortfolioBootstrapImportMapping = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (!mapping.label && ['nombre', 'name', 'iniciativa', 'initiative', 'proyecto', 'project'].includes(normalized)) mapping.label = header;
    else if (!mapping.owner && ['owner', 'responsable', 'lider', 'líder'].includes(normalized)) mapping.owner = header;
    else if (!mapping.state && ['estado', 'status'].includes(normalized)) mapping.state = header;
    else if (!mapping.purpose && ['objetivo', 'objective', 'proposito', 'propósito', 'purpose', 'descripcion', 'descripción'].includes(normalized)) mapping.purpose = header;
    else if (!mapping.signal && ['kpi', 'metrica', 'métrica', 'signal'].includes(normalized)) mapping.signal = header;
    else if (!mapping.notes && ['notes', 'notas', 'comentarios'].includes(normalized)) mapping.notes = header;
  }
  return mapping;
}

function normalizeImportMapping(input: unknown, headers: string[]): PortfolioBootstrapImportMapping {
  const source = (input ?? {}) as Record<string, unknown>;
  const allowed = new Set(headers);
  const mapping: PortfolioBootstrapImportMapping = {};
  for (const key of ['label', 'owner', 'state', 'purpose', 'signal', 'notes'] as const) {
    const value = typeof source[key] === 'string' ? source[key].trim() : null;
    mapping[key] = value && allowed.has(value) ? value : null;
  }
  return mapping;
}

function buildWorkItemsFromImport(
  batch: any,
  rows: PortfolioBootstrapImportPreviewRow[],
  mapping: PortfolioBootstrapImportMapping,
  source: any,
  createdBy: string,
): {
  items: Array<Record<string, unknown>>;
  warnings: PortfolioBootstrapImportWarning[];
  duplicateRows: number;
  skippedRows: number;
} {
  const seen = new Set<string>();
  const warnings = asImportWarnings(batch.warnings);
  const items: Array<Record<string, unknown>> = [];
  let duplicateRows = 0;
  let skippedRows = 0;
  for (const row of rows) {
    const label = readMappedValue(row.rawRow, mapping.label);
    if (!label) {
      skippedRows += 1;
      warnings.push({ code: 'missing_label', message: 'Fila sin nombre importable.', rowNumber: row.rowNumber });
      continue;
    }
    const rowHash = crypto.createHash('sha256').update(stableJson(row.rawRow)).digest('hex');
    const duplicateKey = `${normalizeLabel(label)}:${rowHash}`;
    if (seen.has(duplicateKey)) {
      duplicateRows += 1;
      warnings.push({ code: 'duplicate_exact', message: 'Fila duplicada dentro del archivo.', rowNumber: row.rowNumber });
      continue;
    }
    seen.add(duplicateKey);
    const rawState = readMappedValue(row.rawRow, mapping.state);
    const signal = readMappedValue(row.rawRow, mapping.signal);
    const notes = readMappedValue(row.rawRow, mapping.notes);
    items.push({
      bootstrapSessionId: batch.bootstrapSessionId,
      sourceId: source.id,
      importBatchId: batch.id,
      rawLabel: label,
      proposedName: label,
      proposedPurpose: readMappedValue(row.rawRow, mapping.purpose) || null,
      sourceType: 'imported_file',
      status: 'detected',
      currentStateHint: normalizeState(rawState),
      ownerCandidate: readMappedValue(row.rawRow, mapping.owner) || null,
      sourceRefs: {
        sourceId: source.id,
        sourceType: 'imported_file',
        importBatchId: batch.id,
        fileName: batch.fileName,
        fileHash: batch.fileHash,
        sheetName: batch.sheetName,
        rowNumber: row.rowNumber,
        rawRow: row.rawRow,
        sourceRefs: { rowHash, rawState, signal, notes },
        createdBy,
        createdAt: source.createdAt.toISOString(),
      },
      createdBy,
    });
  }
  return { items, warnings, duplicateRows, skippedRows };
}

function readMappedValue(row: Record<string, string>, header?: string | null): string {
  return header ? (row[header] ?? '').trim() : '';
}

function normalizeState(value: string): string {
  const normalized = normalizeHeader(value);
  if (['idea', 'ideacion', 'ideación'].includes(normalized)) return 'idea';
  if (['candidate', 'candidata', 'candidato'].includes(normalized)) return 'candidate';
  if (['active', 'activo', 'activa', 'en marcha', 'doing'].includes(normalized)) return 'active';
  if (['paused', 'pausado', 'pausada', 'bloqueada', 'blocked'].includes(normalized)) return 'paused';
  if (['completed', 'terminada', 'terminado', 'done', 'finalizada', 'finalizado'].includes(normalized)) return 'completed';
  return 'unknown';
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeLabel(value: string): string {
  return normalizeHeader(value).replace(/\s+/g, ' ');
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'portfolio-import';
}

function sanitizeCell(value: unknown): string {
  const text = String(value ?? '').replace(/\0/g, '').trim().slice(0, 2000);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asImportRows(value: unknown): PortfolioBootstrapImportPreviewRow[] {
  return Array.isArray(value)
    ? value.map((item) => ({
      rowNumber: Number((item as PortfolioBootstrapImportPreviewRow).rowNumber),
      rawRow: ((item as PortfolioBootstrapImportPreviewRow).rawRow ?? {}) as Record<string, string>,
    })).filter((item) => Number.isFinite(item.rowNumber))
    : [];
}

function asImportWarnings(value: unknown): PortfolioBootstrapImportWarning[] {
  return Array.isArray(value)
    ? value.map((item) => ({
      code: String((item as PortfolioBootstrapImportWarning).code ?? 'warning'),
      message: String((item as PortfolioBootstrapImportWarning).message ?? ''),
      rowNumber: (item as PortfolioBootstrapImportWarning).rowNumber,
    }))
    : [];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function parsePastedWorkItems(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [text.trim()].filter(Boolean);
}

function makeRequestHash(operation: string, payload: string, idempotencyKey?: string): string {
  return crypto
    .createHash('sha256')
    .update(operation)
    .update('\n')
    .update(idempotencyKey?.trim() || payload.trim())
    .digest('hex');
}

function makeAnalysisInputVersion(anchor: any, workItems: any[], idempotencyKey?: string): string {
  const payload = {
    anchor: {
      id: anchor.id,
      version: anchor.version,
      status: anchor.status,
      outcomeStatement: anchor.outcomeStatement,
      contextSummary: anchor.contextSummary,
      decisionToEnable: anchor.decisionToEnable,
      businessSignalValue: anchor.businessSignalValue,
    },
    workItems: workItems.map((item) => ({
      id: item.id,
      updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
      rawLabel: item.rawLabel,
      proposedName: item.proposedName,
      proposedPurpose: item.proposedPurpose,
      currentStateHint: item.currentStateHint,
      status: item.status,
    })),
    idempotencyKey: idempotencyKey?.trim() || null,
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function proposedMutationsFromAnalysis(
  bootstrapSessionId: string,
  analysisRunId: string,
  output: PortfolioBootstrapAnalysisOutput,
): Array<Record<string, unknown>> {
  const mutations: Array<Record<string, unknown>> = [];

  for (const itemAnalysis of output.workItemAnalyses) {
    mutations.push({
      bootstrapSessionId,
      analysisRunId,
      targetType: 'strategic_connection',
      targetId: itemAnalysis.workItemId,
      mutationType: 'create',
      proposedValue: {
        workItemId: itemAnalysis.workItemId,
        status: itemAnalysis.strategicConnection.proposedStatus,
        rationale: itemAnalysis.strategicConnection.rationale,
      } as Prisma.InputJsonValue,
      rationale: itemAnalysis.strategicConnection.rationale,
      sourceRefs: itemAnalysis.strategicConnection.sourceRefs as Prisma.InputJsonValue,
      provenanceStatus: 'ai_suggested',
      uncertainty: itemAnalysis.strategicConnection.uncertainty,
      materiality: 'material',
      confirmationRequired: true,
      status: 'proposed',
    });

    for (const condition of itemAnalysis.advancementConditions) {
      mutations.push({
        bootstrapSessionId,
        analysisRunId,
        targetType: 'advancement_condition',
        targetId: itemAnalysis.workItemId,
        mutationType: 'create',
        proposedValue: {
          workItemId: itemAnalysis.workItemId,
          type: condition.type,
          statement: condition.statement,
          status: condition.status,
          severity: condition.severity,
          movementAffected: condition.movementAffected,
        } as Prisma.InputJsonValue,
        rationale: condition.statement,
        sourceRefs: condition.sourceRefs as Prisma.InputJsonValue,
        provenanceStatus: 'ai_inferred',
        uncertainty: condition.uncertainty,
        materiality: condition.severity === 'info' ? 'low' : 'material',
        confirmationRequired: true,
        status: 'proposed',
      });
    }

    for (const conflict of itemAnalysis.conflicts) {
      mutations.push({
        bootstrapSessionId,
        analysisRunId,
        targetType: 'portfolio_anchor',
        targetId: itemAnalysis.workItemId,
        mutationType: 'update',
        proposedValue: {
          conflict: conflict.statement,
          workItemId: itemAnalysis.workItemId,
        } as Prisma.InputJsonValue,
        rationale: conflict.statement,
        sourceRefs: conflict.sourceRefs as Prisma.InputJsonValue,
        provenanceStatus: 'ai_inferred',
        uncertainty: 'medium',
        materiality: 'material',
        confirmationRequired: true,
        status: 'proposed',
      });
    }
  }

  for (const finding of output.portfolioLevelFindings) {
    mutations.push({
      bootstrapSessionId,
      analysisRunId,
      targetType: 'advancement_condition',
      targetId: null,
      mutationType: 'create',
      proposedValue: {
        type: finding.type,
        statement: finding.statement,
        severity: 'attention',
      } as Prisma.InputJsonValue,
      rationale: finding.statement,
      sourceRefs: finding.sourceRefs as Prisma.InputJsonValue,
      provenanceStatus: 'ai_inferred',
      uncertainty: 'medium',
      materiality: 'material',
      confirmationRequired: true,
      status: 'proposed',
    });
  }

  return mutations;
}

type PortfolioAttentionItem = {
  type: 'missing_business_signal' | 'unresolved_dependency' | 'missing_decision_path' | 'information_conflict' | 'possible_misalignment' | 'ownership_gap' | 'missing_required_context';
  title: string;
  statement: string;
  whyItMatters: string;
  targetRef?: { type: 'work_item' | 'portfolio_anchor' | 'portfolio'; id: string };
  severity: 'info' | 'attention' | 'blocking';
  sourceRefs: unknown;
  nextAction?: string;
};

function buildReadingSnapshot(session: any): Record<string, unknown> {
  return {
    bootstrapSession: {
      id: session.id,
      bootstrapPhase: session.bootstrapPhase,
      existingWorkStatus: session.existingWorkStatus,
    },
    anchor: session.anchor ? {
      id: session.anchor.id,
      version: session.anchor.version,
      status: session.anchor.status,
      outcomeStatement: session.anchor.outcomeStatement,
      contextSummary: session.anchor.contextSummary,
      decisionToEnable: session.anchor.decisionToEnable,
      businessSignalStatus: session.anchor.businessSignalStatus,
      businessSignalValue: session.anchor.businessSignalValue,
      sourceRefs: session.anchor.sourceRefs,
      provenanceStatus: session.anchor.provenanceStatus,
    } : null,
    workItems: (session.workItems ?? [])
      .filter((item: any) => item.status !== 'rejected')
      .map((item: any) => ({
        id: item.id,
        rawLabel: item.rawLabel,
        proposedName: item.proposedName,
        proposedPurpose: item.proposedPurpose,
        status: item.status,
        currentStateHint: item.currentStateHint,
        ownerCandidate: item.ownerCandidate,
        sourceRefs: item.sourceRefs,
        updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
      })),
    strategicConnections: (session.strategicConnections ?? []).map((connection: any) => ({
      id: connection.id,
      workItemId: connection.workItemId,
      anchorId: connection.anchorId,
      sourceMutationId: connection.sourceMutationId,
      status: connection.status,
      rationale: connection.rationale,
      provenanceStatus: connection.provenanceStatus,
      sourceRefs: connection.sourceRefs,
      confirmedBy: connection.confirmedBy,
      confirmedAt: connection.confirmedAt?.toISOString?.() ?? connection.confirmedAt,
      updatedAt: connection.updatedAt?.toISOString?.() ?? connection.updatedAt,
    })),
    advancementConditions: (session.advancementConditions ?? []).map((condition: any) => ({
      id: condition.id,
      workItemId: condition.workItemId,
      sourceMutationId: condition.sourceMutationId,
      type: condition.type,
      status: condition.status,
      statement: condition.statement,
      severity: condition.severity,
      movementAffected: condition.movementAffected,
      provenanceStatus: condition.provenanceStatus,
      sourceRefs: condition.sourceRefs,
      confirmedBy: condition.confirmedBy,
      confirmedAt: condition.confirmedAt?.toISOString?.() ?? condition.confirmedAt,
      updatedAt: condition.updatedAt?.toISOString?.() ?? condition.updatedAt,
    })),
    unresolvedProposals: (session.proposedMutations ?? [])
      .filter((mutation: any) => mutation.status === 'proposed' || mutation.status === 'reviewed')
      .map((mutation: any) => ({
        id: mutation.id,
        targetType: mutation.targetType,
        targetId: mutation.targetId,
        proposedValue: mutation.proposedValue,
        originalProposedValue: mutation.originalProposedValue,
        status: mutation.status,
        correctedAt: mutation.correctedAt?.toISOString?.() ?? mutation.correctedAt,
        materiality: mutation.materiality,
        confirmationRequired: mutation.confirmationRequired,
        provenanceStatus: mutation.provenanceStatus,
        uncertainty: mutation.uncertainty,
        sourceRefs: mutation.sourceRefs,
      })),
  };
}

function derivePortfolioReading(
  session: any,
  snapshot: Record<string, unknown>,
  stateHash: string,
  idempotencyKey: string | null,
  publishedBy: string,
  publishedAt: Date,
): Record<string, unknown> {
  const anchor = session.anchor;
  const workItems = (session.workItems ?? []).filter((item: any) => item.status !== 'rejected');
  const strategicConnections = session.strategicConnections ?? [];
  const advancementConditions = session.advancementConditions ?? [];
  const unresolvedProposals = (session.proposedMutations ?? []).filter((mutation: any) => mutation.status === 'reviewed' || mutation.status === 'proposed');
  const attentionItems = deriveAttentionItems(anchor, strategicConnections, advancementConditions, unresolvedProposals);
  const materialAttention = attentionItems.filter((item) => item.severity === 'attention' || item.severity === 'blocking');
  const confirmedConnections = strategicConnections.filter((connection: any) => connection.status === 'confirmed_alignment' || connection.status === 'partial_alignment').length;
  const uncertainConnections = strategicConnections.filter((connection: any) => connection.status === 'alignment_unknown').length
    + unresolvedProposals.filter((mutation: any) => mutation.targetType === 'strategic_connection').length;
  const nextBestAction = materialAttention.length > 0
    ? materialAttention[0].nextAction ?? 'Revisar atencion prioritaria del portfolio'
    : 'Mantener y revisar la lectura inicial del portfolio';

  return {
    bootstrapSessionId: session.id,
    anchorId: anchor.id,
    summary: [
      `Intentamos mover: ${anchor.outcomeStatement}.`,
      `Trabajo identificado: ${workItems.length} elementos.`,
      `Conexion: ${confirmedConnections} conexiones confirmadas y ${uncertainConnections} con incertidumbre visible.`,
      `Faltantes: ${countConditions(advancementConditions, 'business_signal')} senales de negocio, ${countConditions(advancementConditions, 'critical_dependency')} dependencias, ${countConditions(advancementConditions, 'decision_path')} rutas de decision.`,
      `Atencion: ${materialAttention.length} elementos materiales.`,
      `Siguiente paso: ${nextBestAction}.`,
    ].join('\n'),
    totalWorkItems: workItems.length,
    confirmedConnections,
    uncertainConnections,
    signalGapCount: countConditions(advancementConditions, 'business_signal'),
    unresolvedDependencyCount: countConditions(advancementConditions, 'critical_dependency'),
    decisionPathGapCount: countConditions(advancementConditions, 'decision_path'),
    requiredContextGapCount: countConditions(advancementConditions, 'required_context'),
    ownershipGapCount: countConditions(advancementConditions, 'ownership_visibility'),
    possibleMisalignmentCount: attentionItems.filter((item) => item.type === 'possible_misalignment' && item.severity !== 'blocking').length,
    confirmedMisalignmentCount: strategicConnections.filter((connection: any) => connection.status === 'confirmed_misalignment' || connection.status === 'out_of_current_priority').length,
    primaryAttentionItems: attentionItems as Prisma.InputJsonValue,
    nextBestAction,
    sourceBootstrapVersion: stateHash,
    sourceAnchorVersion: anchor.version,
    sourceSnapshot: snapshot as Prisma.InputJsonValue,
    stateHash,
    idempotencyKey,
    homeState: materialAttention.length > 0 ? 'HOME_E' : 'HOME_D',
    publishedBy,
    publishedAt,
  };
}

function deriveAttentionItems(anchor: any, strategicConnections: any[], advancementConditions: any[], unresolvedProposals: any[]): PortfolioAttentionItem[] {
  const items: PortfolioAttentionItem[] = [];

  for (const condition of advancementConditions) {
    items.push({
      type: attentionTypeForCondition(condition.type),
      title: attentionTitleForCondition(condition.type),
      statement: condition.statement,
      whyItMatters: whyConditionMatters(condition.type),
      targetRef: condition.workItemId ? { type: 'work_item', id: condition.workItemId } : { type: 'portfolio_anchor', id: anchor.id },
      severity: condition.severity,
      sourceRefs: condition.sourceRefs,
      nextAction: nextActionForCondition(condition.type, condition.severity),
    });
  }

  for (const connection of strategicConnections) {
    if (connection.status !== 'confirmed_misalignment' && connection.status !== 'out_of_current_priority') continue;
    items.push({
      type: 'possible_misalignment',
      title: connection.status === 'out_of_current_priority' ? 'Fuera de prioridad actual' : 'Relacion cuestionada',
      statement: connection.rationale ?? 'La relacion con el anchor requiere revision de portfolio.',
      whyItMatters: 'Puede estar consumiendo esfuerzo que no conecta con la prioridad revisada.',
      targetRef: { type: 'work_item', id: connection.workItemId },
      severity: 'attention',
      sourceRefs: connection.sourceRefs,
      nextAction: 'Revisar si este trabajo debe mantenerse dentro de esta lectura',
    });
  }

  for (const proposal of unresolvedProposals) {
    if (proposal.status === 'reviewed' && proposal.correctedAt) continue;
    items.push({
      type: proposal.targetType === 'strategic_connection' ? 'possible_misalignment' : 'missing_required_context',
      title: proposal.targetType === 'strategic_connection' ? 'Conexion pendiente' : 'Informacion pendiente',
      statement: proposal.rationale ?? 'Hay una propuesta dejada pendiente para no convertir incertidumbre en verdad.',
      whyItMatters: 'La lectura conserva esta incertidumbre para que no se pierda el limite entre propuesta y confirmacion.',
      targetRef: proposal.targetId ? { type: 'work_item', id: proposal.targetId } : { type: 'portfolio', id: proposal.bootstrapSessionId },
      severity: proposal.materiality === 'material' ? 'attention' : 'info',
      sourceRefs: proposal.sourceRefs,
      nextAction: 'Revisar incertidumbre pendiente cuando afecte una decision de portfolio',
    });
  }

  return items.sort(compareAttentionItems).slice(0, 8);
}

function attentionTypeForCondition(type: string): PortfolioAttentionItem['type'] {
  const map: Record<string, PortfolioAttentionItem['type']> = {
    business_signal: 'missing_business_signal',
    decision_path: 'missing_decision_path',
    critical_dependency: 'unresolved_dependency',
    required_context: 'missing_required_context',
    ownership_visibility: 'ownership_gap',
  };
  return map[type] ?? 'missing_required_context';
}

function attentionTitleForCondition(type: string): string {
  const map: Record<string, string> = {
    business_signal: 'Falta senal de negocio',
    decision_path: 'Ruta de decision poco clara',
    critical_dependency: 'Dependencia sin resolver',
    required_context: 'Contexto requerido pendiente',
    ownership_visibility: 'Visibilidad de ownership pendiente',
  };
  return map[type] ?? 'Informacion pendiente';
}

function whyConditionMatters(type: string): string {
  const map: Record<string, string> = {
    business_signal: 'Sin una senal observable, cuesta decidir si este trabajo contribuye al movimiento buscado.',
    decision_path: 'Sin ruta de decision, el portfolio puede acumular trabajo sin un siguiente movimiento claro.',
    critical_dependency: 'Una dependencia material puede impedir que el portfolio avance aunque el trabajo este relacionado.',
    required_context: 'El contexto faltante limita la calidad de la lectura y debe permanecer visible.',
    ownership_visibility: 'La falta de ownership dificulta saber quien puede aportar evidencia o destrabar decisiones.',
  };
  return map[type] ?? 'La informacion pendiente afecta la claridad para decidir que hacer despues.';
}

function nextActionForCondition(type: string, severity: string): string {
  if (type === 'critical_dependency' && severity === 'blocking') return 'Revisar dependencia prioritaria';
  if (type === 'decision_path') return 'Aclarar ruta de decision';
  if (type === 'business_signal') return 'Revisar senal de negocio faltante';
  if (type === 'ownership_visibility') return 'Aclarar ownership organizacional';
  return 'Revisar contexto faltante';
}

function compareAttentionItems(a: PortfolioAttentionItem, b: PortfolioAttentionItem): number {
  return attentionRank(a) - attentionRank(b);
}

function attentionRank(item: PortfolioAttentionItem): number {
  if (item.type === 'information_conflict') return 0;
  if (item.type === 'unresolved_dependency' && item.severity === 'blocking') return 1;
  if (item.type === 'missing_decision_path' && item.severity !== 'info') return 2;
  if (item.type === 'possible_misalignment') return 3;
  if (item.type === 'missing_business_signal') return 4;
  if (item.type === 'missing_required_context') return 5;
  if (item.type === 'ownership_gap') return 6;
  return 7;
}

function countConditions(conditions: any[], type: string): number {
  return conditions.filter((condition) => condition.type === type).length;
}

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
}

function toGovernedStrategicConnectionStatus(status?: string): string {
  const map: Record<string, string> = {
    probable_alignment: 'confirmed_alignment',
    possible_misalignment: 'confirmed_misalignment',
    partial_alignment: 'partial_alignment',
    alignment_unknown: 'alignment_unknown',
    confirmed_alignment: 'confirmed_alignment',
    confirmed_misalignment: 'confirmed_misalignment',
    out_of_current_priority: 'out_of_current_priority',
  };
  return map[status ?? 'alignment_unknown'] ?? 'alignment_unknown';
}

function toAdvancementConditionType(type?: string, targetType?: string): string {
  if (targetType === 'portfolio_anchor') return 'required_context';
  const allowed = new Set(['business_signal', 'decision_path', 'critical_dependency', 'required_context', 'ownership_visibility']);
  return allowed.has(type ?? '') ? type as string : 'required_context';
}

function toAdvancementSeverity(severity?: string, movementAffected?: string): string {
  if (severity === 'blocking') return movementAffected ? 'blocking' : 'attention';
  if (severity === 'info') return 'info';
  return 'attention';
}
