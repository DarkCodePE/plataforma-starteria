import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * auth.middleware tests cover the parts that DO NOT depend on Prisma:
 *   - authenticate()    — JWT verification + user attachment
 *   - requireRole()     — role gate (synchronous)
 *
 * requireProjectAccess and requireTransitionAuth load Prisma models and
 * are integration-test territory; we leave those to a later F1+ step
 * when DB fixtures are in place.
 *
 * We intentionally reuse the JWT secret that backend/config landed on at
 * import time so signing and verification share the same key.
 */

// Mock the prisma db module — auth.middleware imports it at the top
// even if the Prisma-dependent functions are not exercised.
vi.mock('../../../shared/db/prisma', () => ({
  prisma: {
    project: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

// Avoid the noisy pino transport during tests.
vi.mock('../../../shared/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { authenticate, requireRole } from '../auth.middleware';
import { generateAccessToken } from '../token.service';
import { errorHandler } from '../../../shared/errors/error-handler';

function makeApp(...handlers: express.RequestHandler[]) {
  const app = express();
  app.use(express.json());
  app.get('/me', ...handlers, (req, res) => {
    res.json({ user: (req as any).user });
  });
  app.use(errorHandler);
  return app;
}

describe('modules/auth/auth.middleware — authenticate', () => {
  it('rejects requests with no Authorization header (401 UNAUTHORIZED)', async () => {
    const app = makeApp(authenticate);
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with a non-Bearer Authorization header', async () => {
    const app = makeApp(authenticate);
    const res = await request(app).get('/me').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with a malformed Bearer token (TOKEN_INVALID)', async () => {
    const app = makeApp(authenticate);
    const res = await request(app).get('/me').set('Authorization', 'Bearer not.a.real.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('attaches user info to req when token is valid', async () => {
    const app = makeApp(authenticate);
    const token = generateAccessToken({
      sub: 'user-1',
      email: 'a@b.com',
      role: 'participante',
      cohort: '2026-Q1',
      sid: 'family-1',
    });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 'user-1',
      email: 'a@b.com',
      role: 'participante',
      cohort: '2026-Q1',
      authSessionId: 'family-1',
    });
  });

  it('does not invent a session identity for a legacy token without sid', async () => {
    const app = makeApp(authenticate);
    const token = generateAccessToken({
      sub: 'legacy-user',
      email: 'legacy@example.com',
      role: 'participante',
    });

    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Auth-Session-Id', 'client-supplied');

    expect(res.status).toBe(200);
    expect(res.body.user.authSessionId).toBeUndefined();
  });
});

describe('modules/auth/auth.middleware — requireRole', () => {
  it('emits UNAUTHORIZED when used without authenticate (no req.user)', async () => {
    const app = makeApp(requireRole('admin'));
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('emits FORBIDDEN when user role does not match', async () => {
    const app = makeApp(
      authenticate,
      requireRole('admin'),
    );
    const token = generateAccessToken({
      sub: 'u',
      email: 'a@b.com',
      role: 'participante',
    });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('passes when user role is in allowed list', async () => {
    const app = makeApp(
      authenticate,
      requireRole('admin', 'mentor'),
    );
    const token = generateAccessToken({
      sub: 'u',
      email: 'a@b.com',
      role: 'mentor',
    });
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('mentor');
  });
});
