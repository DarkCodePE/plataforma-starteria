import { describe, expect, it } from 'vitest';
import type { PortfolioBootstrapAnchor, PortfolioGoalTurn } from '../../services/portfolioBootstrapClient';
import { buildGoalReviewRows } from '../goal-review-rows';

const anchor = {
  bootstrapSessionId: 's1', version: 3,
  outcomeStatement: 'Mejorar retención', contextSummary: null, decisionToEnable: null,
  businessSignalValue: null, sourceRefs: { objectiveConversation: { goalLedgerAcceptedTurnIds: ['t2'] } },
} as PortfolioBootstrapAnchor;

const turn = (id: string, version: number, overrides: Partial<PortfolioGoalTurn> = {}) => ({
  id, sessionId: 's1', version, anchorVersion: 3, field: 'decisionToEnable',
  questionId: 'q1', inputText: 'Decidir si continuar', disposition: 'user_declared' as const,
  supersedesTurnId: null, ...overrides,
}) as PortfolioGoalTurn;

describe('B4-C — review summary does not change canonical business state', () => {
  it('shows a pending proposal without changing the anchor', () => {
    const before = JSON.stringify(anchor);
    const rows = buildGoalReviewRows(anchor, [turn('t1', 1)]);
    expect(rows.find((row) => row.key === 'decisionToEnable')).toMatchObject({
      status: 'pending_review', current: 'Por definir', proposed: 'Decidir si continuar',
      turnId: 't1',
    });
    expect(JSON.stringify(anchor)).toBe(before);
  });
  it('does not treat accepted turns as new proposals', () => {
    const rows = buildGoalReviewRows(anchor, [turn('t2', 2)]);
    expect(rows.find((row) => row.key === 'decisionToEnable')?.status).toBe('missing');
    expect(rows.find((row) => row.key === 'decisionToEnable')?.proposed).toBeNull();
  });
  it('excludes earlier corrected answers and identifies stale versions', () => {
    const rows = buildGoalReviewRows(anchor, [
      turn('t1', 1),
      turn('t3', 3, { supersedesTurnId: 't1', anchorVersion: 2 }),
    ]);
    expect(rows.find((row) => row.key === 'decisionToEnable')).toMatchObject({
      status: 'outdated_response', proposed: null, turnId: 't3',
    });
  });
  it('does not overwrite a known outcome with unknown', () => {
    const rows = buildGoalReviewRows(anchor, [
      turn('t4', 4, { field: 'outcomeStatement', disposition: 'unknown', inputText: 'No lo sé todavía' }),
    ]);
    expect(rows[0]).toMatchObject({
      status: 'pending_review', current: 'Mejorar retención',
      proposed: 'Conservar resultado actual; registrar incertidumbre',
    });
  });
});
