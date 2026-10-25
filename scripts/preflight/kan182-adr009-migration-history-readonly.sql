\set ON_ERROR_STOP on

-- Execute only against explicitly authorized non-production databases.
-- This script inventories history; it does not repair or resolve migrations.
BEGIN TRANSACTION READ ONLY;

SELECT to_regclass('"_prisma_migrations"') IS NOT NULL AS prisma_history_exists \gset
\if :prisma_history_exists
SELECT
  migration_name,
  checksum,
  finished_at,
  rolled_back_at,
  CASE
    WHEN migration_name = '20261023090000_add_adr009_imported_initiative_canonicalization'
      -- Prisma checksums raw migration bytes. Git's canonical LF checkout and
      -- an authorized Windows CRLF checkout are semantically identical here.
      AND checksum IN (
        'ae472002b0862a3b608e82abc6b6d2bdf1c50c12bd4a3411039fa383c6b990d8',
        '576354695820ce8de70ae9c089ac9c7ed125a3dc2a6db1765598631ed6e39285'
      )
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
      THEN 'PUBLISHED_CHECKSUM_APPLIED'
    WHEN migration_name = '20261023090000_add_adr009_imported_initiative_canonicalization'
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
      THEN 'DIFFERENT_CHECKSUM_APPLIED_REQUIRES_CONTROLLED_REPAIR'
    WHEN migration_name = '20261023090000_add_adr009_imported_initiative_canonicalization'
      THEN 'INCOMPLETE_OR_ROLLED_BACK_REQUIRES_REVIEW'
    ELSE 'NOT_ADR009_TARGET'
  END AS history_state
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20261023090000_add_adr009_imported_initiative_canonicalization',
  '20261025020000_add_kan182_adr009_forward_guard'
)
ORDER BY started_at;
\else
SELECT
  'NO_PRISMA_HISTORY_TABLE_NEW_OR_UNMANAGED_DATABASE' AS history_state;
\endif

ROLLBACK;
