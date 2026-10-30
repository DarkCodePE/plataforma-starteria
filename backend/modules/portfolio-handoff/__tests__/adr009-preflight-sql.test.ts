import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('KAN-182 ADR-009 production preflight', () => {
  it('is a read-only transaction and reports every tenant reconciliation gate', () => {
    const sql = readFileSync(resolve(process.cwd(), '../scripts/preflight/kan182-adr009-production-readonly.sql'), 'utf8');
    expect(sql).toContain('BEGIN TRANSACTION READ ONLY');
    expect(sql).toContain('owner_front_tenant_mismatch');
    expect(sql).toContain('project_multiple_front_organizations');
    expect(sql).toContain('invalid_owner_organization');
    expect(sql).toContain('invalid_project_owner');
    expect(sql).toContain('invalid_front_organization');
    expect(sql).toContain('candidate_org');
    expect(sql).toContain('portfolio_project_without_organization_candidate');
    expect(sql).toContain('project_without_canonical_organization');
    expect(sql).toContain('project_front_tenant_mismatch');
    expect(sql).toContain("'PERSONAL_OR_LEGACY'");
    expect(sql).toContain('delivery_intent_collision');
    expect(sql).toContain('delivery_attempt_required_columns_ready');
    expect(sql).toContain('REQUIRED_COLUMNS_NOT_PRESENT_YET');
    expect(sql).toContain('delivery_batch_orphan_reference');
    expect(sql).toContain('delivery_batch_required_columns_ready');
    expect(sql).toContain('ROLLBACK');

    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });

  it('preserves the published ADR-009 checksum and adds a forward-only fail-closed guard', () => {
    const published = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261023090000_add_adr009_imported_initiative_canonicalization/migration.sql'), 'utf8');
    const canonicalLfBytes = published.replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(canonicalLfBytes).digest('hex')).toBe('ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8');

    const forward = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261025020000_add_kan182_adr009_forward_guard/migration.sql'), 'utf8');
    expect(forward).toContain('ADR009_PROJECT_MULTIPLE_FRONT_ORGANIZATIONS');
    expect(forward).toContain('ADR009_PORTFOLIO_PROJECT_WITHOUT_ORGANIZATION_CANDIDATE');
    expect(forward).toContain('IS DISTINCT FROM sf."organizationId"');
    expect(forward.replace(/^\s*--.*$/gm, '')).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });

  it('classifies migration history without writing to the database', () => {
    const sql = readFileSync(resolve(process.cwd(), '../scripts/preflight/kan182-adr009-migration-history-readonly.sql'), 'utf8');
    expect(sql).toContain('BEGIN TRANSACTION READ ONLY');
    expect(sql).toContain('PUBLISHED_CHECKSUM_APPLIED');
    expect(sql).toContain('DIFFERENT_CHECKSUM_APPLIED_REQUIRES_CONTROLLED_REPAIR');
    expect(sql).toContain('155045d9d30412a47727641200f63d3cdd7da076a990570e8501ccfc9f12e0f3');
    expect(sql).toContain('KNOWN_LEGACY_CHECKSUM_APPLIED_REQUIRES_EQUIVALENCE');
    expect(sql).toContain('KNOWN_LEGACY_CHECKSUM_INCOMPLETE_REQUIRES_FORWARD_RECOVERY');
    expect(sql).toContain('KNOWN_LEGACY_CHECKSUM_ROLLED_BACK');
    expect(sql).toContain('applied_steps_count');
    expect(sql).toContain('logs_present');
    expect(sql).toContain('576354695820ce8de70ae9c089ac9c7ed125a3dc2a6db1765598631ed6e39285');
    expect(sql).toContain('ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8');
    expect(sql).toContain('ROLLBACK');
    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });
});

describe('KAN-183 ADR-009 catalog equivalence preflight', () => {
  it('fingerprints the canonical ADR-009 schema without writing data', () => {
    const sql = readFileSync(
      resolve(process.cwd(), '../scripts/preflight/kan183-adr009-catalog-equivalence-readonly.sql'),
      'utf8',
    );

    expect(sql).toContain('BEGIN TRANSACTION READ ONLY');
    expect(sql).toContain("'project_columns'");
    expect(sql).toContain("'project_constraints'");
    expect(sql).toContain("'project_indexes'");
    expect(sql).toContain("'adr009_enum_values'");
    expect(sql).toContain("'imported_link_shape'");
    expect(sql).toContain('ROLLBACK');

    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });

  it('keeps the legacy checksum fixture restricted to KAN-183 disposable databases', () => {
    const sql = readFileSync(
      resolve(process.cwd(), '../scripts/preflight/tests/kan183-adr009-completed-legacy-checksum-fixture.sql'),
      'utf8',
    );

    expect(sql).toContain('TEST FIXTURE ONLY');
    expect(sql).toContain("current_database() !~ '^kan183_'");
    expect(sql).toContain('KAN183_DISPOSABLE_DATABASE_REQUIRED');
    expect(sql).toContain('155045d9d30412a47727641200f63d3cdd7da076a990570e8501ccfc9f12e0f3');
  });
});
