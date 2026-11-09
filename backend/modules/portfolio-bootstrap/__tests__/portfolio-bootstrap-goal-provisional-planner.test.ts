import { describe, expect, it } from 'vitest';
import type { GoalTurnDto } from '../portfolio-bootstrap-goal-turn.service';
import { buildProvisionalGoalQuestionPlan } from '../portfolio-bootstrap-goal-provisional-planner';

const anchor = {
  id: 'anchor-1', version: 3, status: 'anchor_insufficient',
  outcomeStatement: 'Resultado de negocio por definir', contextSummary: null,
  decisionToEnable: null, businessSignalStatus: 'unknown', businessSignalValue: null,
  sourceRefs: [],
};
const review = {
  id: 'review-1', status: 'confirmed' as const, version: 2,
  effectiveContext: { situation: { value: 'Una cafetería pequeña sin iniciativas ni equipo.' } },
};
function turn(id: string, version: number, overrides: Partial<GoalTurnDto> = {}): GoalTurnDto {
  return {
    id, version, sessionId: 'session-1', actorUserId: 'owner',
    anchorVersion: 3, contextReviewVersion: 2, field: 'outcomeStatement',
    questionId: 'old-question', inputText: 'Validar desayunos en oficinas.',
    disposition: 'user_declared', supersedesTurnId: null,
    evidence: [{ kind: 'user_input', quote: 'Validar desayunos en oficinas.', status: 'provisional' }],
    createdAt: '2026-11-09T10:00:00Z', ...overrides,
  };
}
const plan = (turns: GoalTurnDto[]) => buildProvisionalGoalQuestionPlan({
  sessionId: 'session-1', anchor, contextReview: review, turns,
});

describe('KAN-253 B4-C2B opt-in E2 provisional question planning', () => {
  it('asks for a new material field without adopting first answer to Anchor', () => {
    const original = JSON.stringify(anchor);
    const result = plan([turn('t1', 1)]);
    expect(result.activeQuestion).toMatchObject({
      field: 'decisionToEnable',
      id: 'goal-preview-anchor-1-v3-decisionToEnable-ledger1',
    });
    expect(JSON.stringify(anchor)).toBe(original);
  });
  it('binds question id to ledger version and honors unknown', () => {
    const unknown = plan([turn('t1', 1, { disposition: 'unknown', inputText: 'No lo sé todavía.' })]);
    expect(unknown.activeQuestion?.field).toBe('decisionToEnable');
    expect(unknown.unknownFields).toContain('outcomeStatement');
    expect(unknown.activeQuestion?.id).toContain('ledger1');
    expect(plan([turn('t1', 1), turn('t2', 2, { field: 'decisionToEnable', questionId: 'q2', inputText: 'Decidir si invertir.' })])
      .activeQuestion?.id).toContain('ledger2');
  });
  it('ignores corrected, retracted and stale answers while retaining ledger version in ID', () => {
    const result = plan([
      turn('t1', 1),
      turn('t2', 2, { supersedesTurnId: 't1', disposition: 'retracted', inputText: 'Retiro el objetivo.' }),
      turn('t3', 3, { anchorVersion: 2, field: 'outcomeStatement', inputText: 'Objetivo de otra versión' }),
    ]);
    expect(result.activeQuestion?.field).toBe('outcomeStatement');
    expect(result.activeQuestion?.id).toContain('ledger3');
  });
  it('does not produce another question when all material gaps were answered provisionally', () => {
    const result = plan([
      turn('t1', 1),
      turn('t2', 2, { field: 'decisionToEnable', inputText: 'Decidir si invertir.' }),
      turn('t3', 3, { field: 'contextSummary', inputText: 'No tenemos iniciativas en marcha.' }),
      turn('t4', 4, { field: 'businessSignalValue', inputText: 'Número de solicitudes de desayuno.' }),
    ]);
    expect(result.status).toBe('ready_for_human_review');
    expect(result.activeQuestion).toBeNull();
  });
  it('does not reuse provisional answers after E1 is reconfirmed at another version', () => {
    const result = buildProvisionalGoalQuestionPlan({
      sessionId: 'session-1', anchor,
      contextReview: { ...review, version: 4 },
      turns: [turn('t1', 1)],
    });
    expect(result.activeQuestion?.field).toBe('outcomeStatement');
  });
  it('ignores provisional turns entirely when E1 is not confirmed', () => {
    const result = buildProvisionalGoalQuestionPlan({
      sessionId: 'session-1', anchor,
      contextReview: { ...review, status: 'draft' },
      turns: [turn('t1', 1)],
    });
    expect(result.activeQuestion?.field).toBe('outcomeStatement');
  });

  it('does not use turns from another session', () => {
    expect(plan([turn('t1', 1, { sessionId: 'other-session' })]).activeQuestion?.field).toBe('outcomeStatement');
  });
});
