import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

type CertificationContract = {
  version: number;
  expectedRemoteTests: number;
  environments: Array<{
    id: string;
    classification:
      | 'local_disposable_db'
      | 'staging_remote_api_browser'
      | 'staging_synthetic_provisioning';
  }>;
  scenarios: Array<{ id: 'A' | 'B' | 'C'; goals: string[] }>;
  goals: Array<{
    id: string;
    localTests: string[];
    remoteScenarios: Array<'A' | 'B' | 'C'>;
  }>;
  remoteTests: string[];
  syntheticProvisioning: string[];
};

const loadContract = (): CertificationContract =>
  JSON.parse(read('front/e2e/staging-g1-g5.contract.json')) as CertificationContract;

describe('KAN-236/KAN-237 G1-G5 isolated staging certification contract', () => {
  it('classifies all goals and A/B/C evidence across the three execution environments', () => {
    const contract = loadContract();

    expect(contract.version).toBe(1);
    expect(contract.environments.map(({ classification }) => classification).sort()).toEqual([
      'local_disposable_db',
      'staging_remote_api_browser',
      'staging_synthetic_provisioning',
    ]);
    expect(contract.goals.map(({ id }) => id)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5']);
    expect(contract.scenarios.map(({ id }) => id)).toEqual(['A', 'B', 'C']);
    expect(contract.scenarios.every(({ goals }) =>
      JSON.stringify(goals) === JSON.stringify(['G1', 'G2', 'G3', 'G4', 'G5']))).toBe(true);
    expect(contract.goals.every(({ localTests, remoteScenarios }) =>
      localTests.length > 0 && remoteScenarios.length > 0)).toBe(true);
    expect(contract.goals.find(({ id }) => id === 'G5')?.localTests)
      .toContain('front/e2e/kan232-g5-home-final.spec.ts');
    expect(contract.remoteTests).toEqual(['front/e2e/prod/goals-g1-g5-staging.spec.ts']);
    expect(contract.syntheticProvisioning).toEqual(['backend/scripts/e2e-prod-tenant.ts']);
  });

  it('keeps direct-Prisma suites local and makes the remote selector fail closed', () => {
    const contract = loadContract();
    const packageJson = JSON.parse(read('front/package.json')) as {
      scripts: Record<string, string>;
    };

    const localSources = contract.goals.flatMap(({ localTests }) => localTests).map(read);
    expect(localSources.some((source) => source.includes("from '@prisma/client'"))).toBe(true);
    expect(packageJson.scripts['test:e2e:prod']).not.toContain('kan232-g5-home-final');
    expect(packageJson.scripts['test:e2e:prod']).not.toContain('goals-g1-g5-staging');
    expect(packageJson.scripts['test:e2e:staging-goals'])
      .toBe('node ../scripts/ci/e2e-staging-goals-selector.mjs --run');
    expect(packageJson.scripts['test:e2e:staging-goals:list'])
      .toBe('node ../scripts/ci/e2e-staging-goals-selector.mjs --list');

    for (const remotePath of contract.remoteTests) {
      const remoteSource = read(remotePath);
      expect(remoteSource).not.toMatch(/@prisma\/client|PrismaClient|DATABASE_URL/);
      expect(remoteSource).not.toMatch(/test\.(skip|fixme)|\.skip\(/);
    }

    const selector = read('scripts/ci/e2e-staging-goals-selector.mjs');
    expect(selector).toContain('starteria-e2e');
    expect(selector).toContain('E2E_STAGING_SOURCE_SHA');
    expect(selector).toContain('expectedRemoteTests');
    expect(selector).toContain('stats.skipped');
    expect(selector).toContain('refusing production');

    expect(() => execFileSync(
      process.execPath,
      [resolve(root, 'scripts/ci/e2e-staging-goals-selector.mjs'), '--list'],
      {
        cwd: resolve(root, 'front'),
        env: {
          ...process.env,
          NAMESPACE: 'starteria',
          E2E_PROD_BASE_URL: 'https://starter-ia.com',
          E2E_STAGING_MAILPIT_URL: 'http://127.0.0.1:18025',
          E2E_STAGING_SOURCE_SHA: 'a'.repeat(40),
          E2E_PROD_LEAD_PASSWORD: 'synthetic-only',
          E2E_PROD_PARTICIPANT_PASSWORD: 'synthetic-only',
        },
        stdio: 'pipe',
      },
    )).toThrow();
  });

  it('selects the dedicated zero-skip goal suite in the isolated Mailpit workflow', () => {
    const workflow = read('.github/workflows/e2e-staging.yml');
    const runbook = read('docs/e2e/E2E_STAGING_RUNBOOK.md');

    expect(workflow).toContain('npm run test:e2e:staging-goals:list');
    expect(workflow).toContain('npm run test:e2e:staging-goals');
    expect(workflow).toContain('E2E_STAGING_SOURCE_SHA: ${{ needs.resolve.outputs.sha }}');
    expect(workflow).toContain('E2E_STAGING_GOALS_REPORT: ../artifacts/e2e-staging/goals-g1-g5-playwright.json');
    expect(runbook).toContain('77/77');
    expect(runbook).toContain('goal -> scenario -> environment -> test -> evidence -> CI');
    expect(runbook).toContain('KAN-232');
    expect(runbook).toContain('0 skips');
  });
});
