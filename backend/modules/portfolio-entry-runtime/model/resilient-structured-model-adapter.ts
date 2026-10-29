import type { ModelExecutionResult } from './model-execution-types';
import type { StructuredModelAdapter, StructuredModelGenerateInput } from './structured-model-adapter';

/**
 * Provider resilience boundary. The primary adapter owns its technical retry;
 * this boundary is the finite provider/model fallback and never retries a
 * request validation or authentication failure.
 */
export class ResilientStructuredModelAdapter implements StructuredModelAdapter {
  constructor(
    private readonly primary: StructuredModelAdapter,
    private readonly fallback?: StructuredModelAdapter,
  ) {}

  async generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>> {
    let primary: ModelExecutionResult<T>;
    try {
      primary = await this.primary.generate(input);
    } catch (error) {
      if (!this.fallback || !isFallbackEligibleError(error)) throw error;
      const fallback = await this.fallback.generate(input);
      return markFallback(fallback);
    }
    if (primary.validated_output || !this.fallback || !isFallbackEligibleResult(primary)) return primary;
    const fallback = await this.fallback.generate(input);
    return fallback.validated_output ? markFallback(fallback) : primary;
  }
}

function markFallback<T>(result: ModelExecutionResult<T>): ModelExecutionResult<T> {
  return { ...result, execution_metadata: { ...result.execution_metadata, fallback_used: true } };
}

function isFallbackEligibleResult(result: ModelExecutionResult<unknown>): boolean {
  if (result.error_type === 'SCHEMA_ERROR') return true;
  const technical = result.technical_error ?? '';
  return /timeout|transport|status=(429|5\d\d)|status=429|provider request failed/i.test(technical)
    && !/status=4(?!29|02)\d\d|auth|configuration|config/i.test(technical);
}

function isFallbackEligibleError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|transport|status=(429|5\d\d)|provider request failed|schema/i.test(message)
    && !/status=4(?!29|02)\d\d|auth|configuration|config/i.test(message);
}
