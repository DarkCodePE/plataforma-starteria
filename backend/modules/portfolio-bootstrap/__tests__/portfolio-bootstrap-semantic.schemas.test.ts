import { describe, expect, it } from 'vitest';
import {
  portfolioBootstrapSemanticTurnInputSchema,
  semanticE1Enabled,
} from '../portfolio-bootstrap-semantic.schemas';

const validTurn = () => ({
  expectedVersion: 0,
  inputText: 'Somos una cafetería y nunca hemos probado pedidos a oficinas.',
  status: 'completed' as const,
  facts: [{
    conceptId: 'pilot_experience',
    value: { kind: 'none' },
    provenance: 'user_declared' as const,
    evidenceRefs: [{ kind: 'user_input' as const, quote: 'nunca hemos probado pedidos a oficinas' }],
    confidence: 1,
    status: 'observed' as const,
  }],
  hypotheses: [{
    hypothesisId: 'hyp-demand',
    statement: 'Puede existir demanda recurrente de oficinas.',
    provenance: 'copilot_inferred' as const,
    supportConceptIds: ['pilot_experience'],
    confidence: 0.4,
    status: 'proposed' as const,
  }],
  answeredGaps: ['pilot_experience'],
  answeredQuestionId: null,
  emittedQuestion: {
    id: 'question-opportunity',
    recap: 'Entiendo que todavía no habéis probado el servicio.',
    question: '¿Qué situación concreta os gustaría mejorar primero?',
    reasonToAsk: 'Permite encuadrar el objetivo sin asumir métricas.',
    resolves: ['situation'],
  },
  convergence: { status: 'question_required' as const, reason: 'Falta concretar la situación.' },
  questionBudget: { limit: null, used: 1 },
  error: null,
  execution: {
    provider: 'test-double', model: 'semantic-e1-fixture', durationMs: 12,
    inputTokens: 20, outputTokens: 10, totalTokens: 30, retryCount: 0, fallbackUsed: false,
  },
});

describe('Portfolio Bootstrap E1 semantic contracts', () => {
  it('accepts evidence-bound facts, separate hypotheses and one active question', () => {
    const parsed = portfolioBootstrapSemanticTurnInputSchema.parse(validTurn());
    expect(parsed.facts[0].conceptId).toBe('pilot_experience');
    expect(parsed.hypotheses[0].provenance).toBe('copilot_inferred');
    expect(parsed.emittedQuestion?.resolves).toEqual(['situation']);
  });

  it('rejects invented facts, hypothesis provenance in the fact ledger and invalid token totals', () => {
    const missingEvidence = validTurn();
    missingEvidence.facts[0].evidenceRefs = [];
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse(missingEvidence)).toThrow();

    const inferredFact = validTurn() as any;
    inferredFact.facts[0].provenance = 'copilot_inferred';
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse(inferredFact)).toThrow();

    const wrongTotal = validTurn();
    wrongTotal.execution.totalTokens = 999;
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse(wrongTotal)).toThrow();
  });

  it('requires retryable failures to carry no semantic output or next question', () => {
    const failed = {
      ...validTurn(), status: 'failed_retryable' as const,
      facts: [], hypotheses: [], answeredGaps: [], emittedQuestion: null,
      convergence: { status: 'provider_retryable_failure' as const, reason: 'timeout' },
      questionBudget: { limit: null, used: 0 },
      error: { code: 'provider_timeout', retryable: true },
    };
    expect(portfolioBootstrapSemanticTurnInputSchema.parse(failed).status).toBe('failed_retryable');
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse({ ...failed, facts: validTurn().facts })).toThrow();
  });

  it('correlates provenance with evidence and constrains terminal failures to a safety stop', () => {
    const incompatible = validTurn() as any;
    incompatible.facts[0] = {
      ...incompatible.facts[0],
      provenance: 'source_extracted',
      evidenceRefs: [{ kind: 'user_input', quote: 'nunca hemos probado pedidos a oficinas' }],
    };
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse(incompatible)).toThrow(/procedencia/i);

    const terminal = {
      ...validTurn(), status: 'failed_terminal' as const,
      facts: [], hypotheses: [], answeredGaps: [], emittedQuestion: null,
      convergence: { status: 'ready_for_human_review' as const, reason: 'incorrect' },
      questionBudget: { limit: null, used: 0 },
      error: { code: 'unsafe_output', retryable: false },
    };
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse(terminal)).toThrow(/terminal/i);
  });

  it('rejects a user disposition whose quoted evidence is absent from the turn input', () => {
    const forged = {
      ...validTurn(), facts: [], answeredGaps: [],
      dispositions: [{
        conceptId: 'formal_area', disposition: 'unknown', provenance: 'user_declared',
        evidenceRefs: [{ kind: 'user_input', quote: 'No lo sé todavía' }],
      }],
    };
    expect(() => portfolioBootstrapSemanticTurnInputSchema.parse(forged)).toThrow(/evidencia/i);
  });

  it('keeps the semantic runtime feature flag fail-closed by default', () => {
    expect(semanticE1Enabled({})).toBe(false);
    expect(semanticE1Enabled({ SEMANTIC_E1_ENABLED: 'false' })).toBe(false);
    expect(semanticE1Enabled({ SEMANTIC_E1_ENABLED: 'true' })).toBe(true);
  });
});
