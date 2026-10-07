import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CriticalSituationSynthesis } from '../../backend/modules/portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import { criticalSituationSynthesisSchema } from '../../backend/modules/portfolio-entry-runtime/domain/critical-situation-synthesis.schema';
import { CriticalSituationSynthesisAdapter } from '../../backend/modules/portfolio-entry-runtime/agent/critical-situation-synthesis-adapter';
import type { LiveCandidateMetadata, ModelExecutionResult } from '../../backend/modules/portfolio-entry-runtime/model/model-execution-types';
import { FetchStructuredModelAdapter } from '../../backend/modules/portfolio-entry-runtime/model/fetch-structured-model-adapter';
import { loadPortfolioEntryProviderConfig } from '../../backend/modules/portfolio-entry-runtime/model/provider-config';
import type { StructuredModelAdapter, StructuredModelGenerateInput } from '../../backend/modules/portfolio-entry-runtime/model/structured-model-adapter';
import {
  normalizeCriticalSituationSynthesisInput,
  type CriticalSituationSynthesisAuthorizedSnapshot,
} from '../../backend/modules/portfolio-entry-runtime/synthesis/critical-situation-synthesis-input';
import { loadResolvedCriticalSituationSynthesisPromptManifest } from '../../backend/modules/portfolio-entry-runtime/prompts/kan-114/prompt-manifest';
import { CRITICAL_SITUATION_SYNTHESIS_FIXTURES, type CriticalSituationSynthesisFixture } from './fixtures.v0.1';
import {
  ADAPTABILITY_COMPARISON_PAIRS,
  CRITICAL_SITUATION_SYNTHESIS_REVIEW_MATRIX,
  SEMANTIC_REVIEW_DIMENSIONS,
  type ReviewExpectation,
  type SemanticReviewDimension,
} from './review-matrix.v0.1';

export type RunnerMode = 'mock' | 'live';
export type CheckStatus = 'valid' | 'invalid' | 'not_run';

export type SuiteRunOptions = {
  mode: RunnerMode;
  suiteVersion: string;
  repeats?: number;
  outputPath?: string;
  modelAdapter?: StructuredModelAdapter;
  modelMetadata?: LiveCandidateMetadata;
  now?: () => Date;
  opaqueId?: () => string;
};

export type FixtureExecution = {
  fixture_id: string;
  display_name: string;
  input_snapshot_references: {
    snapshot_id: string | null;
    captured_at: string | null;
    source_refs: string[];
    items: Array<{ ref: string; kind: string; evidence_preview: string; provenance: unknown | null }>;
  };
  synthesis: CriticalSituationSynthesis | null;
  schema_result: { status: CheckStatus; issues: Array<{ path: string; message: string }> };
  conformance_result: {
    status: CheckStatus;
    issues: Array<{ code: string; path: string; message: string }>;
  };
  execution_metadata: {
    suite_version: string;
    fixture_version: string;
    skill_contract_version: string;
    schema_version: string;
    prompt_version: string;
    prompt_hash: string;
    manifest_hash: string;
    provider: string;
    requested_model: string | null;
    reported_model: string | null;
    temperature: number | null;
    seed: string | number | null;
    seed_support: string;
    timestamp_utc: string;
    repeat_index: number;
    opaque_case_id: string;
    duration_ms: number;
    schema_status: CheckStatus;
    conformance_status: CheckStatus;
    error_type: string | null;
  };
};

export type SemanticReviewReport = {
  fixture_id: string;
  review_state: 'pending_human_review' | 'not_assessed_mock' | 'blocked_by_contract_failure';
  evaluation_expectation: ReviewExpectation;
  review_subject: {
    situation_insight: unknown;
    material_tensions: unknown[];
    decision_frame: unknown;
    usable_now: unknown[];
    decision_changing_unknowns: unknown[];
    candidate_first_movement: unknown;
    selected_lenses: string[];
  };
  dimensions: Record<SemanticReviewDimension, { assessment: string | null; notes: string | null }>;
};

export type AdaptabilityReviewReport = {
  method: string;
  automatic_verdict: null;
  comparisons: Array<{
    pair_id: string;
    contrast: string;
    review_state: 'pending_human_review' | 'not_assessed_mock';
    sides: Array<{
      fixture_id: string;
      selected_lenses: string[];
      decision_frame: { status: string | null; decision_to_prepare: string | null };
      tension_status: string[];
      first_movement: string | null;
      no_insight_status: string | null;
    }>;
    material_difference: boolean | null;
    reviewer_notes: string | null;
  }>;
};

export type EvaluationArtifact = {
  artifact_version: '0.1';
  mode: RunnerMode;
  run_metadata: {
    suite_version: string;
    fixture_version: string;
    skill_contract_version: string;
    schema_version: string;
    prompt_version: string;
    prompt_hash: string;
    manifest_hash: string;
    provider: string;
    requested_model: string | null;
    temperature: number | null;
    seed: string | number | null;
    seed_support: string;
    started_at_utc: string;
    repeat_count: number;
  };
  artifact_path: string;
  anti_overfit: { status: 'clear'; violations: [] };
  cases: FixtureExecution[];
  semantic_review: SemanticReviewReport[];
  adaptability_review: AdaptabilityReviewReport;
  interpretation_boundary: 'Contract conformance is automated. Semantic quality and adaptability require human review.';
};

type CandidateTransform = (candidate: CriticalSituationSynthesis) => unknown;

/** A deterministic plumbing-only model. Its output is not semantic evidence. */
export class MockStructuredModelAdapter implements StructuredModelAdapter {
  readonly calls: StructuredModelGenerateInput<unknown>[] = [];

  constructor(private readonly transform: CandidateTransform = (candidate) => candidate) {}

  async generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>> {
    this.calls.push(input as StructuredModelGenerateInput<unknown>);
    const snapshot = input.userPayload as CriticalSituationSynthesisAuthorizedSnapshot;
    const candidate = this.transform(mockNoInsightCandidate(snapshot.source_refs[0]));
    const parsed = input.outputSchema.safeParse(candidate);
    return {
      provider_raw: { mock: true },
      parsed_output: candidate,
      validated_output: parsed.success ? parsed.data : null,
      schema_errors: parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      execution_metadata: {
        call_id: input.call.call_id,
        case_id: input.call.case_id,
        repeat_index: input.call.repeat_index,
        purpose: input.call.purpose,
        provider: input.metadata.provider,
        requested_model: input.metadata.requested_model,
        provider_reported_model: 'mock-model-reported',
        model: input.metadata.model ?? 'mock-contract-plumbing',
        temperature: input.metadata.temperature,
        seed: input.metadata.seed,
        seed_support: input.metadata.seed_support,
        duration_ms: 1,
        retry_count: 0,
      },
      ...(parsed.success ? {} : { error_type: 'SCHEMA_ERROR' as const }),
    };
  }
}

export class LiveBlockedError extends Error {
  readonly code = 'LIVE_BLOCKED';

  constructor(message: string) {
    super(message);
    this.name = 'LiveBlockedError';
  }
}

export async function runEightFixtureSuite(options: SuiteRunOptions): Promise<EvaluationArtifact> {
  const repeats = options.repeats ?? 1;
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error('--repeats must be a positive integer.');

  const startedAt = (options.now ?? (() => new Date()))().toISOString();
  const id = options.opaqueId ?? randomUUID;
  const prompt = loadResolvedCriticalSituationSynthesisPromptManifest();
  const providerSetup = options.mode === 'live'
    ? await createLiveProvider(options.modelMetadata)
    : createMockProvider(options.modelMetadata);
  const modelAdapter = options.modelAdapter ?? providerSetup.adapter;
  const modelMetadata = options.modelMetadata ?? providerSetup.metadata;
  const antiOverfit = await checkRuntimeAntiOverfit();
  if (antiOverfit.status !== 'clear') {
    throw new Error(`Runtime anti-overfit check failed: ${antiOverfit.violations.join(', ')}`);
  }

  const outputPath = options.outputPath ?? defaultArtifactPath(options.suiteVersion, startedAt);
  const adapter = new CriticalSituationSynthesisAdapter(modelAdapter);
  const cases: FixtureExecution[] = [];
  const expectedPromptSignature = `${prompt.prompt_version}:${prompt.prompt_hash}:${prompt.prompt_manifest_hash}:${prompt.schema_version}`;

  for (let repeatIndex = 1; repeatIndex <= repeats; repeatIndex += 1) {
    for (const fixture of CRITICAL_SITUATION_SYNTHESIS_FIXTURES) {
      const timestamp = (options.now ?? (() => new Date()))().toISOString();
      const opaqueCaseId = id();
      const snapshotId = id();
      const messageId = id();
      const snapshot = normalizeCriticalSituationSynthesisInput({
        snapshot: { snapshot_id: snapshotId, captured_at: timestamp },
        user_messages: [{ id: messageId, text: fixture.user_message }],
      });

      const adapterResult = await adapter.generate({
        authorized_snapshot: snapshot,
        call_id: id(),
        model_metadata: modelMetadata as LiveCandidateMetadata & { requested_model: string; temperature: number },
      });
      const observedPrompt = adapterResult.resolved_prompt_metadata;
      const observedPromptSignature = `${observedPrompt.prompt_version}:${observedPrompt.prompt_hash}:${observedPrompt.prompt_manifest_hash}:${observedPrompt.schema_version}`;
      if (observedPromptSignature !== expectedPromptSignature) {
        throw new Error('Runtime prompt/schema configuration changed during the suite.');
      }

      const execution = adapterResult.model_execution;
      if (options.mode === 'live' && execution.error_type === 'TECHNICAL_ERROR') {
        throw new LiveBlockedError(summarizeLiveBlock(execution.technical_error));
      }
      const parsed = execution.error_type === 'TECHNICAL_ERROR'
        ? null
        : criticalSituationSynthesisSchema.safeParse(execution.parsed_output);
      const schemaStatus: CheckStatus = parsed === null ? 'not_run' : parsed.success ? 'valid' : 'invalid';
      const schemaIssues = parsed === null
        ? []
        : parsed.success
          ? []
          : parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
      if (!parsed?.success && schemaStatus === 'invalid' && execution.schema_errors.length > 0) {
        schemaIssues.push(...execution.schema_errors.map((message) => ({ path: '', message })));
      }
      const conformanceStatus: CheckStatus = adapterResult.conformance_result === null
        ? 'not_run'
        : adapterResult.conformance_result.valid ? 'valid' : 'invalid';
      const metadata = execution.execution_metadata;

      cases.push({
        fixture_id: fixture.fixture_id,
        display_name: fixture.display_name,
        input_snapshot_references: {
          snapshot_id: snapshot.snapshot_id,
          captured_at: snapshot.captured_at,
          source_refs: [...snapshot.source_refs],
          items: snapshot.items.map((item) => ({
            ref: item.ref,
            kind: item.kind,
            evidence_preview: typeof item.content === 'string' ? item.content : JSON.stringify(item.content),
            provenance: item.provenance,
          })),
        },
        synthesis: adapterResult.synthesis,
        schema_result: { status: schemaStatus, issues: schemaIssues },
        conformance_result: {
          status: conformanceStatus,
          issues: adapterResult.conformance_result?.issues.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message })) ?? [],
        },
        execution_metadata: {
          suite_version: options.suiteVersion,
          fixture_version: observedPrompt.fixture_spec_version,
          skill_contract_version: observedPrompt.skill_contract_version,
          schema_version: observedPrompt.schema_version,
          prompt_version: observedPrompt.prompt_version,
          prompt_hash: observedPrompt.prompt_hash,
          manifest_hash: observedPrompt.prompt_manifest_hash,
          provider: metadata.provider,
          requested_model: metadata.requested_model ?? modelMetadata.requested_model ?? null,
          reported_model: metadata.provider_reported_model ?? null,
          temperature: metadata.temperature ?? modelMetadata.temperature ?? null,
          seed: metadata.seed ?? modelMetadata.seed ?? null,
          seed_support: metadata.seed_support,
          timestamp_utc: timestamp,
          repeat_index: repeatIndex,
          opaque_case_id: opaqueCaseId,
          duration_ms: metadata.duration_ms,
          schema_status: schemaStatus,
          conformance_status: conformanceStatus,
          error_type: execution.error_type ?? null,
        },
      });
    }
  }

  const semanticReview = cases.map((item) => createSemanticReviewReport(item, options.mode));
  const artifact: EvaluationArtifact = {
    artifact_version: '0.1',
    mode: options.mode,
    run_metadata: {
      suite_version: options.suiteVersion,
      fixture_version: prompt.fixture_spec_version,
      skill_contract_version: prompt.skill_contract_version,
      schema_version: prompt.schema_version,
      prompt_version: prompt.prompt_version,
      prompt_hash: prompt.prompt_hash,
      manifest_hash: prompt.prompt_manifest_hash,
      provider: modelMetadata.provider,
      requested_model: modelMetadata.requested_model ?? modelMetadata.model ?? null,
      temperature: modelMetadata.temperature ?? null,
      seed: modelMetadata.seed ?? null,
      seed_support: modelMetadata.seed_support,
      started_at_utc: startedAt,
      repeat_count: repeats,
    },
    artifact_path: outputPath,
    anti_overfit: antiOverfit,
    cases,
    semantic_review: semanticReview,
    adaptability_review: buildAdaptabilityReviewReport(cases, options.mode),
    interpretation_boundary: 'Contract conformance is automated. Semantic quality and adaptability require human review.',
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return artifact;
}

export function createSemanticReviewReport(item: FixtureExecution, mode: RunnerMode): SemanticReviewReport {
  const synthesis = item.synthesis;
  const expectation = reviewExpectation(item.fixture_id);
  const dimensions = Object.fromEntries(SEMANTIC_REVIEW_DIMENSIONS.map((dimension) => [dimension, { assessment: null, notes: null }])) as Record<SemanticReviewDimension, { assessment: string | null; notes: string | null }>;
  return {
    fixture_id: item.fixture_id,
    review_state: mode === 'mock'
      ? 'not_assessed_mock'
      : synthesis
        ? 'pending_human_review'
        : 'blocked_by_contract_failure',
    evaluation_expectation: expectation,
    review_subject: {
      situation_insight: synthesis?.situation_insight ?? null,
      material_tensions: synthesis?.material_tensions ?? [],
      decision_frame: synthesis?.decision_frame ?? null,
      usable_now: synthesis?.usable_now ?? [],
      decision_changing_unknowns: synthesis?.decision_changing_unknowns ?? [],
      candidate_first_movement: synthesis?.candidate_first_movement ?? null,
      selected_lenses: synthesis?.reasoning_metadata.selected_lenses ?? [],
    },
    dimensions,
  };
}

export function buildAdaptabilityReviewReport(cases: FixtureExecution[], mode: RunnerMode): AdaptabilityReviewReport {
  const byId = new Map(cases.map((item) => [item.fixture_id, item]));
  return {
    method: 'Qualitative side-by-side review against the frozen contrast. No exact-match rule, embedding threshold, or automatic quality verdict.',
    automatic_verdict: null,
    comparisons: ADAPTABILITY_COMPARISON_PAIRS.map((pair) => ({
      pair_id: pair.pair_id,
      contrast: pair.contrast,
      review_state: mode === 'mock' ? 'not_assessed_mock' : 'pending_human_review',
      sides: pair.fixture_ids.map((fixtureId) => {
        const output = byId.get(fixtureId)?.synthesis;
        return {
          fixture_id: fixtureId,
          selected_lenses: output?.reasoning_metadata.selected_lenses ?? [],
          decision_frame: {
            status: output?.decision_frame.status ?? null,
            decision_to_prepare: output?.decision_frame.decision_to_prepare ?? null,
          },
          tension_status: output?.material_tensions.map((tension) => tension.status) ?? [],
          first_movement: output?.candidate_first_movement?.movement ?? null,
          no_insight_status: output?.situation_insight.status === 'no_supported_insight' ? 'no_supported_insight' : output ? 'supported' : null,
        };
      }),
      material_difference: null,
      reviewer_notes: null,
    })),
  };
}

export async function checkRuntimeAntiOverfit(): Promise<{ status: 'clear'; violations: [] } | { status: 'violations'; violations: string[] }> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const runtimeFiles = [
    'backend/modules/portfolio-entry-runtime/agent/critical-situation-synthesis-adapter.ts',
    'backend/modules/portfolio-entry-runtime/domain/critical-situation-synthesis.schema.ts',
    'backend/modules/portfolio-entry-runtime/model/critical-situation-synthesis-provider-schema.ts',
    'backend/modules/portfolio-entry-runtime/model/structured-model-adapter.ts',
    'backend/modules/portfolio-entry-runtime/model/fetch-structured-model-adapter.ts',
    'backend/modules/portfolio-entry-runtime/model/provider-config.ts',
    'backend/modules/portfolio-entry-runtime/synthesis/critical-situation-synthesis-input.ts',
    'backend/modules/portfolio-entry-runtime/synthesis/critical-situation-synthesis-conformance.ts',
    'backend/modules/portfolio-entry-runtime/prompts/kan-114/prompt-manifest.ts',
    'backend/modules/portfolio-entry-runtime/prompts/kan-114/v0.1/manifest.json',
    'backend/modules/portfolio-entry-runtime/prompts/kan-114/v0.1/critical-situation-synthesis.md',
    'backend/modules/portfolio-entry-runtime/prompts/kan-114/v0.2/manifest.json',
    'backend/modules/portfolio-entry-runtime/prompts/kan-114/v0.2/critical-situation-synthesis.md',
  ];
  const prohibited = /\bLaura\b|\bchurn\b|\baccelerator\b|\bregulatory\b|\bCS-0[1-8]\b|expected[_ -]outputs?|expected[_ -]lenses|review[_ -]pairs|comparison[_ -]pairs|paired[_ -]contrast/gi;
  const violations: string[] = [];
  for (const relativePath of runtimeFiles) {
    const source = await readFile(path.join(projectRoot, relativePath), 'utf8');
    if (prohibited.test(source)) violations.push(relativePath);
    prohibited.lastIndex = 0;
  }
  return violations.length === 0 ? { status: 'clear', violations: [] } : { status: 'violations', violations };
}

function mockNoInsightCandidate(sourceRef: string | undefined): CriticalSituationSynthesis {
  const ref = sourceRef ?? 'source:opaque';
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
      id: 'mock-decision-authority',
      claim_ref: 'decision_frame.decision_authority',
      origin: 'AI_INFERRED',
      review_disposition: 'UNREVIEWED',
      source_refs: [ref],
      source_path: null,
      source_text: null,
      recorded_at: null,
    }],
  };
}

function reviewExpectation(fixtureId: string): ReviewExpectation {
  const found = CRITICAL_SITUATION_SYNTHESIS_REVIEW_MATRIX.find((item) => item.fixture_id === fixtureId);
  if (!found) throw new Error(`Missing review expectation for ${fixtureId}.`);
  return found;
}

async function createLiveProvider(modelMetadataOverride?: LiveCandidateMetadata): Promise<{ adapter: StructuredModelAdapter; metadata: LiveCandidateMetadata }> {
  try {
    loadDotEnvFromFrontWorkspace();
    const config = loadPortfolioEntryProviderConfig();
    return {
      adapter: new FetchStructuredModelAdapter(config),
      metadata: modelMetadataOverride ?? {
        provider: config.provider,
        requested_model: config.model,
        model: config.model,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.seed !== undefined ? { seed: config.seed } : {}),
        seed_support: config.seed === undefined ? 'not_requested' : 'unavailable',
      },
    };
  } catch (error) {
    const detail = error instanceof Error && /API_KEY is required/i.test(error.message)
      ? 'provider API key is missing'
      : 'provider configuration is unavailable';
    throw new LiveBlockedError(detail);
  }
}

function createMockProvider(modelMetadataOverride?: LiveCandidateMetadata): { adapter: StructuredModelAdapter; metadata: LiveCandidateMetadata } {
  return {
    adapter: new MockStructuredModelAdapter(),
    metadata: modelMetadataOverride ?? {
      provider: 'mock',
      requested_model: 'mock-contract-plumbing',
      model: 'mock-contract-plumbing',
      temperature: 0,
      seed_support: 'not_requested',
    },
  };
}

function loadDotEnvFromFrontWorkspace(): void {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const requireFromWorkspace = createRequire(packagePath);
    const dotenv = requireFromWorkspace('dotenv') as { config: (options?: { path?: string }) => unknown };
    dotenv.config({ path: path.join(process.cwd(), '.env') });
  } catch {
    // The existing provider config may be supplied directly by the process environment.
  }
}

function summarizeLiveBlock(message?: string): string {
  if (!message) return 'provider/network execution failed';
  if (/timeout/i.test(message)) return 'provider timeout';
  if (/status=(401|403)\b/i.test(message)) return 'provider authentication/configuration failed';
  if (/status=5\d\d\b/i.test(message)) return 'provider unavailable';
  if (/transport failure/i.test(message)) return 'network or provider transport unavailable';
  return 'provider request failed';
}

function defaultArtifactPath(suiteVersion: string, startedAtUtc: string): string {
  const safeSuite = suiteVersion.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeTimestamp = startedAtUtc.replace(/[:.]/g, '-');
  return path.join(os.tmpdir(), 'starteria-evaluation-artifacts', 'KAN-114', `${safeSuite}-${safeTimestamp}-${randomUUID()}.json`);
}

function parseArgs(args: string[]): { mode: RunnerMode; suiteVersion: string; repeats: number; outputPath?: string } {
  let mode: RunnerMode | undefined;
  let suiteVersion = 'KAN-114-v0.1';
  let repeats = 1;
  let outputPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === '--mode' && (value === 'mock' || value === 'live')) { mode = value; index += 1; }
    else if (arg === '--suite' && value) { suiteVersion = value; index += 1; }
    else if (arg === '--repeats' && value) { repeats = Number(value); index += 1; }
    else if (arg === '--output' && value) { outputPath = path.resolve(value); index += 1; }
    else if (arg === '--help') {
      process.stdout.write('Usage: tsx run-eight-fixtures.ts --mode mock|live [--suite KAN-114-v0.1] [--repeats 1] [--output <temp-path>]\n');
      process.exit(0);
    } else throw new Error(`Unsupported or incomplete argument: ${arg}`);
  }
  if (!mode) throw new Error('--mode mock or --mode live is required.');
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error('--repeats must be a positive integer.');
  return { mode, suiteVersion, repeats, outputPath };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const artifact = await runEightFixtureSuite(args);
    process.stdout.write(`${JSON.stringify({
      status: 'COMPLETE',
      mode: artifact.mode,
      provider: artifact.run_metadata.provider,
      requested_model: artifact.run_metadata.requested_model,
      cases: artifact.cases.length,
      contract_conformance: {
        valid: artifact.cases.filter((item) => item.conformance_result.status === 'valid').length,
        invalid: artifact.cases.filter((item) => item.conformance_result.status === 'invalid').length,
        not_run: artifact.cases.filter((item) => item.conformance_result.status === 'not_run').length,
      },
      semantic_review: artifact.mode === 'mock' ? 'not assessed in mock mode' : 'human review pending',
      artifact_path: artifact.artifact_path,
    }, null, 2)}\n`);
  } catch (error) {
    if (error instanceof LiveBlockedError) {
      process.stderr.write(`LIVE_BLOCKED: ${error.message}\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`RUNNER_ERROR: ${error instanceof Error ? error.message : 'unknown failure'}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) void main();

export type { CriticalSituationSynthesisFixture };
