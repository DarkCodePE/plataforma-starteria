import { performance } from 'node:perf_hooks';
import type { StructuredModelAdapter, StructuredModelGenerateInput } from './structured-model-adapter';
import type { PortfolioEntryProviderConfig } from './provider-config';
import { shouldRetryModelExecution } from './retry-policy';
import type { ModelExecutionResult } from '../model/model-execution-types';

type FetchLike = typeof fetch;

export class FetchStructuredModelAdapter implements StructuredModelAdapter {
  constructor(
    private readonly config: PortfolioEntryProviderConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async generate<T>(input: StructuredModelGenerateInput<T>): Promise<ModelExecutionResult<T>> {
    let attempt = 0;
    let retryReason: string | undefined;

    while (true) {
      attempt += 1;
      const started = performance.now();
      try {
        const providerRaw = await this.callProvider(input);
        const duration = Math.round(performance.now() - started);
        const parsed = parseProviderOutput(providerRaw);
        if (!parsed.success) {
          return this.result(input, providerRaw, null, null, ['error' in parsed ? parsed.error : 'Invalid provider output'], duration, attempt - 1, retryReason, 'SCHEMA_ERROR');
        }

        const validationInput = input.preserveProviderNulls
          ? parsed.output
          : removeProviderNullOptionals(parsed.output);
        const validated = input.outputSchema.safeParse(validationInput);
        if (!validated.success) {
          return this.result(input, providerRaw, parsed.output, null, validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`), duration, attempt - 1, retryReason, 'SCHEMA_ERROR');
        }

        return this.result(input, providerRaw, parsed.output, validated.data, [], duration, attempt - 1, retryReason);
      } catch (error) {
        const duration = Math.round(performance.now() - started);
        const errorKind = classifyTechnicalError(error);
        const decision = shouldRetryModelExecution({ errorType: errorKind, attempt });
        if (decision.retry) {
          retryReason = decision.reason;
          continue;
        }
        return {
          provider_raw: error instanceof ProviderRequestError ? error.providerRaw : null,
          parsed_output: null,
          validated_output: null,
          schema_errors: [],
          execution_metadata: this.metadata(input, duration, attempt - 1, retryReason, error instanceof ProviderRequestError ? error.providerRaw : undefined),
          error_type: 'TECHNICAL_ERROR',
          technical_error: error instanceof ProviderRequestError
            ? error.message
            : error instanceof Error && error.name === 'AbortError'
              ? `Provider timeout: ${this.config.provider} ${safeEndpoint(this.config.baseUrl)} model=${this.config.model}`
              : `Provider transport failure: ${this.config.provider} ${safeEndpoint(this.config.baseUrl)} model=${this.config.model}`,
        };
      }
    }
  }

  private async callProvider<T>(input: StructuredModelGenerateInput<T>): Promise<unknown> {
    if (this.config.provider !== 'openai_responses' && this.config.provider !== 'deepseek_responses') {
      throw new Error(`Unsupported Portfolio Entry harness provider: ${this.config.provider}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          ...(this.config.temperature !== undefined ? { temperature: this.config.temperature } : {}),
          input: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: JSON.stringify(input.userPayload) },
          ],
          text: input.providerJsonSchema ? {
            format: {
              type: 'json_schema',
              name: input.call.purpose,
              strict: true,
              schema: input.providerJsonSchema,
            },
          } : {
            format: { type: 'json_object' },
          },
        }),
        signal: controller.signal,
      });

      const bodyText = await response.text();
      let body: unknown = bodyText;
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }

      if (!response.ok) {
        throw new ProviderRequestError(
          `Provider request failed: provider=${this.config.provider} endpoint=${safeEndpoint(this.config.baseUrl)} model=${this.config.model} status=${response.status} error=${sanitizedProviderError(body)}`,
          response.status,
          { status: response.status, error: sanitizedProviderError(body) },
        );
      }

      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  private result<T>(
    input: StructuredModelGenerateInput<T>,
    providerRaw: unknown,
    parsedOutput: unknown,
    validatedOutput: T | null,
    schemaErrors: string[],
    durationMs: number,
    retryCount: number,
    retryReason?: string,
    errorType?: 'SCHEMA_ERROR',
  ): ModelExecutionResult<T> {
    return {
      provider_raw: providerRaw,
      parsed_output: parsedOutput,
      validated_output: validatedOutput,
      schema_errors: schemaErrors,
      execution_metadata: this.metadata(input, durationMs, retryCount, retryReason, providerRaw),
      error_type: errorType,
    };
  }

  private metadata<T>(
    input: StructuredModelGenerateInput<T>,
    durationMs: number,
    retryCount: number,
    retryReason?: string,
    providerRaw?: unknown,
  ): ModelExecutionResult<T>['execution_metadata'] {
    return {
      call_id: input.call.call_id,
      case_id: input.call.case_id,
      repeat_index: input.call.repeat_index,
      turn_index: input.call.turn_index,
      purpose: input.call.purpose,
      provider: this.config.provider,
      requested_model: this.config.model,
      provider_reported_model: extractProviderReportedModel(providerRaw),
      model: this.config.model,
      ...(this.config.temperature !== undefined ? { temperature: this.config.temperature } : {}),
      seed: this.config.seed,
      seed_support: this.config.seed === undefined ? 'not_requested' : 'unavailable',
      duration_ms: durationMs,
      retry_count: retryCount,
      retry_reason: retryReason,
      usage: extractUsage(providerRaw),
      fallback_used: false,
    };
  }
}

function sanitizedProviderError(body: unknown): string {
  if (!body || typeof body !== 'object') return 'unspecified';
  const error = (body as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return 'unspecified';
  const record = error as Record<string, unknown>;
  const parts = [record.type, record.code]
    .filter((value): value is string => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value));
  return parts.length ? parts.join('/') : 'unspecified';
}

function safeEndpoint(baseUrl: string): string {
  try {
    const endpoint = new URL(`${baseUrl}/responses`);
    return endpoint.origin + endpoint.pathname;
  } catch {
    return 'invalid-url';
  }
}

class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerRaw: unknown,
  ) {
    super(message);
    this.name = 'ProviderRequestError';
  }
}

function parseProviderOutput(providerRaw: unknown): { success: true; output: unknown } | { success: false; error: string } {
  const extracted = extractText(providerRaw);
  if (!extracted.success) return { success: false, error: 'error' in extracted ? extracted.error : 'Provider output extraction failed.' };
  try {
    return { success: true, output: JSON.parse(extracted.text) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function extractText(providerRaw: unknown): { success: true; text: string } | { success: false; error: string } {
  if (providerRaw && typeof providerRaw === 'object') {
    const record = providerRaw as Record<string, unknown>;
    if (Array.isArray(record.output)) {
      const texts: string[] = [];
      for (const item of record.output) {
        if (!item || typeof item !== 'object') continue;
        const itemRecord = item as Record<string, unknown>;
        if (itemRecord.type !== 'message') continue;
        const content = itemRecord.content;
        if (!Array.isArray(content)) continue;
        for (const contentItem of content) {
          if (!contentItem || typeof contentItem !== 'object') continue;
          const contentRecord = contentItem as Record<string, unknown>;
          if (contentRecord.type !== 'output_text') continue;
          if (typeof contentRecord.text === 'string') texts.push(contentRecord.text);
        }
      }
      if (texts.length === 0) return { success: false, error: 'Provider response did not contain message output_text structured output.' };
      if (texts.length > 1) return { success: false, error: 'Provider response contained multiple message output_text candidates.' };
      if (texts[0].trim() === '') return { success: false, error: 'Provider response contained empty message output_text structured output.' };
      return { success: true, text: texts[0] };
    }
    if (typeof record.output_text === 'string') {
      if (record.output_text.trim() === '') return { success: false, error: 'Provider response contained empty structured output text.' };
      return { success: true, text: record.output_text };
    }
  }
  if (typeof providerRaw === 'string') {
    if (providerRaw.trim() === '') return { success: false, error: 'Provider response contained empty structured output text.' };
    return { success: true, text: providerRaw };
  }
  return { success: false, error: 'Provider response did not contain structured output text.' };
}

function extractUsage(providerRaw: unknown): unknown {
  if (providerRaw && typeof providerRaw === 'object' && 'usage' in providerRaw) {
    return (providerRaw as { usage: unknown }).usage;
  }
  return undefined;
}

function extractProviderReportedModel(providerRaw: unknown): string | undefined {
  if (providerRaw && typeof providerRaw === 'object' && 'model' in providerRaw) {
    const model = (providerRaw as { model: unknown }).model;
    return typeof model === 'string' && model.trim() ? model : undefined;
  }
  return undefined;
}

function classifyTechnicalError(error: unknown): 'timeout' | 'rate_limit' | 'transport' | 'provider_5xx' | 'provider_auth' | 'provider_request_error' {
  if (error instanceof Error && error.name === 'AbortError') return 'timeout';
  const status = error && typeof error === 'object' && 'status' in error ? Number((error as { status: unknown }).status) : undefined;
  if (status === 429) return 'rate_limit';
  if (status !== undefined && status >= 500) return 'provider_5xx';
  if (status !== undefined && (status === 401 || status === 403)) return 'provider_auth';
  if (status !== undefined && status >= 400) return 'provider_request_error';
  return 'transport';
}

function removeProviderNullOptionals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeProviderNullOptionals);
  if (!value || typeof value !== 'object') return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === null) continue;
    normalized[key] = removeProviderNullOptionals(child);
  }
  return normalized;
}
