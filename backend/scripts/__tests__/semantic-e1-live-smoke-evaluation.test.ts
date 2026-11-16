import { describe, expect, it } from 'vitest';
import {
  evaluateSemanticE1Preflight,
  type SemanticE1PreflightInput,
  type SemanticE1PreflightPredicate,
} from '../semantic-e1-live-smoke-evaluation';

function inputWithMainUncertaintyFact(): SemanticE1PreflightInput {
  return {
    processing: false,
    turn: {
      status: 'completed',
      facts: [
        {
          conceptId: 'situation',
          value: 'Capacidad disponible entre semana.',
          provenance: 'user_declared',
          evidenceRefs: [{ kind: 'user_input', quote: 'Capacidad disponible entre semana.' }],
          confidence: 1,
          status: 'observed',
        },
        {
          conceptId: 'main_uncertainty',
          value: 'Qué propuesta valorarían los clientes entre semana.',
          provenance: 'user_declared',
          evidenceRefs: [{ kind: 'user_input', quote: 'Qué propuesta valorarían.' }],
          confidence: 1,
          status: 'observed',
        },
      ],
      hypotheses: [{
        hypothesisId: 'starting_point.opportunity',
        statement: 'Existe una oportunidad de aprovechar la capacidad entre semana.',
        provenance: 'copilot_inferred',
        supportConceptIds: ['situation'],
        confidence: 0.8,
        status: 'proposed',
      }],
      emittedQuestion: null,
      convergence: {
        status: 'ready_for_human_review',
        reason: 'Existe evidencia material suficiente.',
        synthesis: {
          summary: 'Hay capacidad disponible entre semana y una oportunidad por validar.',
          situation: 'El restaurante concentra la demanda en fines de semana.',
          intention: 'Aumentar las ventas entre semana.',
          mainUncertainty: 'Qué propuesta valorarán los clientes.',
          directionForE2: 'Definir qué resultado conviene validar.',
          evidenceConceptIds: ['situation', 'main_uncertainty'],
        },
      },
      execution: {
        provider: 'openrouter',
        model: 'openai/gpt-5.6-luna',
        durationMs: 800,
        inputTokens: 1_200,
        outputTokens: 600,
        totalTokens: 1_800,
        retryCount: 0,
        fallbackUsed: false,
      },
    },
  };
}

function inferredMainUncertainty() {
  return {
    hypothesisId: 'main_uncertainty',
    statement: 'La propuesta valorada entre semana sigue siendo incierta.',
    provenance: 'copilot_inferred' as const,
    supportConceptIds: ['situation'],
    confidence: 0.7,
    status: 'proposed' as const,
  };
}

describe('Semantic E1 live-provider preflight evaluation', () => {
  it('accepts a main_uncertainty fact exactly as materialEvidenceStatus does', () => {
    const result = evaluateSemanticE1Preflight(inputWithMainUncertaintyFact());

    expect(result.passed).toBe(true);
    expect(result.predicates.mainUncertainty).toBe(true);
    expect(result.failedPredicates).toEqual([]);
  });

  it.each<[SemanticE1PreflightPredicate, (input: SemanticE1PreflightInput) => void]>([
    ['processing', (input) => { input.processing = true; }],
    ['status', (input) => { input.turn.status = 'failed_retryable'; }],
    ['provider', (input) => { input.turn.execution.provider = 'deterministic_test_adapter'; }],
    ['model', (input) => { input.turn.execution.model = null; }],
    ['tokenUsage', (input) => {
      input.turn.execution.inputTokens = 0;
      input.turn.execution.outputTokens = 0;
      input.turn.execution.totalTokens = 0;
    }],
    ['facts', (input) => {
      input.turn.facts = [];
      input.turn.hypotheses.push(inferredMainUncertainty());
    }],
    ['startingPoint', (input) => {
      input.turn.hypotheses = [];
    }],
    ['mainUncertainty', (input) => {
      input.turn.facts = input.turn.facts.filter((fact) => fact.conceptId !== 'main_uncertainty');
    }],
    ['hasNextStep', (input) => {
      input.turn.emittedQuestion = null;
      input.turn.convergence.synthesis = null;
    }],
  ])('identifies only the failed %s predicate', (predicate, mutate) => {
    const input = inputWithMainUncertaintyFact();
    mutate(input);

    const result = evaluateSemanticE1Preflight(input);

    expect(result.passed).toBe(false);
    expect(result.predicates[predicate]).toBe(false);
    expect(result.failedPredicates).toEqual([predicate]);
  });

  it('returns only safe diagnostic metadata', () => {
    const result = evaluateSemanticE1Preflight(inputWithMainUncertaintyFact());

    expect(result.diagnostics).toEqual({
      status: 'completed',
      provider: 'openrouter',
      model: 'openai/gpt-5.6-luna',
      tokenUsage: { inputTokens: 1_200, outputTokens: 600, totalTokens: 1_800 },
      convergenceStatus: 'ready_for_human_review',
      emittedQuestion: false,
      synthesis: true,
    });
    expect(JSON.stringify(result)).not.toContain('Capacidad disponible entre semana.');
    expect(JSON.stringify(result)).not.toContain('Qué propuesta valorarían');
  });
});
