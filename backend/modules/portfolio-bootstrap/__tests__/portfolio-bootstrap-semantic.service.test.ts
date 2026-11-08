import { describe, expect, it } from 'vitest';
import {
  applySemanticTurnProjection,
  emptySemanticStateProjection,
} from '../portfolio-bootstrap-semantic.service';

describe('Portfolio Bootstrap E1 semantic projection', () => {
  it('resolves multiple cross-field concepts while keeping hypotheses separate', () => {
    const next = applySemanticTurnProjection(emptySemanticStateProjection(), {
      status: 'completed',
      facts: [
        fact('pilot_experience', 'No pilot'),
        fact('organization_structure', 'No formal departments'),
      ],
      hypotheses: [{
        hypothesisId: 'hyp-1', statement: 'Demand may be recurrent', provenance: 'copilot_inferred',
        supportConceptIds: ['pilot_experience'], confidence: 0.3, status: 'proposed',
      }],
      answeredGaps: ['pilot_experience', 'organization_structure'],
      answeredQuestionId: null,
      emittedQuestion: question('situation'),
      convergence: { status: 'question_required', reason: 'Situation remains material.' },
      questionBudget: { limit: null, used: 1 },
    }, { turnId: 'turn-1', semanticVersion: 1 });

    expect(next.factLedger.map((item) => item.conceptId)).toEqual(['pilot_experience', 'organization_structure']);
    expect(next.answeredGaps).toEqual(['pilot_experience', 'organization_structure']);
    expect(next.hypotheses).toHaveLength(1);
    expect(next.activeQuestion?.resolves).toEqual(['situation']);
  });

  it('retires the active question and converges without erasing history', () => {
    const current = {
      ...emptySemanticStateProjection(),
      activeQuestion: question('pilot_experience'),
      questionBudget: { limit: 3, used: 1 },
    };
    const next = applySemanticTurnProjection(current, {
      status: 'completed', facts: [fact('pilot_experience', 'None')], hypotheses: [],
      answeredGaps: ['pilot_experience'], answeredQuestionId: current.activeQuestion.id,
      emittedQuestion: null,
      convergence: { status: 'ready_for_human_review', reason: 'Context is sufficient for E2 review.' },
      questionBudget: { limit: 3, used: 1 },
    }, { turnId: 'turn-2', semanticVersion: 2 });
    expect(next.activeQuestion).toBeNull();
    expect(next.answeredQuestionIds).toEqual([current.activeQuestion.id]);
    expect(next.convergence.status).toBe('ready_for_human_review');
  });

  it('preserves the prior ledger and question on a retryable provider failure', () => {
    const current = {
      ...emptySemanticStateProjection(), factLedger: [{ ...fact('situation', 'Grow'), turnId: 'turn-0', semanticVersion: 1 }],
      activeQuestion: question('stakeholder'),
    };
    const next = applySemanticTurnProjection(current, {
      status: 'failed_retryable', facts: [], hypotheses: [], answeredGaps: [], answeredQuestionId: null,
      emittedQuestion: null,
      convergence: { status: 'provider_retryable_failure', reason: 'timeout' },
      questionBudget: { limit: null, used: 0 },
    }, { turnId: 'turn-failed', semanticVersion: 2 });
    expect(next.factLedger).toEqual(current.factLedger);
    expect(next.activeQuestion).toEqual(current.activeQuestion);
    expect(next.convergence.status).toBe('provider_retryable_failure');
  });

  it('persists unknown/no-aplica dispositions without treating unknown as a resolved gap', () => {
    const unknown = {
      conceptId: 'formal_area', disposition: 'unknown' as const, provenance: 'user_declared' as const,
      evidenceRefs: [{ kind: 'user_input' as const, quote: 'No lo sé todavía' }],
    };
    const next = applySemanticTurnProjection(emptySemanticStateProjection(), {
      status: 'completed', facts: [], hypotheses: [], dispositions: [unknown], answeredGaps: [],
      answeredQuestionId: null, emittedQuestion: null,
      convergence: { status: 'ready_for_human_review', reason: 'Se conserva la duda.' },
      questionBudget: { limit: null, used: 0 },
    }, { turnId: 'turn-unknown', semanticVersion: 1 });
    expect(next.dispositions[0]).toMatchObject({ conceptId: 'formal_area', disposition: 'unknown' });
    expect(next.answeredGaps).toEqual([]);

    expect(() => applySemanticTurnProjection(emptySemanticStateProjection(), {
      status: 'completed', facts: [], hypotheses: [], dispositions: [unknown], answeredGaps: ['formal_area'],
      answeredQuestionId: null, emittedQuestion: null,
      convergence: { status: 'ready_for_human_review', reason: 'Invalid.' },
      questionBudget: { limit: null, used: 0 },
    }, { turnId: 'turn-invalid', semanticVersion: 1 })).toThrowError(/desconocido/i);
  });

  it('retracts a previously answered gap when the user later declares it unknown', () => {
    const current = { ...emptySemanticStateProjection(), answeredGaps: ['formal_area'] };
    const next = applySemanticTurnProjection(current, {
      status: 'completed', facts: [], hypotheses: [], dispositions: [{
        conceptId: 'formal_area', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'En realidad no lo sé' }],
      }], answeredGaps: [], answeredQuestionId: null, emittedQuestion: null,
      convergence: { status: 'ready_for_human_review', reason: 'Se explicita la incertidumbre.' },
      questionBudget: { limit: null, used: 0 },
    }, { turnId: 'turn-correction', semanticVersion: 2 });
    expect(next.answeredGaps).toEqual([]);
  });

  it('rejects historical semantic repeats, unresolved question replacement and client budget tampering', () => {
    const historical = { ...question('situation'), id: 'question-old', turnId: 'turn-old', semanticVersion: 1 };
    const current = {
      ...emptySemanticStateProjection(),
      questionHistory: [historical],
      activeQuestion: question('stakeholder'),
      questionBudget: { limit: 3, used: 2 },
    };
    const base = {
      status: 'completed' as const, facts: [], hypotheses: [], dispositions: [], answeredGaps: [],
      answeredQuestionId: current.activeQuestion.id,
      convergence: { status: 'question_required' as const, reason: 'Falta una cuestión.' },
      questionBudget: { limit: 3, used: 3 },
    };
    expect(() => applySemanticTurnProjection(current, {
      ...base, emittedQuestion: { ...question('situation'), id: 'question-new-id' },
    }, { turnId: 'turn-repeat', semanticVersion: 2 })).toThrowError(/presentada|repite/i);

    expect(() => applySemanticTurnProjection(current, {
      ...base, answeredQuestionId: null, emittedQuestion: question('area'),
    }, { turnId: 'turn-replace', semanticVersion: 2 })).toThrowError(/activa/i);

    expect(() => applySemanticTurnProjection(current, {
      ...base, emittedQuestion: question('area'), questionBudget: { limit: 3, used: 2 },
    }, { turnId: 'turn-budget', semanticVersion: 2 })).toThrowError(/presupuesto/i);
  });

  it('rejects orphan answered gaps and retracts a prior grounded resolution', () => {
    const orphan = {
      status: 'completed' as const, facts: [], hypotheses: [], dispositions: [],
      answeredGaps: ['pilot_experience'], answeredQuestionId: null, emittedQuestion: null,
      convergence: { status: 'ready_for_human_review' as const, reason: 'Incorrecto.' },
      questionBudget: { limit: null, used: 0 },
    };
    expect(() => applySemanticTurnProjection(emptySemanticStateProjection(), orphan, {
      turnId: 'turn-orphan', semanticVersion: 1,
    })).toThrowError(/evidencia|respaldado/i);

    const current = { ...emptySemanticStateProjection(), answeredGaps: ['pilot_experience'] };
    const retraction = applySemanticTurnProjection(current, {
      ...orphan,
      answeredGaps: [],
      facts: [{ ...fact('pilot_experience', 'Retiro esa respuesta'), status: 'retracted' as const }],
    }, { turnId: 'turn-retracted', semanticVersion: 2 });
    expect(retraction.answeredGaps).toEqual([]);
  });
});

function fact(conceptId: string, value: string) {
  return {
    conceptId, value, provenance: 'user_declared' as const,
    evidenceRefs: [{ kind: 'user_input' as const, quote: value }],
    confidence: 1, status: 'observed' as const,
  };
}

function question(resolve: string) {
  return {
    id: `question-${resolve}`, recap: 'Recap factual', question: `Question about ${resolve}?`,
    reasonToAsk: 'It can change E2 framing.', resolves: [resolve],
  };
}
