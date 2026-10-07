import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CRITICAL_SITUATION_SYNTHESIS_FIXTURES } from './fixtures.v0.1';
import { CRITICAL_SITUATION_SYNTHESIS_REVIEW_MATRIX } from './review-matrix.v0.1';
import {
  MockStructuredModelAdapter,
  buildAdaptabilityReviewReport,
  runEightFixtureSuite,
} from './run-eight-fixtures';

const opaqueId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('KAN-114 isolated eight-fixture evaluation runner', () => {
  it('loads all eight frozen inputs without putting evaluation expectations in the adapter payload', async () => {
    expect(CRITICAL_SITUATION_SYNTHESIS_FIXTURES).toHaveLength(8);
    expect(CRITICAL_SITUATION_SYNTHESIS_REVIEW_MATRIX).toHaveLength(8);

    const model = new MockStructuredModelAdapter();
    const artifact = await runEightFixtureSuite({
      mode: 'mock',
      suiteVersion: 'KAN-114-v0.1',
      repeats: 1,
      modelAdapter: model,
      outputPath: path.join(os.tmpdir(), `kan-114-isolation-${Date.now()}.json`),
    });

    expect(artifact.cases).toHaveLength(8);
    expect(model.calls).toHaveLength(8);
    for (const call of model.calls) {
      const serialized = JSON.stringify(call.userPayload);
      expect(serialized).not.toMatch(/CS-0[1-8]|expected_lenses|forbidden_lenses|review_rubric|comparison_pairs|paired_contrast/i);
      expect(call.userPayload).not.toHaveProperty('fixture_id');
      expect(call.userPayload).not.toHaveProperty('expected_lenses');
      expect(call.userPayload).not.toHaveProperty('review_matrix');
      expect(call.userPayload).not.toHaveProperty('comparison_pairs');
      expect(call.call.case_id).toBeUndefined();
      expect(call.call.call_id).toMatch(opaqueId);
    }
  });

  it('uses opaque snapshot references and one provider/model/prompt/schema configuration for every fixture', async () => {
    const model = new MockStructuredModelAdapter();
    const artifact = await runEightFixtureSuite({
      mode: 'mock',
      suiteVersion: 'KAN-114-v0.1',
      repeats: 1,
      modelAdapter: model,
      outputPath: path.join(os.tmpdir(), `kan-114-config-${Date.now()}.json`),
    });

    const callMetadata = model.calls.map((call) => call.metadata);
    expect(callMetadata.every((metadata) => JSON.stringify(metadata) === JSON.stringify(callMetadata[0]))).toBe(true);
    expect(model.calls.every((call) => call.outputSchema === model.calls[0].outputSchema)).toBe(true);
    expect(model.calls.every((call) => JSON.stringify(call.providerJsonSchema) === JSON.stringify(model.calls[0].providerJsonSchema))).toBe(true);

    for (const item of artifact.cases) {
      expect(item.execution_metadata.opaque_case_id).toMatch(opaqueId);
      expect(item.input_snapshot_references.snapshot_id).toMatch(opaqueId);
      expect(item.input_snapshot_references.source_refs.every((ref) => !ref.includes(item.fixture_id))).toBe(true);
      expect(item.execution_metadata.prompt_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(item.execution_metadata.manifest_hash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('writes run metadata and per-case evidence without storing provider responses or private reasoning', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'kan-114-artifact-'));
    const outputPath = path.join(directory, 'evaluation.json');
    try {
      const artifact = await runEightFixtureSuite({
        mode: 'mock',
        suiteVersion: 'KAN-114-v0.1',
        repeats: 1,
        outputPath,
      });
      const saved = JSON.parse(await readFile(outputPath, 'utf8')) as typeof artifact;
      expect(saved.run_metadata).toMatchObject({
        suite_version: 'KAN-114-v0.1',
        fixture_version: '0.1',
        skill_contract_version: '0.1',
        schema_version: '0.1',
        prompt_version: '0.2',
        provider: 'mock',
        requested_model: 'mock-contract-plumbing',
      });
      expect(saved.run_metadata.started_at_utc).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(saved.cases[0]).toHaveProperty('input_snapshot_references.source_refs');
      expect(saved.cases[0]).toHaveProperty('synthesis');
      expect(saved.cases[0]).toHaveProperty('schema_result');
      expect(saved.cases[0]).toHaveProperty('conformance_result');
      expect(saved.cases[0]).toHaveProperty('execution_metadata.duration_ms');
      expect(saved.cases[0]).not.toHaveProperty('provider_raw');
      expect(JSON.stringify(saved)).not.toMatch(/chain.of.thought|private reasoning|hidden deliberation/i);
      expect(saved.semantic_review.every((review) => review.review_state === 'not_assessed_mock')).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('keeps contract conformance failures separate from pending semantic review', async () => {
    const model = new MockStructuredModelAdapter((candidate) => {
      const invalid = structuredClone(candidate);
      invalid.provenance[0].claim_ref = 'unmatched.claim';
      return invalid;
    });
    const artifact = await runEightFixtureSuite({
      mode: 'mock',
      suiteVersion: 'KAN-114-v0.1',
      repeats: 1,
      modelAdapter: model,
      outputPath: path.join(os.tmpdir(), `kan-114-contract-${Date.now()}.json`),
    });

    expect(artifact.cases.every((item) => item.schema_result.status === 'valid')).toBe(true);
    expect(artifact.cases.every((item) => item.conformance_result.status === 'invalid')).toBe(true);
    expect(artifact.semantic_review.every((review) => review.review_state === 'not_assessed_mock')).toBe(true);
    expect(artifact.semantic_review.every((review) => Object.values(review.dimensions).every((dimension) => dimension.assessment === null))).toBe(true);
  });

  it('allows CS-06 to carry a null first movement and reports explicit, human-decided contrast pairs', async () => {
    const artifact = await runEightFixtureSuite({
      mode: 'mock',
      suiteVersion: 'KAN-114-v0.1',
      repeats: 1,
      outputPath: path.join(os.tmpdir(), `kan-114-null-movement-${Date.now()}.json`),
    });
    const ambiguous = artifact.cases.find((item) => item.fixture_id === 'CS-06');
    expect(ambiguous?.synthesis?.candidate_first_movement).toBeNull();
    expect(ambiguous?.conformance_result.status).toBe('valid');

    const comparisons = buildAdaptabilityReviewReport(artifact.cases, 'mock');
    expect(comparisons.comparisons.map((pair) => pair.pair_id)).toEqual([
      'CS-01-vs-CS-05',
      'CS-02-vs-CS-05',
      'CS-03-vs-CS-07',
      'CS-04-vs-CS-07',
      'CS-08-vs-multi-initiative',
    ]);
    expect(comparisons.automatic_verdict).toBeNull();
    expect(comparisons.comparisons[0].sides[0]).toHaveProperty('selected_lenses');
    expect(comparisons.comparisons[0].sides[0]).toHaveProperty('decision_frame');
    expect(comparisons.comparisons[0].sides[0]).toHaveProperty('tension_status');
    expect(comparisons.comparisons[0].sides[0]).toHaveProperty('first_movement');
    expect(comparisons.comparisons[0].sides[0]).toHaveProperty('no_insight_status');
  });

  it('keeps fixture-specific details out of the runtime prompt, adapter, schema and conformance code', async () => {
    const result = await runEightFixtureSuite({
      mode: 'mock',
      suiteVersion: 'KAN-114-v0.1',
      repeats: 1,
      outputPath: path.join(os.tmpdir(), `kan-114-anti-overfit-${Date.now()}.json`),
    });
    expect(result.anti_overfit.status).toBe('clear');
    expect(result.anti_overfit.violations).toEqual([]);
  });
});
