import { describe, expect, it, vi } from 'vitest';
import { permissionsForRoles } from '../../../shared/authz/permissions';
import { PortfolioBootstrapGoalTurnService } from '../portfolio-bootstrap-goal-turn.service';

const lead = permissionsForRoles(['portfolio_lead']);
const makeBody = (overrides: Record<string, unknown> = {}) => ({
  expectedVersion: 0, expectedAnchorVersion: 1, expectedContextReviewVersion: 3,
  questionId: 'goal-preview-anchor-1-v1-outcomeStatement',
  inputText: 'Queremos validar la demanda de pedidos a oficinas.',
  disposition: 'user_declared',
  supersedesTurnId: null,
  ...overrides,
});

function harness() {
  let turns: any[] = [];
  const session = {
    id: 'bs-1', userId: 'owner-1', organizationId: 'org-1',
    anchor: {
      id: 'anchor-1', version: 1, status: 'anchor_insufficient',
      outcomeStatement: 'Resultado de negocio por definir', contextSummary: null,
      decisionToEnable: null, businessSignalStatus: 'unknown',
      businessSignalValue: null, sourceRefs: [],
    },
    contextReview: {
      id: 'review-1', version: 3, status: 'confirmed',
      confirmedSnapshotJson: { situation: { value: 'Cafetería de cuatro personas sin pedidos a oficinas.' } },
    },
  };
  const mock = {
    portfolioBootstrapSession: {
      findFirst: vi.fn(async ({ where }: any) =>
        where.id === session.id && where.userId === session.userId ? session : null),
    },
    portfolioBootstrapGoalTurn: {
      findUnique: vi.fn(async ({ where }: any) =>
        turns.find((t) => t.bootstrapSessionId === where.bootstrapSessionId_idempotencyKeyHash.bootstrapSessionId
          && t.idempotencyKeyHash === where.bootstrapSessionId_idempotencyKeyHash.idempotencyKeyHash) ?? null),
      findFirst: vi.fn(async ({ where, select }: any) => {
        const latest = turns.filter((t) => t.bootstrapSessionId === where.bootstrapSessionId
          && (!where.questionId || t.questionId === where.questionId)).at(-1) ?? null;
        return latest && select ? { turnVersion: latest.turnVersion } : latest;
      }),
      findMany: vi.fn(async () => [...turns]),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, id: `turn-${turns.length + 1}`, createdAt: new Date('2026-11-09T00:00:00.000Z') };
        turns.push(row); return row;
      }),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  const prisma = { ...mock, $transaction: vi.fn((fn: any) => fn(mock)) };
  return { service: new PortfolioBootstrapGoalTurnService(prisma as any), mock, prisma, session };
}

const access = { sessionId: 'bs-1', authenticatedUserId: 'owner-1', permissions: lead };

describe('KAN-253 B2 provisional durable goal turns', () => {
  it('records a literal answer with anchored evidence but does not write the Anchor', async () => {
    const h = harness();
    const result = await h.service.appendTurn({
      ...access, idempotencyKey: 'first-response', body: makeBody() as any,
    });
    expect(result).toMatchObject({
      version: 1,
      turn: {
        sessionId: 'bs-1', version: 1, anchorVersion: 1, contextReviewVersion: 3,
        field: 'outcomeStatement', disposition: 'user_declared',
        evidence: [{ kind: 'user_input', quote: 'Queremos validar la demanda de pedidos a oficinas.', status: 'provisional' }],
      },
    });
    expect(h.mock.portfolioBootstrapGoalTurn.create).toHaveBeenCalledOnce();
    expect(h.mock.auditLog.create).toHaveBeenCalledOnce();
    expect(h.session.anchor.status).toBe('anchor_insufficient');
    expect(await h.service.getTurns(access)).toMatchObject({ version: 1, turns: [result.turn] });
  });

  it('replays the exact committed receipt, even with a stale expectedVersion', async () => {
    const h = harness();
    const input = { ...access, idempotencyKey: 'same-intent', body: makeBody() as any };
    const first = await h.service.appendTurn(input);
    const second = await h.service.appendTurn(input);
    expect(second).toEqual(first);
    expect(h.mock.portfolioBootstrapGoalTurn.create).toHaveBeenCalledTimes(1);
  });

  it('rejects idempotency collision with altered data', async () => {
    const h = harness();
    await h.service.appendTurn({ ...access, idempotencyKey: 'stable', body: makeBody() as any });
    await expect(h.service.appendTurn({
      ...access, idempotencyKey: 'stable', body: makeBody({ inputText: 'Otro relato' }) as any,
    })).rejects.toMatchObject({ statusCode: 409, code: 'PORTFOLIO_GOAL_IDEMPOTENCY_CONFLICT' });
  });

  it('requires CAS version and an explicit supersedesTurnId before correction', async () => {
    const h = harness();
    const first = await h.service.appendTurn({ ...access, idempotencyKey: 'q1', body: makeBody() as any });
    await expect(h.service.appendTurn({ ...access, idempotencyKey: 'q2',
      body: makeBody({ expectedVersion: 0 }) as any,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_GOAL_TURN_VERSION_CONFLICT' });
    await expect(h.service.appendTurn({ ...access, idempotencyKey: 'q3',
      body: makeBody({ expectedVersion: 1 }) as any,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_GOAL_CORRECTION_REQUIRED' });
    const corrected = await h.service.appendTurn({ ...access, idempotencyKey: 'q4',
      body: makeBody({
        expectedVersion: 1, supersedesTurnId: first.turn.id,
        disposition: 'unknown', inputText: 'No lo sé todavía.',
      }) as any,
    });
    expect(corrected.turn.supersedesTurnId).toBe(first.turn.id);
    expect(corrected.turn.version).toBe(2);
    expect(h.session.anchor.outcomeStatement).toBe('Resultado de negocio por definir');
  });

  it('rejects stale E1/Anchor and locked Anchor, never promoting a goal', async () => {
    const h = harness();
    await expect(h.service.appendTurn({ ...access, idempotencyKey: 'v-context',
      body: makeBody({ expectedContextReviewVersion: 2 }) as any,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_GOAL_CONTEXT_VERSION_CONFLICT' });
    await expect(h.service.appendTurn({ ...access, idempotencyKey: 'v-anchor',
      body: makeBody({ expectedAnchorVersion: 9 }) as any,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_GOAL_ANCHOR_VERSION_CONFLICT' });
    h.session.anchor.status = 'anchor_confirmed';
    await expect(h.service.appendTurn({ ...access, idempotencyKey: 'locked',
      body: makeBody() as any,
    })).rejects.toMatchObject({ code: 'PORTFOLIO_GOAL_ANCHOR_LOCKED' });
    expect(h.mock.portfolioBootstrapGoalTurn.create).not.toHaveBeenCalled();
  });

  it('enforces owner and permission, keeping other sessions private', async () => {
    const h = harness();
    await expect(h.service.getTurns({ ...access, authenticatedUserId: 'other-user' }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(h.service.appendTurn({
      ...access, permissions: new Set() as any, idempotencyKey: 'no-write', body: makeBody() as any,
    })).rejects.toMatchObject({ statusCode: 403 });
    expect(h.mock.portfolioBootstrapGoalTurn.create).not.toHaveBeenCalled();
  });
});
