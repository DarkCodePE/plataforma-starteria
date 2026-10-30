-- TEST FIXTURE ONLY. Apply exclusively to a disposable clone whose canonical
-- ADR-009 migration has completed. It represents the completed legacy cohort.
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_database() !~ '^kan183_' THEN
    RAISE EXCEPTION 'KAN183_DISPOSABLE_DATABASE_REQUIRED';
  END IF;
END $$;

UPDATE "_prisma_migrations"
SET checksum = '155045d9d30412a47727641200f63d3cdd7da076a990570e8501ccfc9f12e0f3'
WHERE migration_name = '20261023090000_add_adr009_imported_initiative_canonicalization'
  AND finished_at IS NOT NULL
  AND rolled_back_at IS NULL;

SELECT CASE
  WHEN COUNT(*) = 1 THEN 'COMPLETED_LEGACY_CHECKSUM_FIXTURE_READY'
  ELSE 'FIXTURE_PRECONDITION_FAILED'
END AS fixture_state
FROM "_prisma_migrations"
WHERE migration_name = '20261023090000_add_adr009_imported_initiative_canonicalization'
  AND checksum = '155045d9d30412a47727641200f63d3cdd7da076a990570e8501ccfc9f12e0f3'
  AND finished_at IS NOT NULL
  AND rolled_back_at IS NULL;
