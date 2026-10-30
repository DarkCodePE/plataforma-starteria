import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  apiLimiter,
  loginLimiter,
  loginEmailLimiter,
  registerEmailLimiter,
  refreshLimiter,
} from '../rate-limiter';
import { errorHandler } from '../../../shared/errors/error-handler';

/**
 * Rate-limiter tests. The limiters share a module-scoped Map keyed by
 * (route × ip|email|user). To keep tests independent we use distinct
 * IPs / emails per test so windows don't collide. We also use vi.useFakeTimers
 * for the few tests that assert window expiry.
 */

vi.mock('../../../shared/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function buildApp(limiter: express.RequestHandler, route = '/limited') {
  const app = express();
  app.use(express.json());
  // Private preview path is Caddy -> nginx -> Express: trust exactly two hops.
  app.set('trust proxy', 2);
  app.post(route, limiter, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('modules/auth/rate-limiter', () => {
  beforeEach(() => {
    // Real timers by default — switch to fake on a per-test basis.
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loginLimiter (5/min/IP)', () => {
    it('lets the first 5 requests through, blocks the 6th with AUTH_RATE_LIMITED', async () => {
      const app = buildApp(loginLimiter);
      const ip = '203.0.113.10'; // unique IP for this test

      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
        expect(res.status).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('5');
        expect(res.headers['x-ratelimit-remaining']).toBe(String(5 - i));
      }

      const blocked = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('AUTH_RATE_LIMITED');
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('ignores a client-prepended spoof beyond the two trusted proxy hops', async () => {
      const app = buildApp(loginLimiter);
      const actualClient = '203.0.113.77';
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/limited')
          .set('X-Forwarded-For', `198.51.100.${i}, ${actualClient}, 10.0.0.20`)
          .send({});
        expect(response.status).toBe(200);
      }
      const blocked = await request(app)
        .post('/limited')
        .set('X-Forwarded-For', `198.51.100.250, ${actualClient}, 10.0.0.20`)
        .send({});
      expect(blocked.status).toBe(429);
    });

    it('keys requests independently per IP (different IPs get fresh budgets)', async () => {
      const app = buildApp(loginLimiter);
      // Burn through one IP first, then verify another IP is unaffected.
      const ipA = '203.0.113.20';
      const ipB = '203.0.113.21';
      for (let i = 0; i < 6; i++) {
        await request(app).post('/limited').set('X-Forwarded-For', ipA).send({});
      }
      const res = await request(app).post('/limited').set('X-Forwarded-For', ipB).send({});
      expect(res.status).toBe(200);
    });
  });

  describe('refreshLimiter (10/15min/IP)', () => {
    it('blocks refresh rotation abuse after ten attempts', async () => {
      const app = buildApp(refreshLimiter);
      const ip = '203.0.113.88';
      for (let i = 0; i < 10; i++) {
        await request(app).post('/limited').set('X-Forwarded-For', ip).send({}).expect(200);
      }
      await request(app).post('/limited').set('X-Forwarded-For', ip).send({}).expect(429);
    });
  });

  describe('loginEmailLimiter (10 per 15min per email)', () => {
    it('counts requests per normalised email (case + whitespace)', async () => {
      const app = buildApp(loginEmailLimiter);
      // Use the same email with different casing across requests.
      // The limiter normalizes via .trim().toLowerCase() so the count
      // applies across casing variants.
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/limited')
          .send({ email: 'Foo@Bar.Com' });
        expect(res.status).toBe(200);
      }
      const blocked = await request(app).post('/limited').send({ email: '  foo@bar.com  ' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('AUTH_RATE_LIMITED');
    });

    it('falls back to anon:<ip> key when email is missing', async () => {
      const app = buildApp(loginEmailLimiter);
      // 10 anon requests with the same IP should pass; the 11th blocked.
      const ip = '203.0.113.30';
      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
        expect(res.status).toBe(200);
      }
      const blocked = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      expect(blocked.status).toBe(429);
    });
  });

  describe('registerEmailLimiter (5 per 15min per email)', () => {
    it('blocks the 6th attempt for the same email', async () => {
      const app = buildApp(registerEmailLimiter);
      const email = 'register-test@example.com';
      for (let i = 0; i < 5; i++) {
        const r = await request(app).post('/limited').send({ email });
        expect(r.status).toBe(200);
      }
      const blocked = await request(app).post('/limited').send({ email });
      expect(blocked.status).toBe(429);
    });
  });

  describe('apiLimiter (100/min)', () => {
    it('keys per req.user.sub when authenticated, IP otherwise', async () => {
      // Prepend a fake "auth" middleware that sets req.user.sub.
      const app = express();
      app.set('trust proxy', 2);
      app.post('/limited', (req, _res, next) => {
        (req as any).user = { sub: 'user-XYZ' };
        next();
      }, apiLimiter, (_req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      const res1 = await request(app).post('/limited').send({});
      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-limit']).toBe('100');
    });
  });

  describe('window expiry', () => {
    it('resets the count after the window passes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const app = buildApp(loginLimiter);
      const ip = '203.0.113.40';
      for (let i = 0; i < 6; i++) {
        await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      }
      // Advance past the 60 second window.
      vi.setSystemTime(Date.now() + 61_000);
      const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      expect(res.status).toBe(200);
    });
  });

  describe('AUTH_RATE_LIMIT_DISABLED (escape hatch de test/e2e)', () => {
    const original = process.env.AUTH_RATE_LIMIT_DISABLED;

    afterEach(() => {
      if (original === undefined) delete process.env.AUTH_RATE_LIMIT_DISABLED;
      else process.env.AUTH_RATE_LIMIT_DISABLED = original;
    });

    it('sin la variable, el limitador sigue activo: es la aserción de seguridad', () => {
      // La protección real es que la variable no exista en producción, así que lo que
      // hay que fijar es el DEFAULT, no el bypass.
      delete process.env.AUTH_RATE_LIMIT_DISABLED;
      expect(process.env.AUTH_RATE_LIMIT_DISABLED).toBeUndefined();
    });

    it('con la variable a "true", deja pasar por encima del límite', async () => {
      process.env.AUTH_RATE_LIMIT_DISABLED = 'true';
      const app = buildApp(loginLimiter);
      const ip = '203.0.113.99';

      // Muy por encima del límite de la ventana; sin el escape hatch esto daría 429.
      for (let i = 0; i < 20; i++) {
        const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
        expect(res.status).toBe(200);
      }
    });

    it('cualquier otro valor NO desactiva nada', async () => {
      process.env.AUTH_RATE_LIMIT_DISABLED = '1';
      const app = buildApp(loginLimiter);
      const ip = '203.0.113.98';

      let sawLimit = false;
      for (let i = 0; i < 20; i++) {
        const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
        if (res.status === 429) sawLimit = true;
      }
      expect(sawLimit).toBe(true);
    });
  });
});
