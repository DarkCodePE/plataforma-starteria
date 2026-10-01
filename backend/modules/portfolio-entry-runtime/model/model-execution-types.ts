export type ModelExecutionErrorType =
  | 'TECHNICAL_ERROR'
  | 'SCHEMA_ERROR'
  | 'CONTRACT_FAILURE'
  | 'HYPOTHESIS_RESULT';

export type ModelExecutionPurpose = 'analysis_turn' | 'handoff_generation' | 'technical_smoke';

export type SeedSupport = 'provided' | 'unavailable' | 'not_requested';

export type RuntimeModelRequestMetadata = {
  provider: string;
  requested_model?: string;
  provider_reported_model?: string;
  model?: string;
  model_version_if_available?: string;
  temperature?: number;
  seed?: string | number;
  seed_support: SeedSupport;
  [key: string]: unknown;
};

export type ModelExecutionMetadata = {
  call_id: string;
  case_id?: string;
  repeat_index?: number;
  turn_index?: number;
  purpose: ModelExecutionPurpose;
  provider: string;
  requested_model?: string;
  provider_reported_model?: string;
  model: string;
  model_version_if_available?: string;
  temperature?: number;
  seed?: string | number;
  seed_support: SeedSupport;
  duration_ms: number;
  retry_count: number;
  retry_reason?: string;
  usage?: unknown;
  fallback_used?: boolean;
  // ADR-032: presente cuando Jev clasificó el turno (o no estuvo disponible).
  classifier?: {
    provider: 'jev' | 'jev_unavailable';
    model?: string;
    confidence: { frame: number; primary_intent: number };
    duration_ms: number;
    error?: string;
  };
};

export type ModelExecutionResult<T> = {
  provider_raw: unknown;
  parsed_output: unknown;
  validated_output: T | null;
  schema_errors: string[];
  execution_metadata: ModelExecutionMetadata;
  error_type?: ModelExecutionErrorType;
  technical_error?: string;
};

export type LiveCandidateMetadata = RuntimeModelRequestMetadata;
