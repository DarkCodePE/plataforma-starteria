import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { buildPortfolioHandoffOwnerContinuityRouter } from '../portfolio-handoff-owner-continuity.router';

const auth: RequestHandler = (req, _res, next) => {
  req.user = { id: 'owner-user', email: 'owner@starteria.test', name: 'Owner', initials: 'OW', skills: [], role: 'colaborador' };
  next();
};

function appFor(resolve: ReturnType<typeof vi.fn>) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/handoff/assignments', buildPortfolioHandoffOwnerContinuityRouter({ resolve }, auth));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const appError = error instanceof AppError ? error : AppError.internal();
    res.status(appError.statusCode).json({ success: false, error: { code: appError.code, message: appError.message } });
  };
  app.use(errors);
  return app;
}

describe('KAN-178 owner continuity HTTP contract', () => {
  it('returns the resolver projection for the authenticated identity', async () => {
    const resolve = vi.fn().mockResolvedValue({
      outcome: 'CHALLENGE_FORMULATION_REQUIRED', assignmentId: 'assignment-1', targetKind: 'CHALLENGE',
      challengeId: 'challenge-1', challenge: { id: 'challenge-1', title: 'Reto' }, initiativeId: null,
      contextNote: null, briefVersion: null, handoffState: 'STARTED',
    });
    const response = await request(appFor(resolve)).get('/api/v1/handoff/assignments/assignment-1/post-start-continuity');

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ outcome: 'CHALLENGE_FORMULATION_REQUIRED', assignmentId: 'assignment-1' });
    expect(resolve).toHaveBeenCalledWith('assignment-1', { id: 'owner-user', email: 'owner@starteria.test' });
  });

  it('maps every internal denial reason to one non-enumerating 403 contract', async () => {
    const resolve = vi.fn().mockResolvedValue({ outcome: 'ACCESS_DENIED', assignmentId: 'assignment-1', reason: 'IDENTITY_MISMATCH' });
    const response = await request(appFor(resolve)).get('/api/v1/handoff/assignments/assignment-1/post-start-continuity');

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: 'OWNER_CONTINUITY_ACCESS_DENIED' });
    expect(JSON.stringify(response.body)).not.toContain('IDENTITY_MISMATCH');
  });
});

