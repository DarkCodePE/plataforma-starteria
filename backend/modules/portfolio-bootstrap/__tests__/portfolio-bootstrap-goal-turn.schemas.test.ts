import { describe, expect, it } from 'vitest';
import { portfolioBootstrapGoalTurnBodySchema } from '../portfolio-bootstrap-goal-turn.schemas';

const base = {
  expectedVersion: 0,
  expectedAnchorVersion: 1,
  expectedContextReviewVersion: null,
  questionId: 'goal-preview-a1-v1-outcomeStatement',
  inputText: 'Queremos validar si podemos aumentar pedidos recurrentes.',
  disposition: 'user_declared' as const,
  supersedesTurnId: null,
};

describe('KAN-253 B2 goal turn input guards', () => {
  it('permits a literal answer with explicit versions and no client facts or hypotheses', () => {
    expect(portfolioBootstrapGoalTurnBodySchema.parse(base)).toEqual(base);
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({
      ...base, facts: [{ conceptId: 'revenue', value: 2000 }],
    }).success).toBe(false);
  });

  it('requires literal uncertainty, no silent promotion of a claimed KPI', () => {
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({
      ...base, disposition: 'unknown', inputText: '20 pedidos por semana',
    }).success).toBe(false);
    expect(portfolioBootstrapGoalTurnBodySchema.parse({
      ...base, disposition: 'unknown', inputText: 'No lo sé todavía.',
    }).disposition).toBe('unknown');
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({
      ...base, disposition: 'not_applicable', inputText: 'Tenemos un KPI confirmado',
    }).success).toBe(false);
  });

  it('requires an exact prior turn to be referenced for a retraction', () => {
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({
      ...base, disposition: 'retracted', inputText: 'Retiro esta respuesta',
    }).success).toBe(false);
    expect(portfolioBootstrapGoalTurnBodySchema.parse({
      ...base, disposition: 'retracted', inputText: 'Retiro esta respuesta',
      supersedesTurnId: 'turn-1',
    }).supersedesTurnId).toBe('turn-1');
  });

  it('rejects missing CAS versions, large input and unknown dispositions', () => {
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({ ...base, expectedVersion: -1 }).success).toBe(false);
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({ ...base, inputText: 'x'.repeat(2001) }).success).toBe(false);
    expect(portfolioBootstrapGoalTurnBodySchema.safeParse({ ...base, disposition: 'confirmed' }).success).toBe(false);
  });
});
