/**
 * Contract tests for the PUBLIC (no-auth) pilot-lead capture surface.
 * PRD-003 / SPEC-003 / ADR-015.
 *
 * Hermetic: the Prisma surface is an in-memory fake (no real DB), mirroring the
 * dependency-injection style of public-pdf.router.test.ts. Locks:
 *   - happy path → 201 { id, pilotCode, status, createdAt }, lead persisted
 *   - 409 PILOT_CONSENT_REQUIRED when consent is not accepted
 *   - 422 when email is invalid (Zod boundary)
 *   - idempotency by draftId (resend never duplicates → create called once)
 *   - AuditLog carries ids/metadata only — never the PII payload
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import { PilotLeadService, type PilotLeadStore } from '../pilot-lead.service';
import { buildPilotLeadRouter } from '../pilot-lead.router';
import { errorHandler } from '../../../shared/errors/error-handler';
import { hashRefreshToken } from '../../auth/token.service';

interface Row {
  id: string;
  draftId: string;
  pilotCode: string;
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  consentAccepted: boolean;
  consentAt: Date;
  status: string;
  source: string;
  retentionUntil: Date;
  proposal?: unknown;
  createdAt: Date;
}

function makeStore() {
  const rows: Row[] = [];
  const audits: Array<Record<string, unknown>> = [];
  let seq = 0;
  const store: PilotLeadStore = {
    pilotLead: {
      findUnique: vi.fn(async ({ where }) =>
        rows.find(r =>
          ('draftId' in where && r.draftId === where.draftId) ||
          ('pilotCode' in where && r.pilotCode === where.pilotCode),
        ) ?? null,
      ),
      create: vi.fn(async ({ data }) => {
        const row = { id: `lead-${++seq}`, createdAt: new Date('2026-05-29T12:00:00Z'), ...(data as object) } as Row;
        rows.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = rows.find((candidate) => candidate.id === where.id && candidate.pilotCode === where.pilotCode);
        if (!row) return { count: 0 };
        row.pilotCode = data.pilotCode;
        return { count: 1 };
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }) => {
        audits.push(data as Record<string, unknown>);
        return data;
      }),
    },
  };
  return { store, rows, audits };
}

function makeApp(store: PilotLeadStore, notify = vi.fn()) {
  const service = new PilotLeadService(store, notify);
  const app = express();
  app.use(express.json());
  // High rate-limit cap so tests never trip the limiter.
  app.use('/api/v1/public/pilot-leads', buildPilotLeadRouter(service, { maxRequests: 1000 }));
  app.use(errorHandler);
  return { app, notify };
}

const VALID = {
  draftId: 'draft-pilot-1',
  name: 'Ana Rodríguez',
  email: 'ana@example.com',
  phone: '+51 999 888 777',
  organization: 'Efectiva',
  consentAccepted: true,
};

describe('POST /api/v1/public/pilot-leads', () => {
  let ctx: ReturnType<typeof makeStore>;
  beforeEach(() => {
    ctx = makeStore();
  });

  it('persists a valid lead and returns 201 with id/pilotCode/status', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app).post('/api/v1/public/pilot-leads').send(VALID);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeTruthy();
    expect(res.body.data.pilotCode).toMatch(/^ST-PILOT-[0-9A-F]{64}$/);
    expect(res.body.data.status).toBe('submitted');
    expect(typeof res.body.data.createdAt).toBe('string');

    expect(ctx.rows).toHaveLength(1);
    expect(ctx.rows[0].consentAccepted).toBe(true);
    expect(ctx.rows[0].pilotCode).toBe(hashRefreshToken(res.body.data.pilotCode));
    expect(ctx.rows[0].pilotCode).not.toBe(res.body.data.pilotCode);
    expect(ctx.rows[0].consentAt).toBeInstanceOf(Date);
    expect(ctx.rows[0].retentionUntil.getTime()).toBeGreaterThan(ctx.rows[0].consentAt.getTime());
  });

  it('rejects without consent → 409 PILOT_CONSENT_REQUIRED, nothing persisted', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app)
      .post('/api/v1/public/pilot-leads')
      .send({ ...VALID, consentAccepted: false });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('PILOT_CONSENT_REQUIRED');
    expect(ctx.rows).toHaveLength(0);
  });

  it('rejects an invalid email → 400 (Zod boundary)', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app)
      .post('/api/v1/public/pilot-leads')
      .send({ ...VALID, email: 'not-an-email' });

    // Codebase convention: ZodError → 400 VALIDATION_ERROR (central handler).
    expect(res.status).toBe(400);
    expect(ctx.rows).toHaveLength(0);
  });

  it('is idempotent by draftId — a resend returns the same lead, creates once', async () => {
    const { app } = makeApp(ctx.store);
    const first = await request(app).post('/api/v1/public/pilot-leads').send(VALID);
    const second = await request(app).post('/api/v1/public/pilot-leads').send(VALID);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.pilotCode).toBe(first.body.data.pilotCode);
    expect(ctx.store.pilotLead.create).toHaveBeenCalledTimes(1);
    expect(ctx.rows).toHaveLength(1);
  });

  it('invalidates and reissues a legacy weak code only after contact identity matches', async () => {
    ctx.rows.push({
      id: 'legacy-lead', draftId: VALID.draftId, pilotCode: 'ST-PILOT-AB12',
      name: VALID.name, email: VALID.email, phone: VALID.phone,
      organization: VALID.organization, consentAccepted: true,
      consentAt: new Date('2026-05-29T12:00:00Z'), status: 'submitted',
      source: 'public_landing', retentionUntil: new Date('2027-05-29T12:00:00Z'),
      createdAt: new Date('2026-05-29T12:00:00Z'),
    });
    const { app } = makeApp(ctx.store);

    const denied = await request(app).post('/api/v1/public/pilot-leads').send({ ...VALID, email: 'attacker@example.com' });
    expect(denied.status).toBe(409);
    expect(denied.body.error?.code).toBe('PILOT_LEAD_IDENTITY_MISMATCH');
    expect(ctx.rows[0].pilotCode).toBe('ST-PILOT-AB12');

    const reissued = await request(app).post('/api/v1/public/pilot-leads').send(VALID);
    expect(reissued.status).toBe(201);
    expect(reissued.body.data.pilotCode).toMatch(/^ST-PILOT-[0-9A-F]{64}$/);
    expect(ctx.rows[0].pilotCode).toBe(hashRefreshToken(reissued.body.data.pilotCode));
    expect(ctx.rows[0].pilotCode).not.toContain('AB12');
    expect(ctx.audits).toContainEqual(expect.objectContaining({
      action: 'pilot.lead.credential_reissued',
      resourceId: 'legacy-lead',
      details: { reason: 'legacy_credential_invalidated' },
    }));
    expect(JSON.stringify(ctx.audits)).not.toContain(reissued.body.data.pilotCode);
  });

  it('rechecks contact identity after a concurrent draftId P2002 winner', async () => {
    const winner = {
      id: 'winner', draftId: VALID.draftId, pilotCode: 'stored-hash',
      name: 'Victim', email: 'victim@example.com', phone: null, organization: null,
      consentAccepted: true, consentAt: new Date(), status: 'submitted', source: 'public_landing',
      retentionUntil: new Date('2027-05-29T12:00:00Z'), createdAt: new Date('2026-05-29T12:00:00Z'),
    } as Row;
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    const racingStore = {
      pilotLead: {
        findUnique,
        create: vi.fn().mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' })),
        updateMany: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    } as unknown as PilotLeadStore;
    const service = new PilotLeadService(racingStore, vi.fn(), 'test-pilot-secret-with-enough-entropy');

    await expect(service.submit({ ...VALID, email: 'attacker@example.com' }))
      .rejects.toMatchObject({ code: 'PILOT_LEAD_IDENTITY_MISMATCH' });
    expect(racingStore.pilotLead.updateMany).not.toHaveBeenCalled();
  });

  it('writes an AuditLog with ids/metadata only — no PII (email/phone/name)', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app).post('/api/v1/public/pilot-leads').send(VALID);

    expect(ctx.audits).toHaveLength(1);
    const audit = ctx.audits[0];
    expect(audit.action).toBe('pilot.lead.captured');
    expect(audit.resource).toBe('PilotLead');
    const serialized = JSON.stringify(audit);
    expect(serialized).not.toContain(res.body?.data?.pilotCode ?? 'never');
    expect(serialized).not.toContain(VALID.email);
    expect(serialized).not.toContain(VALID.phone);
    expect(serialized).not.toContain(VALID.name);
  });

  it('fires the notifier with the lead contact so the team can follow up (issue #54)', async () => {
    const notify = vi.fn();
    const { app } = makeApp(ctx.store, notify);
    await request(app).post('/api/v1/public/pilot-leads').send(VALID);

    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.pilotCode).toMatch(/^ST-PILOT-/);
    // The notification IS actionable: it carries contact PII (consented purpose).
    expect(arg.name).toBe(VALID.name);
    expect(arg.email).toBe(VALID.email);
    expect(arg.phone).toBe(VALID.phone);
    expect(arg.organization).toBe(VALID.organization);
  });

  it('persists the proposal snapshot so the code can later be redeemed', async () => {
    const { app } = makeApp(ctx.store);
    const proposal = { title: 'Protocolo de Autonomía', aiOutput: { whatToMove: 'ordenar el proceso' } };
    await request(app).post('/api/v1/public/pilot-leads').send({ ...VALID, proposal });

    expect(ctx.rows[0].proposal).toEqual(proposal);
  });
});

describe('GET /api/v1/public/pilot-leads/:pilotCode (resume)', () => {
  let ctx: ReturnType<typeof makeStore>;
  beforeEach(() => {
    ctx = makeStore();
  });

  const PROPOSAL = { title: 'Protocolo de Autonomía', aiOutput: { whatToMove: 'ordenar el proceso' } };

  async function captureCode(app: express.Express): Promise<string> {
    const res = await request(app).post('/api/v1/public/pilot-leads').send({ ...VALID, proposal: PROPOSAL });
    return res.body.data.pilotCode as string;
  }

  it('redeems a known code → 200 with the proposal + name/org, NO contact PII', async () => {
    const { app } = makeApp(ctx.store);
    const code = await captureCode(app);

    const res = await request(app).get(`/api/v1/public/pilot-leads/${code}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pilotCode).toBe(code);
    expect(res.body.data.proposal).toEqual(PROPOSAL);
    expect(res.body.data.name).toBe(VALID.name);
    expect(res.body.data.organization).toBe(VALID.organization);
    // The short code is a bearer token — a public lookup must not leak contact PII.
    const serialized = JSON.stringify(res.body.data);
    expect(serialized).not.toContain(VALID.email);
    expect(serialized).not.toContain(VALID.phone);
  });

  it('accepts a lowercase code (normalized) and still resolves', async () => {
    const { app } = makeApp(ctx.store);
    const code = await captureCode(app);

    const res = await request(app).get(`/api/v1/public/pilot-leads/${code.toLowerCase()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.pilotCode).toBe(code);
  });

  it('unknown code → 404 PILOT_CODE_NOT_FOUND', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app).get(`/api/v1/public/pilot-leads/ST-PILOT-${'F'.repeat(64)}`);

    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PILOT_CODE_NOT_FOUND');
  });

  it('rejects a known bearer after the lead retention deadline', async () => {
    const { app } = makeApp(ctx.store);
    const code = await captureCode(app);
    ctx.rows[0].retentionUntil = new Date(Date.now() - 1);

    const res = await request(app).get(`/api/v1/public/pilot-leads/${code}`);

    expect(res.status).toBe(410);
    expect(res.body.error?.code).toBe('PILOT_RETENTION_EXPIRED');
    expect(JSON.stringify(res.body)).not.toContain(ctx.rows[0].name);
  });

  it('malformed code → 400 (Zod boundary), never hits the store', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app).get('/api/v1/public/pilot-leads/not-a-code');

    expect(res.status).toBe(400);
  });

  it('fails closed for legacy 16-bit codes instead of opening a plaintext fallback', async () => {
    const { app } = makeApp(ctx.store);
    const res = await request(app).get('/api/v1/public/pilot-leads/ST-PILOT-AB12');

    expect(res.status).toBe(400);
    expect(ctx.store.pilotLead.findUnique).not.toHaveBeenCalled();
  });

  it('audits the resume with ids/metadata only (no PII)', async () => {
    const { app } = makeApp(ctx.store);
    const code = await captureCode(app);
    ctx.audits.length = 0; // drop the capture audit; focus on resume
    await request(app).get(`/api/v1/public/pilot-leads/${code}`);

    const resume = ctx.audits.find(a => a.action === 'pilot.lead.resumed');
    expect(resume).toBeTruthy();
    const serialized = JSON.stringify(resume);
    expect(serialized).not.toContain(code);
    expect(serialized).not.toContain(VALID.email);
    expect(serialized).not.toContain(VALID.phone);
  });
});
