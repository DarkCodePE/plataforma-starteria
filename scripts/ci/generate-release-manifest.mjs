#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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

function imageRef(value, name) {
  if (!/^[-.:/a-zA-Z0-9]+@sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`--${name} must be an immutable image reference using @sha256`);
  }
  return value;
}

function bool(value, name) {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`--${name} must be true or false`);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

const values = args(process.argv.slice(2));
const repoRoot = resolve(values['repo-root'] || process.cwd());
const output = resolve(required(values, 'output'));
const sourceSha = required(values, 'source-sha');
if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw new Error('--source-sha must be a full lowercase commit SHA');

const frontPackage = JSON.parse(readFileSync(join(repoRoot, 'front/package.json'), 'utf8'));
const pyproject = readFileSync(join(repoRoot, 'ai-service/pyproject.toml'), 'utf8');
const aiVersion = /^version\s*=\s*"([^"]+)"/m.exec(pyproject)?.[1];
if (!aiVersion) throw new Error('Could not read ai-service version');

const migrationsRoot = join(repoRoot, 'front/prisma/migrations');
const requiredMigrations = readdirSync(migrationsRoot, { withFileTypes: true })
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
    sha256: sha256(readFileSync(join(migrationsRoot, name, 'migration.sql'))),
  }));

const releaseMigrationNames = [
  '20261109100000_kan253_e2_goal_turn_ledger',
  '20261109222000_g04_attention_event_history',
];
const releaseMigrations = releaseMigrationNames.map((name) => {
  const migration = requiredMigrations.find((candidate) => candidate.name === name);
  if (!migration) throw new Error(`Required release migration is missing: ${name}`);
  return migration;
});

const handoffMode = values['handoff-email-mode'] || 'disabled';
if (!['disabled', 'pilot'].includes(handoffMode)) {
  throw new Error('--handoff-email-mode must be disabled or pilot for a production release');
}

const manifest = {
  schema: 'starteria.release-manifest.v1',
  sourceSha,
  versions: {
    frontend: frontPackage.version,
    backend: frontPackage.version,
    aiService: aiVersion,
  },
  images: {
    backend: imageRef(required(values, 'backend-image'), 'backend-image'),
    frontend: imageRef(required(values, 'frontend-image'), 'frontend-image'),
    aiService: imageRef(required(values, 'ai-service-image'), 'ai-service-image'),
  },
  migrations: {
    requiredForRelease: releaseMigrations,
    inventory: requiredMigrations,
    inventorySha256: sha256(JSON.stringify(requiredMigrations)),
  },
  flags: {
    frontend: {
      VITE_API_URL: '/api/v1',
      VITE_FEATURE_PDF_AUTOFILL: true,
      VITE_ENABLE_DEMO_DATA: false,
      VITE_ENABLE_INITIAL_REVIEW: false,
      VITE_ENABLE_INITIATIVE_REVIEW_CHAT: true,
      VITE_PORTFOLIO_COPILOT_ENABLED: false,
      VITE_STEP_REASONING_COPILOT_ENABLED: true,
      VITE_PORTFOLIO_GOAL_E2_LEDGER_UI_ENABLED: false,
      VITE_PORTFOLIO_GOAL_E2_MULTI_TURN_UI_ENABLED: false,
      VITE_PORTFOLIO_GOAL_E2_CHECKPOINT_UI_ENABLED: false,
      VITE_GOOGLE_LOGIN_ENABLED: bool(values['google-login-enabled'], 'google-login-enabled'),
    },
    backend: {
      PORTFOLIO_ENTRY_RUNTIME_MODE: 'live',
      SEMANTIC_E1_ENABLED: false,
      PORTFOLIO_GOAL_E2_LEDGER_ENABLED: false,
      PORTFOLIO_GOAL_E2_MULTI_TURN_ENABLED: false,
      PORTFOLIO_GOAL_E2_CHECKPOINT_ENABLED: false,
      HANDOFF_EMAIL_TRANSPORT_MODE: handoffMode,
      HANDOFF_EMAIL_PILOT_ENABLED: bool(values['handoff-email-pilot-enabled'], 'handoff-email-pilot-enabled'),
    },
  },
  e2e: {
    approvedSuites: ['kan232-g5-home-final', 'kan254-owner-handoff-acceptance'],
    portfolioInitiativeCounts: [0, 3, 25],
    viewportWidths: [375, 768, 1440],
    testOverrides: {
      HANDOFF_EMAIL_TRANSPORT_MODE: 'sandbox',
      HANDOFF_EMAIL_PILOT_ENABLED: false,
      AUTH_DISABLE_WAITLIST: true,
      AUTH_RATE_LIMIT_DISABLED: true,
      reason: 'Mailpit transport evidence only; no productive email is sent by the parity gate.',
    },
  },
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`Release manifest written: ${output}`);
