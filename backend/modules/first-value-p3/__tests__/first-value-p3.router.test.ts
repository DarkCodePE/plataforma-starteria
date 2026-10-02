import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildRequestUser } from '../../auth/auth.middleware';
import { errorHandler } from '../../../shared/errors/error-handler';
import { buildFirstValueP3Router } from '../first-value-p3.router';
import type { FirstValueP3Service } from '../first-value-p3.service';

const body = {
  sessionId: 'session-1', requestId: 'request-1', p2Confirmed: true,
  goal: 'Increase sales', initiatives: [{ itemId: 'item-1', name: 'Outreach' }],
};

function appFor(role?: 'portfolio_lead' | 'participante') {
  const app = express();
  app.use(express.json());
  const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!role) { res.status(401).json({ code: 'UNAUTHORIZED' }); return; }
    req.user = buildRequestUser({ id: 'user-1', email: 'test@example.test', role });
    next();
  };
  const service = { analyze: vi.fn(async () => ({ resultState: 'PROVISIONAL' })) } as unknown as FirstValueP3Service;
  app.use('/api/v1', buildFirstValueP3Router({ ...(role ? { authenticate: auth } : {}), service }));
  app.use(errorHandler);
  return { app, service };
}

describe('First Value P3 route authorization', () => {
  it('rejects unauthenticated callers before processing', async () => {
    const { app, service } = appFor();
    const response = await request(app).post('/api/v1/first-value/p3/analyze').send(body);
    expect(response.status).toBe(401);
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it('denies an authenticated caller without Portfolio Lead read scope', async () => {
    const { app, service } = appFor('participante');
    const response = await request(app).post('/api/v1/first-value/p3/analyze').send(body);
    expect(response.status).toBe(403);
    expect(service.analyze).not.toHaveBeenCalled();
  });

  it('allows an authorized Portfolio Lead to process', async () => {
    const { app, service } = appFor('portfolio_lead');
    const response = await request(app).post('/api/v1/first-value/p3/analyze').send(body);
    expect(response.status).toBe(200);
    expect(service.analyze).toHaveBeenCalledOnce();
  });

});
