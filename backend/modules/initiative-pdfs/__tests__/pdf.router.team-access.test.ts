/**
 * /api/v1/initiatives/:id/pdfs* sólo pedía sesión: cualquier usuario logueado podía subir un PDF,
 * lanzar una extracción (que gasta IA) o confirmar propuestas en una iniciativa ajena con su ID.
 * Ahora: el equipo y el Portfolio Lead asignado leen; OWNER o EDITOR escriben.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../shared/errors/error-handler';

let currentUser: { id: string; email: string; role: string } = { id: 'u1', email: 'u1@x.test', role: 'participante' };
let teamRole: string | null = null;

vi.mock('../../auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/auth.middleware')>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = actual.buildRequestUser(currentUser as any);
      next();
    },
  };
});

vi.mock('../../../shared/db/prisma', () => {
  const prisma = {
    teamMember: { findFirst: vi.fn(async () => (teamRole ? { role: teamRole, status: 'ACTIVE' } : null)) },
    initiativeGovernance: { findUnique: vi.fn(async () => null) },
  };
  return { default: prisma, prisma };
});

// El controller real no se ejecuta: interesa quién llega al handler.
vi.mock('../pdf.controller', () => ({
  PdfController: class {
    upload = (_req: any, res: any) => res.status(201).json({ ok: true });
    startExtraction = (_req: any, res: any) => res.status(202).json({ ok: true });
    getRun = (_req: any, res: any) => res.json({ ok: true });
    listProposals = (_req: any, res: any) => res.json({ ok: true });
    listProposalsByProject = (_req: any, res: any) => res.json({ ok: true });
    confirmProposal = (_req: any, res: any) => res.json({ ok: true });
    editProposal = (_req: any, res: any) => res.json({ ok: true });
    discardProposal = (_req: any, res: any) => res.json({ ok: true });
  },
}));

vi.mock('../../billing/entitlement.middleware', () => ({
  requireEntitlement: () => (_req: any, _res: any, next: any) => next(),
}));

const { pdfRouter } = await import('../pdf.router');

const app = express();
app.use(express.json());
app.use('/api/v1/initiatives', pdfRouter);
app.use(errorHandler);

const base = '/api/v1/initiatives/p1';
const reads = [`${base}/pdfs/runs/r1`, `${base}/pdfs/runs/r1/proposals`, `${base}/autofill-proposals`];
const writes: Array<{ path: string; pdf?: boolean; body?: object }> = [
  { path: `${base}/pdfs`, pdf: true },
  { path: `${base}/pdfs/pdf-1/extract`, body: {} },
  { path: `${base}/pdfs/runs/r1/proposals/step0.problem/confirm` },
  { path: `${base}/pdfs/runs/r1/proposals/step0.problem/edit`, body: { finalValue: 'x' } },
  { path: `${base}/pdfs/runs/r1/proposals/step0.problem/discard` },
];

function post(w: (typeof writes)[number]) {
  const req = request(app).post(w.path);
  if (w.pdf) return req.set('Content-Type', 'application/pdf').send(Buffer.from('%PDF-1.4'));
  return req.send(w.body ?? {});
}

describe('initiative-pdfs: acceso por equipo', () => {
  beforeEach(() => {
    currentUser = { id: 'u1', email: 'u1@x.test', role: 'participante' };
    teamRole = null;
  });

  it('un usuario ajeno a la iniciativa no lee ni escribe', async () => {
    for (const path of reads) expect((await request(app).get(path)).status, path).toBe(403);
    for (const w of writes) expect((await post(w)).status, w.path).toBe(403);
  });

  it('un VIEWER del equipo lee pero no sube, extrae ni resuelve propuestas', async () => {
    teamRole = 'VIEWER';
    for (const path of reads) expect((await request(app).get(path)).status, path).toBe(200);
    for (const w of writes) expect((await post(w)).status, w.path).toBe(403);
  });

  it('un EDITOR del equipo lee y escribe', async () => {
    teamRole = 'EDITOR';
    for (const path of reads) expect((await request(app).get(path)).status, path).toBe(200);
    for (const w of writes) expect((await post(w)).status, w.path).toBeLessThan(300);
  });
});
