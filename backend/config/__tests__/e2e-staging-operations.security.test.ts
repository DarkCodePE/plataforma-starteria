import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd(), '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const countNamedFiles = (directory: string, fileName: string): number =>
  readdirSync(directory, { withFileTypes: true }).reduce(
    (count, entry) =>
      count +
      (entry.isDirectory()
        ? countNamedFiles(join(directory, entry.name), fileName)
        : Number(entry.name === fileName)),
    0,
  );

describe('MVP-RELEASE-01 isolated E2E staging operations', () => {
  it('renders only the fixed staging namespace with Mailpit and network isolation', () => {
    const render = read('scripts/ci/render-e2e-staging-manifests.sh');
    expect(render).toContain('starteria-e2e');
    expect(render).toContain('refusing production namespace');
    expect(render).toContain('axllent/mailpit:v1.27.10@sha256:');
    expect(render).toContain('kind: NetworkPolicy');
    expect(render).toContain('automountServiceAccountToken: false');
    expect(render).not.toContain('STARTERIA_DB_PASSWORD');
  });

  it('bootstraps an empty staging database without weakening the production migration guard', () => {
    const workflow = read('.github/workflows/e2e-staging.yml');
    const bootstrap = read('scripts/ci/e2e-staging-db-bootstrap.sh');
    const productionGuard = read('scripts/ci/prod-db-migrate.sh');

    expect(workflow).toContain('scripts/ci/e2e-staging-db-bootstrap.sh');
    expect(workflow).not.toContain('scripts/ci/prod-db-migrate.sh apply');
    expect(bootstrap).toContain('database is not empty');
    expect(bootstrap).toContain('migrate deploy');
    expect(bootstrap).toContain('migrate status');
    expect(bootstrap).toContain('migrate diff');
    expect(bootstrap).toContain('--exit-code');
    expect(bootstrap).not.toContain('migrate resolve');
    expect(productionGuard).toContain('reject_destructive');
  });

  it('keeps the staging gate migration count aligned with the canonical migration files', () => {
    const bootstrap = read('scripts/ci/e2e-staging-db-bootstrap.sh');
    const declaredCount = bootstrap.match(/^expected_migrations=(\d+)$/m);
    const actualCount = countNamedFiles(
      resolve(root, 'front/prisma/migrations'),
      'migration.sql',
    );

    expect(declaredCount).not.toBeNull();
    expect(Number(declaredCount?.[1])).toBe(actualCount);
  });

  it('fails closed when the runner can access production and exercises sandbox Handoff', () => {
    const workflow = read('.github/workflows/e2e-staging.yml');
    const smoke = read('scripts/ci/e2e-staging-api-smoke.sh');
    const handoff = read('front/e2e/prod/handoff-mailpit-staging.spec.ts');

    expect(workflow).toContain('"get secrets -n starteria"');
    expect(workflow).toContain('credential can access production');
    expect(workflow).toContain('E2E_STAGING_MAILPIT_URL');
    expect(smoke).toContain('refusing production URL');
    expect(handoff).toContain('/api/v1/portfolio/handoff-assignments/');
    expect(handoff).toContain('/api/v1/public/handoff-invitations/claim');
    expect(handoff).toContain('/post-start-continuity');
  });
});
