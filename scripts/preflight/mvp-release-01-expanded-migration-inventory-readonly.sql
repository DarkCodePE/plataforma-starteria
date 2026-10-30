\set ON_ERROR_STOP on

-- MVP-RELEASE-01 fixed production inventory. Outputs only opaque identifiers,
-- schema metadata, checksums and aggregate counts. Never output credential
-- values, contact data or migration logs.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL application_name = 'mvp_release_01_readonly_inventory';

\echo === READ-ONLY SESSION GUARD ===
SELECT
  current_setting('transaction_read_only') AS transaction_read_only,
  current_setting('statement_timeout') AS statement_timeout,
  current_setting('lock_timeout') AS lock_timeout;

\echo === MIGRATION CHECKSUM COMPARISON ===
WITH canonical AS (
  SELECT manifest."migrationName" AS migration_name, manifest.checksum AS canonical_checksum
  FROM jsonb_to_recordset(
    convert_from(decode(:'canonical_migrations_b64', 'base64'), 'UTF8')::jsonb
  )
    AS manifest("migrationName" text, checksum text)
),
history AS (
  SELECT
    migration_name,
    checksum AS database_checksum,
    started_at,
    finished_at,
    rolled_back_at,
    applied_steps_count,
    LENGTH(COALESCE(logs, '')) > 0 AS logs_present
  FROM "_prisma_migrations"
),
effective_history AS (
  SELECT DISTINCT ON (migration_name)
    migration_name,
    database_checksum,
    started_at,
    finished_at,
    rolled_back_at,
    applied_steps_count,
    logs_present
  FROM history
  ORDER BY
    migration_name,
    (finished_at IS NOT NULL AND rolled_back_at IS NULL) DESC,
    started_at DESC
),
comparison AS (
  SELECT
    COALESCE(c.migration_name, h.migration_name) AS migration_name,
    c.canonical_checksum,
    h.database_checksum,
    h.applied_steps_count,
    h.logs_present,
    CASE
      WHEN c.migration_name IS NULL THEN 'DATABASE_ONLY_MISSING_FROM_REPOSITORY'
      WHEN h.migration_name IS NULL THEN 'PENDING'
      WHEN h.rolled_back_at IS NOT NULL THEN 'ROLLED_BACK'
      WHEN h.finished_at IS NULL OR h.applied_steps_count < 1 THEN 'FAILED_OR_INCOMPLETE'
      WHEN h.database_checksum IS DISTINCT FROM c.canonical_checksum THEN 'APPLIED_CHECKSUM_MISMATCH'
      ELSE 'APPLIED_MATCH'
    END AS checksum_state
  FROM canonical c
  FULL OUTER JOIN effective_history h USING (migration_name)
)
SELECT
  migration_name,
  checksum_state,
  canonical_checksum,
  database_checksum,
  applied_steps_count,
  COALESCE(logs_present, false) AS logs_present
FROM comparison
ORDER BY migration_name;

WITH canonical AS (
  SELECT manifest."migrationName" AS migration_name, manifest.checksum AS canonical_checksum
  FROM jsonb_to_recordset(
    convert_from(decode(:'canonical_migrations_b64', 'base64'), 'UTF8')::jsonb
  )
    AS manifest("migrationName" text, checksum text)
),
effective_history AS (
  SELECT DISTINCT ON (migration_name)
    migration_name,
    checksum AS database_checksum,
    started_at,
    finished_at,
    rolled_back_at,
    applied_steps_count
  FROM "_prisma_migrations"
  ORDER BY
    migration_name,
    (finished_at IS NOT NULL AND rolled_back_at IS NULL) DESC,
    started_at DESC
),
comparison AS (
  SELECT
    CASE
      WHEN c.migration_name IS NULL THEN 'DATABASE_ONLY_MISSING_FROM_REPOSITORY'
      WHEN h.migration_name IS NULL THEN 'PENDING'
      WHEN h.rolled_back_at IS NOT NULL THEN 'ROLLED_BACK'
      WHEN h.finished_at IS NULL OR h.applied_steps_count < 1 THEN 'FAILED_OR_INCOMPLETE'
      WHEN h.database_checksum IS DISTINCT FROM c.canonical_checksum THEN 'APPLIED_CHECKSUM_MISMATCH'
      ELSE 'APPLIED_MATCH'
    END AS checksum_state
  FROM canonical c
  FULL OUTER JOIN effective_history h USING (migration_name)
)
SELECT checksum_state, COUNT(*)::int AS migration_count
FROM comparison
GROUP BY checksum_state
ORDER BY checksum_state;

SELECT
  'migration_history_duplicate_names' AS check_name,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT migration_name
  FROM "_prisma_migrations"
  GROUP BY migration_name
  HAVING COUNT(*) > 1
) duplicate_history;

\echo === ADR-009 BLOCKING PROJECT RELATIONSHIPS ===
SELECT
  p."id" AS project_id,
  p."ownerId" AS owner_id,
  p."origin"::text AS origin,
  u."organizationId" AS owner_organization_id,
  (owner_org."id" IS NOT NULL) AS owner_organization_exists
FROM "Project" p
LEFT JOIN "User" u ON u."id" = p."ownerId"
LEFT JOIN "Organization" owner_org ON owner_org."id" = u."organizationId"
WHERE p."id" = 'cmuyalf02000adi010zwlqek0';

SELECT
  p."id" AS project_id,
  COALESCE(ARRAY_AGG(DISTINCT member."organizationId" ORDER BY member."organizationId")
    FILTER (WHERE member."organizationId" IS NOT NULL), ARRAY[]::text[]) AS owner_membership_organization_ids,
  COALESCE(ARRAY_AGG(DISTINCT grant_row."organizationId" ORDER BY grant_row."organizationId")
    FILTER (WHERE grant_row."organizationId" IS NOT NULL), ARRAY[]::text[]) AS owner_portfolio_grant_organization_ids
FROM "Project" p
LEFT JOIN "OrganizationMember" member ON member."userId" = p."ownerId"
LEFT JOIN "OrganizationPortfolioAccessGrant" grant_row ON grant_row."userId" = p."ownerId"
WHERE p."id" = 'cmuyalf02000adi010zwlqek0'
GROUP BY p."id";

SELECT
  meta."projectId" AS project_id,
  meta."challengeId" AS challenge_id,
  challenge."strategicFrontId" AS strategic_front_id,
  front."organizationId" AS front_organization_id,
  (front_org."id" IS NOT NULL) AS front_organization_exists
FROM "InitiativePortfolioMeta" meta
LEFT JOIN "Challenge" challenge ON challenge."id" = meta."challengeId"
LEFT JOIN "StrategicFront" front ON front."id" = challenge."strategicFrontId"
LEFT JOIN "Organization" front_org ON front_org."id" = front."organizationId"
WHERE meta."projectId" = 'cmuyalf02000adi010zwlqek0'
ORDER BY meta."challengeId";

SELECT COUNT(*) = 3 AS handoff_assignment_project_evidence_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'PortfolioHandoffAssignment'
  AND column_name IN ('initiativeId', 'organizationId', 'challengeId') \gset
\if :handoff_assignment_project_evidence_ready
SELECT
  'adr009_project_handoff_organization_candidates' AS check_name,
  COUNT(*)::bigint AS assignment_count,
  COUNT(DISTINCT "organizationId")::bigint AS distinct_organization_count,
  COALESCE(ARRAY_AGG(DISTINCT "organizationId" ORDER BY "organizationId")
    FILTER (WHERE "organizationId" IS NOT NULL), ARRAY[]::text[]) AS organization_ids
FROM "PortfolioHandoffAssignment"
WHERE "initiativeId" = 'cmuyalf02000adi010zwlqek0';
\else
SELECT
  'adr009_project_handoff_organization_candidates' AS check_name,
  'NOT_YET_EVALUABLE' AS evaluation_state,
  NULL::bigint AS finding_count;
\endif

\echo === HANDOFF SCHEMA AND AGGREGATE INVENTORY ===
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN (
    'PortfolioHandoffDeliveryAttempt',
    'PortfolioHandoffDeliveryAttemptKey',
    'PortfolioHandoffDeliveryBatch'
  )
ORDER BY table_name, ordinal_position;

SELECT to_regclass('"PortfolioHandoffDeliveryAttempt"') IS NOT NULL AS handoff_attempt_exists \gset
\if :handoff_attempt_exists
SELECT 'handoff_attempt_rows' AS check_name, 'EVALUATED' AS evaluation_state, COUNT(*)::bigint AS finding_count
FROM "PortfolioHandoffDeliveryAttempt";

SELECT COUNT(*) = 3 AS handoff_attempt_intent_columns_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'PortfolioHandoffDeliveryAttempt'
  AND column_name IN ('assignmentId', 'idempotencyKey', 'requestFingerprint') \gset
\if :handoff_attempt_intent_columns_ready
SELECT
  'handoff_attempt_request_fingerprint_nulls' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*) FILTER (WHERE "requestFingerprint" IS NULL)::bigint AS finding_count
FROM "PortfolioHandoffDeliveryAttempt";

SELECT
  'handoff_delivery_intent_collisions' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT 1
  FROM "PortfolioHandoffDeliveryAttempt"
  GROUP BY "assignmentId", "requestFingerprint"
  HAVING COUNT(*) > 1
) collisions;

SELECT
  'handoff_legacy_idempotency_collisions' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT 1
  FROM "PortfolioHandoffDeliveryAttempt"
  GROUP BY "assignmentId", "idempotencyKey"
  HAVING COUNT(*) > 1
) collisions;
\else
SELECT
  'handoff_attempt_intent_checks' AS check_name,
  'NOT_YET_EVALUABLE' AS evaluation_state,
  NULL::bigint AS finding_count;
\endif
\else
SELECT 'handoff_attempt_rows' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'handoff_attempt_intent_checks' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

SELECT to_regclass('"PortfolioHandoffDeliveryBatch"') IS NOT NULL AS handoff_batch_exists \gset
\if :handoff_batch_exists
SELECT 'handoff_batch_rows' AS check_name, 'EVALUATED' AS evaluation_state, COUNT(*)::bigint AS finding_count
FROM "PortfolioHandoffDeliveryBatch";

SELECT COUNT(*) = 5 AS handoff_batch_reference_columns_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'PortfolioHandoffDeliveryBatch'
  AND column_name IN ('organizationId', 'challengeId', 'actorId', 'retryOfBatchId', 'id') \gset
\if :handoff_batch_reference_columns_ready
SELECT
  'handoff_batch_orphan_references' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM "PortfolioHandoffDeliveryBatch" batch
LEFT JOIN "Organization" organization_row ON organization_row."id" = batch."organizationId"
LEFT JOIN "Challenge" challenge ON challenge."id" = batch."challengeId"
LEFT JOIN "User" actor ON actor."id" = batch."actorId"
LEFT JOIN "PortfolioHandoffDeliveryBatch" parent_batch ON parent_batch."id" = batch."retryOfBatchId"
WHERE organization_row."id" IS NULL
   OR challenge."id" IS NULL
   OR actor."id" IS NULL
   OR (batch."retryOfBatchId" IS NOT NULL AND parent_batch."id" IS NULL);
\else
SELECT 'handoff_batch_orphan_references' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif
\else
SELECT 'handoff_batch_rows' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'handoff_batch_orphan_references' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

SELECT to_regclass('"PortfolioHandoffDeliveryAttemptKey"') IS NOT NULL AS handoff_attempt_key_exists \gset
\if :handoff_attempt_key_exists
SELECT 'handoff_attempt_key_rows' AS check_name, 'EVALUATED' AS evaluation_state, COUNT(*)::bigint AS finding_count
FROM "PortfolioHandoffDeliveryAttemptKey";
SELECT
  'handoff_attempt_key_orphans' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM "PortfolioHandoffDeliveryAttemptKey" key_row
LEFT JOIN "PortfolioHandoffDeliveryAttempt" attempt ON attempt."id" = key_row."attemptId"
WHERE attempt."id" IS NULL;
\else
SELECT 'handoff_attempt_key_rows' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'handoff_attempt_key_orphans' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

\echo === REFRESH TOKEN AGGREGATE INVENTORY ===
SELECT to_regclass('"RefreshToken"') IS NOT NULL AS refresh_token_exists \gset
\if :refresh_token_exists
SELECT 'refresh_token_rows' AS check_name, 'EVALUATED' AS evaluation_state, COUNT(*)::bigint AS finding_count
FROM "RefreshToken";

SELECT
  'refresh_active_duplicate_families' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT family
  FROM "RefreshToken"
  WHERE "revokedAt" IS NULL
  GROUP BY family
  HAVING COUNT(*) > 1
) duplicate_active;

SELECT
  'refresh_active_tokens_to_revoke' AS check_name,
  'EVALUATED' AS evaluation_state,
  COALESCE(SUM(active_count - 1), 0)::bigint AS finding_count
FROM (
  SELECT COUNT(*)::bigint AS active_count
  FROM "RefreshToken"
  WHERE "revokedAt" IS NULL
  GROUP BY family
  HAVING COUNT(*) > 1
) duplicate_active;

SELECT
  'refresh_mixed_user_families' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT family
  FROM "RefreshToken"
  GROUP BY family
  HAVING COUNT(DISTINCT "userId") > 1
) mixed_user;

SELECT COUNT(*) = 1 AS refresh_generation_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'RefreshToken'
  AND column_name = 'generation' \gset
\if :refresh_generation_ready
SELECT
  'refresh_generation_nulls' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*) FILTER (WHERE generation IS NULL)::bigint AS finding_count
FROM "RefreshToken";
SELECT
  'refresh_generation_collisions' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT 1
  FROM "RefreshToken"
  GROUP BY family, generation
  HAVING COUNT(*) > 1
) collisions;
\else
SELECT 'refresh_generation_nulls' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_generation_collisions' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

SELECT to_regclass('"RefreshTokenFamily"') IS NOT NULL AS refresh_family_exists \gset
\if :refresh_family_exists
SELECT
  'refresh_token_family_orphans' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM "RefreshToken" token_row
LEFT JOIN "RefreshTokenFamily" family_row ON family_row."id" = token_row.family
WHERE family_row."id" IS NULL;
\else
SELECT 'refresh_token_family_orphans' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif
\else
SELECT 'refresh_token_rows' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_active_duplicate_families' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_active_tokens_to_revoke' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_mixed_user_families' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_generation_nulls' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_generation_collisions' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'refresh_token_family_orphans' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

\echo === PILOT AGGREGATE INVENTORY ===
SELECT COUNT(*) = 1 AS project_pilot_lead_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'Project'
  AND column_name = 'pilotLeadId' \gset
\if :project_pilot_lead_ready
SELECT
  'pilot_projects_without_lead' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*) FILTER (WHERE "pilotLeadId" IS NULL)::bigint AS finding_count
FROM "Project";
SELECT
  'pilot_project_duplicate_leads' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT "pilotLeadId"
  FROM "Project"
  WHERE "pilotLeadId" IS NOT NULL
  GROUP BY "pilotLeadId"
  HAVING COUNT(*) > 1
) duplicate_leads;
SELECT
  'pilot_project_rows_in_duplicate_groups' AS check_name,
  'EVALUATED' AS evaluation_state,
  COALESCE(SUM(project_count), 0)::bigint AS finding_count
FROM (
  SELECT COUNT(*)::bigint AS project_count
  FROM "Project"
  WHERE "pilotLeadId" IS NOT NULL
  GROUP BY "pilotLeadId"
  HAVING COUNT(*) > 1
) duplicate_leads;
SELECT
  'pilot_project_orphan_lead_references' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM "Project" project_row
LEFT JOIN "PilotLead" lead_row ON lead_row."id" = project_row."pilotLeadId"
WHERE project_row."pilotLeadId" IS NOT NULL
  AND lead_row."id" IS NULL;
\else
SELECT 'pilot_projects_without_lead' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_project_duplicate_leads' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_project_rows_in_duplicate_groups' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_project_orphan_lead_references' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

SELECT COUNT(*) = 1 AS pilot_code_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'PilotLead'
  AND column_name = 'pilotCode' \gset
\if :pilot_code_ready
SELECT 'pilot_lead_rows' AS check_name, 'EVALUATED' AS evaluation_state, COUNT(*)::bigint AS finding_count
FROM "PilotLead";
SELECT
  'pilot_code_nulls' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*) FILTER (WHERE "pilotCode" IS NULL)::bigint AS finding_count
FROM "PilotLead";
SELECT
  'pilot_legacy_credentials_to_invalidate' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*) FILTER (WHERE "pilotCode" IS NOT NULL AND "pilotCode" !~ '^[0-9a-f]{64}$')::bigint AS finding_count
FROM "PilotLead";
SELECT
  'pilot_hashed_credentials' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*) FILTER (WHERE "pilotCode" ~ '^[0-9a-f]{64}$')::bigint AS finding_count
FROM "PilotLead";
SELECT
  'pilot_code_duplicate_groups' AS check_name,
  'EVALUATED' AS evaluation_state,
  COUNT(*)::bigint AS finding_count
FROM (
  SELECT 1
  FROM "PilotLead"
  WHERE "pilotCode" IS NOT NULL
  GROUP BY "pilotCode"
  HAVING COUNT(*) > 1
) duplicate_codes;
\else
SELECT 'pilot_lead_rows' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_code_nulls' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_legacy_credentials_to_invalidate' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_hashed_credentials' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
SELECT 'pilot_code_duplicate_groups' AS check_name, 'NOT_YET_EVALUABLE' AS evaluation_state, NULL::bigint AS finding_count;
\endif

ROLLBACK;
