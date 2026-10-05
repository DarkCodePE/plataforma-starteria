import express, { type RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { errorHandler } from '../../../shared/errors/error-handler';
import { PortfolioBootstrapService } from '../portfolio-bootstrap.service';
import { buildPortfolioBootstrapRouter } from '../portfolio-bootstrap.router';

const describeIntegration = process.env.PORTFOLIO_BOOTSTRAP_DB_INTEGRATION === '1' ? describe : describe.skip;
const prisma = new PrismaClient();
const base = '/api/v1/portfolio-bootstrap';
const userId = 'user-portfolio-bootstrap-pr2';
const otherUserId = 'user-portfolio-bootstrap-other';
const organizationId = 'org-portfolio-bootstrap-integration';
const touchedEntrySessionIds = new Set<string>();

describeIntegration('Portfolio Bootstrap persistence', () => {
  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('persists session and anchor from continuation idempotently without canonical writes', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const before = await canonicalCounts();

    const first = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const second = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);

    expect(second.body.data.bootstrapSession.id).toBe(first.body.data.bootstrapSession.id);
    expect(await (prisma as any).portfolioBootstrapSession.count({ where: { sourceContinuationId: continuation.id } })).toBe(1);
    expect(await (prisma as any).portfolioAnchor.count({ where: { bootstrapSessionId: first.body.data.bootstrapSession.id } })).toBe(1);
    expect(await canonicalCounts()).toEqual(before);
  });

  it('denies a continuation owned by another Portfolio Lead and writes nothing', async () => {
    const app = makeApp(otherUserId);
    const continuation = await seedContinuation(userId);
    const before = await (prisma as any).portfolioBootstrapSession.count();

    await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(403);

    expect(await (prisma as any).portfolioBootstrapSession.count()).toBe(before);
  });

  it('updates and confirms anchor with version history and idempotent double confirm', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;

    const updated = await request(app)
      .patch(`${base}/sessions/${sessionId}/anchor`)
      .send({
        outcomeStatement: 'Reducir abandono en onboarding B2B',
        contextSummary: 'Customer success y producto reportan retrasos en activacion.',
        decisionToEnable: 'Decidir foco del trimestre',
      })
      .expect(200);

    expect(updated.body.data.anchor.status).toBe('anchor_sufficient');
    expect(updated.body.data.anchor.confirmedBy).toBeNull();

    const confirmed = await request(app)
      .post(`${base}/sessions/${sessionId}/anchor/confirm`)
      .send({})
      .expect(200);
    const confirmedAgain = await request(app)
      .post(`${base}/sessions/${sessionId}/anchor/confirm`)
      .send({})
      .expect(200);

    expect(confirmed.body.data.anchor.status).toBe('anchor_confirmed');
    expect(confirmed.body.data.anchor.provenanceStatus).toBe('user_confirmed');
    expect(confirmedAgain.body.data.anchor.version).toBe(confirmed.body.data.anchor.version);
    expect(await (prisma as any).portfolioAnchorHistory.count({ where: { anchorId: confirmed.body.data.anchor.id } })).toBe(2);
  });

  it('confirms once and reads back a sequential repeat without adding another history row', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const before = await (prisma as any).portfolioAnchor.findUnique({
      where: { bootstrapSessionId: sessionId },
      select: { id: true, status: true, version: true },
    });

    expect(before).toMatchObject({ status: 'anchor_sufficient', version: 1 });

    const first = await request(app)
      .post(`${base}/sessions/${sessionId}/anchor/confirm`)
      .send({})
      .expect(200);
    const repeated = await request(app)
      .post(`${base}/sessions/${sessionId}/anchor/confirm`)
      .send({})
      .expect(200);
    const anchor = await (prisma as any).portfolioAnchor.findUnique({ where: { id: before.id } });
    const histories = await (prisma as any).portfolioAnchorHistory.findMany({
      where: { anchorId: before.id },
      orderBy: { version: 'asc' },
      select: { version: true },
    });
    const confirmations = await prisma.auditLog.count({
      where: { resource: 'PortfolioBootstrap', resourceId: before.id, action: 'portfolio_anchor_confirmed' },
    });

    expect(first.body.data.anchor).toMatchObject({ status: 'anchor_confirmed', version: 2 });
    expect(repeated.body.data.anchor).toMatchObject({ status: 'anchor_confirmed', version: 2 });
    expect(anchor).toMatchObject({ status: 'anchor_confirmed', version: before.version + 1 });
    expect(histories.map((history: { version: number }) => history.version)).toEqual([1]);
    expect(confirmations).toBe(1);
  });

  it('returns authorized success for both callers confirming the same anchor concurrently', async () => {
    const setupApp = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(setupApp)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const before = await (prisma as any).portfolioAnchor.findUnique({
      where: { bootstrapSessionId: sessionId },
      select: { id: true, status: true, version: true },
    });
    expect(before).toMatchObject({ status: 'anchor_sufficient', version: 1 });

    const capturedErrors: Error[] = [];
    const app = makeApp(userId, ['portfolio_lead'], {
      service: makeSessionReadBarrierService(2),
      capturedErrors,
    });
    const responses = await Promise.all([
      request(app).post(`${base}/sessions/${sessionId}/anchor/confirm`).send({}),
      request(app).post(`${base}/sessions/${sessionId}/anchor/confirm`).send({}),
    ]);
    const anchor = await (prisma as any).portfolioAnchor.findUnique({ where: { id: before.id } });
    const histories = await (prisma as any).portfolioAnchorHistory.findMany({
      where: { anchorId: before.id },
      orderBy: { version: 'asc' },
      select: { version: true },
    });
    const confirmations = await prisma.auditLog.count({
      where: { resource: 'PortfolioBootstrap', resourceId: before.id, action: 'portfolio_anchor_confirmed' },
    });
    const observation = {
      statuses: responses.map((response) => response.status),
      returnedAnchors: responses.map((response) => response.body.data?.anchor && ({
        status: response.body.data.anchor.status,
        version: response.body.data.anchor.version,
      })),
      anchorVersionBefore: before.version,
      anchorStatusAfter: anchor.status,
      anchorVersionAfter: anchor.version,
      historyVersions: histories.map((history: { version: number }) => history.version),
      semanticConfirmations: confirmations,
      prismaErrors: capturedErrors.map((error) => ({
        name: error.name,
        code: (error as Error & { code?: string }).code,
        message: error.message,
      })),
    };

    expect(observation).toEqual({
      statuses: [200, 200],
      returnedAnchors: [
        { status: 'anchor_confirmed', version: 2 },
        { status: 'anchor_confirmed', version: 2 },
      ],
      anchorVersionBefore: 1,
      anchorStatusAfter: 'anchor_confirmed',
      anchorVersionAfter: 2,
      historyVersions: [1],
      semanticConfirmations: 1,
      prismaErrors: [],
    });
  });

  it('rejects a concurrent caller who does not own the session without affecting the owner confirmation', async () => {
    const ownerApp = makeApp(userId);
    const unauthorizedApp = makeApp(otherUserId);
    const continuation = await seedContinuation(userId);
    const created = await request(ownerApp)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const anchorId = created.body.data.anchor.id;

    const [ownerResponse, unauthorizedResponse] = await Promise.all([
      request(ownerApp).post(`${base}/sessions/${sessionId}/anchor/confirm`).send({}),
      request(unauthorizedApp).post(`${base}/sessions/${sessionId}/anchor/confirm`).send({}),
    ]);
    const anchor = await (prisma as any).portfolioAnchor.findUnique({ where: { id: anchorId } });
    const histories = await (prisma as any).portfolioAnchorHistory.findMany({
      where: { anchorId },
      orderBy: { version: 'asc' },
      select: { version: true },
    });
    const confirmations = await prisma.auditLog.count({
      where: { resource: 'PortfolioBootstrap', resourceId: anchorId, action: 'portfolio_anchor_confirmed' },
    });

    expect(ownerResponse.status).toBe(200);
    expect(unauthorizedResponse.status).toBe(403);
    expect(unauthorizedResponse.body.error.code).toBe('PORTFOLIO_BOOTSTRAP_FORBIDDEN');
    expect(anchor).toMatchObject({ status: 'anchor_confirmed', version: 2 });
    expect(histories.map((history: { version: number }) => history.version)).toEqual([1]);
    expect(confirmations).toBe(1);
  });

  it('pastes deterministic provisional work items idempotently and preserves raw source', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const before = await canonicalCounts();

    const first = await request(app)
      .post(`${base}/sessions/${sessionId}/work-items/paste`)
      .set('Idempotency-Key', 'paste-key')
      .send({ text: 'Nuevo onboarding digital\n\nChatbot de soporte\nPrograma loyalty\nMigracion CRM' })
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${sessionId}/work-items/paste`)
      .set('Idempotency-Key', 'paste-key')
      .send({ text: 'Nuevo onboarding digital\n\nChatbot de soporte\nPrograma loyalty\nMigracion CRM' })
      .expect(200);

    expect(first.body.data.items).toHaveLength(4);
    expect(replay.body.data.items).toHaveLength(4);
    expect(await (prisma as any).portfolioBootstrapWorkItem.count({ where: { bootstrapSessionId: sessionId } })).toBe(4);
    expect(first.body.data.existingWorkStatus).toBe('has_work');
    expect(first.body.data.items[0]).toMatchObject({
      rawLabel: 'Nuevo onboarding digital',
      proposedName: 'Nuevo onboarding digital',
      sourceType: 'pasted_text',
      status: 'detected',
      createdBy: userId,
    });
    expect(first.body.data.items[0].sourceRefs.rawInput).toContain('Chatbot de soporte');

    const reloaded = await request(app)
      .get(`${base}/sessions/${sessionId}/work-items`)
      .expect(200);
    expect(reloaded.body.data.items.map((item: any) => item.rawLabel)).toEqual([
      'Nuevo onboarding digital',
      'Chatbot de soporte',
      'Programa loyalty',
      'Migracion CRM',
    ]);
    expect(await canonicalCounts()).toEqual(before);
  });

  it('imports CSV/XLSX rows as provisional work items with mapping, provenance, and idempotency only', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const before = await canonicalCounts();

    const csv = [
      'Initiative,Owner,Status,Objective,KPI,Notes',
      'Nuevo onboarding digital,Ana,Active,Reducir abandono,Activation rate,solution-first',
      'Chatbot de soporte,,Paused,Reducir tickets,,owner missing',
      'Nuevo onboarding digital,Ana,Active,Reducir abandono,Activation rate,solution-first',
    ].join('\n');
    const uploadedCsv = await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'portfolio.csv',
        fileType: 'text/csv',
        fileSize: Buffer.byteLength(csv),
        contentBase64: Buffer.from(csv).toString('base64'),
      })
      .expect(200);

    expect(uploadedCsv.body.data.rawHeaders).toEqual(['Initiative', 'Owner', 'Status', 'Objective', 'KPI', 'Notes']);
    expect(uploadedCsv.body.data.suggestedMapping).toMatchObject({
      label: 'Initiative',
      owner: 'Owner',
      state: 'Status',
      purpose: 'Objective',
      signal: 'KPI',
    });

    const mapping = { label: 'Initiative', owner: 'Owner', state: 'Status', purpose: 'Objective', signal: 'KPI', notes: 'Notes' };
    const readyCsv = await request(app)
      .patch(`${base}/sessions/${sessionId}/imports/${uploadedCsv.body.data.id}/mapping`)
      .send({ confirmedMapping: mapping })
      .expect(200);
    expect(readyCsv.body.data.status).toBe('ready_to_import');

    const committedCsv = await request(app)
      .post(`${base}/sessions/${sessionId}/imports/${uploadedCsv.body.data.id}/commit`)
      .set('Idempotency-Key', 'csv-import-key')
      .send({})
      .expect(200);
    const replayCsv = await request(app)
      .post(`${base}/sessions/${sessionId}/imports/${uploadedCsv.body.data.id}/commit`)
      .set('Idempotency-Key', 'csv-import-key')
      .send({})
      .expect(200);

    expect(committedCsv.body.data.workItems).toHaveLength(2);
    expect(replayCsv.body.data.workItems).toHaveLength(2);
    expect(committedCsv.body.data.duplicateRows).toBe(1);
    expect(committedCsv.body.data.workItems[0]).toMatchObject({
      rawLabel: 'Nuevo onboarding digital',
      proposedPurpose: 'Reducir abandono',
      sourceType: 'imported_file',
      currentStateHint: 'active',
      ownerCandidate: 'Ana',
      status: 'detected',
    });
    expect(committedCsv.body.data.workItems[0].sourceRefs).toMatchObject({
      importBatchId: uploadedCsv.body.data.id,
      fileName: 'portfolio.csv',
      rowNumber: 2,
      rawRow: { Initiative: 'Nuevo onboarding digital' },
    });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Project', 'Owner', 'Status', 'Purpose', 'Signal', 'Notes'],
      ['Migracion CRM', 'Bruno', 'Candidate', 'Unificar datos comerciales', 'Data quality', 'ambiguous KPI'],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Portfolio');
    const xlsx = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
    const uploadedXlsx = await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'portfolio.xlsx',
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: xlsx.length,
        contentBase64: xlsx.toString('base64'),
      })
      .expect(200);
    expect(uploadedXlsx.body.data.sheetName).toBe('Portfolio');
    expect(uploadedXlsx.body.data.suggestedMapping.label).toBe('Project');

    await request(app)
      .patch(`${base}/sessions/${sessionId}/imports/${uploadedXlsx.body.data.id}/mapping`)
      .send({ confirmedMapping: { label: 'Project', owner: 'Owner', state: 'Status', purpose: 'Purpose', signal: 'Signal', notes: 'Notes' } })
      .expect(200);
    await request(app)
      .post(`${base}/sessions/${sessionId}/imports/${uploadedXlsx.body.data.id}/commit`)
      .set('Idempotency-Key', 'xlsx-import-key')
      .send({})
      .expect(200);
    const replayXlsx = await request(app)
      .post(`${base}/sessions/${sessionId}/imports/${uploadedXlsx.body.data.id}/commit`)
      .set('Idempotency-Key', 'xlsx-import-key')
      .send({})
      .expect(200);
    expect(replayXlsx.body.data.workItems).toHaveLength(1);

    const session = await (prisma as any).portfolioBootstrapSession.findUnique({
      where: { id: sessionId },
      include: { importBatches: true, workItems: true },
    });
    expect(session.existingWorkStatus).toBe('has_work');
    expect(session.bootstrapPhase).toBe('B3_PROVISIONAL_STRUCTURING');
    expect(session.importBatches).toHaveLength(2);
    expect(session.workItems).toHaveLength(3);
    expect(await canonicalCounts()).toEqual(before);
  });

  it('rejects unsafe import files and enforces portfolio write permission', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;

    const invalid = Buffer.from('Initiative\nNuevo onboarding digital');
    await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'portfolio.exe',
        fileType: 'application/octet-stream',
        fileSize: invalid.length,
        contentBase64: invalid.toString('base64'),
      })
      .expect(400);

    const corrupt = Buffer.from('not an xlsx');
    await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'portfolio.xlsx',
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileSize: corrupt.length,
        contentBase64: corrupt.toString('base64'),
      })
      .expect(400);

    await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'empty.csv',
        fileType: 'text/csv',
        fileSize: 0,
        contentBase64: '',
      })
      .expect(400);

    await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'too-large.csv',
        fileType: 'text/csv',
        fileSize: 10 * 1024 * 1024 + 1,
        contentBase64: Buffer.from('Initiative\nX').toString('base64'),
      })
      .expect(400);

    const formulaCsv = 'Initiative,Owner,Status,Objective,KPI\n=cmd,Ana,Active,Reducir abandono,+activation';
    const uploaded = await request(app)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'formula.csv',
        fileType: 'text/csv',
        fileSize: Buffer.byteLength(formulaCsv),
        contentBase64: Buffer.from(formulaCsv).toString('base64'),
      })
      .expect(200);
    expect(uploaded.body.data.previewRows[0].rawRow.Initiative).toBe("'=cmd");
    expect(uploaded.body.data.previewRows[0].rawRow.KPI).toBe("'+activation");

    const readOnlyApp = makeApp(userId, ['portfolio:read']);
    await request(readOnlyApp)
      .post(`${base}/sessions/${sessionId}/imports`)
      .send({
        fileName: 'portfolio.csv',
        fileType: 'text/csv',
        fileSize: invalid.length,
        contentBase64: invalid.toString('base64'),
      })
      .expect(403);
  });

  it('keeps CSV import performance bounded for 10, 100, and 500 rows', async () => {
    const app = makeApp(userId);
    const results: Array<{ rows: number; uploadPreviewMs: number; commitMs: number; workItems: number }> = [];

    for (const rows of [10, 100, 500]) {
      const continuation = await seedContinuation(userId);
      const created = await request(app)
        .post(`${base}/sessions/from-continuation`)
        .send({ portfolioEntryContinuationId: continuation.id })
        .expect(200);
      const sessionId = created.body.data.bootstrapSession.id;
      const csv = buildImportCsv(rows);

      const uploadStartedAt = Date.now();
      const uploaded = await request(app)
        .post(`${base}/sessions/${sessionId}/imports`)
        .send({
          fileName: `portfolio-${rows}.csv`,
          fileType: 'text/csv',
          fileSize: Buffer.byteLength(csv),
          contentBase64: Buffer.from(csv).toString('base64'),
        })
        .expect(200);
      const uploadPreviewMs = Date.now() - uploadStartedAt;

      await request(app)
        .patch(`${base}/sessions/${sessionId}/imports/${uploaded.body.data.id}/mapping`)
        .send({ confirmedMapping: { label: 'Initiative', owner: 'Owner', state: 'Status', purpose: 'Objective', signal: 'KPI', notes: 'Notes' } })
        .expect(200);

      const commitStartedAt = Date.now();
      const committed = await request(app)
        .post(`${base}/sessions/${sessionId}/imports/${uploaded.body.data.id}/commit`)
        .set('Idempotency-Key', `csv-performance-${rows}`)
        .send({})
        .expect(200);
      const commitMs = Date.now() - commitStartedAt;

      results.push({ rows, uploadPreviewMs, commitMs, workItems: committed.body.data.workItems.length });
      expect(committed.body.data.workItems).toHaveLength(rows);
      expect(uploadPreviewMs).toBeLessThan(10_000);
      expect(commitMs).toBeLessThan(10_000);
    }

    console.info('[portfolio-bootstrap-import-performance]', JSON.stringify(results));
  });

  it('adds, edits, and removes manual provisional work items without canonical writes', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const before = await canonicalCounts();

    const added = await request(app)
      .post(`${base}/sessions/${sessionId}/work-items/manual`)
      .set('Idempotency-Key', 'manual-key')
      .send({ label: 'Programa loyalty', purpose: 'Aumentar recurrencia', currentStateHint: 'active' })
      .expect(200);

    expect(added.body.data.items).toHaveLength(1);
    expect(added.body.data.items[0]).toMatchObject({
      rawLabel: 'Programa loyalty',
      proposedPurpose: 'Aumentar recurrencia',
      sourceType: 'manual_entry',
      status: 'pending',
      currentStateHint: 'active',
    });

    const itemId = added.body.data.items[0].id;
    const edited = await request(app)
      .patch(`${base}/sessions/${sessionId}/work-items/${itemId}`)
      .send({ label: 'Programa loyalty empresas' })
      .expect(200);
    expect(edited.body.data.items[0].rawLabel).toBe('Programa loyalty empresas');

    const removed = await request(app)
      .delete(`${base}/sessions/${sessionId}/work-items/${itemId}`)
      .expect(200);
    expect(removed.body.data.items).toHaveLength(0);
    expect(await (prisma as any).portfolioBootstrapWorkItem.count({ where: { id: itemId, status: 'rejected' } })).toBe(1);
    expect(await canonicalCounts()).toEqual(before);
  });

  it('stores explicit no-existing-work state and creates zero fake work items', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    const before = await canonicalCounts();

    const none = await request(app)
      .post(`${base}/sessions/${sessionId}/work-items/none`)
      .send({})
      .expect(200);

    expect(none.body.data.existingWorkStatus).toBe('no_existing_work');
    expect(none.body.data.items).toEqual([]);
    expect(await (prisma as any).portfolioBootstrapWorkItem.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
    const session = await (prisma as any).portfolioBootstrapSession.findUnique({ where: { id: sessionId } });
    expect(session.existingWorkStatus).toBe('no_existing_work');
    expect(session.bootstrapPhase).toBe('B3_PROVISIONAL_STRUCTURING');
    expect(await canonicalCounts()).toEqual(before);
  });

  it('analyzes provisional work into proposed mutations idempotently without canonical writes', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    await request(app)
      .post(`${base}/sessions/${sessionId}/work-items/paste`)
      .set('Idempotency-Key', 'analysis-work-seed')
      .send({
        text: [
          'Nuevo onboarding digital',
          'Chatbot de soporte bloqueado por datos',
          'Migracion CRM',
        ].join('\n'),
      })
      .expect(200);
    const before = await canonicalCounts();

    const first = await request(app)
      .post(`${base}/sessions/${sessionId}/analyze`)
      .set('Idempotency-Key', 'analysis-key')
      .send({})
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${sessionId}/analyze`)
      .set('Idempotency-Key', 'analysis-key')
      .send({})
      .expect(200);

    expect(first.body.data.homeState).toBe('HOME_C');
    expect(replay.body.data.analysisRunId).toBe(first.body.data.analysisRunId);
    expect(first.body.data.proposedMutations.length).toBeGreaterThanOrEqual(3);
    expect(await (prisma as any).portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(1);
    expect(await (prisma as any).portfolioBootstrapProposedMutation.count({ where: { bootstrapSessionId: sessionId } }))
      .toBe(first.body.data.proposedMutations.length);
    expect(first.body.data.proposedMutations.every((mutation: any) => mutation.status === 'proposed')).toBe(true);
    expect(first.body.data.proposedMutations.every((mutation: any) => mutation.confirmationRequired === true)).toBe(true);
    expect(first.body.data.proposedMutations.every((mutation: any) => ['ai_inferred', 'ai_suggested'].includes(mutation.provenanceStatus))).toBe(true);
    expect(first.body.data.proposedMutations.some((mutation: any) => mutation.proposedValue?.status === 'confirmed_alignment')).toBe(false);

    const session = await (prisma as any).portfolioBootstrapSession.findUnique({ where: { id: sessionId } });
    expect(session.status).toBe('awaiting_material_review');
    expect(session.bootstrapPhase).toBe('B4_MATERIAL_REVIEW');
    expect(await canonicalCounts()).toEqual(before);

    const listed = await request(app)
      .get(`${base}/sessions/${sessionId}/proposed-mutations`)
      .expect(200);
    expect(listed.body.data.proposedMutations).toHaveLength(first.body.data.proposedMutations.length);
  });

  it('refuses B3 analysis when no existing work was declared', async () => {
    const app = makeApp(userId);
    const continuation = await seedContinuation(userId);
    const created = await request(app)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);
    const sessionId = created.body.data.bootstrapSession.id;
    await request(app)
      .post(`${base}/sessions/${sessionId}/work-items/none`)
      .send({})
      .expect(200);

    await request(app)
      .post(`${base}/sessions/${sessionId}/analyze`)
      .send({})
      .expect(409);
    expect(await (prisma as any).portfolioBootstrapAnalysisRun.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
    expect(await (prisma as any).portfolioBootstrapProposedMutation.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
  });

  it('confirms, corrects, rejects, and leaves pending proposed mutations without canonical writes', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);
    const before = await canonicalCounts();
    const mutations = await (prisma as any).portfolioBootstrapProposedMutation.findMany({
      where: { bootstrapSessionId: sessionId, status: 'proposed' },
      orderBy: { createdAt: 'asc' },
    });
    const relation = mutations.find((mutation: any) => mutation.targetType === 'strategic_connection');
    const firstCondition = mutations.find((mutation: any) => mutation.targetType === 'advancement_condition');
    const secondCondition = mutations.find((mutation: any) => mutation.targetType === 'advancement_condition' && mutation.id !== firstCondition?.id);
    expect(relation).toBeTruthy();
    expect(firstCondition).toBeTruthy();
    expect(secondCondition).toBeTruthy();

    const corrected = await request(app)
      .patch(`${base}/sessions/${sessionId}/proposed-mutations/${relation.id}`)
      .send({ proposedValue: { ...relation.proposedValue, status: 'partial_alignment' }, reviewNote: 'Solo cubre una parte de la prioridad' })
      .expect(200);
    expect(corrected.body.data.mutation.status).toBe('reviewed');
    expect(corrected.body.data.mutation.originalProposedValue).toEqual(relation.proposedValue);
    expect(await (prisma as any).portfolioStrategicConnection.count({ where: { sourceMutationId: relation.id } })).toBe(0);

    const confirmed = await request(app)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${relation.id}/confirm`)
      .send({})
      .expect(200);
    const confirmedAgain = await request(app)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${relation.id}/confirm`)
      .send({})
      .expect(200);
    expect(confirmed.body.data.mutation.status).toBe('confirmed');
    expect(confirmed.body.data.strategicConnection.status).toBe('partial_alignment');
    expect(confirmed.body.data.strategicConnection.provenanceStatus).toBe('user_confirmed');
    expect(confirmedAgain.body.data.strategicConnection?.id ?? confirmed.body.data.strategicConnection.id)
      .toBe(confirmed.body.data.strategicConnection.id);
    expect(await (prisma as any).portfolioStrategicConnection.count({ where: { sourceMutationId: relation.id } })).toBe(1);

    const rejected = await request(app)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${firstCondition.id}/reject`)
      .send({ reviewNote: 'No aplica a esta lectura' })
      .expect(200);
    expect(rejected.body.data.mutation.status).toBe('rejected');
    expect(await (prisma as any).portfolioAdvancementCondition.count({ where: { sourceMutationId: firstCondition.id } })).toBe(0);

    const pending = await request(app)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${secondCondition.id}/review`)
      .send({})
      .expect(200);
    expect(pending.body.data.mutation.status).toBe('reviewed');

    const remaining = await (prisma as any).portfolioBootstrapProposedMutation.findMany({
      where: { bootstrapSessionId: sessionId, status: 'proposed' },
      select: { id: true },
    });
    for (const mutation of remaining) {
      await request(app)
        .post(`${base}/sessions/${sessionId}/proposed-mutations/${mutation.id}/review`)
        .send({})
        .expect(200);
    }

    const session = await (prisma as any).portfolioBootstrapSession.findUnique({ where: { id: sessionId } });
    expect(session.status).toBe('awaiting_first_reading');
    expect(session.bootstrapPhase).toBe('B5_FIRST_READING');
    expect(await canonicalCounts()).toEqual(before);

    const storedRelation = await (prisma as any).portfolioStrategicConnection.findUnique({
      where: { sourceMutationId: relation.id },
    });
    expect(storedRelation.sourceRefs.originalProvenanceStatus).toBe('ai_suggested');
    expect(storedRelation.sourceRefs.mutationId).toBe(relation.id);
  });

  it('blocks superseded proposed mutations from governing Bootstrap state', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);
    const mutation = await (prisma as any).portfolioBootstrapProposedMutation.findFirst({
      where: { bootstrapSessionId: sessionId, status: 'proposed' },
    });
    await (prisma as any).portfolioBootstrapProposedMutation.update({
      where: { id: mutation.id },
      data: { status: 'superseded' },
    });

    await request(app)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${mutation.id}/confirm`)
      .send({})
      .expect(409);
    expect(await (prisma as any).portfolioStrategicConnection.count({ where: { sourceMutationId: mutation.id } })).toBe(0);
    expect(await (prisma as any).portfolioAdvancementCondition.count({ where: { sourceMutationId: mutation.id } })).toBe(0);
  });

  it('publishes a versioned HOME_E first reading idempotently without canonical writes', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);
    const before = await canonicalCounts();
    await resolveMaterialReview(app, sessionId, 'with_attention');

    const first = await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-key')
      .send({})
      .expect(200);
    const replay = await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-key')
      .send({})
      .expect(200);

    expect(first.body.data.homeState).toBe('HOME_E');
    expect(first.body.data.reading.version).toBe(1);
    expect(replay.body.data.reading.id).toBe(first.body.data.reading.id);
    expect(first.body.data.reading.primaryAttentionItems[0]).toMatchObject({
      type: 'missing_business_signal',
      severity: 'attention',
    });
    expect(first.body.data.reading.summary).toContain('Intentamos mover:');
    expect(first.body.data.reading.sourceSnapshot.workItems.length).toBeGreaterThan(0);
    const session = await (prisma as any).portfolioBootstrapSession.findUnique({ where: { id: sessionId } });
    expect(session.status).toBe('reading_published');
    expect(session.bootstrapPhase).toBe('B5_FIRST_READING');
    expect(await canonicalCounts()).toEqual(before);
  });

  it('publishes HOME_D when material attention was not confirmed', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);
    await resolveMaterialReview(app, sessionId, 'without_attention');

    const published = await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-no-attention')
      .send({})
      .expect(200);

    expect(published.body.data.homeState).toBe('HOME_D');
    expect(published.body.data.reading.primaryAttentionItems).toEqual([]);
    expect(published.body.data.nextBestAction).toBe('Mantener y revisar la lectura inicial del portfolio');
  });

  it('creates v2 when governed Bootstrap state changes after a published reading', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);
    await resolveMaterialReview(app, sessionId, 'with_attention');
    const first = await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-versioned')
      .send({})
      .expect(200);
    const governedCondition = await (prisma as any).portfolioAdvancementCondition.findFirst({
      where: { bootstrapSessionId: sessionId },
      orderBy: { createdAt: 'asc' },
    });
    expect(governedCondition).toBeTruthy();
    await (prisma as any).portfolioAdvancementCondition.update({
      where: { id: governedCondition.id },
      data: { statement: `${governedCondition.statement} Revision actualizada.` },
    });

    const second = await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-versioned')
      .send({})
      .expect(200);

    expect(second.body.data.reading.id).not.toBe(first.body.data.reading.id);
    expect(second.body.data.reading.version).toBe(2);
  });

  it('refuses reading publish before material review is sufficient', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);

    await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-too-early')
      .send({})
      .expect(409);

    expect(await (prisma as any).portfolioReading.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
  });

  it('refuses reading publish when required mutations are stale', async () => {
    const app = makeApp(userId);
    const { sessionId } = await seedAnalyzedBootstrap(app);
    await (prisma as any).portfolioBootstrapProposedMutation.updateMany({
      where: { bootstrapSessionId: sessionId },
      data: { status: 'rejected' },
    });
    await (prisma as any).portfolioBootstrapProposedMutation.updateMany({
      where: { bootstrapSessionId: sessionId, targetType: 'strategic_connection' },
      data: { status: 'superseded' },
    });
    await (prisma as any).portfolioBootstrapSession.update({
      where: { id: sessionId },
      data: { status: 'awaiting_first_reading', bootstrapPhase: 'B5_FIRST_READING' },
    });

    await request(app)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-stale')
      .send({})
      .expect(409);
    expect(await (prisma as any).portfolioReading.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
  });

  it('requires portfolio:write for material review and reading publish even for the owner', async () => {
    const ownerApp = makeApp(userId);
    const readOnlyOwnerApp = makeApp(userId, ['viewer']);
    const { sessionId } = await seedAnalyzedBootstrap(ownerApp);
    const mutation = await (prisma as any).portfolioBootstrapProposedMutation.findFirst({
      where: { bootstrapSessionId: sessionId, status: 'proposed' },
    });
    expect(mutation).toBeTruthy();

    await request(readOnlyOwnerApp)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${mutation.id}/confirm`)
      .send({})
      .expect(403);
    expect(await (prisma as any).portfolioStrategicConnection.count({ where: { sourceMutationId: mutation.id } })).toBe(0);
    expect(await (prisma as any).portfolioAdvancementCondition.count({ where: { sourceMutationId: mutation.id } })).toBe(0);

    await resolveMaterialReview(ownerApp, sessionId, 'with_attention');
    await request(readOnlyOwnerApp)
      .post(`${base}/sessions/${sessionId}/readings`)
      .set('Idempotency-Key', 'reading-read-only-owner')
      .send({})
      .expect(403);
    expect(await (prisma as any).portfolioReading.count({ where: { bootstrapSessionId: sessionId } })).toBe(0);
  });

  it('denies work intake for a session owned by another Portfolio Lead', async () => {
    const ownerApp = makeApp(userId);
    const otherApp = makeApp(otherUserId);
    const continuation = await seedContinuation(userId);
    const created = await request(ownerApp)
      .post(`${base}/sessions/from-continuation`)
      .send({ portfolioEntryContinuationId: continuation.id })
      .expect(200);

    await request(otherApp)
      .post(`${base}/sessions/${created.body.data.bootstrapSession.id}/work-items/manual`)
      .send({ label: 'Trabajo ajeno' })
      .expect(403);
  });
});

function makeApp(
  authenticatedUserId: string,
  roles: any[] = ['portfolio_lead'],
  options: { service?: PortfolioBootstrapService; capturedErrors?: Error[] } = {},
) {
  const app = express();
  app.use(express.json());
  app.use(base, buildPortfolioBootstrapRouter({
    authenticate: fakeAuthenticate(authenticatedUserId, roles),
    service: options.service,
  }));
  if (options.capturedErrors) {
    app.use((err: Error, req: any, res: any, next: any) => {
      options.capturedErrors?.push(err);
      errorHandler(err, req, res, next);
    });
  } else {
    app.use(errorHandler);
  }
  return app;
}

function makeSessionReadBarrierService(expectedReads: number): PortfolioBootstrapService {
  let arrived = 0;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const prismaWithBarrier = new Proxy(prisma, {
    get(target, property) {
      if (property !== '$transaction') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      const transaction = Reflect.get(target, property, target) as (...args: any[]) => Promise<unknown>;
      return (callback: (tx: any) => Promise<unknown>, ...args: any[]) => transaction.call(
        target,
        (tx: any) => {
          const sessionDelegate = tx.portfolioBootstrapSession;
          const sessionDelegateWithBarrier = new Proxy(sessionDelegate, {
            get(delegate, method) {
              const value = Reflect.get(delegate, method, delegate);
              if (method !== 'findUnique' || typeof value !== 'function') {
                return typeof value === 'function' ? value.bind(delegate) : value;
              }
              return async (...queryArgs: any[]) => {
                const session = await value.apply(delegate, queryArgs);
                if (session?.anchor?.status === 'anchor_sufficient' && arrived < expectedReads) {
                  arrived += 1;
                  if (arrived === expectedReads) release();
                  await barrier;
                }
                return session;
              };
            },
          });
          const txWithBarrier = new Proxy(tx, {
            get(targetTx, txProperty) {
              return txProperty === 'portfolioBootstrapSession'
                ? sessionDelegateWithBarrier
                : Reflect.get(targetTx, txProperty, targetTx);
            },
          });
          return callback(txWithBarrier);
        },
        ...args,
      );
    },
  });
  return new PortfolioBootstrapService(prismaWithBarrier);
}

function fakeAuthenticate(authenticatedUserId: string, roles: any[] = ['portfolio_lead']): RequestHandler {
  return (req: any, _res, next) => {
    req.user = {
      id: authenticatedUserId,
      email: `${authenticatedUserId}@starteria.test`,
      role: roles[0] ?? 'viewer',
      roles,
      permissions: permissionsForRoles(roles),
    };
    next();
  };
}

async function seedContinuation(ownerUserId: string) {
  await prisma.organization.upsert({
    where: { id: organizationId },
    create: {
      id: organizationId,
      name: 'Portfolio Bootstrap integration fixture',
      slug: 'portfolio-bootstrap-integration-fixture',
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: ownerUserId },
    create: {
      id: ownerUserId,
      email: `${ownerUserId}@starteria.test`,
      name: 'Portfolio Lead',
      role: 'portfolio_lead',
      roles: ['portfolio_lead'],
      initials: 'PL',
      skills: [],
    },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: otherUserId },
    create: {
      id: otherUserId,
      email: `${otherUserId}@starteria.test`,
      name: 'Other Portfolio Lead',
      role: 'portfolio_lead',
      roles: ['portfolio_lead'],
      initials: 'OP',
      skills: [],
    },
    update: {},
  });
  const session = await prisma.portfolioEntrySession.create({
    data: {
      id: `entry-session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ownerUserId,
      ownershipState: 'CLAIMED',
      rawEntry: 'Queremos ordenar iniciativas comerciales',
      entryOrigin: 'public_start',
      lifecycleStatus: 'CONVERTED',
      executionStatus: 'SUCCEEDED',
      interactionMode: 'guided',
      semanticState: {},
      questionBudget: {},
      continuationProfile: 'PORTFOLIO_LEAD_ENTRY',
      contractVersion: 'portfolio-entry-contract-v0.1',
      runtimeVersion: 'portfolio-entry-runtime-v0.2',
      schemaVersion: 'portfolio-entry-schema-v0.2',
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  touchedEntrySessionIds.add(session.id);
  return prisma.portfolioEntryPortfolioContinuation.create({
    data: {
      sessionId: session.id,
      handoffId: `handoff-${session.id}`,
      confirmationId: `confirmation-${session.id}`,
      continuedByUserId: ownerUserId,
      portfolioScope: { kind: 'scoped_portfolio_grant', userId: ownerUserId, organizationId },
      sourceSnapshot: {
        session: { rawEntry: session.rawEntry },
        handoff: {
          desired_outcome: { value: 'Reducir abandono en onboarding B2B' },
          known_context: [{ description: 'Customer success y producto reportan retrasos en activacion.' }],
          business_signal: { value: 'Aumento sostenido de tickets durante onboarding' },
          provenance_summary: [{ origin: 'AI_INFERRED', source_path: 'analysis' }],
        },
        confirmation: { status: 'CONFIRMED', correctedFields: {} },
      },
      pendingItems: {},
      mappingVersion: 'portfolio-entry-portfolio-continuation-v0.1',
      destinationRoute: '/portfolio/inicio',
    },
  });
}

async function seedAnalyzedBootstrap(app: express.Express) {
  const continuation = await seedContinuation(userId);
  const created = await request(app)
    .post(`${base}/sessions/from-continuation`)
    .send({ portfolioEntryContinuationId: continuation.id })
    .expect(200);
  const sessionId = created.body.data.bootstrapSession.id;
  await request(app)
    .post(`${base}/sessions/${sessionId}/work-items/paste`)
    .set('Idempotency-Key', `analysis-seed-${sessionId}`)
    .send({
      text: [
        'Nuevo onboarding digital',
        'Chatbot de soporte bloqueado por datos',
        'Migracion CRM',
      ].join('\n'),
    })
    .expect(200);
  await request(app)
    .post(`${base}/sessions/${sessionId}/analyze`)
    .set('Idempotency-Key', `analysis-${sessionId}`)
    .send({})
    .expect(200);
  return { sessionId };
}

async function resolveMaterialReview(app: express.Express, sessionId: string, mode: 'with_attention' | 'without_attention') {
  const mutations = await (prisma as any).portfolioBootstrapProposedMutation.findMany({
    where: { bootstrapSessionId: sessionId, status: 'proposed' },
    orderBy: { createdAt: 'asc' },
  });
  let attentionConfirmed = false;
  for (const mutation of mutations) {
    if (mutation.targetType === 'strategic_connection') {
      await request(app)
        .post(`${base}/sessions/${sessionId}/proposed-mutations/${mutation.id}/confirm`)
        .send({})
        .expect(200);
      continue;
    }
    if (
      mode === 'with_attention'
      && !attentionConfirmed
      && mutation.targetType === 'advancement_condition'
      && ['attention', 'blocking'].includes(mutation.proposedValue?.severity)
    ) {
      await request(app)
        .post(`${base}/sessions/${sessionId}/proposed-mutations/${mutation.id}/confirm`)
        .send({})
        .expect(200);
      attentionConfirmed = true;
      continue;
    }
    await request(app)
      .post(`${base}/sessions/${sessionId}/proposed-mutations/${mutation.id}/reject`)
      .send({ reviewNote: 'No entra en esta primera lectura' })
      .expect(200);
  }
}

async function canonicalCounts() {
  const [strategicFronts, challenges, projects, steps, initiativePortfolioMetas] = await Promise.all([
    prisma.strategicFront.count(),
    prisma.challenge.count(),
    prisma.project.count(),
    prisma.step.count(),
    prisma.initiativePortfolioMeta.count(),
  ]);
  return { strategicFronts, challenges, projects, steps, initiativePortfolioMetas };
}

function buildImportCsv(rowCount: number) {
  const rows = ['Initiative,Owner,Status,Objective,KPI,Notes'];
  for (let index = 1; index <= rowCount; index += 1) {
    rows.push(`Initiative ${rowCount}-${index},Owner ${index},Active,Objective ${index},Signal ${index},Note ${index}`);
  }
  return rows.join('\n');
}

async function cleanup() {
  await (prisma as any).portfolioReading.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioStrategicConnection.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioAdvancementCondition.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioBootstrapProposedMutation.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioBootstrapAnalysisRun.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioBootstrapWorkItem.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioBootstrapImportBatch.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioBootstrapWorkIntakeSource.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioAnchorHistory.deleteMany({
    where: { bootstrapSessionId: { in: await touchedBootstrapSessionIds() } },
  });
  await (prisma as any).portfolioAnchor.deleteMany({
    where: { bootstrapSession: { sourceContinuation: { sessionId: { in: [...touchedEntrySessionIds] } } } },
  });
  await (prisma as any).portfolioBootstrapSession.deleteMany({
    where: { sourceContinuation: { sessionId: { in: [...touchedEntrySessionIds] } } },
  });
  await prisma.portfolioEntryPortfolioContinuation.deleteMany({
    where: { sessionId: { in: [...touchedEntrySessionIds] } },
  });
  await prisma.portfolioEntrySession.deleteMany({
    where: { id: { in: [...touchedEntrySessionIds] } },
  });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
}

async function touchedBootstrapSessionIds(): Promise<string[]> {
  const rows = await (prisma as any).portfolioBootstrapSession.findMany({
    where: { sourceContinuation: { sessionId: { in: [...touchedEntrySessionIds] } } },
    select: { id: true },
  });
  return rows.map((row: { id: string }) => row.id);
}
