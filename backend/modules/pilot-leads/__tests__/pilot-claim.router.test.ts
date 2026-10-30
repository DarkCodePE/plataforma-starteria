/**
 * Contract tests for the pilot-claim flow (ADR-018). Hermetic: in-memory fake
 * Prisma surface + a fake project creator + a fake auth middleware. Locks:
 *   - issue → 201 with claim token + non-PII personalization, NEVER email/phone
 *   - issue unknown code → 404 PILOT_CODE_NOT_FOUND
 *   - consume (authenticated) → creates exactly one Project, returns its id
 *   - consume twice (same token) → idempotent, project created only once
 *   - consume expired token → 410 PILOT_CLAIM_EXPIRED, no project created
 *   - consume unknown token → 404 PILOT_CLAIM_NOT_FOUND
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';

import { PilotClaimService, type PilotClaimStore } from '../pilot-claim.service';
import { PilotClaimController } from '../pilot-claim.controller';
import { buildPilotLeadRouter } from '../pilot-lead.router';
import type { PilotLeadService } from '../pilot-lead.service';
import { hashRefreshToken } from '../../auth/token.service';
import { errorHandler } from '../../../shared/errors/error-handler';

const PILOT_CODE = `ST-PILOT-${'A1'.repeat(32)}`;

function makeStore() {
  const leads: any[] = [];
  const tokens: any[] = [];
  const projects: any[] = [];
  const audits: any[] = [];
  const store = {
    $transaction: vi.fn(async (run: (tx: PilotClaimStore) => Promise<unknown>) => run(store as PilotClaimStore)),
    pilotLead: {
      findUnique: vi.fn(async ({ where }: any) =>
        leads.find(
          (l) => ('pilotCode' in where && l.pilotCode === where.pilotCode) || ('id' in where && l.id === where.id),
        ) ?? null,
      ),
    },
    pilotClaimToken: {
      create: vi.fn(async ({ data }: any) => {
        const token = { consumedAt: null, ...data };
        tokens.push(token);
        return token;
      }),
      findUnique: vi.fn(async ({ where }: any) => tokens.find((t) => t.tokenHash === where.tokenHash) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const t = tokens.find((x) => x.tokenHash === where.tokenHash);
        if (t) Object.assign(t, data);
        return t;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const token of tokens) {
          const matchesHash = where.tokenHash === undefined || token.tokenHash === where.tokenHash;
          const matchesLead = where.pilotLeadId === undefined || token.pilotLeadId === where.pilotLeadId;
          const matchesConsumed = where.consumedAt === undefined || token.consumedAt === where.consumedAt;
          const matchesExpiry = !where.expiresAt?.gt || new Date(token.expiresAt) > where.expiresAt.gt;
          if (matchesHash && matchesLead && matchesConsumed && matchesExpiry) {
            Object.assign(token, data);
            count++;
          }
        }
        return { count };
      }),
    },
    project: {
      findFirst: vi.fn(async ({ where }: any) => projects.find((p) => p.pilotLeadId === where.pilotLeadId) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const project = projects.find((p) => p.id === where.id);
        if (project) Object.assign(project, data);
        return project;
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: any) => { audits.push(data); return data; }) },
  } as PilotClaimStore;
  return { store, leads, tokens, projects, audits };
}

function makeApp(ctx: ReturnType<typeof makeStore>) {
  const createProject = vi.fn(async (_userId: string, _role: string, lead: any) => {
    const id = `proj-${ctx.projects.length + 1}`;
    ctx.projects.push({ id, pilotLeadId: lead.id });
    return id;
  });
  const service = new PilotClaimService(ctx.store, createProject);
  const claimController = new PilotClaimController(service);
  const fakeAuth: RequestHandler = (req, _res, next) => {
    (req as any).user = { id: 'user-1', role: 'participante', email: 'ana@example.com' };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/public/pilot-leads',
    buildPilotLeadRouter({} as PilotLeadService, { maxRequests: 1000 }, { claimController, authenticate: fakeAuth }),
  );
  app.use(errorHandler);
  return { app, createProject };
}

const LEAD = {
  id: 'lead-1',
  pilotCode: hashRefreshToken(PILOT_CODE),
  name: 'Ana Rodríguez',
  email: 'ana@example.com',
  phone: '+51 999 888 777',
  organization: 'Efectiva',
  proposal: { title: 'Protocolo de Autonomía', aiOutput: { proposalTitle: 'Protocolo de Autonomía', whatToMove: 'ordenar el proceso', suggestedChallengeType: 'correction' } },
  retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
};

describe('POST /api/v1/public/pilot-leads/:pilotCode/claim (issue)', () => {
  let ctx: ReturnType<typeof makeStore>;
  beforeEach(() => { ctx = makeStore(); ctx.leads.push({ ...LEAD }); });

  it('issues a claim token with non-PII personalization and NO email/phone', async () => {
    const { app } = makeApp(ctx);
    const res = await request(app).post(`/api/v1/public/pilot-leads/${PILOT_CODE}/claim`);

    expect(res.status).toBe(201);
    expect(res.body.data.claimToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.data.name).toBe('Ana Rodríguez');
    expect(res.body.data.hasProposal).toBe(true);
    const serialized = JSON.stringify(res.body.data);
    expect(serialized).not.toContain('ana@example.com');
    expect(serialized).not.toContain('+51 999 888 777');
    // Only the SHA-256 hash is persisted — never the raw token.
    expect(ctx.tokens).toHaveLength(1);
    expect(ctx.tokens[0].tokenHash).not.toBe(res.body.data.claimToken);
    expect(ctx.tokens[0].tokenHash).toBe(hashRefreshToken(res.body.data.claimToken));
  });

  it('unknown code → 404 PILOT_CODE_NOT_FOUND', async () => {
    const { app } = makeApp(ctx);
    const res = await request(app).post(`/api/v1/public/pilot-leads/ST-PILOT-${'F'.repeat(64)}/claim`);
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PILOT_CODE_NOT_FOUND');
  });

  it('maps a concurrent Serializable issuance conflict to a controlled retry response', async () => {
    ctx.store.$transaction = vi.fn().mockRejectedValue(Object.assign(new Error('serialization'), { code: 'P2034' }));
    const { app } = makeApp(ctx);

    const res = await request(app).post(`/api/v1/public/pilot-leads/${PILOT_CODE}/claim`);

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe('PILOT_CLAIM_RETRY_REQUIRED');
    expect(JSON.stringify(res.body)).not.toContain(PILOT_CODE);
  });
});

describe('POST /api/v1/public/pilot-leads/consume-claim (consume)', () => {
  let ctx: ReturnType<typeof makeStore>;
  beforeEach(() => { ctx = makeStore(); ctx.leads.push({ ...LEAD }); });

  async function issueToken(app: express.Express): Promise<string> {
    const res = await request(app).post(`/api/v1/public/pilot-leads/${PILOT_CODE}/claim`);
    return res.body.data.claimToken as string;
  }

  it('consumes a claim and creates exactly one project for the authenticated user', async () => {
    const { app, createProject } = makeApp(ctx);
    const token = await issueToken(app);

    const res = await request(app).post('/api/v1/public/pilot-leads/consume-claim').send({ claimToken: token });

    expect(res.status).toBe(201);
    expect(res.body.data.projectId).toBe('proj-1');
    expect(res.body.data.alreadyExisted).toBe(false);
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(createProject.mock.calls[0][0]).toBe('user-1');
    expect(ctx.projects).toHaveLength(1);
  });

  it('rejects replay of a consumed token without disclosing the project id', async () => {
    const { app, createProject } = makeApp(ctx);
    const token = await issueToken(app);

    const first = await request(app).post('/api/v1/public/pilot-leads/consume-claim').send({ claimToken: token });
    const second = await request(app).post('/api/v1/public/pilot-leads/consume-claim').send({ claimToken: token });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe('PILOT_CLAIM_ALREADY_CONSUMED');
    expect(JSON.stringify(second.body)).not.toContain(first.body.data.projectId);
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(ctx.projects).toHaveLength(1);
  });

  it('rejects consumption by an authenticated account with a different email', async () => {
    const createProject = vi.fn(async () => 'never');
    const service = new PilotClaimService(ctx.store, createProject);
    const token = await service.issue(PILOT_CODE).then((issued) => issued.claimToken);

    await expect(
      service.consume(token, { id: 'user-b', role: 'participante', email: 'other@example.com' }),
    ).rejects.toMatchObject({ code: 'PILOT_CLAIM_IDENTITY_MISMATCH' });
    expect(createProject).not.toHaveBeenCalled();
  });

  it('expired claim → 410 PILOT_CLAIM_EXPIRED, no project created', async () => {
    const { app, createProject } = makeApp(ctx);
    // Inject an already-expired token directly (compute the hash like the service does).
    const raw = 'a'.repeat(64);
    ctx.tokens.push({ tokenHash: hashRefreshToken(raw), pilotLeadId: 'lead-1', expiresAt: new Date(Date.now() - 1000), consumedAt: null, createdProjectId: null });

    const res = await request(app).post('/api/v1/public/pilot-leads/consume-claim').send({ claimToken: raw });

    expect(res.status).toBe(410);
    expect(res.body.error?.code).toBe('PILOT_CLAIM_EXPIRED');
    expect(createProject).not.toHaveBeenCalled();
  });

  it('unknown token → 404 PILOT_CLAIM_NOT_FOUND', async () => {
    const { app } = makeApp(ctx);
    const res = await request(app).post('/api/v1/public/pilot-leads/consume-claim').send({ claimToken: 'b'.repeat(64) });
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('PILOT_CLAIM_NOT_FOUND');
  });
});
