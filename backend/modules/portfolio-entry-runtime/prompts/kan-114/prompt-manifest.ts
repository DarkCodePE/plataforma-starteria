import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const promptDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'v0.3');

const criticalSituationSynthesisPromptManifestSchema = z.object({
  prompt_version: z.literal('0.3'),
  skill_id: z.literal('entry-05-critical-situation-synthesis'),
  skill_contract_version: z.literal('0.1'),
  fixture_spec_version: z.literal('0.1'),
  schema_version: z.literal('0.1'),
  files: z.object({
    critical_situation_synthesis: z.literal('critical-situation-synthesis.md'),
  }).strict(),
}).strict();

export type CriticalSituationSynthesisPromptManifest = z.infer<typeof criticalSituationSynthesisPromptManifestSchema>;

export type ResolvedCriticalSituationSynthesisPromptManifest = CriticalSituationSynthesisPromptManifest & {
  file_hashes: Record<string, string>;
  prompt_hash: string;
  prompt_manifest_hash: string;
  prompt_text: string;
};

export type CriticalSituationSynthesisPromptMetadata = Omit<ResolvedCriticalSituationSynthesisPromptManifest, 'prompt_text'>;

export function resolveCriticalSituationSynthesisPromptManifest(
  rawManifest: unknown,
  promptText: string,
): ResolvedCriticalSituationSynthesisPromptManifest {
  const manifest = criticalSituationSynthesisPromptManifestSchema.parse(rawManifest);
  const promptHash = sha256(promptText);
  const fileHashes = { [manifest.files.critical_situation_synthesis]: promptHash };

  return {
    ...manifest,
    file_hashes: fileHashes,
    prompt_hash: promptHash,
    prompt_manifest_hash: sha256(JSON.stringify({ ...manifest, file_hashes: fileHashes })),
    prompt_text: promptText,
  };
}

export function loadResolvedCriticalSituationSynthesisPromptManifest(): ResolvedCriticalSituationSynthesisPromptManifest {
  const manifestPath = path.join(promptDirectory, 'manifest.json');
  const rawManifest: unknown = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const manifest = criticalSituationSynthesisPromptManifestSchema.parse(rawManifest);
  const promptText = fs.readFileSync(path.join(promptDirectory, manifest.files.critical_situation_synthesis), 'utf8');
  return resolveCriticalSituationSynthesisPromptManifest(manifest, promptText);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
