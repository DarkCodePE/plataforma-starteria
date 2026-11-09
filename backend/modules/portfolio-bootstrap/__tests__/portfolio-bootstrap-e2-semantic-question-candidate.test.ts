import { describe, expect, it, vi } from 'vitest';
import type { StructuredModelAdapter } from '../../portfolio-entry-runtime/model/structured-model-adapter';
import type { E2ConversationContext } from '../portfolio-bootstrap-e2-conversation-context';
import {
  e2SemanticQuestionCandidateSchema,
  proposeE2SemanticQuestion,
  validateE2CandidateEvidence,
} from '../portfolio-bootstrap-e2-semantic-question-candidate';

const context: E2ConversationContext = {
  anchorVersion: 3, ledgerVersion: 2,
  confirmedE1: { reviewId: 'r1', version: 2, situation: 'Cafetería de cuatro personas.' },
  anchorDraft: {
    outcomeStatement: 'Explorar desayunos para oficinas cercanas.',
    contextSummary: null, decisionToEnable: null, businessSignalValue: null,
  },
  activeProvisional: [{
    turnId: 't2', turnVersion: 2, questionId: 'q1', field: 'decisionToEnable',
    literalAnswer: 'No sabemos si la demanda es suficiente.',
    disposition: 'user_declared', source: 'user_input', reviewStatus: 'unreviewed',
  }],
  excludedHistory: [{ turnId: 't1', reason: 'superseded' }],
};

const candidate = {
  status: 'question_required' as const,
  question: {
    field: 'decisionToEnable' as const,
    text: '¿Qué decisión necesitas poder tomar sobre esta oportunidad?',
    recap: 'Has mencionado incertidumbre sobre la demanda.',
    reasonToAsk: 'Falta conocer la decisión a habilitar.',
    resolves: ['decision_to_enable'],
    evidence: [{ kind: 'goal_turn' as const, id: 't2', quote: 'No sabemos si la demanda es suficiente.' }],
  },
  reason: 'Queda una aclaración material.',
};

function fakeModel(output: unknown): StructuredModelAdapter {
  return { generate: vi.fn().mockResolvedValue({ validated_output: output }) } as unknown as StructuredModelAdapter;
}

describe('KAN-253 B4-B semantic E2 question candidate', () => {
  it('accepts one provisional question with an exact source quote but does not persist anything', async () => {
    const model = fakeModel(candidate);
    const result = await proposeE2SemanticQuestion({ context, model, remainingQuestionBudget: 2, requestId: 'req-1' });
    expect(result.status).toBe('candidate');
    expect(result.candidate?.question?.field).toBe('decisionToEnable');
    expect((model.generate as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });

  it('rejects fabricated quotes, unknown source IDs, and stale provisional turn references', () => {
    expect(validateE2CandidateEvidence(candidate, context)).toBe(true);
    expect(validateE2CandidateEvidence({
      ...candidate, question: { ...candidate.question!, evidence: [{ kind: 'goal_turn', id: 't1', quote: 'No sabemos' }] },
    }, context)).toBe(false);
    expect(validateE2CandidateEvidence({
      ...candidate, question: { ...candidate.question!, evidence: [{ kind: 'confirmed_e1', id: 'r1', quote: 'Tenemos 100 clientes' }] },
    }, context)).toBe(false);
    expect(validateE2CandidateEvidence(candidate, {
      ...context, activeProvisional: context.activeProvisional.map(t => ({ ...t, reviewStatus: 'stale_anchor' })),
    })).toBe(false);
  });

  it('forces human review when budget is exhausted and does not call model', async () => {
    const model = fakeModel(candidate);
    const result = await proposeE2SemanticQuestion({ context, model, remainingQuestionBudget: 0, requestId: 'req-2' });
    expect(result).toMatchObject({ status: 'candidate', candidate: { status: 'ready_for_human_review', question: null } });
    expect(model.generate).not.toHaveBeenCalled();
  });

  it('fails closed on schema violations and model errors', async () => {
    expect(e2SemanticQuestionCandidateSchema.safeParse({
      ...candidate, question: null,
    }).success).toBe(false);
    const invalid = await proposeE2SemanticQuestion({
      context, model: fakeModel({ ...candidate, question: { ...candidate.question, evidence: [{ kind: 'goal_turn', id: 't2', quote: 'Valor inventado' }] } }),
      remainingQuestionBudget: 2, requestId: 'req-3',
    });
    expect(invalid).toMatchObject({ status: 'fallback_required', candidate: null, reason: 'invalid_schema_or_evidence' });
    const broken = { generate: vi.fn().mockRejectedValue(new Error('down')) } as unknown as StructuredModelAdapter;
    const unavailable = await proposeE2SemanticQuestion({ context, model: broken, remainingQuestionBudget: 2, requestId: 'req-4' });
    expect(unavailable).toMatchObject({ status: 'fallback_required', reason: 'model_unavailable' });
  });
});
