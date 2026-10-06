import { describe, expect, it } from 'vitest';
import type { CriticalSituationSynthesis } from '../domain/critical-situation-synthesis.schema';
import { criticalSituationSynthesisSchema } from '../domain/critical-situation-synthesis.schema';
import {
  criticalSituationSynthesisProviderSchema,
} from '../model/critical-situation-synthesis-provider-schema';
import type { ModelExecutionResult } from '../model/model-execution-types';
import type {
  StructuredModelAdapter,
  StructuredModelGenerateInput,
} from '../model/structured-model-adapter';
import {
  normalizeCriticalSituationSynthesisInput,
  type CriticalSituationSynthesisAuthorizedSnapshot,
} from '../synthesis/critical-situation-synthesis-input';
import { CriticalSituationSynthesisAdapter } from '../agent/critical-situation-synthesis-adapter';

const modelMetadata = {
  provider: 'mock_provider',
  requested_model: 'mock-model',
  model: 'mock-model',
  temperature: 0,
  seed: 17,
  seed_support: 'provided' as const,
};

function authorizedSnapshot(): CriticalSituationSynthesisAuthorizedSnapshot {
  return normalizeCriticalSituationSynthesisInput({
    snapshot: { snapshot_id: 'snapshot-1', captured_at: '2026-10-06T10:00:00.000Z' },
    user_messages: [{ id: 'message-1', text: 'Todavía no hay una situación suficientemente definida.' }],
  });
}

function insufficientSynthesis(sourceRef: string): CriticalSituationSynthesis {
  return {
    basis_status: 'insufficient_basis',
    situation_model: {
      desired_change: null,
      current_situation: [],
      existing_work_or_assets: [],
      decision_to_enable: null,
      known_evidence: [],
      constraints: [],
      actors_and_authority: [],
      dependencies: [],
      uncertainties: [],
      time_pressure: [],
      existing_alternatives: [],
      material_tensions: [],
    },
    reasoning_metadata: { selected_lenses: [] },
    situation_insight: {
      statement: null,
      support: [],
      novelty_type: 'no_supported_insight',
      epistemic_role: 'INTERPRETATION',
      status: 'no_supported_insight',
    },
    material_tensions: [],
    decision_frame: {
      status: 'not_yet_identifiable',
      decision_to_prepare: null,
      decision_authority: 'unknown',
      materially_distinct_paths: [],
      distinguishing_conditions: [],
      timing_or_constraints: [],
      unresolved_basis: [],
    },
    usable_now: [],
    decision_changing_unknowns: [],
    candidate_first_movement: null,
    uncertainty_statement: null,
    provenance: [{
      id: 'provenance-decision-authority',
      claim_ref: 'decision_frame.decision_authority',
      origin: 'AI_INFERRED',
      review_disposition: 'UNREVIEWED',
      source_refs: [sourceRef],
      source_path: null,
      source_text: null,
      recorded_at: null,
    }],
  };
}

class FakeStructuredModelAdapter implements StructuredModelAdapter {
  readonly calls: StructuredModelGenerateInput<unknown>[] = [];

  constructor(private readonly candidate: unknown) {}

  async generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>> {
    this.calls.push(input as StructuredModelGenerateInput<unknown>);
    const parsed = input.outputSchema.safeParse(this.candidate);
    return {
      provider_raw: { fake: true },
      parsed_output: this.candidate,
      validated_output: parsed.success ? parsed.data : null,
      schema_errors: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
      execution_metadata: {
        call_id: input.call.call_id,
        purpose: input.call.purpose,
        provider: input.metadata.provider,
        requested_model: input.metadata.requested_model,
        provider_reported_model: 'mock-model-reported',
        model: input.metadata.model ?? 'mock-model',
        temperature: input.metadata.temperature,
        seed: input.metadata.seed,
        seed_support: input.metadata.seed_support,
        duration_ms: 8,
        retry_count: 0,
      },
      ...(parsed.success ? {} : { error_type: 'SCHEMA_ERROR' as const }),
    };
  }
}

function createAdapter(candidate: unknown) {
  const model = new FakeStructuredModelAdapter(candidate);
  return { model, adapter: new CriticalSituationSynthesisAdapter(model) };
}

describe('isolated critical situation synthesis adapter', () => {
  it('uses the dedicated execution purpose and provider schema with the authorized snapshot only', async () => {
    const snapshot = authorizedSnapshot();
    const model = new FakeStructuredModelAdapter(insufficientSynthesis(snapshot.source_refs[0]));
    const adapter = new CriticalSituationSynthesisAdapter(model);
    const snapshotWithOutOfBandFields = {
      ...snapshot,
      question_plan: { questions: ['outside the synthesis boundary'] },
      session_state: { stopping: true },
      handoff: { destination: 'outside the synthesis boundary' },
    } as CriticalSituationSynthesisAuthorizedSnapshot;

    const result = await adapter.generate({
      authorized_snapshot: snapshotWithOutOfBandFields,
      call_id: 'call-synthesis-1',
      model_metadata: modelMetadata,
    });

    expect(model.calls).toHaveLength(1);
    expect(model.calls[0].call).toEqual({ call_id: 'call-synthesis-1', purpose: 'critical_situation_synthesis' });
    expect(model.calls[0].outputSchema).toBe(criticalSituationSynthesisSchema);
    expect(model.calls[0].providerJsonSchema).toBe(criticalSituationSynthesisProviderSchema);
    expect(model.calls[0].userPayload).toEqual(snapshot);
    expect(model.calls[0].userPayload).not.toHaveProperty('question_plan');
    expect(model.calls[0].userPayload).not.toHaveProperty('session_state');
    expect(model.calls[0].userPayload).not.toHaveProperty('handoff');
    expect(result.synthesis).toEqual(insufficientSynthesis(snapshot.source_refs[0]));
    expect(result.model_execution.execution_metadata).toMatchObject({
      call_id: 'call-synthesis-1',
      purpose: 'critical_situation_synthesis',
      provider: 'mock_provider',
      requested_model: 'mock-model',
      provider_reported_model: 'mock-model-reported',
      temperature: 0,
      seed: 17,
      seed_support: 'provided',
      duration_ms: 8,
      retry_count: 0,
    });
    expect(result.resolved_prompt_metadata).toMatchObject({
      prompt_version: '0.1',
      prompt_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      skill_contract_version: '0.1',
      schema_version: '0.1',
    });
    expect(result.conformance_result?.valid).toBe(true);
  });

  it('returns no synthesis when provider output fails the dedicated Zod schema', async () => {
    const snapshot = authorizedSnapshot();
    const invalid = { ...insufficientSynthesis(snapshot.source_refs[0]), basis_status: 'unsupported' };
    const { model, adapter } = createAdapter(invalid);

    const result = await adapter.generate({
      authorized_snapshot: snapshot,
      call_id: 'call-schema-failure',
      model_metadata: modelMetadata,
    });

    expect(result.synthesis).toBeNull();
    expect(result.model_execution.error_type).toBe('SCHEMA_ERROR');
    expect(result.model_execution.validated_output).toBeNull();
    expect(result.conformance_result).toBeNull();
    expect(model.calls).toHaveLength(1);
  });

  it('classifies schema-valid but nonconforming output as CONTRACT_FAILURE without retrying', async () => {
    const snapshot = authorizedSnapshot();
    const invalid = insufficientSynthesis(snapshot.source_refs[0]);
    invalid.provenance[0].claim_ref = 'claim.with.no.output';
    const { model, adapter } = createAdapter(invalid);

    const result = await adapter.generate({
      authorized_snapshot: snapshot,
      call_id: 'call-contract-failure',
      model_metadata: modelMetadata,
    });

    expect(result.synthesis).toBeNull();
    expect(result.model_execution.error_type).toBe('CONTRACT_FAILURE');
    expect(result.model_execution.validated_output).toBeNull();
    expect(result.conformance_result?.valid).toBe(false);
    expect(result.conformance_result?.issues.map((issue) => issue.code)).toContain('invalid_provenance_reference');
    expect(model.calls).toHaveLength(1);
  });

  it('classifies a source reference outside the authorized snapshot as CONTRACT_FAILURE', async () => {
    const snapshot = authorizedSnapshot();
    const invalid = insufficientSynthesis(snapshot.source_refs[0]);
    invalid.provenance[0].source_refs = ['source:not-in-authorized-snapshot'];
    const { model, adapter } = createAdapter(invalid);

    const result = await adapter.generate({
      authorized_snapshot: snapshot,
      call_id: 'call-invalid-source-ref',
      model_metadata: modelMetadata,
    });

    expect(result.synthesis).toBeNull();
    expect(result.model_execution.error_type).toBe('CONTRACT_FAILURE');
    expect(result.conformance_result?.issues.some((issue) => issue.code === 'missing_reference')).toBe(true);
    expect(model.calls).toHaveLength(1);
  });

  it('accepts no_supported_insight and a null candidate first movement', async () => {
    const snapshot = authorizedSnapshot();
    const candidate = insufficientSynthesis(snapshot.source_refs[0]);
    const { adapter } = createAdapter(candidate);

    const result = await adapter.generate({
      authorized_snapshot: snapshot,
      call_id: 'call-partial-result',
      model_metadata: modelMetadata,
    });

    expect(result.synthesis?.situation_insight).toMatchObject({ status: 'no_supported_insight', statement: null });
    expect(result.synthesis?.candidate_first_movement).toBeNull();
    expect(result.conformance_result?.valid).toBe(true);
  });
});
