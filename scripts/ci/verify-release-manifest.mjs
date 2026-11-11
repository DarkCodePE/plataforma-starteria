#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

function args(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument near ${key ?? '<end>'}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function required(values, name) {
  const value = values[name]?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

const values = args(process.argv.slice(2));
const repoRoot = resolve(values['repo-root'] || process.cwd());
const manifest = JSON.parse(readFileSync(resolve(required(values, 'manifest')), 'utf8'));
const expected = {
  backend: required(values, 'backend-image'),
  frontend: required(values, 'frontend-image'),
  aiService: required(values, 'ai-service-image'),
};

if (manifest.schema !== 'starteria.release-manifest.v1') throw new Error('Unexpected release manifest schema');
if (manifest.sourceSha !== required(values, 'source-sha')) throw new Error('Release manifest source SHA mismatch');
for (const [service, reference] of Object.entries(expected)) {
  if (!/^[-.:/a-zA-Z0-9]+@sha256:[a-f0-9]{64}$/.test(reference)) throw new Error(`${service} image is not immutable`);
  if (manifest.images?.[service] !== reference) throw new Error(`${service} image mismatch`);
}
const expectedReleaseMigrations = [
  '20261109100000_kan253_e2_goal_turn_ledger',
  '20261109222000_g04_attention_event_history',
];
const migrationsRoot = join(repoRoot, 'front/prisma/migrations');
const repositoryInventory = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => {
    try {
      readFileSync(join(migrationsRoot, name, 'migration.sql'));
      return true;
    } catch {
      return false;
    }
  })
  .sort()
  .map((name) => ({
    name,
    sha256: createHash('sha256').update(readFileSync(join(migrationsRoot, name, 'migration.sql'))).digest('hex'),
  }));
if (!Array.isArray(manifest.migrations?.inventory) || manifest.migrations.inventory.length === 0) {
  throw new Error('Release manifest has no migration inventory');
}
if (JSON.stringify(manifest.migrations.inventory) !== JSON.stringify(repositoryInventory)) {
  throw new Error('Release migration inventory does not match the selected source SHA');
}
const repositoryInventorySha = createHash('sha256').update(JSON.stringify(repositoryInventory)).digest('hex');
if (manifest.migrations.inventorySha256 !== repositoryInventorySha) {
  throw new Error('Release migration inventory checksum mismatch');
}
if (JSON.stringify(manifest.migrations.requiredForRelease?.map((migration) => migration.name))
  !== JSON.stringify(expectedReleaseMigrations)) {
  throw new Error('Release manifest does not identify the two authorized release migrations');
}
for (const migration of manifest.migrations.requiredForRelease) {
  if (!/^[a-f0-9]{64}$/.test(migration.sha256)
    || !manifest.migrations.inventory.some((candidate) => candidate.name === migration.name
      && candidate.sha256 === migration.sha256)) {
    throw new Error(`Release migration checksum mismatch: ${migration.name}`);
  }
}
if (manifest.flags?.frontend?.VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED !== false
  || manifest.flags?.frontend?.VITE_PORTFOLIO_GOAL_E2_MULTI_TURN_UI_ENABLED !== false
  || manifest.flags?.frontend?.VITE_PORTFOLIO_GOAL_E2_CHECKPOINT_UI_ENABLED !== false) {
  throw new Error('Experimental frontend E2 flags must remain off');
}
if (manifest.flags.frontend.VITE_ENABLE_DEMO_DATA !== false
  || typeof manifest.flags.frontend.VITE_GOOGLE_LOGIN_ENABLED !== 'boolean') {
  throw new Error('Frontend release flags are incomplete or unsafe');
}
if (manifest.flags?.backend?.PORTFOLIO_GOAL_E2_LEDGER_ENABLED !== false
  || manifest.flags?.backend?.PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED !== false
  || manifest.flags?.backend?.PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED !== false) {
  throw new Error('Experimental backend E2 flags must remain off');
}
if (!['disabled', 'pilot'].includes(manifest.flags?.backend?.HANDOFF_EMAIL_TRANSPORT_MODE)) {
  throw new Error('Invalid productive Handoff transport mode');
}
if (manifest.flags.backend.HANDOFF_EMAIL_TRANSPORT_MODE === 'disabled'
  && manifest.flags.backend.HANDOFF_EMAIL_PILOT_ENABLED !== false) {
  throw new Error('Handoff pilot cannot be enabled while transport is disabled');
}
if (manifest.e2e?.testOverrides?.HANDOFF_EMAIL_TRANSPORT_MODE !== 'sandbox'
  || manifest.e2e.testOverrides.HANDOFF_EMAIL_PILOT_ENABLED !== false
  || manifest.e2e.testOverrides.AUTH_DISABLE_WAITLIST !== true
  || manifest.e2e.testOverrides.AUTH_RATE_LIMIT_DISABLED !== true) {
  throw new Error('Isolated E2E overrides must be explicit in the release manifest');
}
for (const suite of ['kan232-g5-home-final', 'kan254-owner-handoff-acceptance']) {
  if (!manifest.e2e?.approvedSuites?.includes(suite)) throw new Error(`Missing approved suite ${suite}`);
}
if (JSON.stringify(manifest).match(/"(?:password|secret|token|apiKey)"\s*:/i)) {
  throw new Error('Release manifest contains a forbidden secret-like field');
}
console.log(`Release manifest verified for ${manifest.sourceSha}`);
