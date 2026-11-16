import { describe, expect, it, vi } from 'vitest';
import { FetchStructuredModelAdapter } from '../../portfolio-entry-runtime/model/fetch-structured-model-adapter';
import { portfolioBootstrapSemanticInferenceSchema } from '../portfolio-bootstrap-semantic-orchestrator.service';
import { portfolioBootstrapSemanticProviderJsonSchema } from '../portfolio-bootstrap-semantic-provider-schema';

const metadata = {
  provider: 'openai_responses' as const,
  model: 'openai/gpt-5.6-luna',
  seed_support: 'not_requested' as const,
};

describe('Portfolio Bootstrap E1 strict structured-output transport', () => {
  it('sends the strict provider schema and preserves a direct restaurant landing with questionPlan null', async () => {
    const output = sufficientRestaurantInference();
    const fetchImpl = providerFetch(output);
    const adapter = model(fetchImpl);

    const result = await adapter.generate({
      systemPrompt: 'E1 system prompt',
      userPayload: { rawInput: 'restaurant case' },
      outputSchema: portfolioBootstrapSemanticInferenceSchema,
      providerJsonSchema: portfolioBootstrapSemanticProviderJsonSchema,
      preserveProviderNulls: true,
      requireProviderParameters: true,
      metadata,
      limits: { maxOutputTokens: 900 },
      call: { call_id: 'e1-restaurant-direct', purpose: 'bootstrap_semantic_turn' },
    });

    const request = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)) as {
      max_output_tokens: number;
      provider: { require_parameters: boolean };
      text: { format: { type: string; strict: boolean; schema: unknown } };
    };
    expect(request.max_output_tokens).toBe(900);
    expect(request.provider).toEqual({ require_parameters: true });
    expect(request.text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
      schema: portfolioBootstrapSemanticProviderJsonSchema,
    });
    expect(result.error_type).toBeUndefined();
    expect(result.validated_output).toMatchObject({
      questionPlan: null,
      synthesis: { directionForE2: expect.stringContaining('objetivo') },
      readyForHumanReview: true,
    });
  });

  it('preserves synthesis null when the restaurant still requires one material question', async () => {
    const output = incompleteRestaurantInference();
    const adapter = model(providerFetch(output));

    const result = await adapter.generate({
      systemPrompt: 'E1 system prompt',
      userPayload: { rawInput: 'restaurant case' },
      outputSchema: portfolioBootstrapSemanticInferenceSchema,
      providerJsonSchema: portfolioBootstrapSemanticProviderJsonSchema,
      preserveProviderNulls: true,
      requireProviderParameters: true,
      metadata,
      limits: { maxOutputTokens: 900 },
      call: { call_id: 'e1-restaurant-question', purpose: 'bootstrap_semantic_turn' },
    });

    expect(result.error_type).toBeUndefined();
    expect(result.validated_output).toMatchObject({
      questionPlan: {
        question: expect.stringContaining('cambio'),
        resolves: ['desired_outcome'],
      },
      synthesis: null,
      readyForHumanReview: false,
    });
  });

  it('reproduces the required-nullable failure when E1 null preservation is omitted', async () => {
    const output = sufficientRestaurantInference();
    const adapter = model(providerFetch(output));

    const result = await adapter.generate({
      systemPrompt: 'E1 system prompt',
      userPayload: {},
      outputSchema: portfolioBootstrapSemanticInferenceSchema,
      providerJsonSchema: portfolioBootstrapSemanticProviderJsonSchema,
      requireProviderParameters: true,
      metadata,
      call: { call_id: 'e1-null-regression-proof', purpose: 'bootstrap_semantic_turn' },
    });

    expect(result.error_type).toBe('SCHEMA_ERROR');
    expect(result.schema_errors.some((error) => error.startsWith('questionPlan:'))).toBe(true);
  });

  it('does not send the OpenRouter routing control to a direct OpenAI endpoint', async () => {
    const fetchImpl = providerFetch(sufficientRestaurantInference());
    const adapter = model(fetchImpl, 'https://api.openai.com/v1');

    await adapter.generate({
      systemPrompt: 'E1 system prompt',
      userPayload: {},
      outputSchema: portfolioBootstrapSemanticInferenceSchema,
      providerJsonSchema: portfolioBootstrapSemanticProviderJsonSchema,
      preserveProviderNulls: true,
      requireProviderParameters: true,
      metadata,
      call: { call_id: 'e1-openai-direct', purpose: 'bootstrap_semantic_turn' },
    });

    const request = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)) as {
      provider?: unknown;
    };
    expect(request.provider).toBeUndefined();
  });
});

function model(
  fetchImpl: ReturnType<typeof providerFetch>,
  baseUrl = 'https://openrouter.ai/api/v1',
): FetchStructuredModelAdapter {
  return new FetchStructuredModelAdapter({
    provider: 'openai_responses',
    model: 'openai/gpt-5.6-luna',
    apiKey: 'test-key',
    baseUrl,
    timeoutMs: 1_000,
  }, fetchImpl);
}

function providerFetch(output: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      status: 'completed',
      model: 'openai/gpt-5.6-luna',
      usage: { input_tokens: 300, output_tokens: 240, total_tokens: 540 },
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(output) }],
      }],
    }),
  });
}

function fact(conceptId: string, value: string, quote: string) {
  return {
    conceptId,
    value,
    provenance: 'user_declared',
    evidenceRefs: [{ kind: 'user_input', quote }],
    confidence: 1,
    status: 'observed',
  };
}

function sufficientRestaurantInference() {
  return {
    facts: [
      fact('business_signal', 'alta demanda los fines de semana', 'alta demanda'),
      fact('constraint', 'capacidad limitada los fines de semana', 'capacidad limitada'),
      fact('desired_outcome', 'incrementar ventas entre semana', 'incrementar ventas entre semana'),
    ],
    hypotheses: [{
      hypothesisId: 'starting_point.opportunity',
      statement: 'Existe una oportunidad de equilibrar la demanda semanal.',
      provenance: 'copilot_inferred',
      supportConceptIds: ['business_signal', 'desired_outcome'],
      confidence: 0.8,
      status: 'proposed',
    }, {
      hypothesisId: 'main_uncertainty',
      statement: 'No está claro qué limita la demanda entre semana.',
      provenance: 'copilot_inferred',
      supportConceptIds: ['business_signal', 'constraint', 'desired_outcome'],
      confidence: 0.7,
      status: 'proposed',
    }],
    dispositions: [],
    questionPlan: null,
    synthesis: {
      summary: 'La oportunidad está en equilibrar las ventas semanales sin agravar el límite del fin de semana.',
      situation: 'La demanda se concentra en fines de semana con capacidad limitada.',
      intention: 'Incrementar las ventas entre semana.',
      mainUncertainty: 'Qué explica la menor demanda entre semana.',
      directionForE2: 'Definir un objetivo de crecimiento entre semana sin asumir una solución.',
      evidenceConceptIds: ['business_signal', 'constraint', 'desired_outcome'],
    },
    readyForHumanReview: true,
    reason: 'La situación, intención e incertidumbre están delimitadas.',
  };
}

function incompleteRestaurantInference() {
  return {
    facts: [
      fact('business_signal', 'alta demanda los fines de semana', 'alta demanda'),
      fact('constraint', 'capacidad limitada los fines de semana', 'capacidad limitada'),
    ],
    hypotheses: [{
      hypothesisId: 'starting_point.need',
      statement: 'Existe una tensión de capacidad, pero el propósito todavía no está delimitado.',
      provenance: 'copilot_inferred',
      supportConceptIds: ['business_signal', 'constraint'],
      confidence: 0.7,
      status: 'proposed',
    }],
    dispositions: [],
    questionPlan: {
      question: '¿Qué cambio os gustaría conseguir fuera de los fines de semana?',
      reasonToAsk: 'La respuesta delimita el propósito material de E1.',
      resolves: ['desired_outcome'],
    },
    synthesis: null,
    readyForHumanReview: false,
    reason: 'Falta el cambio que se quiere conseguir.',
  };
}
