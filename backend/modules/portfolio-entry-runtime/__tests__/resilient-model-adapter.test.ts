import { describe, expect, it, vi } from 'vitest';
import { ResilientStructuredModelAdapter } from '../model/resilient-structured-model-adapter';
import type { StructuredModelAdapter } from '../model/structured-model-adapter';

const input = {} as Parameters<StructuredModelAdapter['generate']>[0];

function result(provider: string, output: unknown, error_type?: 'SCHEMA_ERROR' | 'TECHNICAL_ERROR') {
  return {
    provider_raw: null,
    parsed_output: output,
    validated_output: error_type ? null : output,
    schema_errors: error_type === 'SCHEMA_ERROR' ? ['invalid'] : [],
    execution_metadata: { call_id: 'call', purpose: 'analysis_turn' as const, provider, model: provider, seed_support: 'not_requested' as const, duration_ms: 1, retry_count: 1 },
    error_type,
    technical_error: error_type === 'TECHNICAL_ERROR' ? 'Provider request failed status=503' : undefined,
  };
}

describe('ResilientStructuredModelAdapter', () => {
  it('uses fallback after primary technical failure and preserves final provider metadata', async () => {
    const primary = { generate: vi.fn().mockResolvedValue(result('primary', null, 'TECHNICAL_ERROR')) } as unknown as StructuredModelAdapter;
    const fallback = { generate: vi.fn().mockResolvedValue(result('fallback', { ok: true })) } as unknown as StructuredModelAdapter;
    const output = await new ResilientStructuredModelAdapter(primary, fallback).generate(input);
    expect(fallback.generate).toHaveBeenCalledOnce();
    expect(output.validated_output).toEqual({ ok: true });
    expect(output.execution_metadata.provider).toBe('fallback');
  });

  it('uses fallback for schema-invalid output', async () => {
    const primary = { generate: vi.fn().mockResolvedValue(result('primary', { malformed: true }, 'SCHEMA_ERROR')) } as unknown as StructuredModelAdapter;
    const fallback = { generate: vi.fn().mockResolvedValue(result('fallback', { valid: true })) } as unknown as StructuredModelAdapter;
    const output = await new ResilientStructuredModelAdapter(primary, fallback).generate(input);
    expect(output.validated_output).toEqual({ valid: true });
  });

  it.each([400, 404, 422])('does not use fallback for request rejection %s, returned or thrown', async (status) => {
    const message = `Provider request failed status=${status}`;
    for (const thrown of [false, true]) {
      const failure = { ...result('primary', null, 'TECHNICAL_ERROR'), technical_error: message };
      const generate = thrown ? vi.fn().mockRejectedValue(new Error(message)) : vi.fn().mockResolvedValue(failure);
      const primary = { generate } as unknown as StructuredModelAdapter;
      const fallback = { generate: vi.fn() } as unknown as StructuredModelAdapter;
      const attempt = new ResilientStructuredModelAdapter(primary, fallback).generate(input);
      if (thrown) await expect(attempt).rejects.toThrow(message);
      else expect(await attempt).toEqual(failure);
      expect(fallback.generate).not.toHaveBeenCalled();
    }
  });

  it('keeps fallback for rate limiting', async () => {
    const primary = { generate: vi.fn().mockResolvedValue({ ...result('primary', null, 'TECHNICAL_ERROR'), technical_error: 'Provider request failed status=429' }) } as unknown as StructuredModelAdapter;
    const fallback = { generate: vi.fn().mockResolvedValue(result('fallback', { ok: true })) } as unknown as StructuredModelAdapter;
    expect((await new ResilientStructuredModelAdapter(primary, fallback).generate(input)).validated_output).toEqual({ ok: true });
    expect(fallback.generate).toHaveBeenCalledOnce();
  });

  it('does not use fallback for auth failures', async () => {
    const primary = { generate: vi.fn().mockResolvedValue({ ...result('primary', null, 'TECHNICAL_ERROR'), technical_error: 'Provider request failed status=401' }) } as unknown as StructuredModelAdapter;
    const fallback = { generate: vi.fn() } as unknown as StructuredModelAdapter;
    const output = await new ResilientStructuredModelAdapter(primary, fallback).generate(input);
    expect(fallback.generate).not.toHaveBeenCalled();
    expect(output.execution_metadata.provider).toBe('primary');
  });
});
