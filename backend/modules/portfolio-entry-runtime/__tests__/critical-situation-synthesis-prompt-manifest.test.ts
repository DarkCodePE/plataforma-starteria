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
  it('loads prompt v0.4 while retaining the frozen contract and fixture schema versions', () => {
    const resolved = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(resolved).toMatchObject({
      prompt_version: '0.4',
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
      prompt_version: '0.3',
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

  it('keeps the v0.1, v0.2, and v0.3 prompt assets present and unchanged', () => {
    const promptDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prompts', 'kan-114');
    const frozenAssets = [
      ['v0.1/manifest.json', '09441becdf8f257255a7ca5e4e58c240188a417da14b403549a7475821bb3c61'],
      ['v0.1/critical-situation-synthesis.md', '9216ca923381e6e2be783c2156465fe75e48b31688ab422db8a3ff6148fd5768'],
      ['v0.2/manifest.json', '3e2b78fa276107023b1238347b4f1a78b21b5f3ac805ca28a14f8b347f66da40'],
      ['v0.2/critical-situation-synthesis.md', 'd66bb3d391284bb7a4838a831f1a3ac995b5d996ee0765f4f50836cadb57b64f'],
      ['v0.3/manifest.json', '02cfff273a718c7bf2f1b34807f8b68a181aaa390ad5f43ef8f60aaf9c285fd0'],
      ['v0.3/critical-situation-synthesis.md', 'db5b82fafd6d443283a8918683cda42cdfa2095baf7a1c01a45e5140c4d497c4'],
    ] as const;

    for (const [relativePath, expectedHash] of frozenAssets) {
      const content = fs.readFileSync(path.join(promptDirectory, relativePath), 'utf8');
      expect(createHash('sha256').update(content).digest('hex'), relativePath).toBe(expectedHash);
    }
    expect(JSON.parse(fs.readFileSync(path.join(promptDirectory, 'v0.1', 'manifest.json'), 'utf8'))).toMatchObject({ prompt_version: '0.1' });
    expect(JSON.parse(fs.readFileSync(path.join(promptDirectory, 'v0.2', 'manifest.json'), 'utf8'))).toMatchObject({ prompt_version: '0.2' });
    expect(JSON.parse(fs.readFileSync(path.join(promptDirectory, 'v0.3', 'manifest.json'), 'utf8'))).toMatchObject({ prompt_version: '0.3' });
  });

  it('requires a supported relationship for insight and material tension', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toMatch(/Missing information, ambiguity, lack of evidence, lack of goals, or absence of documented criteria do not by themselves constitute a supported insight or material tension/is);
    expect(prompt).toMatch(/A supported situation insight requires a supported relationship between conditions that changes how the situation or decision should be understood/is);
    expect(prompt).toMatch(/A supported material tension requires at least two supported conditions whose coexistence creates a meaningful constraint, conflict, tradeoff, or sequencing problem for a decision/is);
    expect(prompt).toMatch(/Use `material_tensions = \[\]` unless an independently supported material relationship exists/is);
  });

  it('keeps decision framing separate from answer and authority certainty', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toMatch(/A decision can be identifiable even when its answer is unknown, evidence is pending, authority is not yet confirmed/is);
    expect(prompt).toMatch(/`status = "framed"` means Starteria can name the choice or commitment to prepare; it does not mean Starteria knows the correct answer/is);
    expect(prompt).toMatch(/materially distinct next paths can be named conditionally/is);
    expect(prompt).toMatch(/Unknown authority alone does not make a decision unidentifiable/is);
    expect(prompt).toMatch(/Pending evidence alone does not make a decision unidentifiable/is);
  });

  it('reuses meaningful existing checkpoints before proposing new work', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toMatch(/When work is already underway and a meaningful checkpoint exists, use that checkpoint before proposing new work/is);
    expect(prompt).toMatch(/do not require the checkpoint result to be known before framing the decision/is);
    expect(prompt).toMatch(/Do not design a new experiment unless the existing checkpoint cannot inform the decision sought/is);
  });

  it('makes lens selection minimal and guards against topic-only triggers', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toMatch(/Use the smallest sufficient set of reasoning lenses/is);
    expect(prompt).toMatch(/Select a lens only when it materially changes at least one of the situation reading, insight, tension, decision frame, decision-changing unknowns, or first movement/is);
    expect(prompt).toMatch(/Priority \/ allocation:\*\* select only for a real allocation or focus tradeoff/is);
    expect(prompt).toMatch(/Multiple initiatives alone do not trigger it/is);
    expect(prompt).toMatch(/Governance:\*\* select only when authority, decision rights, progression rules, approval, or ownership materially changes/is);
    expect(prompt).toMatch(/Unknown authority alone does not trigger it/is);
    expect(prompt).toMatch(/Risk:\*\* select only when an identified uncertainty or condition materially changes exposure, decision conditions, or downside/is);
    expect(prompt).toMatch(/Uncertainty alone does not trigger it/is);
    expect(prompt).toMatch(/Alignment:\*\* select only for a supported mismatch/is);
    expect(prompt).toMatch(/Diagnosis:\*\* select only when understanding the mechanism, cause, or location/is);
    expect(prompt).toMatch(/Dependencies:\*\* select only when another actor, system, or condition gates/is);
    expect(prompt).toMatch(/System design:\*\* select only when the operating mechanism or structure itself is under review/is);
    expect(prompt).toMatch(/Record only selected families in `reasoning_metadata\.selected_lenses`; use an empty array when no lens materially changes the synthesis/is);
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
      'candidate_first_movement.why_now',
      'candidate_first_movement.what_it_may_clarify',
      'candidate_first_movement.decision_supported',
      'candidate_first_movement.boundary',
    ]) {
      expect(prompt).toContain(path);
    }
    expect(prompt).toContain('For every output claim at these paths, include at least one provenance record with that exact `claim_ref`:');
    expect(prompt).toMatch(/claim_ref.{0,100}exact JSON output path/is);
    expect(prompt).toMatch(/claim_ref.{0,200}must exactly match/is);
    expect(prompt).toMatch(/authorized_snapshot\.source_refs/is);
    expect(prompt).toContain('When a claim has support references, at least one provenance record for its exact claim path must include each of those references in `source_refs`.');
    expect(prompt).toContain('`provenance.source_refs` may contain only reference identifiers supplied in `authorized_snapshot.source_refs`; do not fabricate or infer source references.');
    expect(prompt).toContain('The values in `support`, `source_refs`, and `current_evidence` are reference identifiers, not paraphrased evidence text.');
    expect(prompt).toMatch(/Do not invent facts, evidence, causality, authority, outcomes, constraints, or source references/is);
    expect(prompt).toMatch(/reference identifiers, not (?:paraphrased )?evidence text/is);
    expect(prompt).toMatch(/usable_now\[i\]\.provenance_refs/is);
    expect(prompt).toMatch(/epistemic_role.{0,100}provenance/is);
    expect(prompt).toMatch(/uncertainty_statement\s*=\s*null/is);
    expect(prompt).toMatch(/decision_changing_unknowns/is);
  });

  it.each(['user_message', 'user_correction'])('requires USER_DECLARED provenance for a direct FACT from %s', (kind) => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toMatch(new RegExp(`kind = ${kind}.{0,180}origin = USER_DECLARED`, 'is'));
    expect(prompt).toMatch(/FACT.{0,180}directly supported by authorized evidence/is);
    expect(prompt).toMatch(/exact authorized source ref/is);
    expect(prompt).toMatch(/review_disposition.{0,140}UNREVIEWED/is);
    expect(prompt).toMatch(/Do not use.{0,220}AI_INFERRED.{0,100}AI_SUGGESTED.{0,100}EXTRACTED_FROM_USER_TEXT/is);
  });

  it('limits extracted provenance and separates interpretation and proposal origins', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toContain('Use `origin = EXTRACTED_FROM_USER_TEXT` only when the authorized snapshot itself contains a provisional extracted value whose provenance says `EXTRACTED_FROM_USER_TEXT`.');
    expect(prompt).toMatch(/paraphrased, summarized, selected, or reformulated/is);
    expect(prompt).toMatch(/epistemic_role\s*=\s*INTERPRETATION.{0,160}origin\s*=\s*AI_INFERRED/is);
    expect(prompt).toMatch(/relationship.{0,180}consequence.{0,180}synthesis.{0,180}diagnostic reading/is);
    expect(prompt).toMatch(/epistemic_role\s*=\s*PROPOSAL.{0,120}origin\s*=\s*AI_SUGGESTED/is);
    expect(prompt).toMatch(/Preserve the authorized source refs used to ground the proposal/is);
  });

  it('assigns material tension provenance only to the root source-of-truth path', () => {
    const { prompt_text: prompt } = loadResolvedCriticalSituationSynthesisPromptManifest();

    expect(prompt).toContain('The root collection `material_tensions[i]` is the provenance-bearing source of truth.');
    expect(prompt).toMatch(/situation_model\.material_tensions.{0,160}deeply identical.{0,80}projection/is);
    expect(prompt).toContain('Generate provenance for `material_tensions[i].statement`.');
    expect(prompt).toContain('Do NOT generate a separate provenance record for `situation_model.material_tensions[i].statement`.');
  });
});
