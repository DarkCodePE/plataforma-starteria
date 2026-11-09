import { describe, expect, it } from 'vitest';
import type { GoalTurnDto } from '../portfolio-bootstrap-goal-turn.service';
import { buildE2ConversationContext } from '../portfolio-bootstrap-e2-conversation-context';

const anchor = {
  version: 3, outcomeStatement: 'Mejorar retención',
  contextSummary: 'Clientes nuevos', decisionToEnable: null,
  businessSignalValue: null,
  sourceRefs: { objectiveConversation: { goalLedgerAcceptedTurnIds: ['t1'] } },
};

function turn(id: string, version: number, overrides: Partial<GoalTurnDto> = {}): GoalTurnDto {
  return {
    id, sessionId: 's1', version, actorUserId: 'u1', anchorVersion: 3,
    contextReviewVersion: 2, questionId: 'q1', field: 'decisionToEnable',
    inputText: 'Decidir si mantener el piloto.', disposition: 'user_declared',
    supersedesTurnId: null,
    evidence: [{ kind: 'user_input', quote: 'Decidir si mantener el piloto.', status: 'provisional' }],
    createdAt: '2026-11-09T09:00:00.000Z',
    ...overrides,
  };
}

describe('KAN-253 B4-A — E2 provenance-safe read context', () => {
  it('distinguishes confirmed Anchor, incorporated and pending literal turns', () => {
    const result = buildE2ConversationContext({
      anchor,
      confirmedE1: { id: 'r1', version: 2, status: 'confirmed', situation: 'Empresa SaaS B2B.' },
      turns: [turn('t2', 2), turn('t1', 1)],
    });
    expect(result.confirmedE1).toEqual({ reviewId: 'r1', version: 2, situation: 'Empresa SaaS B2B.' });
    expect(result.anchorDraft.outcomeStatement).toBe('Mejorar retención');
    expect(result.activeProvisional).toEqual([
      expect.objectContaining({ turnId: 't1', reviewStatus: 'incorporated', source: 'user_input' }),
      expect.objectContaining({ turnId: 't2', reviewStatus: 'unreviewed', source: 'user_input' }),
    ]);
    expect(result.anchorDraft.decisionToEnable).toBeNull();
    expect(result.ledgerVersion).toBe(2);
  });

  it('excludes superseded and retracted turns without erasing the historical IDs', () => {
    const result = buildE2ConversationContext({
      anchor, confirmedE1: null,
      turns: [
        turn('t1', 1),
        turn('t2', 2, { inputText: 'Decidir qué financiar.', supersedesTurnId: 't1' }),
        turn('t3', 3, { disposition: 'retracted', supersedesTurnId: null }),
      ],
    });
    expect(result.activeProvisional.map((t) => t.turnId)).toEqual(['t2']);
    expect(result.excludedHistory).toEqual([
      { turnId: 't1', reason: 'superseded' },
      { turnId: 't3', reason: 'retracted' },
    ]);
  });

  it('never promotes outdated turns or draft E1 to confirmed knowledge', () => {
    const result = buildE2ConversationContext({
      anchor, confirmedE1: { id: 'r1', version: 2, status: 'draft', situation: 'Supuesto no confirmado' },
      turns: [turn('t4', 4, { anchorVersion: 2, disposition: 'unknown', inputText: 'No lo sé todavía.' })],
    });
    expect(result.confirmedE1).toBeNull();
    expect(result.activeProvisional[0]).toMatchObject({
      reviewStatus: 'stale_anchor', disposition: 'unknown', literalAnswer: 'No lo sé todavía.',
    });
    expect(result.anchorDraft.decisionToEnable).toBeNull();
  });

  it('handles empty inputs without inventing data', () => {
    const result = buildE2ConversationContext({
      anchor: { ...anchor, sourceRefs: null }, confirmedE1: null, turns: [],
    });
    expect(result.ledgerVersion).toBe(0);
    expect(result.activeProvisional).toEqual([]);
    expect(result.excludedHistory).toEqual([]);
  });
});
