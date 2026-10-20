import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PdfService } from '../pdf.service';
import type { IPdfStorage } from '../storage.service';
import type { AiServiceClient } from '../ai-client';

/**
 * PdfService unit tests — mock Prisma + storage + ai-client. We focus on the
 * state-machine moves the spec calls out: confidence-band derivation, refusal
 * to start an extraction against a missing PDF, refusal to resolve an already
 * resolved proposal.
 */

type PrismaMock = ReturnType<typeof makePrismaMock>;

function makePrismaMock() {
  return {
    project: {
      findUnique: vi.fn(),
    },
    initiativePdf: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    pdfExtractionRun: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    pdfFieldProposal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  } as const;
}

function makeStorage(): IPdfStorage {
  return {
    savePdf: vi.fn().mockResolvedValue({
      fileKey: 'initiative-pdfs/p/abc/original.pdf',
      fileSize: 10,
      mimeType: 'application/pdf',
    }),
    readPdf: vi.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    deletePdf: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    getMetadata: vi.fn().mockResolvedValue(null),
  };
}

function makeAiClient(): AiServiceClient {
  return {
    callPdfExtract: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'pending' }),
    fetchRunState: vi.fn(),
  } as unknown as AiServiceClient;
}

describe('PdfService', () => {
  let prisma: PrismaMock;
  let service: PdfService;
  let storage: ReturnType<typeof makeStorage>;
  let ai: AiServiceClient;

  beforeEach(() => {
    prisma = makePrismaMock();
    storage = makeStorage();
    ai = makeAiClient();
    service = new PdfService(prisma as any, storage, ai);
  });

  describe('confidence bands', () => {
    it('maps confidence to bands per US-008', () => {
      expect(PdfService.confidenceBandFor(0.95)).toBe('HIGH');
      expect(PdfService.confidenceBandFor(0.8)).toBe('HIGH');
      expect(PdfService.confidenceBandFor(0.7)).toBe('MED');
      expect(PdfService.confidenceBandFor(0.59)).toBe('LOW');
    });
  });

  describe('uploadPdf', () => {
    it('happy path persists row + writes audit', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'cproject0000000000000000' });
      prisma.initiativePdf.create.mockResolvedValue({
        id: 'pdf-1',
        projectId: 'cproject0000000000000000',
        fileKey: 'initiative-pdfs/p/abc/original.pdf',
        fileName: 'plan.pdf',
        mimeType: 'application/pdf',
        fileSize: 10,
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        status: 'UPLOADED',
        languageDetected: null,
        retentionUntil: null,
      });

      const dto = await service.uploadPdf({
        projectId: 'cproject0000000000000000',
        uploadedBy: 'user-1',
        fileName: 'plan.pdf',
        mimeType: 'application/pdf',
        bytes: Buffer.from('hello world'),
      });

      expect(dto.pdfId).toBe('pdf-1');
      expect(dto.status).toBe('UPLOADED');
      expect(storage.savePdf).toHaveBeenCalledOnce();
      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    });

    it('rejects non-PDF mime types', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'cproject0000000000000000' });
      await expect(
        service.uploadPdf({
          projectId: 'cproject0000000000000000',
          uploadedBy: 'user-1',
          fileName: 'evil.exe',
          mimeType: 'application/octet-stream',
          bytes: Buffer.from('x'),
        }),
      ).rejects.toMatchObject({ statusCode: 400, code: 'PDF_MIME_INVALID' });
    });

    it('rolls back disk on DB failure', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'cproject0000000000000000' });
      prisma.initiativePdf.create.mockRejectedValue(new Error('db boom'));

      await expect(
        service.uploadPdf({
          projectId: 'cproject0000000000000000',
          uploadedBy: 'user-1',
          fileName: 'plan.pdf',
          mimeType: 'application/pdf',
          bytes: Buffer.from('hello'),
        }),
      ).rejects.toThrow('db boom');

      expect(storage.deletePdf).toHaveBeenCalledWith('initiative-pdfs/p/abc/original.pdf');
    });

    it('returns the original upload for an identical idempotent retry', async () => {
      const existing = {
        id: 'pdf-replay', projectId: 'cproject0000000000000000', fileKey: 'initiative-pdfs/p/replay/original.pdf',
        fileName: 'plan.pdf', mimeType: 'application/pdf', fileSize: 5, uploadedBy: 'user-1', uploadedAt: new Date(),
        status: 'UPLOADED', languageDetected: null, retentionUntil: null,
        idempotencyKey: 'upload-key', requestFingerprint: createHash('sha256').update('application/pdf').update('\0').update('plan.pdf').update('\0').update(Buffer.from('hello')).digest('hex'),
      };
      prisma.project.findUnique.mockResolvedValue({ id: 'cproject0000000000000000' });
      prisma.initiativePdf.findFirst.mockResolvedValue(existing);
      const dto = await service.uploadPdf({ projectId: existing.projectId, uploadedBy: 'user-1', fileName: 'plan.pdf', mimeType: 'application/pdf', bytes: Buffer.from('hello'), idempotencyKey: 'upload-key' });
      expect(dto.pdfId).toBe('pdf-replay');
      expect(storage.savePdf).not.toHaveBeenCalled();
    });

    it('rejects a reused upload key whose file fingerprint differs', async () => {
      prisma.project.findUnique.mockResolvedValue({ id: 'cproject0000000000000000' });
      prisma.initiativePdf.findFirst.mockResolvedValue({ id: 'pdf-replay', requestFingerprint: 'different' });
      await expect(service.uploadPdf({ projectId: 'cproject0000000000000000', uploadedBy: 'user-1', fileName: 'other.pdf', mimeType: 'application/pdf', bytes: Buffer.from('other'), idempotencyKey: 'upload-key' }))
        .rejects.toMatchObject({ code: 'PDF_IDEMPOTENCY_CONFLICT' });
      expect(storage.savePdf).not.toHaveBeenCalled();
    });
  });

  describe('startExtraction', () => {
    it('refuses unknown PDFs', async () => {
      prisma.initiativePdf.findFirst.mockResolvedValue(null);
      await expect(
        service.startExtraction({
          projectId: 'cproject0000000000000000',
          pdfId: 'no-such-pdf',
          actorId: 'user-1',
        }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PDF_NOT_FOUND' });
    });

    it('persists run + propagates pending status from ai-service', async () => {
      prisma.initiativePdf.findFirst.mockResolvedValue({
        id: 'pdf-1',
        projectId: 'cproject0000000000000000',
        fileKey: 'k',
        fileName: 'x.pdf',
        status: 'UPLOADED',
        deletedAt: null,
      });
      prisma.pdfExtractionRun.create.mockResolvedValue({
        id: 'run-1',
        pdfId: 'pdf-1',
        projectId: 'cproject0000000000000000',
        status: 'PENDING',
        startedAt: new Date(),
        finishedAt: null,
        costUsd: null,
        tokensIn: null,
        tokensOut: null,
        model: null,
        language: null,
        errorReason: null,
      });
      prisma.pdfExtractionRun.update.mockResolvedValue({
        id: 'run-1',
        pdfId: 'pdf-1',
        projectId: 'cproject0000000000000000',
        status: 'PENDING',
        startedAt: new Date(),
        finishedAt: null,
        costUsd: null,
        tokensIn: null,
        tokensOut: null,
        model: null,
        language: null,
        errorReason: null,
      });

      const dto = await service.startExtraction({
        projectId: 'cproject0000000000000000',
        pdfId: 'pdf-1',
        actorId: 'user-1',
      });
      expect(dto.runId).toBe('run-1');
      // Wire status is lowercase (BUG-001): DB 'PENDING' → wire 'queued'.
      expect(dto.status).toBe('queued');
      expect(ai.callPdfExtract).toHaveBeenCalledOnce();
    });
  });

  describe('proposal resolution', () => {
    const baseProposal = {
      id: 'prop-1',
      runId: 'run-1',
      projectId: 'cproject0000000000000000',
      fieldPath: 'step1.moduleB.segment',
      proposedValue: { v: 1 },
      provenance: { pdfId: 'pdf-1', pages: [1], excerpt: '', sources: [] },
      confidence: 0.9,
      confidenceBand: 'HIGH',
      status: 'PENDING',
      finalValue: null,
      confirmedBy: null,
      confirmedAt: null,
    };

    it('confirms a pending proposal and writes audit', async () => {
      prisma.pdfFieldProposal.findFirst.mockResolvedValue(baseProposal);
      prisma.pdfFieldProposal.update.mockResolvedValue({
        ...baseProposal,
        status: 'CONFIRMED',
        finalValue: baseProposal.proposedValue,
        confirmedBy: 'user-1',
        confirmedAt: new Date(),
      });

      const dto = await service.confirmProposal({
        projectId: 'cproject0000000000000000',
        runId: 'run-1',
        fieldPath: 'step1.moduleB.segment',
        actorId: 'user-1',
      });
      expect(dto.status).toBe('CONFIRMED');
      expect(dto.finalValue).toEqual({ v: 1 });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('refuses to confirm an already-resolved proposal', async () => {
      prisma.pdfFieldProposal.findFirst.mockResolvedValue({ ...baseProposal, status: 'CONFIRMED' });

      await expect(
        service.confirmProposal({
          projectId: 'cproject0000000000000000',
          runId: 'run-1',
          fieldPath: 'step1.moduleB.segment',
          actorId: 'user-1',
        }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'PDF_PROPOSAL_ALREADY_RESOLVED' });
    });
  });

  describe('listProposals', () => {
    it('refuses to list when run is not completed', async () => {
      prisma.pdfExtractionRun.findFirst.mockResolvedValue({
        id: 'run-1',
        projectId: 'cproject0000000000000000',
        status: 'PENDING',
      });
      await expect(
        service.listProposals('cproject0000000000000000', 'run-1'),
      ).rejects.toMatchObject({ statusCode: 409, code: 'PDF_RUN_NOT_READY' });
    });
  });

  describe('pendingProposalsForProject', () => {
    it('returns 0 when nothing is pending', async () => {
      prisma.pdfFieldProposal.findMany.mockResolvedValue([]);
      const res = await service.pendingProposalsForProject('cproject0000000000000000');
      expect(res.pendingCount).toBe(0);
      expect(res.pendingFieldPaths).toEqual([]);
    });

    it('returns the list of pending field paths', async () => {
      prisma.pdfFieldProposal.findMany.mockResolvedValue([
        { fieldPath: 'step1.a' },
        { fieldPath: 'step1.b' },
      ]);
      const res = await service.pendingProposalsForProject('cproject0000000000000000');
      expect(res.pendingCount).toBe(2);
      expect(res.pendingFieldPaths).toEqual(['step1.a', 'step1.b']);
    });
  });
});
