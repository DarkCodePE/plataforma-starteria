import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  loadResolvedCriticalSituationSynthesisPromptManifest,
  resolveCriticalSituationSynthesisPromptManifest,
} from '../prompts/kan-114/prompt-manifest';

describe('KAN-114 isolated prompt manifest', () => {
  it('loads and validates the independently versioned prompt contract', () => {
    const resolved = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(resolved).toMatchObject({
      prompt_version: '0.1',
      skill_id: 'entry-05-critical-situation-synthesis',
      skill_contract_version: '0.1',
      fixture_spec_version: '0.1',
      schema_version: '0.1',
    });
    expect(resolved.files).toEqual({ critical_situation_synthesis: 'critical-situation-synthesis.md' });
    expect(Object.keys(resolved.file_hashes)).toEqual(['critical-situation-synthesis.md']);
    expect(resolved.prompt_hash).toBe(resolved.file_hashes['critical-situation-synthesis.md']);
    expect(resolved.prompt_manifest_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('calculates the prompt and resolved-manifest SHA-256 hashes deterministically', () => {
    const first = loadResolvedCriticalSituationSynthesisPromptManifest();
    const second = loadResolvedCriticalSituationSynthesisPromptManifest();
    const promptHash = createHash('sha256').update(first.prompt_text).digest('hex');
    const manifestHash = createHash('sha256')
      .update(JSON.stringify({
        prompt_version: first.prompt_version,
        skill_id: first.skill_id,
        skill_contract_version: first.skill_contract_version,
        fixture_spec_version: first.fixture_spec_version,
        schema_version: first.schema_version,
        files: first.files,
        file_hashes: first.file_hashes,
      }))
      .digest('hex');

    expect(first.prompt_hash).toBe(promptHash);
    expect(first.prompt_hash).toBe(second.prompt_hash);
    expect(first.prompt_manifest_hash).toBe(manifestHash);
    expect(first.prompt_manifest_hash).toBe(second.prompt_manifest_hash);
  });

  it('rejects a manifest with a mismatched version', () => {
    const resolved = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(() => resolveCriticalSituationSynthesisPromptManifest({
      prompt_version: '0.2',
      skill_id: resolved.skill_id,
      skill_contract_version: resolved.skill_contract_version,
      fixture_spec_version: resolved.fixture_spec_version,
      schema_version: resolved.schema_version,
      files: resolved.files,
    }, resolved.prompt_text)).toThrow();
  });

  it('keeps the prompt free of evaluation identifiers and case-specific outputs', () => {
    const resolved = loadResolvedCriticalSituationSynthesisPromptManifest();
    const identifierMarker = `${String.fromCharCode(67, 83)}-`;

    expect(resolved.prompt_text).not.toContain(identifierMarker);
    expect(resolved.prompt_text).not.toMatch(/\b(expected|fixture)\b/i);
    expect(Object.keys(resolved.files)).toEqual(['critical_situation_synthesis']);
  });
});
