\set ON_ERROR_STOP on

-- KAN-182 / ADR-009. Execute only with a read-only production role.
-- Any returned detail row blocks the production migration until human reconciliation.
BEGIN TRANSACTION READ ONLY;

SELECT
  'invalid_owner_organization' AS gate,
  p."id" AS project_id,
  p."ownerId" AS owner_id,
  u."organizationId" AS invalid_organization_id
FROM "Project" p
JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
JOIN "User" u ON u."id" = p."ownerId"
LEFT JOIN "Organization" o ON o."id" = u."organizationId"
WHERE u."organizationId" IS NOT NULL
  AND o."id" IS NULL
ORDER BY p."id";

-- Mirrors the forward guard: a Portfolio Project owner is invalid when the
-- User row is missing or its non-null organization reference is orphaned.
SELECT DISTINCT
  'invalid_project_owner' AS gate,
  p."id" AS project_id,
  p."ownerId" AS owner_id,
  CASE
    WHEN u."id" IS NULL THEN 'USER_NOT_FOUND'
    ELSE 'OWNER_ORGANIZATION_NOT_FOUND'
  END AS reason
FROM "Project" p
JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
LEFT JOIN "User" u ON u."id" = p."ownerId"
LEFT JOIN "Organization" owner_org ON owner_org."id" = u."organizationId"
WHERE p."ownerId" IS NOT NULL
  AND (u."id" IS NULL OR (u."organizationId" IS NOT NULL AND owner_org."id" IS NULL))
ORDER BY p."id";

-- A non-null StrategicFront.organizationId is not a usable tenant candidate
-- unless the referenced Organization exists.
SELECT DISTINCT
  'invalid_front_organization' AS gate,
  p."id" AS project_id,
  sf."id" AS strategic_front_id,
  sf."organizationId" AS invalid_organization_id
FROM "Project" p
JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
JOIN "Challenge" c ON c."id" = ipm."challengeId"
JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
LEFT JOIN "Organization" front_org ON front_org."id" = sf."organizationId"
WHERE sf."organizationId" IS NOT NULL
  AND front_org."id" IS NULL
ORDER BY p."id", sf."id";

SELECT DISTINCT
  'owner_front_tenant_mismatch' AS gate,
  p."id" AS project_id,
  u."organizationId" AS owner_organization_id,
  sf."organizationId" AS front_organization_id
FROM "Project" p
JOIN "User" u ON u."id" = p."ownerId"
JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
JOIN "Challenge" c ON c."id" = ipm."challengeId"
JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
WHERE u."organizationId" IS NOT NULL
  AND sf."organizationId" IS NOT NULL
  AND u."organizationId" <> sf."organizationId"
ORDER BY p."id", owner_organization_id, front_organization_id;

SELECT
  'project_multiple_front_organizations' AS gate,
  p."id" AS project_id,
  ARRAY_AGG(DISTINCT sf."organizationId" ORDER BY sf."organizationId") AS front_organization_ids
FROM "Project" p
JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
JOIN "Challenge" c ON c."id" = ipm."challengeId"
JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
WHERE sf."organizationId" IS NOT NULL
GROUP BY p."id"
HAVING COUNT(DISTINCT sf."organizationId") > 1
ORDER BY p."id";

SELECT
  'portfolio_project_without_organization_candidate' AS gate,
  p."id" AS project_id,
  p."ownerId" AS owner_id
FROM "Project" p
WHERE EXISTS (
  SELECT 1 FROM "InitiativePortfolioMeta" ipm WHERE ipm."projectId" = p."id"
)
AND NOT EXISTS (
  SELECT 1
  FROM "InitiativePortfolioMeta" ipm
  JOIN "Challenge" c ON c."id" = ipm."challengeId"
  JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
  JOIN "Organization" candidate_org ON candidate_org."id" = sf."organizationId"
  WHERE ipm."projectId" = p."id"
)
ORDER BY p."id";

-- Inventory, not an automatic failure: before ADR-009 the target column does not exist,
-- so every Project is listed; after ADR-009 only rows still tenantless are listed.
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'Project'
    AND column_name = 'organizationId'
) AS project_organization_column_exists \gset
\if :project_organization_column_exists
SELECT DISTINCT
  'project_front_tenant_mismatch' AS gate,
  p."id" AS project_id,
  p."organizationId" AS project_organization_id,
  sf."organizationId" AS front_organization_id
FROM "Project" p
JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
JOIN "Challenge" c ON c."id" = ipm."challengeId"
JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
WHERE sf."organizationId" IS NOT NULL
  AND p."organizationId" IS DISTINCT FROM sf."organizationId"
ORDER BY p."id", front_organization_id;

SELECT
  'project_without_canonical_organization' AS gate,
  p."id" AS project_id,
  p."ownerId" AS owner_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "InitiativePortfolioMeta" ipm WHERE ipm."projectId" = p."id"
    ) THEN 'PORTFOLIO'
    ELSE 'PERSONAL_OR_LEGACY'
  END AS classification
FROM "Project" p
WHERE p."organizationId" IS NULL
ORDER BY classification, p."id";
\else
SELECT
  'project_without_canonical_organization' AS gate,
  p."id" AS project_id,
  p."ownerId" AS owner_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "InitiativePortfolioMeta" ipm WHERE ipm."projectId" = p."id"
    ) THEN 'PORTFOLIO_PRE_MIGRATION'
    ELSE 'PERSONAL_OR_LEGACY'
  END AS classification
FROM "Project" p
ORDER BY classification, p."id";
\endif

-- Older PL-06A/ADR-009 histories can already have the attempt table without
-- the later requestFingerprint column. Check the complete query shape before
-- referencing it so the historical preflight remains executable.
SELECT to_regclass('"PortfolioHandoffDeliveryAttempt"') IS NOT NULL AS delivery_attempt_table_exists \gset
SELECT COUNT(*) = 2 AS delivery_attempt_required_columns_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'PortfolioHandoffDeliveryAttempt'
  AND column_name IN ('assignmentId', 'requestFingerprint') \gset
\if :delivery_attempt_table_exists
\if :delivery_attempt_required_columns_ready
SELECT
  'delivery_intent_collision' AS gate,
  "assignmentId" AS assignment_id,
  "requestFingerprint" AS request_fingerprint,
  COUNT(*) AS collision_count
FROM "PortfolioHandoffDeliveryAttempt"
GROUP BY "assignmentId", "requestFingerprint"
HAVING COUNT(*) > 1
ORDER BY "assignmentId", "requestFingerprint";
\else
SELECT 'delivery_intent_collision' AS gate, 'REQUIRED_COLUMNS_NOT_PRESENT_YET' AS status;
\endif
\else
SELECT 'delivery_intent_collision' AS gate, 'TABLE_NOT_PRESENT_YET' AS status;
\endif

-- MEDIUM-03 inventory: DeliveryBatch currently keeps bounded scalar references instead
-- of FKs. Any orphan blocks adding constraints until its lifecycle is reconciled.
SELECT to_regclass('"PortfolioHandoffDeliveryBatch"') IS NOT NULL AS delivery_batch_table_exists \gset
SELECT COUNT(*) = 5 AS delivery_batch_required_columns_ready
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'PortfolioHandoffDeliveryBatch'
  AND column_name IN ('id', 'organizationId', 'challengeId', 'actorId', 'retryOfBatchId') \gset
\if :delivery_batch_table_exists
\if :delivery_batch_required_columns_ready
SELECT
  'delivery_batch_orphan_reference' AS gate,
  b."id" AS batch_id,
  CASE
    WHEN o."id" IS NULL THEN 'organizationId'
    WHEN c."id" IS NULL THEN 'challengeId'
    WHEN u."id" IS NULL THEN 'actorId'
    WHEN b."retryOfBatchId" IS NOT NULL AND parent."id" IS NULL THEN 'retryOfBatchId'
  END AS orphan_field
FROM "PortfolioHandoffDeliveryBatch" b
LEFT JOIN "Organization" o ON o."id" = b."organizationId"
LEFT JOIN "Challenge" c ON c."id" = b."challengeId"
LEFT JOIN "User" u ON u."id" = b."actorId"
LEFT JOIN "PortfolioHandoffDeliveryBatch" parent ON parent."id" = b."retryOfBatchId"
WHERE o."id" IS NULL
   OR c."id" IS NULL
   OR u."id" IS NULL
   OR (b."retryOfBatchId" IS NOT NULL AND parent."id" IS NULL)
ORDER BY b."id";
\else
SELECT 'delivery_batch_orphan_reference' AS gate, 'REQUIRED_COLUMNS_NOT_PRESENT_YET' AS status;
\endif
\else
SELECT 'delivery_batch_orphan_reference' AS gate, 'TABLE_NOT_PRESENT_YET' AS status;
\endif

ROLLBACK;
