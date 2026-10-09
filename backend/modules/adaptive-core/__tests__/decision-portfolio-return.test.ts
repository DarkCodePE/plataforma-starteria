/**
 * E2E Job-Driven §23 (G8) y Core §30: la decisión vuelve al portfolio sin propagación ciega.
 */
import { describe, expect, it, vi } from 'vitest';
import { nextCoverage, propagateDecisionToPortfolioTx } from '../decision-portfolio-return';

const decision = (outcome: any) => ({
  id: 'd1',
  projectId: 'p1',
  outcome,
  rationale: 'La evidencia del piloto sostiene escalar.',
  decidedAt: new Date('2026-10-04T12:00:00Z'),
  packageSnapshotJson: { narrative: { learnings: { text: 'La visibilidad temprana reduce retrabajo.' } } },
});

function makeTx({ coverage = 'sin_cobertura', siblings = 0, withChallenge = true } = {}) {
  return {
    initiativePortfolioMeta: {
      findFirst: vi.fn().mockResolvedValue({ challenge: withChallenge ? { id: 'c1', coverageStatus: coverage, strategicFrontId: 'f1' } : null }),
      count: vi.fn().mockResolvedValue(siblings),
      updateMany: vi.fn(),
    },
    challenge: { update: vi.fn() },
    portfolioLearning: { upsert: vi.fn((args: any) => args.create) },
  };
}

describe('nextCoverage', () => {
  it.each([
    // Única iniciativa del Reto: la decisión corporativa manda sobre lo que declaró el owner.
    ['sin_cobertura', 'scale', 0, 'cobertura_suficiente'],
    ['sin_cobertura', 'continue_experimenting', 0, 'cobertura_parcial'],
    ['cobertura_suficiente', 'continue_experimenting', 0, 'cobertura_parcial'],
    ['cobertura_suficiente', 'close_with_learning', 0, 'reformular'],
    ['cobertura_parcial', 'pause', 0, 'cobertura_parcial'],
    ['resuelto', 'close_with_learning', 0, 'resuelto'],
    // Con otras iniciativas activas: nunca baja lo que ellas sostienen.
    ['cobertura_parcial', 'close_with_learning', 2, 'cobertura_parcial'],
    ['cobertura_suficiente', 'continue_experimenting', 1, 'cobertura_suficiente'],
    ['cobertura_parcial', 'implement', 1, 'cobertura_suficiente'],
  ])('%s + %s (otras activas: %i) → %s', (current, outcome, siblings, expected) => {
    expect(nextCoverage(current, outcome as any, siblings as number)).toBe(expected);
  });
});

describe('propagateDecisionToPortfolioTx', () => {
  it('actualiza la cobertura del Reto, la siguiente acción y deja el aprendizaje ligado a Reto y Frente', async () => {
    const tx = makeTx();
    const learning = await propagateDecisionToPortfolioTx(tx, decision('scale'));

    expect(tx.challenge.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { coverageStatus: 'cobertura_suficiente' } });
    expect(tx.initiativePortfolioMeta.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 'p1' },
      data: expect.objectContaining({ nextActionRecommended: 'Planificar el escalamiento y quién lo opera.' }),
    }));
    expect(learning).toMatchObject({
      decisionId: 'd1',
      challengeId: 'c1',
      strategicFrontId: 'f1',
      outcome: 'scale',
      learning: 'La visibilidad temprana reduce retrabajo.',
      coverageBefore: 'sin_cobertura',
      coverageAfter: 'cobertura_suficiente',
      suggestedReformulation: null,
    });
  });

  it('cerrar sin cubrir propone reformular el Reto, pero no lo reescribe (Core §30)', async () => {
    const tx = makeTx();
    const learning = await propagateDecisionToPortfolioTx(tx, decision('close_with_learning'));
    expect(learning.suggestedReformulation).toMatch(/reformularse/);
    // Sólo cambia la proyección de cobertura; nada del texto del Reto.
    expect(tx.challenge.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { coverageStatus: 'reformular' } });
  });

  it('no escribe el Reto si la cobertura no cambia', async () => {
    const tx = makeTx({ coverage: 'cobertura_suficiente', siblings: 1 });
    await propagateDecisionToPortfolioTx(tx, decision('continue_experimenting'));
    expect(tx.challenge.update).not.toHaveBeenCalled();
  });

  it('una iniciativa independiente deja aprendizaje sin Reto ni Frente', async () => {
    const tx = makeTx({ withChallenge: false });
    const learning = await propagateDecisionToPortfolioTx(tx, decision('implement'));
    expect(learning).toMatchObject({ challengeId: null, strategicFrontId: null, coverageBefore: null, coverageAfter: null });
    expect(tx.challenge.update).not.toHaveBeenCalled();
  });

  it.each(['scale', 'continue_experimenting', 'close_with_learning'])('decidida (%s), la iniciativa queda cerrada en el portafolio', async (outcome) => {
    const tx = makeTx();
    await propagateDecisionToPortfolioTx(tx, decision(outcome));
    expect(tx.initiativePortfolioMeta.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 'p1' },
      data: expect.objectContaining({ status: 'closed', readyForDecision: false }),
    }));
  });

  it('una iniciativa independiente también queda cerrada', async () => {
    const tx = makeTx({ withChallenge: false });
    await propagateDecisionToPortfolioTx(tx, decision('implement'));
    expect(tx.initiativePortfolioMeta.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'closed', readyForDecision: false }),
    }));
  });

  it('sin los modelos en el cliente no propaga', async () => {
    expect(await propagateDecisionToPortfolioTx({}, decision('scale'))).toBeNull();
  });
});
