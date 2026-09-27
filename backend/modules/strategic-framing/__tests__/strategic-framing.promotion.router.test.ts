import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../../shared/errors/error-handler';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { buildStrategicFramingRouter } from '../strategic-framing.router';

const { userLookup } = vi.hoisted(() => ({ userLookup: vi.fn() }));
vi.mock('../../../shared/db/prisma', () => ({ prisma: { user: { findUnique: userLookup } } }));

const service = { getCurrent: vi.fn() };
const promotionService = { promote: vi.fn() };
let currentUser: any;
const authenticate: RequestHandler = (req: any, _res, next) => { if (currentUser) req.user = currentUser; next(); };

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/strategic-framing', buildStrategicFramingRouter({ authenticate, service: service as any, promotionService: promotionService as any }));
  app.use(errorHandler);
  return app;
}

const persistedResult = {
  retry: false,
  promotion: {
    id: 'promotion-1', challengeCandidateId: 'candidate-1', strategicFrontId: 'front-1', challengeId: 'challenge-1',
    inputFingerprint: 'secret-fingerprint', candidateSnapshot: { secret: true }, promotionInputSnapshot: { secret: true },
  },
  challenge: { id: 'challenge-1', title: 'Canonical challenge', status: 'draft', actorUserId: 'secret-actor' },
};

describe('SF-6D.1 promotion response contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = { id: 'user-1', roles: ['portfolio_lead'], permissions: permissionsForRoles(['portfolio_lead']) };
    userLookup.mockResolvedValue({ id: 'user-1', organizationId: 'org-1' });
    promotionService.promote.mockResolvedValue(persistedResult);
  });

  it.each([false, true])('returns the same minimal public shape for retry=%s', async (retry) => {
    promotionService.promote.mockResolvedValue({ ...persistedResult, retry });
    const response = await request(makeApp()).post('/api/v1/strategic-framing/states/state-1/promotions').send({
      challengeCandidateId: 'candidate-1', expectedVersion: 1, strategicFrontId: 'front-1', title: 'Canonical challenge', statement: 'Statement', type: 'crecimiento',
    }).expect(retry ? 200 : 201);
    expect(response.body).toEqual({ success: true, data: {
      promotionId: 'promotion-1', challengeCandidateId: 'candidate-1', challengeId: 'challenge-1', challengeTitle: 'Canonical challenge', strategicFrontId: 'front-1', challengeStatus: 'draft', retry,
    } });
    expect(response.body.data).not.toHaveProperty('id');
    expect(response.body.data).not.toHaveProperty('inputFingerprint');
    expect(response.body.data).not.toHaveProperty('candidateSnapshot');
    expect(response.body.data).not.toHaveProperty('promotionInputSnapshot');
  });

  it('preserves authenticated scope and rejects unauthenticated promotion', async () => {
    currentUser = null;
    await request(makeApp()).post('/api/v1/strategic-framing/states/state-1/promotions').send({}).expect(401);
    expect(promotionService.promote).not.toHaveBeenCalled();
    currentUser = { id: 'user-1', roles: ['portfolio_lead'], permissions: permissionsForRoles(['portfolio_lead']) };
    await request(makeApp()).post('/api/v1/strategic-framing/states/state-1/promotions').send({
      challengeCandidateId: 'candidate-1', expectedVersion: 1, strategicFrontId: 'front-1', title: 'Canonical challenge', statement: 'Statement', type: 'crecimiento',
    }).expect(201);
    expect(promotionService.promote).toHaveBeenCalledWith(expect.objectContaining({
      stateId: 'state-1', actor: { id: 'user-1', roles: ['portfolio_lead'], permissions: expect.any(Set) },
    }));
  });
});
