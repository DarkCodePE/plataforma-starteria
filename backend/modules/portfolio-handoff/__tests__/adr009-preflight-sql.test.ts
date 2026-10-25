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
    expect(sql).toContain('portfolio_project_without_organization_candidate');
    expect(sql).toContain('project_without_canonical_organization');
    expect(sql).toContain('project_front_tenant_mismatch');
    expect(sql).toContain("'PERSONAL_OR_LEGACY'");
    expect(sql).toContain('delivery_intent_collision');
    expect(sql).toContain('delivery_batch_orphan_reference');
    expect(sql).toContain('ROLLBACK');

    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });

  it('preserves the published ADR-009 checksum and adds a forward-only fail-closed guard', () => {
    const published = readFileSync(resolve(process.cwd(), 'prisma/migrations/20261023090000_add_adr009_imported_initiative_canonicalization/migration.sql'));
    expect(createHash('sha256').update(published).digest('hex')).toBe('576354695820ce8de70ae9c089ac9c7ed125a3dc2a6db1765598631ed6e39285');

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
    expect(sql).toContain('576354695820ce8de70ae9c089ac9c7ed125a3dc2a6db1765598631ed6e39285');
    expect(sql).toContain('ROLLBACK');
    const statements = sql.replace(/^\s*--.*$/gm, '');
    expect(statements).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE)\b/i);
  });
});
