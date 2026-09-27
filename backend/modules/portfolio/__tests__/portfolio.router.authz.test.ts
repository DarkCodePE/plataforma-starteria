/**
 * portfolio.router.authz.test.ts — ADR-028.
 *
 * Fija el cambio de autorización de las escrituras de portafolio: pasan de
 * `admin` + `mentor` a `admin` + `portfolio_lead`.
 *
 * Prueba el CABLEADO, no `requireRole` (eso ya lo cubre auth.middleware.test.ts):
 * que la ruta real lleva el gate real. Por eso se mockea sólo `authenticate` y se
 * conserva el `requireRole` de verdad vía `importOriginal`.
 *
 * El 403 es la aserción que importa: antes de ADR-028 un portfolio lead lo recibía
 * en TODA su propia sección, porque su JWT decía `viewer`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../shared/errors/error-handler';
import type { Role } from '../../../shared/types';

// Usuario que inyecta el `authenticate` mockeado; cada test lo reasigna.
let currentUser: { id: string; email: string; role: Role } = {
  id: 'u-test',
  email: 'test@starteria.io',
  role: 'admin',
};

vi.mock('../../auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/auth.middleware')>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      // ADR-029: se construye con el MISMO helper que usa el middleware real, para
      // que el mock no mienta sobre la forma de req.user (roles + permissions).
      req.user = currentUser ? actual.buildRequestUser(currentUser) : currentUser;
      next();
    },
  };
});

vi.mock('../../../shared/db/prisma', () => ({ default: {}, prisma: {} }));

const upsertInitiativeMeta = vi.fn();
const listStrategicFronts = vi.fn();
const getHome = vi.fn();

vi.mock('../portfolio.service', () => ({
  PortfolioService: class {
    upsertInitiativeMeta = upsertInitiativeMeta;
    listStrategicFronts = listStrategicFronts;
  },
}));

vi.mock('../portfolio-home.read-service', () => ({
  PortfolioHomeReadService: class {
    getHome = getHome;
  },
}));

vi.mock('../../billing/entitlement.middleware', () => ({
  requireEntitlement: () => (_req: any, _res: any, next: any) => next(),
}));

const { portfolioRouter } = await import('../portfolio.router');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.requestId = 'req-authz-1';
    next();
  });
  app.use('/api/v1/portfolio', portfolioRouter);
  app.use(errorHandler);
  return app;
}

const META_BODY = { challengeId: 'ch-1', status: 'en_step_1' as const };

describe('portfolio.router — autorización de escrituras (ADR-028)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upsertInitiativeMeta.mockResolvedValue({ projectId: 'p-1' });
    listStrategicFronts.mockResolvedValue([]);
    getHome.mockResolvedValue({ strategicUnits: [], pendingDecisions: [] });
  });

  it('un portfolio_lead PUEDE escribir la meta de una iniciativa', async () => {
    currentUser = { id: 'u-pl', email: 'pl@starteria.io', role: 'portfolio_lead' };

    const res = await request(makeApp())
      .put('/api/v1/portfolio/initiatives/p-1/meta')
      .send(META_BODY);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(upsertInitiativeMeta).toHaveBeenCalledOnce();
  });

  it('un admin sigue pudiendo escribir', async () => {
    currentUser = { id: 'u-adm', email: 'adm@starteria.io', role: 'admin' };

    const res = await request(makeApp())
      .put('/api/v1/portfolio/initiatives/p-1/meta')
      .send(META_BODY);

    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it('un mentor YA NO puede escribir: pierde el acceso que tenía', async () => {
    currentUser = { id: 'u-men', email: 'men@starteria.io', role: 'mentor' };

    const res = await request(makeApp())
      .put('/api/v1/portfolio/initiatives/p-1/meta')
      .send(META_BODY);

    expect(res.status).toBe(403);
    expect(upsertInitiativeMeta).not.toHaveBeenCalled();
  });

  it('un participante tampoco puede escribir', async () => {
    currentUser = { id: 'u-par', email: 'par@starteria.io', role: 'participante' };

    const res = await request(makeApp())
      .put('/api/v1/portfolio/initiatives/p-1/meta')
      .send(META_BODY);

    expect(res.status).toBe(403);
  });

  it('las lecturas siguen abiertas a cualquier autenticado (deuda declarada)', async () => {
    // AppLayout llama a las lecturas de portafolio para TODO usuario autenticado,
    // así que cerrarlas rompería a los participantes. Se fija el comportamiento
    // actual para que cerrarlas sea una decisión explícita, no un descuido.
    currentUser = { id: 'u-par', email: 'par@starteria.io', role: 'participante' };

    const res = await request(makeApp()).get('/api/v1/portfolio/strategic-fronts');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it('expone Portfolio Home como lectura autenticada sin permiso de escritura', async () => {
    currentUser = { id: 'u-par', email: 'par@starteria.io', role: 'participante' };

    const res = await request(makeApp()).get('/api/v1/portfolio/home');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(getHome).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: 'u-par' }),
      { status: 'no_context' },
    );
  });

  it('rechaza un intento explícito de imponer una organización desde la petición', async () => {
    currentUser = { id: 'u-par', email: 'par@starteria.io', role: 'participante' };

    const res = await request(makeApp()).get('/api/v1/portfolio/home?organizationId=other-org');

    expect(res.status).toBe(403);
    expect(getHome).not.toHaveBeenCalled();
  });
});
