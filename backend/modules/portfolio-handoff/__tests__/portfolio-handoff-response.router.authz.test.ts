import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { AppError } from '../../../shared/errors/AppError';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildPortfolioHandoffResponseRouter } from '../portfolio-handoff-invitation.router';

vi.mock('../../../shared/db/prisma', () => ({ prisma: {}, default: {} }));

const recordPortfolioRejectionResponse = vi.fn(async () => ({ id: 'asg-a', state: 'REJECTED' }));
const service = {
  recordPortfolioRejectionResponse,
  acceptHandoffAssignment: vi.fn(),
  rejectHandoffAssignment: vi.fn(),
  startAssignedWork: vi.fn(),
} as any;

const auth: RequestHandler = (req, _res, next) => {
  req.user = {
    id: 'lead-a',
    email: 'lead-a@example.test',
    role: 'portfolio_lead',
    roles: ['portfolio_lead'],
    permissions: new Set(['portfolio:read', 'portfolio:write']),
  };
  next();
};
const write: RequestHandler = (_req, _res, next) => next();
const owns: RequestHandler = (req, _res, next) => {
  if (req.params.assignmentId !== 'asg-a') {
    next(AppError.notFound('Recurso de portafolio', 'PORTFOLIO_RESOURCE_NOT_FOUND'));
    return;
  }
  next();
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v1/handoff/assignments', buildPortfolioHandoffResponseRouter(service, auth, write, owns));
  instance.use(errorHandler);
  return instance;
}

describe('Portfolio Handoff rejection-response tenant authorization', () => {
  it('lead de org-A no responde una Assignment conocida de org-B', async () => {
    recordPortfolioRejectionResponse.mockClear();
    const res = await request(app())
      .post('/api/v1/handoff/assignments/asg-b/rejection-response')
      .set('Idempotency-Key', 'cross-org')
      .send({ response: 'No debe escribirse' });

    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe('PORTFOLIO_RESOURCE_NOT_FOUND');
    expect(recordPortfolioRejectionResponse).not.toHaveBeenCalled();
  });

  it('lead autorizado conserva la respuesta sobre su Assignment', async () => {
    recordPortfolioRejectionResponse.mockClear();
    const res = await request(app())
      .post('/api/v1/handoff/assignments/asg-a/rejection-response')
      .set('Idempotency-Key', 'own-assignment')
      .send({ response: 'Revisaremos el alcance' });

    expect(res.status).toBe(200);
    expect(recordPortfolioRejectionResponse).toHaveBeenCalledOnce();
  });
});
