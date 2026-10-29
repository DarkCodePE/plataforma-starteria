/**
 * Regression-test suite for the backend ↔ ai-service ↔ Prisma contract.
 *
 * Goal: catch ANY breakage in the PDF auto-fill cross-cutting contract.
 *  - flattenFieldProposals(...) must emit fieldPaths that match the eval
 *    ground-truth keys (evals/golden/pdf-extraction/test-iniciativa.ground-truth.json).
 *  - PdfService must persist `aiRunId` returned by the ai-service.
 *  - Run polling must sync local state from upstream, write proposals on
 *    completion, be idempotent, tolerate ai-service outages, and propagate
 *    `failed` / `cost_capped` upstream statuses to the right local enum.
 *  - Resolution endpoints (confirm/edit/discard) must transition state
 *    correctly and always write an AuditLog row.
 *  - The US-017 portfolio guard must block `en_step_4 → esperando_revision`
 *    while autofill proposals remain PENDING.
 *
 * Mirrors the mock-Prisma pattern used in pdf.service.test.ts so the suite
 * stays hermetic and fast (no real DB, no real ai-service).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PdfService } from '../pdf.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { flattenFieldProposals } from '../extraction-flatten';
import type { IPdfStorage } from '../storage.service';
import type { AiServiceClient } from '../ai-client';

// ─── Ground truth load ─────────────────────────────────────────────────────

const GROUND_TRUTH_PATH = path.resolve(
  __dirname,
  '../../../../evals/golden/pdf-extraction/test-iniciativa.ground-truth.json',
);
const groundTruth = JSON.parse(readFileSync(GROUND_TRUTH_PATH, 'utf8')) as {
  fields: Record<string, unknown>;
  must_omit: { fields: string[] };
};
const GROUND_TRUTH_KEYS = new Set(Object.keys(groundTruth.fields));

// ─── Mock helpers (mirror pdf.service.test.ts) ─────────────────────────────

type PrismaMock = ReturnType<typeof makePrismaMock>;

function makePrismaMock() {
  return {
    project: { findUnique: vi.fn() },
    initiativePdf: { create: vi.fn(), findFirst: vi.fn() },
    pdfExtractionRun: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    pdfFieldProposal: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    initiativePortfolioMeta: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    challenge: { findUnique: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-row' }) },
    // The service uses prisma.$transaction([promise, promise, ...]) — return the
    // resolved values in order so persistProposals' upsert calls all "succeed".
    $transaction: vi.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      return [];
    }),
  } as const;
}

function makeStorage(bytes = Buffer.from('%PDF-1.4 stub bytes for tests')): IPdfStorage {
  return {
    savePdf: vi.fn().mockResolvedValue({
      fileKey: 'initiative-pdfs/p/abc/original.pdf',
      fileSize: bytes.byteLength,
      mimeType: 'application/pdf',
    }),
    readPdf: vi.fn().mockResolvedValue(bytes),
    deletePdf: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(true),
    getMetadata: vi.fn().mockResolvedValue(null),
  };
}

function makeAiClient(overrides: Partial<AiServiceClient> = {}): AiServiceClient {
  return {
    callPdfExtract: vi.fn().mockResolvedValue({ runId: 'ai-default', status: 'pending' }),
    fetchRunState: vi.fn(),
    ...overrides,
  } as unknown as AiServiceClient;
}

// Reusable "leaf" FieldProposal factory matching the ai-service shape.
function fp(value: unknown, confidence: number, page = 1, quote = 'q'): {
  value: unknown;
  confidence: number;
  provenance: { page: number; quote: string; confidence: number }[];
} {
  return {
    value,
    confidence,
    provenance: [{ page, quote, confidence }],
  };
}

// ─── 1. flattenFieldProposals contract ─────────────────────────────────────

describe('flattenFieldProposals — fieldPath contract', () => {
  it('emits fieldPaths that exist in the ground-truth, skips harness metadata, and assigns bands per 0.80/0.60 thresholds', () => {
    /**
     * Payload uses the path shape implied by the ground-truth keys:
     *   `step3.testCycles[0].queValidamos`
     * i.e. testCycles is treated as a BARE array (spike shape), not wrapped.
     * If TASK-008 ships the production schema unchanged (testCycles wrapped
     * in a FieldProposal), the walker will halt at the wrapper and this test
     * will fail with missing nested paths — which is exactly the contract
     * mismatch we want this regression suite to surface.
     */
    const extraction = {
      step0: {
        origen: fp('problema', 0.92, 3, 'El Reto: Rigidez Operativa'),
      },
      step1: {
        asisData: {
          quiebre: fp('Esperar autorización desde Lima', 0.85, 2, 'esperar'),
        },
      },
      step3: {
        testCycles: [
          {
            queValidamos: fp('autonomía + lead time', 0.65, 5, 'habilitar autonomía'),
          },
        ],
      },
      step4: {
        // implementationPlan: list-wrapped FieldProposal (matches schema).
        implementationPlan: fp(
          [
            { stage: 'Flex', activity: 'Disponibilidad Linea', status: 'Completado' },
          ],
          0.55,
          10,
          'Gantt',
        ),
      },
      // Harness fields — MUST be skipped by the walker.
      must_omit_violations: ['step2.ideas'],
      extraction_metadata: {
        model: 'gpt-5-pro',
        language: 'es',
        pages: 14,
      },
    };

    const flat = flattenFieldProposals(extraction);
    const paths = flat.map((p) => p.fieldPath);

    // Every emitted fieldPath must be a key the ground-truth knows about.
    for (const p of paths) {
      expect(
        GROUND_TRUTH_KEYS.has(p),
        `flattenFieldProposals produced fieldPath "${p}" which is not in the ground-truth keys. ` +
          `This signals a contract divergence between the backend walker and the eval schema.`,
      ).toBe(true);
    }

    // Concrete paths we expect from our payload:
    expect(paths).toContain('step0.origen');
    expect(paths).toContain('step1.asisData.quiebre');
    expect(paths).toContain('step3.testCycles[0].queValidamos');
    expect(paths).toContain('step4.implementationPlan');

    // Band thresholds: HIGH ≥ 0.80, MED ≥ 0.60, LOW otherwise.
    const byPath = Object.fromEntries(flat.map((p) => [p.fieldPath, p]));
    expect(byPath['step0.origen'].confidenceBand).toBe('HIGH'); // 0.92
    expect(byPath['step1.asisData.quiebre'].confidenceBand).toBe('HIGH'); // 0.85
    expect(byPath['step3.testCycles[0].queValidamos'].confidenceBand).toBe('MED'); // 0.65
    expect(byPath['step4.implementationPlan'].confidenceBand).toBe('LOW'); // 0.55

    // Harness keys MUST be skipped — never proposals.
    expect(paths.some((p) => p.includes('must_omit_violations'))).toBe(false);
    expect(paths.some((p) => p.includes('extraction_metadata'))).toBe(false);
  });
});

// ─── 2. startExtraction persists aiRunId ───────────────────────────────────

describe('PdfService.startExtraction — persists aiRunId from ai-service', () => {
  it('writes aiRunId on the run row and an AuditLog row for pdf.extract.requested', async () => {
    const prisma = makePrismaMock();
    const storage = makeStorage();
    const ai = makeAiClient({
      callPdfExtract: vi.fn().mockResolvedValue({ runId: 'ai-xyz-123', status: 'pending' }),
    } as unknown as Partial<AiServiceClient>);
    const service = new PdfService(prisma as any, storage, ai);

    prisma.initiativePdf.findFirst.mockResolvedValue({
      id: 'pdf-1',
      projectId: 'cproject0000000000000000',
      fileKey: 'k',
      fileName: 'plan.pdf',
      status: 'UPLOADED',
      deletedAt: null,
    });

    const created = {
      id: 'local-run-1',
      pdfId: 'pdf-1',
      projectId: 'cproject0000000000000000',
      status: 'PENDING' as const,
      startedAt: new Date(),
      finishedAt: null,
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      model: null,
      language: null,
      errorReason: null,
      aiRunId: null,
    };
    prisma.pdfExtractionRun.create.mockResolvedValue(created);
    prisma.pdfExtractionRun.update.mockResolvedValue({ ...created, aiRunId: 'ai-xyz-123' });

    const dto = await service.startExtraction({
      projectId: 'cproject0000000000000000',
      pdfId: 'pdf-1',
      actorId: 'user-1',
    });

    expect(dto.status).toBe('queued');
    expect(ai.callPdfExtract).toHaveBeenCalledOnce();

    // The update call must persist aiRunId.
    const updateArgs = (prisma.pdfExtractionRun.update as any).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'local-run-1' });
    expect(updateArgs.data.aiRunId).toBe('ai-xyz-123');

    // AuditLog row written with action "pdf.extract.requested".
    const auditCalls = (prisma.auditLog.create as any).mock.calls;
    const requested = auditCalls.find((c: any[]) => c[0].data.action === 'pdf.extract.requested');
    expect(requested).toBeDefined();
    expect(requested[0].data.resource).toBe('PdfExtractionRun');
    expect(requested[0].data.resourceId).toBe('local-run-1');
  });
});

// ─── 3. getRun syncs ai-service → local when PENDING + aiRunId ─────────────

describe('PdfService.getRun — syncs from ai-service and persists proposals', () => {
  it('marks COMPLETED, stores costUsd, upserts proposals, idempotent on re-poll', async () => {
    const prisma = makePrismaMock();
    const storage = makeStorage();
    const ai = makeAiClient();
    const service = new PdfService(prisma as any, storage, ai);

    const pending = {
      id: 'local-run-3',
      projectId: 'cproject0000000000000000',
      pdfId: 'pdf-1',
      status: 'PENDING' as const,
      aiRunId: 'ai-abc',
      startedAt: new Date(),
      finishedAt: null,
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      model: null,
      language: null,
      errorReason: null,
    };
    const completed = {
      ...pending,
      status: 'COMPLETED' as const,
      finishedAt: new Date(),
      costUsd: 0.18 as any,
    };

    // First call returns the PENDING local row. After update it returns COMPLETED.
    prisma.pdfExtractionRun.findFirst.mockResolvedValueOnce(pending).mockResolvedValueOnce(completed);
    prisma.pdfExtractionRun.update.mockResolvedValue(completed);

    const proposalsTree = {
      step0: { origen: fp('problema', 0.91, 3, 'rigidez') },
      step1: { asisData: { quiebre: fp('esperar Lima', 0.83, 2, 'esperar') } },
      extraction_metadata: { model: 'gpt-5', language: 'es', pages: 14 },
    };

    (ai.fetchRunState as any).mockResolvedValue({
      runId: 'ai-abc',
      status: 'completed',
      costUsd: 0.18,
      proposals: proposalsTree,
    });

    // Each upsert resolves to a stub row.
    prisma.pdfFieldProposal.upsert.mockResolvedValue({ id: 'prop-x' });

    const dto = await service.getRun('cproject0000000000000000', 'local-run-3');

    expect(dto.status).toBe('completed');
    expect(dto.costUsd).toBe(0.18);
    expect(dto.finishedAt).toBeTruthy();

    // Two proposals → two upsert calls inside $transaction.
    const upsertCalls = (prisma.pdfFieldProposal.upsert as any).mock.calls;
    expect(upsertCalls.length).toBe(2);
    const upsertedPaths = upsertCalls.map((c: any[]) => c[0].where.runId_fieldPath.fieldPath);
    expect(upsertedPaths).toContain('step0.origen');
    expect(upsertedPaths).toContain('step1.asisData.quiebre');
    // All upserts keyed by composite unique (runId, fieldPath) → idempotent by design.
    for (const c of upsertCalls) {
      expect(c[0].where.runId_fieldPath.runId).toBe('local-run-3');
    }

    // Re-poll: row is already COMPLETED → no upstream call, no new upserts.
    (ai.fetchRunState as any).mockClear();
    (prisma.pdfFieldProposal.upsert as any).mockClear();
    const dto2 = await service.getRun('cproject0000000000000000', 'local-run-3');
    expect(dto2.status).toBe('completed');
    expect((ai.fetchRunState as any).mock.calls.length).toBe(0);
    expect((prisma.pdfFieldProposal.upsert as any).mock.calls.length).toBe(0);
  });
});

// ─── 4. ai-service polling failure is non-fatal ────────────────────────────

describe('PdfService.getRun — polling failure tolerated', () => {
  it('returns the local PENDING row unchanged and writes pdf.extract.poll_failed audit row', async () => {
    const prisma = makePrismaMock();
    const storage = makeStorage();
    const ai = makeAiClient({
      fetchRunState: vi.fn().mockRejectedValue(new Error('network down')),
    } as unknown as Partial<AiServiceClient>);
    const service = new PdfService(prisma as any, storage, ai);

    const pending = {
      id: 'local-run-4',
      projectId: 'cproject0000000000000000',
      pdfId: 'pdf-1',
      status: 'PENDING' as const,
      aiRunId: 'ai-down',
      startedAt: new Date(),
      finishedAt: null,
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      model: null,
      language: null,
      errorReason: null,
    };
    prisma.pdfExtractionRun.findFirst.mockResolvedValue(pending);

    // Must NOT throw to caller.
    const dto = await service.getRun('cproject0000000000000000', 'local-run-4');

    expect(dto.status).toBe('queued');
    expect(dto.finishedAt).toBeNull();
    // No update on the run row.
    expect((prisma.pdfExtractionRun.update as any).mock.calls.length).toBe(0);

    // Audit row written with action pdf.extract.poll_failed.
    const calls = (prisma.auditLog.create as any).mock.calls;
    const polled = calls.find((c: any[]) => c[0].data.action === 'pdf.extract.poll_failed');
    expect(polled).toBeDefined();
    expect(polled[0].data.resourceId).toBe('local-run-4');
  });
});

// ─── 5. ai-service "failed" → local FAILED ─────────────────────────────────

describe('PdfService.getRun — upstream failure propagates to local FAILED', () => {
  it('sets status=FAILED, errorReason, and finishedAt', async () => {
    const prisma = makePrismaMock();
    const ai = makeAiClient({
      fetchRunState: vi.fn().mockResolvedValue({
        runId: 'ai-fail',
        status: 'failed',
        errorReason: 'model timeout',
      }),
    } as unknown as Partial<AiServiceClient>);
    const service = new PdfService(prisma as any, makeStorage(), ai);

    const pending = {
      id: 'local-run-5',
      projectId: 'cproject0000000000000000',
      pdfId: 'pdf-1',
      status: 'PENDING' as const,
      aiRunId: 'ai-fail',
      startedAt: new Date(),
      finishedAt: null,
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      model: null,
      language: null,
      errorReason: null,
    };
    const failed = {
      ...pending,
      status: 'FAILED' as const,
      errorReason: 'model timeout',
      finishedAt: new Date(),
    };
    prisma.pdfExtractionRun.findFirst.mockResolvedValue(pending);
    prisma.pdfExtractionRun.update.mockResolvedValue(failed);

    const dto = await service.getRun('cproject0000000000000000', 'local-run-5');

    expect(dto.status).toBe('failed');
    expect(dto.errorReason).toBe('model timeout');
    expect(dto.finishedAt).toBeTruthy();

    const updateArgs = (prisma.pdfExtractionRun.update as any).mock.calls[0][0];
    expect(updateArgs.data.status).toBe('FAILED');
    expect(updateArgs.data.errorReason).toBe('model timeout');
    expect(updateArgs.data.finishedAt).toBeInstanceOf(Date);
  });
});

// ─── 6. ai-service "cost_capped" → local COST_CAPPED ───────────────────────

describe('PdfService.getRun — upstream cost_capped maps to local COST_CAPPED', () => {
  it('sets status=COST_CAPPED (not FAILED) and persists costUsd + errorReason', async () => {
    const prisma = makePrismaMock();
    const ai = makeAiClient({
      fetchRunState: vi.fn().mockResolvedValue({
        runId: 'ai-cap',
        status: 'cost_capped',
        costUsd: 0.31,
        errorReason: 'cap_exceeded',
      }),
    } as unknown as Partial<AiServiceClient>);
    const service = new PdfService(prisma as any, makeStorage(), ai);

    const pending = {
      id: 'local-run-6',
      projectId: 'cproject0000000000000000',
      pdfId: 'pdf-1',
      status: 'PENDING' as const,
      aiRunId: 'ai-cap',
      startedAt: new Date(),
      finishedAt: null,
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      model: null,
      language: null,
      errorReason: null,
    };
    const capped = {
      ...pending,
      status: 'COST_CAPPED' as const,
      costUsd: 0.31 as any,
      errorReason: 'cap_exceeded',
      finishedAt: new Date(),
    };
    prisma.pdfExtractionRun.findFirst.mockResolvedValue(pending);
    prisma.pdfExtractionRun.update.mockResolvedValue(capped);

    const dto = await service.getRun('cproject0000000000000000', 'local-run-6');

    // Wire status collapses COST_CAPPED → 'failed' (the client has no cost-cap
    // state). The DB row stays COST_CAPPED — asserted on updateArgs.data below.
    expect(dto.status).toBe('failed');
    expect(dto.costUsd).toBe(0.31);
    expect(dto.errorReason).toBe('cap_exceeded');

    const updateArgs = (prisma.pdfExtractionRun.update as any).mock.calls[0][0];
    expect(updateArgs.data.status).toBe('COST_CAPPED');
    expect(updateArgs.data.costUsd).toBe(0.31);
  });
});

// ─── 7. Proposal resolution flow ───────────────────────────────────────────

describe('PdfService resolution — confirm / edit / discard', () => {
  const baseProposal = {
    id: 'prop-7',
    runId: 'run-7',
    projectId: 'cproject0000000000000000',
    fieldPath: 'step1.asisData.quiebre',
    proposedValue: { v: 'esperar Lima' },
    provenance: { pdfId: 'pdf-1', pages: [2], excerpt: '', sources: [] },
    confidence: 0.85,
    confidenceBand: 'HIGH' as const,
    status: 'PENDING' as const,
    finalValue: null,
    confirmedBy: null,
    confirmedAt: null,
  };

  it('confirmProposal → CONFIRMED, finalValue == proposedValue, audit written', async () => {
    const prisma = makePrismaMock();
    const service = new PdfService(prisma as any, makeStorage(), makeAiClient());
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
      runId: 'run-7',
      fieldPath: 'step1.asisData.quiebre',
      actorId: 'user-1',
    });

    expect(dto.status).toBe('CONFIRMED');
    expect(dto.finalValue).toEqual({ v: 'esperar Lima' });
    const audit = (prisma.auditLog.create as any).mock.calls.find(
      (c: any[]) => c[0].data.action === 'pdf.proposal.confirmed',
    );
    expect(audit).toBeDefined();
  });

  it('editProposal → EDITED, finalValue is the supplied override, audit captures before/after', async () => {
    const prisma = makePrismaMock();
    const service = new PdfService(prisma as any, makeStorage(), makeAiClient());
    prisma.pdfFieldProposal.findFirst.mockResolvedValue(baseProposal);
    prisma.pdfFieldProposal.update.mockResolvedValue({
      ...baseProposal,
      status: 'EDITED',
      finalValue: 'edited',
      confirmedBy: 'user-1',
      confirmedAt: new Date(),
    });

    const dto = await service.editProposal({
      projectId: 'cproject0000000000000000',
      runId: 'run-7',
      fieldPath: 'step1.asisData.quiebre',
      actorId: 'user-1',
      finalValue: 'edited',
    });

    expect(dto.status).toBe('EDITED');
    expect(dto.finalValue).toBe('edited');
    const audit = (prisma.auditLog.create as any).mock.calls.find(
      (c: any[]) => c[0].data.action === 'pdf.proposal.edited',
    );
    expect(audit).toBeDefined();
    expect(audit[0].data.details.after.finalValue).toBe('edited');
  });

  it('discardProposal → DISCARDED, finalValue null/undefined, audit written', async () => {
    const prisma = makePrismaMock();
    const service = new PdfService(prisma as any, makeStorage(), makeAiClient());
    prisma.pdfFieldProposal.findFirst.mockResolvedValue(baseProposal);
    prisma.pdfFieldProposal.update.mockResolvedValue({
      ...baseProposal,
      status: 'DISCARDED',
      finalValue: null,
      confirmedBy: 'user-1',
      confirmedAt: new Date(),
    });

    const dto = await service.discardProposal({
      projectId: 'cproject0000000000000000',
      runId: 'run-7',
      fieldPath: 'step1.asisData.quiebre',
      actorId: 'user-1',
    });

    expect(dto.status).toBe('DISCARDED');
    // DTO maps null → undefined (toProposalDTO uses `?? undefined`)
    expect(dto.finalValue).toBeUndefined();
    const audit = (prisma.auditLog.create as any).mock.calls.find(
      (c: any[]) => c[0].data.action === 'pdf.proposal.discarded',
    );
    expect(audit).toBeDefined();
  });
});

// ─── 8. US-017 state guard via PortfolioService.upsertInitiativeMeta ───────

describe('PortfolioService.upsertInitiativeMeta — US-017 autofill guard', () => {
  const projectId = 'cproject0000000000000000';
  const challengeId = 'cchallenge000000000000000';

  function makeFullPrisma() {
    return {
      project: { findUnique: vi.fn() },
      challenge: { findUnique: vi.fn() },
      initiativePortfolioMeta: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      pdfFieldProposal: {
        findMany: vi.fn(),
      },
    } as const;
  }

  it('blocks en_step_4 → esperando_revision when proposals are PENDING; succeeds after they are resolved', async () => {
    const prisma = makeFullPrisma();
    const service = new PortfolioService(prisma as any);

    prisma.project.findUnique.mockResolvedValue({ id: projectId, organizationId: 'org-1' });
    prisma.challenge.findUnique.mockResolvedValue({
      id: challengeId,
      strategicFrontId: 'front-1',
      strategicFront: { id: 'front-1', organizationId: 'org-1', ownerId: null },
    });
    prisma.initiativePortfolioMeta.findUnique.mockResolvedValue({ status: 'en_step_4' });
    prisma.pdfFieldProposal.findMany.mockResolvedValue([
      { fieldPath: 'step1.asisData.quiebre' },
      { fieldPath: 'step3.testCycles[0].queValidamos' },
    ]);

    let thrown: any = null;
    try {
      await service.upsertInitiativeMeta(projectId, {
        challengeId,
        status: 'esperando_revision',
      } as any);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeTruthy();
    expect(thrown.code).toBe('AUTOFILL_UNCONFIRMED');
    expect(thrown.statusCode).toBe(409);
    // CONTRACT NOTE: portfolio.service shapes details as AppErrorDetail[] with
    // `{ field, code, message }` — the original task asked for
    // `details.pendingFieldPaths` (a dictionary key) but the implementation
    // emits an array. We assert the array form so the regression test reflects
    // the actual contract; document the divergence in the return report.
    expect(Array.isArray(thrown.details)).toBe(true);
    const pendingPaths = thrown.details.map((d: any) => d.field);
    expect(pendingPaths).toContain('step1.asisData.quiebre');
    expect(pendingPaths).toContain('step3.testCycles[0].queValidamos');

    // Now mark them as resolved → findMany returns []; transition succeeds.
    prisma.pdfFieldProposal.findMany.mockResolvedValue([]);
    prisma.initiativePortfolioMeta.upsert.mockResolvedValue({
      projectId,
      challengeId,
      status: 'esperando_revision',
      project: { id: projectId, name: 'P', status: 'esperando_revision' },
    });

    const result = await service.upsertInitiativeMeta(projectId, {
      challengeId,
      status: 'esperando_revision',
    } as any);

    expect(result.status).toBe('esperando_revision');
    expect(prisma.initiativePortfolioMeta.upsert).toHaveBeenCalledOnce();
  });
});
