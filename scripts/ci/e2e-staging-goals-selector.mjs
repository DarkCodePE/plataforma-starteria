#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const frontRoot = resolve(repoRoot, 'front');
const contractPath = resolve(frontRoot, 'e2e', 'staging-g1-g5.contract.json');
const mode = process.argv[2];

const fail = (message) => {
  console.error(`[staging-goals] ${message}`);
  process.exit(1);
};

if (!['--list', '--run'].includes(mode)) fail('expected --list or --run');
if (process.env.NAMESPACE !== 'starteria-e2e') {
  fail('refusing production or non-isolated namespace; NAMESPACE must be starteria-e2e');
}

const sourceSha = process.env.E2E_STAGING_SOURCE_SHA ?? '';
if (!/^[0-9a-f]{40}$/i.test(sourceSha)) fail('E2E_STAGING_SOURCE_SHA must be a full 40-character SHA');

const baseUrlValue = process.env.E2E_PROD_BASE_URL ?? '';
let baseUrl;
try {
  baseUrl = new URL(baseUrlValue);
} catch {
  fail('E2E_PROD_BASE_URL must be an absolute staging URL');
}
if (baseUrl.protocol !== 'https:') fail('E2E_PROD_BASE_URL must use HTTPS');
if (/(^|\.)starter-ia\.com$/i.test(baseUrl.hostname)) fail('refusing production URL');
if (mode === '--run' && /(^|\.)invalid$/i.test(baseUrl.hostname)) fail('refusing validation-only URL for a run');

const mailpitValue = process.env.E2E_STAGING_MAILPIT_URL ?? '';
let mailpit;
try {
  mailpit = new URL(mailpitValue);
} catch {
  fail('E2E_STAGING_MAILPIT_URL must be the local Mailpit port-forward');
}
if (!['127.0.0.1', 'localhost'].includes(mailpit.hostname)) {
  fail('Mailpit must be reached only through the local starteria-e2e port-forward');
}
for (const name of ['E2E_PROD_LEAD_PASSWORD', 'E2E_PROD_PARTICIPANT_PASSWORD']) {
  if (!(process.env[name] ?? '').trim()) fail(`${name} is required; the suite never skips missing credentials`);
}

const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
if (contract.version !== 1 || !Number.isInteger(contract.expectedRemoteTests) || contract.expectedRemoteTests < 1) {
  fail('invalid certification contract version or expectedRemoteTests');
}
if (JSON.stringify(contract.goals?.map(({ id }) => id)) !== JSON.stringify(['G1', 'G2', 'G3', 'G4', 'G5'])) {
  fail('contract must cover G1-G5 exactly');
}
if (JSON.stringify(contract.scenarios?.map(({ id }) => id)) !== JSON.stringify(['A', 'B', 'C'])) {
  fail('contract must cover scenarios A/B/C exactly');
}
if (!Array.isArray(contract.remoteTests) || contract.remoteTests.length !== 1) {
  fail('contract must select exactly one remote API/browser spec');
}

for (const relativePath of contract.remoteTests) {
  if (!relativePath.startsWith('front/e2e/prod/')) fail(`remote spec is outside front/e2e/prod: ${relativePath}`);
  const source = readFileSync(resolve(repoRoot, relativePath), 'utf8');
  if (/@prisma\/client|PrismaClient|DATABASE_URL/.test(source)) fail(`direct database access is forbidden: ${relativePath}`);
  if (/test\.(skip|fixme)|\.skip\(/.test(source)) fail(`skips/fixmes are forbidden: ${relativePath}`);
}

const specArgs = contract.remoteTests.map((path) => path.replace(/^front\//, ''));
const executable = process.execPath;
const args = [resolve(frontRoot, 'node_modules', 'playwright', 'cli.js'), 'test', ...specArgs];

if (mode === '--list') {
  const listed = spawnSync(executable, [...args, '--list'], { cwd: frontRoot, stdio: 'inherit' });
  if (listed.error) fail(listed.error.message);
  process.exit(listed.status ?? 1);
}

const executed = spawnSync(executable, [...args, '--workers=1', '--reporter=json'], {
  cwd: frontRoot,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});
if (executed.stderr) process.stderr.write(executed.stderr);
if (executed.error) fail(executed.error.message);

const reportPath = resolve(frontRoot, process.env.E2E_STAGING_GOALS_REPORT ?? '../artifacts/e2e-staging/goals-g1-g5-playwright.json');
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, executed.stdout ?? '', 'utf8');

let report;
try {
  report = JSON.parse(executed.stdout ?? '');
} catch {
  fail(`Playwright did not produce a JSON report at ${reportPath}`);
}
const stats = report.stats ?? {};
if (stats.skipped !== 0) fail(`expected 0 skips, observed ${String(stats.skipped)}`);
if (stats.unexpected !== 0 || (executed.status ?? 1) !== 0) {
  fail(`remote certification failed: unexpected=${String(stats.unexpected)}, exit=${String(executed.status)}`);
}
if (stats.expected !== contract.expectedRemoteTests) {
  fail(`expected ${contract.expectedRemoteTests} passing tests, observed ${String(stats.expected)}`);
}
console.error(`[staging-goals] PASS ${stats.expected}/${contract.expectedRemoteTests}; 0 skips; source ${sourceSha}`);
