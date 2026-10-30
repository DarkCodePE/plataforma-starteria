-- KAN-183 / ADR-009 catalog equivalence fingerprint.
-- Run with psql. Equal fingerprints prove equality of the selected catalog
-- surfaces; they do not prove that historical migration bytes were equal.
\set ON_ERROR_STOP on

BEGIN TRANSACTION READ ONLY;

WITH
project_columns AS (
  SELECT
    'project_columns'::text AS component,
    concat_ws('|', column_name, ordinal_position, data_type, udt_name, is_nullable, COALESCE(column_default, '')) AS item
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'Project'
    AND column_name IN ('ownerId', 'organizationId', 'activationStatus', 'retrospectiveAssessmentStatus')
),
project_constraints AS (
  SELECT
    'project_constraints'::text AS component,
    concat_ws('|', conname, contype, pg_get_constraintdef(oid, true)) AS item
  FROM pg_constraint
  WHERE conrelid = to_regclass('"Project"')
    AND conname IN ('Project_organizationId_fkey', 'Project_owner_pending_imported_check')
),
project_indexes AS (
  SELECT
    'project_indexes'::text AS component,
    concat_ws('|', indexname, indexdef) AS item
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename = 'Project'
    AND indexname = 'Project_organizationId_idx'
),
adr009_enum_values AS (
  SELECT
    'adr009_enum_values'::text AS component,
    concat_ws('|', t.typname, e.enumsortorder, e.enumlabel) AS item
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = current_schema()
    AND t.typname IN (
      'ImportedInitiativeMode',
      'ImportedInitiativeLinkStatus',
      'ImportedInitiativeActivationStatus',
      'RetrospectiveAssessmentStatus',
      'InitiativePortfolioStatus'
    )
),
imported_link_shape AS (
  SELECT
    'imported_link_shape'::text AS component,
    concat_ws('|', 'column', column_name, ordinal_position, data_type, udt_name, is_nullable, COALESCE(column_default, '')) AS item
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'PortfolioImportedInitiativeLink'

  UNION ALL

  SELECT
    'imported_link_shape'::text AS component,
    concat_ws('|', 'constraint', conname, contype, pg_get_constraintdef(oid, true)) AS item
  FROM pg_constraint
  WHERE conrelid = to_regclass('"PortfolioImportedInitiativeLink"')

  UNION ALL

  SELECT
    'imported_link_shape'::text AS component,
    concat_ws('|', 'index', indexname, indexdef) AS item
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename = 'PortfolioImportedInitiativeLink'
),
catalog_items AS (
  SELECT * FROM project_columns
  UNION ALL SELECT * FROM project_constraints
  UNION ALL SELECT * FROM project_indexes
  UNION ALL SELECT * FROM adr009_enum_values
  UNION ALL SELECT * FROM imported_link_shape
),
expected_components(component) AS (
  VALUES
    ('project_columns'::text),
    ('project_constraints'::text),
    ('project_indexes'::text),
    ('adr009_enum_values'::text),
    ('imported_link_shape'::text)
)
SELECT
  expected.component,
  COUNT(item) AS catalog_item_count,
  md5(COALESCE(string_agg(item, E'\n' ORDER BY item), '')) AS catalog_fingerprint
FROM expected_components expected
LEFT JOIN catalog_items actual ON actual.component = expected.component
GROUP BY expected.component
ORDER BY expected.component;

ROLLBACK;
