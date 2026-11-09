import { describe, expect, it } from 'vitest';
import type { GoalTurnDto } from '../portfolio-bootstrap-goal-turn.service';
import { projectGoalCheckpoint } from '../portfolio-bootstrap-goal-checkpoint';

const anchor = {
  version: 3,
  outcomeStatement: 'Resultado por definir',
  contextSummary: null, decisionToEnable: null, businessSignalStatus: 'unknown',
  businessSignalValue: null,
  sourceRefs: { objectiveConversation: { goalLedgerAcceptedTurnIds: [] } },
};
const t = (id: string, version: number, field: string, inputText: string,
  extra: Partial<GoalTurnDto> = {}): GoalTurnDto => ({
  id, sessionId: 'session-1', version, actorUserId: 'owner', anchorVersion: 3,
  contextReviewVersion: 2, questionId: 'q-' + version, field, inputText,
  disposition: 'user_declared', supersedesTurnId: null,
  evidence: [{ kind: 'user_input', quote: inputText, status: 'provisional' }],
  createdAt: '2026-11-09T12:00:00.000Z', ...extra,
});
const turns = [
  t('t1', 1, 'outcomeStatement', 'Validar pedidos de desayunos a oficinas.'),
  t('t2', 2, 'decisionToEnable', 'Decidir si lanzar una prueba.'),
  t('t3', 3, 'businessSignalValue', 'Todavía no sabemos qué indicador medir.', {
    disposition: 'unknown',
  }),
];
const run = (overrides: Record<string, unknown> = {}) => projectGoalCheckpoint({
  sessionId: 'session-1', anchor, turns, contextReviewVersion: 2,
  checkpoint: {
    expectedAnchorVersion: 3, expectedLedgerVersion: 3, expectedContextReviewVersion: 2,
    decisions: [{ turnId: 't1', action: 'accept' }, { turnId: 't2', action: 'reject' },
      { turnId: 't3', action: 'accept' }],
  }, actorUserId: 'owner', ...overrides,
});

describe('B4-C2D atomic E2 human checkpoint projection', () => {
  it('projects accepted fields, rejected receipts and unknown without confirming Anchor', () => {
    const previous = JSON.stringify(anchor);
    const result = run();
    expect(result.outcomeStatement).toBe(turns[0].inputText);
    expect(result.decisionToEnable).toBeNull();
    expect(result.businessSignalStatus).toBe('unknown');
    expect(result.businessSignalValue).toBeNull();
    expect(result.acceptedTurnIds).toEqual(['t1', 't3']);
    expect(result.rejectedTurnIds).toEqual(['t2']);
    const provenance = result.sourceRefs.objectiveConversation as Record<string, unknown>;
    expect(provenance.goalLedgerAcceptedTurnIds).toEqual(['t1', 't3']);
    expect(provenance.goalLedgerRejectedTurnIds).toEqual(['t2']);
    expect(provenance.unknownFields).toContain('businessSignalValue');
    expect(JSON.stringify(anchor)).toBe(previous);
  });

  it('rejects incomplete, duplicated and forged human decisions', () => {
    for (const decisions of [
      [{ turnId: 't1', action: 'accept' }],
      [{ turnId: 't1', action: 'accept' }, { turnId: 't1', action: 'reject' }, { turnId: 't3', action: 'accept' }],
      [{ turnId: 't1', action: 'accept' }, { turnId: 't2', action: 'reject' }, { turnId: 'alien', action: 'accept' }],
    ]) {
      expect(() => run({ checkpoint: {
        expectedAnchorVersion: 3, expectedLedgerVersion: 3, expectedContextReviewVersion: 2, decisions,
      } })).toThrow();
    }
  });

  it('fails closed for stale Anchor, ledger, E1 and foreign-session turns', () => {
    for (const version of [
      { expectedAnchorVersion: 2, expectedLedgerVersion: 3, expectedContextReviewVersion: 2 },
      { expectedAnchorVersion: 3, expectedLedgerVersion: 2, expectedContextReviewVersion: 2 },
      { expectedAnchorVersion: 3, expectedLedgerVersion: 3, expectedContextReviewVersion: 1 },
    ]) {
      expect(() => run({ checkpoint: { ...version,
        decisions: ['t1', 't2', 't3'].map(turnId => ({ turnId, action: 'reject' })),
      } })).toThrow();
    }
    expect(() => run({ turns: turns.map(turn => turn.id === 't2'
      ? { ...turn, sessionId: 'foreign' } : turn) })).toThrow();
  });

  it('does not adopt superseded or retracted answers; they remain traceable', () => {
    const original = t('t1', 1, 'outcomeStatement', 'Old outcome');
    const replacement = t('t2', 2, 'outcomeStatement', 'New outcome', { supersedesTurnId: 't1' });
    const retracted = t('t3', 3, 'decisionToEnable', 'Withdrawn', {
      disposition: 'retracted',
    });
    const result = run({
      turns: [original, replacement, retracted],
      checkpoint: {
        expectedAnchorVersion: 3, expectedLedgerVersion: 3, expectedContextReviewVersion: 2,
        decisions: [{ turnId: 't2', action: 'accept' }],
      },
    });
    expect(result.outcomeStatement).toBe('New outcome');
    expect(result.acceptedTurnIds).toEqual(['t2']);
  });

  it('rejects accepting multiple provisional answers for the same field', () => {
    const duplicate = t('t4', 4, 'outcomeStatement', 'Competing outcome');
    expect(() => run({
      turns: [...turns, duplicate],
      checkpoint: {
        expectedAnchorVersion: 3, expectedLedgerVersion: 4, expectedContextReviewVersion: 2,
        decisions: ['t1', 't2', 't3', 't4'].map(turnId => ({ turnId, action: 'accept' })),
      },
    })).toThrow();
  });
});
