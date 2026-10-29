/**
 * Auditoría E2E F-03: las escrituras de portafolio por ID sólo comprobaban `portfolio:write`.
 * Un lead de org-A podía editar frentes, retos, iniciativas o invitaciones de org-B con su ID.
 *
 * Prueba el router real (rutas + guardia) con un Prisma en memoria de dos organizaciones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../shared/errors/error-handler';

const db = {
  users: {
    'lead-a': 'org-a', 'lead-b': 'org-b', 'owner-a': 'org-a', 'owner-b': 'org-b',
    'lead-multi': 'org-a',
    'owner-p12-orphan': 'p12r1-http-org', 'owner-p6-orphan': null,
  } as Record<string, string | null>,
  fronts: { 'front-a': 'org-a', 'front-b': 'org-b', 'front-legacy': null } as Record<string, string | null>,
  challenges: { 'ch-a': 'front-a', 'ch-b': 'front-b' } as Record<string, string>,
  invitations: { 'inv-a': 'ch-a', 'inv-b': 'ch-b' } as Record<string, string>,
  projects: {
    'p-a': { organizationId: 'org-a', owner: 'owner-a', challenge: 'ch-a' },
    'p-b': { organizationId: 'org-b', owner: 'owner-b', challenge: 'ch-b' },
    'p-indep-b': { organizationId: 'org-b', owner: 'owner-b', challenge: null },
    'p-legacy-p12r1-http-org': { organizationId: null, owner: 'owner-p12-orphan', challenge: null },
    'p-legacy-p6-runtime-org': { organizationId: null, owner: 'owner-p6-orphan', challenge: 'ch-a' },
  } as Record<string, { organizationId: string | null; owner: string; challenge: string | null }>,
  outputs: { 'out-b': 'ch-b' } as Record<string, string>,
  assignments: { 'asg-b': { organizationId: null, challengeId: 'ch-b' } } as Record<string, { organizationId: string | null; challengeId: string }>,
};

const memberships: Record<string, string[]> = { 'lead-multi': ['org-b'] };
const writeGrants: Record<string, string[]> = {};

const frontOrg = (frontId: string) => ({ organizationId: db.fronts[frontId] ?? null });
const fakePrisma: any = {
  user: { findUnique: vi.fn(async ({ where }: any) => (where.id in db.users ? { organizationId: db.users[where.id] } : null)) },
  organizationMember: { findMany: vi.fn(async ({ where }: any) => (memberships[where.userId] ?? []).map(organizationId => ({ organizationId }))) },
  organizationPortfolioAccessGrant: {
    findMany: vi.fn(async ({ where }: any) => (writeGrants[where.userId] ?? [])
      .filter(() => !where.capability || where.capability === 'portfolio:write')
      .map(organizationId => ({ organizationId }))),
  },
  strategicFront: { findUnique: vi.fn(async ({ where }: any) => (where.id in db.fronts ? { id: where.id, ...frontOrg(where.id) } : null)) },
  challenge: { findUnique: vi.fn(async ({ where }: any) => (where.id in db.challenges ? { strategicFront: frontOrg(db.challenges[where.id]) } : null)) },
  challengeInvitation: { findUnique: vi.fn(async ({ where }: any) => (where.id in db.invitations ? { challengeId: db.invitations[where.id] } : null)) },
  challengeSquadMember: { findUnique: vi.fn(async () => null) },
  challengeTeamMember: { findUnique: vi.fn(async () => null) },
  executiveOutput: { findUnique: vi.fn(async ({ where }: any) => (where.id in db.outputs ? { challengeId: db.outputs[where.id] } : null)) },
  portfolioHandoffAssignment: { findUnique: vi.fn(async ({ where }: any) => db.assignments[where.id] ?? null) },
  project: {
    findUnique: vi.fn(async ({ where }: any) => {
      const p = db.projects[where.id];
      if (!p) return null;
      return {
        organizationId: p.organizationId,
        owner: { organizationId: db.users[p.owner] },
        portfolioMeta: p.challenge ? [{ challenge: { strategicFront: frontOrg(db.challenges[p.challenge]) } }] : [],
      };
    }),
  },
};

let currentUser: any = { id: 'lead-a', email: 'a@x.io', role: 'portfolio_lead' };

vi.mock('../../auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/auth.middleware')>();
  return { ...actual, authenticate: (req: any, _res: any, next: any) => { req.user = actual.buildRequestUser(currentUser); next(); } };
});
vi.mock('../../../shared/db/prisma', () => ({ default: fakePrisma, prisma: fakePrisma }));
vi.mock('../../billing/entitlement.middleware', () => ({ requireEntitlement: () => (_req: any, _res: any, next: any) => next() }));

const ok = vi.fn(async () => ({ ok: true }));
const sensitiveRead = vi.fn(async () => ({ email: 'tenant-b-secret@example.test' }));
vi.mock('../portfolio.service', () => ({
  PortfolioService: class {
    updateStrategicFront = ok; deleteStrategicFront = ok; createChallenge = ok; updateChallenge = ok; publishChallenge = ok;
    updateInvitation = ok; upsertInitiativeTeamMember = ok; upsertInitiativeMeta = ok; updateExecutiveOutput = ok;
    listChallengeTeam = sensitiveRead; resolveInitiativeTeam = sensitiveRead; listInitiativesForChallenge = sensitiveRead;
    getInitiativeMeta = sensitiveRead; listOverlaps = sensitiveRead; listExecutiveOutputs = sensitiveRead;
  },
}));

vi.mock('../challenge-coverage.read-service', () => ({
  ChallengeCoverageReadService: class { get = sensitiveRead; },
}));

const { portfolioRouter } = await import('../portfolio.router');
const { buildPortfolioHandoffDeliveryRouter } = await import('../../portfolio-handoff/portfolio-handoff-invitation.router');

const delivery = { sendHandoffInvitation: ok, revokeHandoffInvitation: ok } as any;

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/portfolio', portfolioRouter);
  a.use('/api/v1/portfolio/handoff', buildPortfolioHandoffDeliveryRouter(delivery, (async (req: any, _res: any, next: any) => { req.user = { ...currentUser, permissions: new Set(['portfolio:read', 'portfolio:write']), roles: [currentUser.role] }; next(); }) as any));
  a.use(errorHandler);
  return a;
}

describe('escrituras de portafolio por ID respetan la organización (F-03)', () => {
  beforeEach(() => {
    ok.mockClear();
    sensitiveRead.mockClear();
    currentUser = { id: 'lead-a', email: 'a@x.io', role: 'portfolio_lead' };
    delete writeGrants['lead-multi'];
  });

  const crossOrg: Array<[string, string, Record<string, unknown>]> = [
    ['patch', '/api/v1/portfolio/strategic-fronts/front-b', { name: 'x' }],
    ['delete', '/api/v1/portfolio/strategic-fronts/front-b', {}],
    ['post', '/api/v1/portfolio/strategic-fronts/front-b/challenges', { title: 'x' }],
    ['patch', '/api/v1/portfolio/challenges/ch-b', { title: 'x' }],
    ['post', '/api/v1/portfolio/challenges/ch-b/publish', {}],
    ['put', '/api/v1/portfolio/initiatives/p-b/meta', { challengeId: 'ch-b', status: 'en_step_1' }],
    ['put', '/api/v1/portfolio/initiatives/p-indep-b/team/u9', { role: 'EDITOR' }],
    ['patch', '/api/v1/portfolio/executive-outputs/out-b', { title: 'x' }],
    ['post', '/api/v1/portfolio/handoff/asg-b/invitation/revoke', {}],
  ];

  it.each(crossOrg)('lead de org-A → %s %s de org-B: 404 y no se ejecuta', async (method, url, body) => {
    const res = await (request(app()) as any)[method](url).send(body);
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe('PORTFOLIO_RESOURCE_NOT_FOUND');
    expect(ok).not.toHaveBeenCalled();
  });

  it('una invitación de org-B no se puede editar colgándola de un reto propio', async () => {
    const res = await request(app()).patch('/api/v1/portfolio/challenges/ch-a/invitations/inv-b').send({ status: 'accepted' });
    expect(res.status).toBe(404);
    expect(ok).not.toHaveBeenCalled();
  });

  it('sobre recursos de su organización sí puede escribir', async () => {
    expect((await request(app()).patch('/api/v1/portfolio/challenges/ch-a/invitations/inv-a').send({ status: 'accepted' })).status).not.toBe(404);
    expect((await request(app()).delete('/api/v1/portfolio/strategic-fronts/front-a')).status).toBe(200);
    expect(ok).toHaveBeenCalled();
  });

  it.each(['p-legacy-p12r1-http-org', 'p-legacy-p6-runtime-org'])(
    'un Project legacy %s sin organización canónica falla cerrado aunque owner o reto sugieran tenant',
    async (projectId) => {
      const res = await request(app()).put(`/api/v1/portfolio/initiatives/${projectId}/meta`).send({ challengeId: 'ch-a', status: 'en_step_1' });
      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe('PORTFOLIO_RESOURCE_NOT_FOUND');
      expect(ok).not.toHaveBeenCalled();
    },
  );

  it('un frente legacy sin organización falla cerrado', async () => {
    const res = await request(app()).delete('/api/v1/portfolio/strategic-fronts/front-legacy');
    expect(res.status).toBe(404);
    expect(ok).not.toHaveBeenCalled();
  });

  const crossOrgReads = [
    '/api/v1/portfolio/challenges/ch-b/team',
    '/api/v1/portfolio/initiatives/p-b/team',
    '/api/v1/portfolio/challenges/ch-b/initiatives',
    '/api/v1/portfolio/initiatives/p-b/meta',
    '/api/v1/portfolio/initiatives/p-b/governance',
    '/api/v1/portfolio/challenges/ch-b/coverage-reading',
    '/api/v1/portfolio/challenges/ch-b/overlaps',
    '/api/v1/portfolio/challenges/ch-b/executive-outputs',
  ];

  it.each(crossOrgReads)('lead de org-A no puede leer %s de org-B y no recibe PII', async (url) => {
    const res = await request(app()).get(url);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('tenant-b-secret@example.test');
    expect(sensitiveRead).not.toHaveBeenCalled();
  });

  it('lead de org-A conserva lectura de un reto propio', async () => {
    const res = await request(app()).get('/api/v1/portfolio/challenges/ch-a/team');
    expect(res.status).toBe(200);
    expect(sensitiveRead).toHaveBeenCalledOnce();
  });

  it('un ID inexistente responde igual que uno ajeno', async () => {
    const res = await request(app()).delete('/api/v1/portfolio/strategic-fronts/no-existe');
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe('PORTFOLIO_RESOURCE_NOT_FOUND');
  });

  it('el admin de plataforma puede escribir en cualquier organización', async () => {
    currentUser = { id: 'admin-1', email: 'adm@x.io', role: 'admin' };
    expect((await request(app()).delete('/api/v1/portfolio/strategic-fronts/front-b')).status).toBe(200);
  });

  it('una membresia secundaria no concede escritura sin grant target-scoped', async () => {
    currentUser = { id: 'lead-multi', email: 'multi@x.io', role: 'portfolio_lead' };
    const denied = await request(app()).delete('/api/v1/portfolio/strategic-fronts/front-b');
    expect(denied.status).toBe(404);
    expect(ok).not.toHaveBeenCalled();

    writeGrants['lead-multi'] = ['org-b'];
    const allowed = await request(app()).delete('/api/v1/portfolio/strategic-fronts/front-b');
    expect(allowed.status).toBe(200);
    expect(ok).toHaveBeenCalledOnce();
  });
});
