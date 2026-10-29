import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z, ZodError } from 'zod/v3';
import { validate } from '../validate';

/**
 * Unit tests for the `validate` middleware.
 *
 * Strategy: mount a real express app with the middleware under test and a
 * trivial handler. We avoid the central error handler — instead we register
 * an inline error sink that converts any error to a JSON response so the
 * tests can assert on `result.success === false`.
 */
function appWith(schema: z.ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  const app = express();
  app.use(express.json());
  app.post(
    '/echo/:id?',
    validate(schema, target),
    (req, res) => {
      res.json({ ok: true, data: (req as any)[target] });
    },
  );
  // Lightweight error sink — in real app this would be the central errorHandler.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ ok: false, kind: 'zod', issues: err.errors });
      return;
    }
    res.status(500).json({ ok: false, kind: 'unknown' });
  });
  return app;
}

describe('shared/middleware/validate', () => {
  it('lets a valid body through and exposes the parsed value on req', async () => {
    const schema = z.object({
      name: z.string().min(2).transform((v) => v.trim()),
      age: z.number().int().positive(),
    });
    const res = await request(appWith(schema))
      .post('/echo')
      .send({ name: '  Alice  ', age: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { name: 'Alice', age: 30 } });
  });

  it('forwards a ZodError to the next handler when validation fails', async () => {
    const schema = z.object({ email: z.string().email() });
    const res = await request(appWith(schema))
      .post('/echo')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.kind).toBe('zod');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('validates query strings when target=query', async () => {
    const schema = z.object({ page: z.coerce.number().int().min(1) });
    const res = await request(appWith(schema, 'query')).post('/echo').query({ page: '3' });

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(3);
  });

  it('validates params when target=params', async () => {
    const schema = z.object({ id: z.string().regex(/^c[a-z0-9]+$/i) });
    const res = await request(appWith(schema, 'params')).post('/echo/cabc12345');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('cabc12345');
  });

  it('does not call next twice on a successful validation', () => {
    // Direct invocation to verify behaviour without an http roundtrip
    const schema = z.object({ x: z.number() });
    const next = vi.fn();
    const req = { body: { x: 1 } } as unknown as express.Request;
    const res = {} as express.Response;
    validate(schema, 'body')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error arg
  });
});
