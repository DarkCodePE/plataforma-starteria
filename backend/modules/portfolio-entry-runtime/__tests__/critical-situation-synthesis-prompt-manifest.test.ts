import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadResolvedCriticalSituationSynthesisPromptManifest,
  resolveCriticalSituationSynthesisPromptManifest,
} from '../prompts/kan-114/prompt-manifest';

describe('KAN-114 isolated prompt manifest', () => {
  it('loads prompt v0.2 while retaining the frozen contract and fixture schema versions', () => {
    const resolved = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(resolved).toMatchObject({
      prompt_version: '0.2',
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
      prompt_version: '0.1',
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
    expect(resolved.prompt_text).not.toMatch(/\bLaura\b|\bchurn\b|\baccelerator\b|\bregulatory\b|\bCS-0[1-8]\b|expected[_ -]outputs?|expected[_ -]lenses|review[_ -]pairs|comparison[_ -]pairs|paired[_ -]contrast/i);
    expect(Object.keys(resolved.files)).toEqual(['critical_situation_synthesis']);
  });

  it('keeps the v0.1 prompt assets present alongside v0.2', () => {
    const promptDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts', 'kan-114');
    const oldManifest = JSON.parse(fs.readFileSync(path.join(promptDirectory, 'v0.1', 'manifest.json'), 'utf8')) as { prompt_version: string };

    expect(oldManifest.prompt_version).toBe('0.1');
    expect(fs.existsSync(path.join(promptDirectory, 'v0.1', 'critical-situation-synthesis.md'))).toBe(true);
    expect(fs.existsSync(path.join(promptDirectory, 'v0.2', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(promptDirectory, 'v0.2', 'critical-situation-synthesis.md'))).toBe(true);
  });

  it('documents exact provenance paths, authorized reference IDs, and usable-now linkage without fixture content', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    for (const path of [
      'situation_model.current_situation[0]',
      'decision_frame.decision_to_prepare',
      'usable_now[0]',
      'candidate_first_movement.movement',
      'situation_model.desired_change',
      'situation_model.decision_to_enable',
      'situation_insight.statement',
      'material_tensions[i].statement',
      'decision_frame.decision_authority',
      'decision_frame.materially_distinct_paths[i]',
      'decision_frame.distinguishing_conditions[i]',
      'decision_frame.timing_or_constraints[i]',
      'decision_frame.unresolved_basis[i]',
      'decision_changing_unknowns[i].uncertainty',
      'candidate_first_movement.existing_assets_used[i]',
    ]) {
      expect(prompt).toContain(path);
    }
    expect(prompt).toMatch(/claim_ref.{0,100}exact JSON output path/is);
    expect(prompt).toMatch(/claim_ref.{0,200}must exactly match/is);
    expect(prompt).toMatch(/authorized_snapshot\.source_refs/is);
    expect(prompt).toMatch(/reference identifiers, not (?:paraphrased )?evidence text/is);
    expect(prompt).toMatch(/usable_now\[i\]\.provenance_refs/is);
    expect(prompt).toMatch(/epistemic_role.{0,100}provenance/is);
    expect(prompt).toMatch(/uncertainty_statement\s*=\s*null/is);
    expect(prompt).toMatch(/decision_changing_unknowns/is);
  });
});
