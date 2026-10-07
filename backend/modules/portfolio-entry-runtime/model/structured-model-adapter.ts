import type { ZodType } from 'zod';
import type { LiveCandidateMetadata, ModelExecutionPurpose, ModelExecutionResult } from './model-execution-types';

export type StructuredModelGenerateInput<T> = {
  systemPrompt: string;
  userPayload: unknown;
  outputSchema: ZodType<T>;
  providerJsonSchema?: unknown;
  preserveProviderNulls?: boolean;
  metadata: LiveCandidateMetadata;
  call: {
    call_id: string;
    purpose: ModelExecutionPurpose;
    case_id?: string;
    repeat_index?: number;
    turn_index?: number;
  };
};

export interface StructuredModelAdapter {
  generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>>;
}
