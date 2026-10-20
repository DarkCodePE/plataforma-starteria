import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildPortfolioHandoffResponseRouter } from '../portfolio-handoff-invitation.router';

describe('Route B reconstruction endpoint', () => {
  it('passes the authenticated actor and assignment to the read-only reconstruction service', async () => {
    const readExistingInitiative = vi.fn(async () => ({
      assignmentId: 'handoff-1', initiativeId: 'project-1', continuityState: 'CONTINUITY_REVIEW_REQUIRED',
      currentGovernedState: null, recovered: { sourceRefs: 0, evidence: 0, claims: 0, snapshots: 0, outputs: 0, events: 0 }, gaps: [],
    }));
    const auth: any = (req: any, _res: any, next: any) => {
      req.user = { id: 'owner-1', role: 'owner', email: 'owner@example.com' };
      next();
    };
    const app = express();
    app.use('/handoff/assignments', buildPortfolioHandoffResponseRouter({} as any, auth, (() => (_req: any, _res: any, next: any) => next()) as any, { readExistingInitiative } as any));

    const response = await request(app).get('/handoff/assignments/handoff-1/reconstruction').expect(200);

    expect(readExistingInitiative).toHaveBeenCalledWith({ assignmentId: 'handoff-1', actor: { id: 'owner-1', role: 'owner' } });
    expect(response.body).toMatchObject({ success: true, data: { initiativeId: 'project-1', continuityState: 'CONTINUITY_REVIEW_REQUIRED' } });
  });
});
