import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ApiResponse } from '../../shared/types/api.types';
import { AuthenticatedRequest } from '../../shared/types/auth.types';
import { PdfService } from './pdf.service';
import { ALLOWED_PDF_MIME, MAX_PDF_BYTES } from './pdf.schemas';
import { toWireProposal } from './wire-proposal';

type PdfUploadRequest = Request<Record<string, string>, ApiResponse, Buffer> & Pick<AuthenticatedRequest, 'user'>;

/**
 * Controllers stay thin: shape request -> service call -> envelope.
 * All validation is delegated to `validate(schema)` middleware or to the
 * service layer; controllers never throw raw Errors.
 */
export class PdfController {
  constructor(private readonly service: PdfService) {}

  upload = async (req: PdfUploadRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();

      // The router mounts `express.raw({ type: 'application/pdf' })` for this
      // route so the entire body is delivered as a Buffer. The original filename
      // travels via the `X-File-Name` header (set by the frontend); fall back
      // to a synthesised name if absent so the upload still succeeds.
      const bytes = req.body as unknown;
      if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0) {
        throw AppError.badRequest(
          'Cuerpo vacio. Envia el PDF como application/pdf.',
          'PDF_BODY_MISSING',
          { hint: 'Content-Type debe ser application/pdf.' },
        );
      }
      if (bytes.byteLength > MAX_PDF_BYTES) {
        throw AppError.badRequest(
          `El PDF excede ${MAX_PDF_BYTES} bytes.`,
          'PDF_TOO_LARGE',
        );
      }
      const contentType = (req.headers['content-type'] || '').toString().split(';')[0].trim();
      if (contentType !== ALLOWED_PDF_MIME) {
        throw AppError.badRequest(
          'Content-Type debe ser application/pdf.',
          'PDF_MIME_INVALID',
          { field: 'mimeType' },
        );
      }
      const rawName = (req.headers['x-file-name'] || '').toString();
      // Frontend URL-encodes the filename so non-ASCII chars survive the header transport.
      let decodedName = rawName;
      try {
        decodedName = rawName ? decodeURIComponent(rawName) : '';
      } catch {
        // Malformed encoding — fall through to the synthetic name below.
      }
      const fileName = (decodedName && decodedName.slice(0, 255)) || `initiative-${Date.now()}.pdf`;

      const dto = await this.service.uploadPdf({
        projectId: req.params.id,
        uploadedBy: req.user.id,
        fileName,
        mimeType: ALLOWED_PDF_MIME,
        bytes,
        idempotencyKey: typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined,
      });

      res.status(201).json({ success: true, data: dto });
    } catch (err) {
      next(err);
    }
  };

  startExtraction = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const dto = await this.service.startExtraction({
        projectId: req.params.id,
        pdfId: req.params.pdfId,
        actorId: req.user.id,
        targetStep: req.body?.targetStep,
        language: req.body?.language,
        requestId: (req as Request & { requestId?: string }).requestId,
      });
      res.status(202).json({ success: true, data: dto });
    } catch (err) {
      next(err);
    }
  };

  getRun = async (req: AuthenticatedRequest, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const dto = await this.service.getRun(req.params.id, req.params.runId);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, data: dto });
    } catch (err) {
      next(err);
    }
  };

  listProposals = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      // Use wire-format DTOs (lowercase enums, frontend-shaped provenance).
      const proposals = await this.service.listWireProposals(req.params.id, req.params.runId);
      const pendingCount = proposals.filter((p) => p.status === 'unconfirmed').length;
      res.json({ success: true, data: { proposals, meta: { total: proposals.length, pendingCount } } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * `GET /initiatives/:id/autofill-proposals[?runId=...]`
   *
   * Project-scoped listing used by the frontend hydration path so a page mount
   * can re-render proposals from previously-completed runs after a hard refresh
   * or direct navigation. When `?runId=` is supplied the result is equivalent
   * to `GET /initiatives/:id/pdfs/runs/:runId/proposals` (single-run scope);
   * otherwise it spans every COMPLETED run for that project, sorted by
   * `fieldPath`.
   *
   * Response envelope: `{ success: true, data: WireAutofillProposal[] }`
   * — chosen to match what the frontend's `listProposals(...)` service expects
   * (it parses `data.data` as the array directly). This intentionally diverges
   * from the existing list-by-run envelope (`{ proposals, meta }`) which has
   * an internal-only consumer; aligning here was the smaller change because
   * touching the frontend wire shape would have rippled into the hook,
   * contract tests, and the integration tests.
   */
  listProposalsByProject = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const runIdFilter =
        typeof req.query.runId === 'string' && req.query.runId.length > 0
          ? (req.query.runId as string)
          : undefined;
      const proposals = await this.service.listWireProposalsForProject(req.params.id, runIdFilter);
      res.json({ success: true, data: proposals });
    } catch (err) {
      next(err);
    }
  };

  confirmProposal = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const dto = await this.service.confirmProposal({
        projectId: req.params.id,
        runId: req.params.runId,
        fieldPath: decodeURIComponent(req.params.fieldPath),
        actorId: req.user.id,
      });
      const meta = (await this.service.getPdfMetaForRun(req.params.id, req.params.runId)) ?? { pdfId: 'unknown', fileName: 'unknown.pdf' };
      res.json({ success: true, data: toWireProposal(dto, meta) });
    } catch (err) {
      next(err);
    }
  };

  editProposal = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const dto = await this.service.editProposal({
        projectId: req.params.id,
        runId: req.params.runId,
        fieldPath: decodeURIComponent(req.params.fieldPath),
        actorId: req.user.id,
        finalValue: req.body?.finalValue,
      });
      const meta = (await this.service.getPdfMetaForRun(req.params.id, req.params.runId)) ?? { pdfId: 'unknown', fileName: 'unknown.pdf' };
      res.json({ success: true, data: toWireProposal(dto, meta) });
    } catch (err) {
      next(err);
    }
  };

  discardProposal = async (
    req: AuthenticatedRequest,
    res: Response<ApiResponse>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const dto = await this.service.discardProposal({
        projectId: req.params.id,
        runId: req.params.runId,
        fieldPath: decodeURIComponent(req.params.fieldPath),
        actorId: req.user.id,
      });
      const meta = (await this.service.getPdfMetaForRun(req.params.id, req.params.runId)) ?? { pdfId: 'unknown', fileName: 'unknown.pdf' };
      res.json({ success: true, data: toWireProposal(dto, meta) });
    } catch (err) {
      next(err);
    }
  };
}
