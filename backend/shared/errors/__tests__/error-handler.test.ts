import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z, ZodError } from 'zod/v3';
import { AppError } from '../AppError';
import { errorHandler } from '../error-handler';
import { requestId } from '../../middleware/request-id';

/**
 * Tests for the central errorHandler — the canonical Error Envelope V1
 * serializer (ADR-010). Critical contract: every non-success response
 * goes through this function.
 */

// Silence pino logger during tests — it imports config which needs no mocking,
// but the logger.error call would emit to stdout otherwise.
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeApp(thrower: (req: express.Request) => unknown) {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.get('/boom', (req, _res, next) => {
    next(thrower(req));
  });
  app.use(errorHandler);
  return app;
}

describe('shared/errors/error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serialises an AppError using the V1 envelope', async () => {
    const app = makeApp(() => AppError.badRequest('Algo malo', 'BAD_THING'));
    const res = await request(app).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: expect.objectContaining({
        code: 'BAD_THING',
        message: 'Algo malo',
        requestId: expect.any(String),
      }),
    });
  });

  it('emits a Retry-After header when AppError carries retryAfterSeconds', async () => {
    const app = makeApp(() => AppError.rateLimited(42));
    const res = await request(app).get('/boom');

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('42');
    expect(res.body.error.code).toBe('AUTH_RATE_LIMITED');
    expect(res.body.error.retryAfterSeconds).toBe(42);
  });

  it('omits undefined optional fields from the envelope', async () => {
    const app = makeApp(() => AppError.unauthorized());
    const res = await request(app).get('/boom');

    expect(res.body.error).not.toHaveProperty('field');
    expect(res.body.error).not.toHaveProperty('details');
    expect(res.body.error).not.toHaveProperty('retryAfterSeconds');
  });

  it('falls back to INTERNAL_ERROR code when AppError has no code', async () => {
    const app = makeApp(() => new AppError(400, 'something', undefined as unknown as string));
    const res = await request(app).get('/boom');
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('converts ZodError into a VALIDATION_ERROR envelope with details', async () => {
    const schema = z.object({ email: z.string().email('Correo electronico invalido') });
    const app = makeApp(() => {
      const result = schema.safeParse({ email: 'no' });
      return (result as any).error as ZodError;
    });
    const res = await request(app).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([
      expect.objectContaining({ field: 'email', code: 'AUTH_EMAIL_INVALID' }),
    ]);
  });

  it('maps password too_small Zod issue to AUTH_PASSWORD_TOO_SHORT', async () => {
    const schema = z.object({ password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres') });
    const app = makeApp(() => (schema.safeParse({ password: 'a' }) as any).error);
    const res = await request(app).get('/boom');

    expect(res.body.error.details[0]).toEqual(
      expect.objectContaining({ field: 'password', code: 'AUTH_PASSWORD_TOO_SHORT' }),
    );
  });

  it('maps password regex (mayuscula) to AUTH_PASSWORD_NO_UPPER', async () => {
    const schema = z.object({
      password: z
        .string()
        .min(8, 'La contrasena debe tener al menos 8 caracteres')
        .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
        .regex(/[a-z]/, 'Debe contener al menos una minuscula')
        .regex(/[0-9]/, 'Debe contener al menos un numero'),
    });
    const app = makeApp(() => (schema.safeParse({ password: 'lowercase1' }) as any).error);
    const res = await request(app).get('/boom');
    expect(res.body.error.details[0].code).toBe('AUTH_PASSWORD_NO_UPPER');
  });

  it('maps password regex (minuscula) to AUTH_PASSWORD_NO_LOWER', async () => {
    const schema = z.object({
      password: z
        .string()
        .regex(/[a-z]/, 'Debe contener al menos una minuscula'),
    });
    const app = makeApp(() => (schema.safeParse({ password: 'UPPER123' }) as any).error);
    const res = await request(app).get('/boom');
    expect(res.body.error.details[0].code).toBe('AUTH_PASSWORD_NO_LOWER');
  });

  it('maps password regex (numero) to AUTH_PASSWORD_NO_DIGIT', async () => {
    const schema = z.object({
      password: z.string().regex(/[0-9]/, 'Debe contener al menos un numero'),
    });
    const app = makeApp(() => (schema.safeParse({ password: 'NoDigitsHere' }) as any).error);
    const res = await request(app).get('/boom');
    expect(res.body.error.details[0].code).toBe('AUTH_PASSWORD_NO_DIGIT');
  });

  it('maps name too_small to AUTH_NAME_TOO_SHORT', async () => {
    const schema = z.object({ name: z.string().min(2, 'corto') });
    const app = makeApp(() => (schema.safeParse({ name: 'a' }) as any).error);
    const res = await request(app).get('/boom');
    expect(res.body.error.details[0].code).toBe('AUTH_NAME_TOO_SHORT');
  });

  it('maps name too_big to AUTH_NAME_TOO_LONG', async () => {
    const schema = z.object({ name: z.string().max(3, 'largo') });
    const app = makeApp(() => (schema.safeParse({ name: 'aaaaa' }) as any).error);
    const res = await request(app).get('/boom');
    expect(res.body.error.details[0].code).toBe('AUTH_NAME_TOO_LONG');
  });

  it('falls back to VALIDATION_FIELD_INVALID for unmapped issues', async () => {
    const schema = z.object({ count: z.number().min(1, 'must be >=1') });
    const app = makeApp(() => (schema.safeParse({ count: 0 }) as any).error);
    const res = await request(app).get('/boom');
    expect(res.body.error.details[0].code).toBe('VALIDATION_FIELD_INVALID');
  });

  it('serialises an unknown Error as a 500 INTERNAL_ERROR', async () => {
    const app = makeApp(() => new Error('boom'));
    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: expect.objectContaining({
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
        requestId: expect.any(String),
      }),
    });
  });

  it('falls back to req.id when req.requestId is unset (integration with non-standard middleware)', async () => {
    const app = express();
    app.get('/boom', (req, _res, next) => {
      (req as any).id = 'legacy-id-1';
      next(AppError.badRequest('x', 'X'));
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.body.error.requestId).toBe('legacy-id-1');
  });
});
