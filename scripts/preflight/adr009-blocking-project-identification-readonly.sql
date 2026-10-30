\set ON_ERROR_STOP on

-- Fixed, private ADR-009 identification report. It emits business titles,
-- opaque identifiers, dates, states and bounded provenance metadata only.
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL application_name = 'adr009_private_identification';

SELECT (
  (SELECT COUNT(*) FROM "StrategicFront" WHERE "id" = 'cmuyaldaz0006di01njwnaf55') = 1
  AND (SELECT COUNT(*) FROM "Challenge" WHERE "id" = 'cmuyaldqg0008di01kbywurz6') = 1
  AND (SELECT COUNT(*) FROM "Project" WHERE "id" = 'cmuyalf02000adi010zwlqek0') = 1
  AND (
    SELECT COUNT(*)
    FROM "Challenge" challenge
    JOIN "InitiativePortfolioMeta" meta ON meta."challengeId" = challenge."id"
    WHERE challenge."id" = 'cmuyaldqg0008di01kbywurz6'
      AND challenge."strategicFrontId" = 'cmuyaldaz0006di01njwnaf55'
      AND meta."projectId" = 'cmuyalf02000adi010zwlqek0'
  ) = 1
) AS fixed_relationship_ready \gset

\if :fixed_relationship_ready
\else
  \warn 'ADR009_FIXED_RELATIONSHIP_NOT_FOUND'
  \quit 3
\endif

SELECT
  'front_dependency_summary' AS record_type,
  front."id" AS strategic_front_id,
  COUNT(DISTINCT challenge."id")::integer AS challenge_count,
  COUNT(DISTINCT meta."projectId")::integer AS dependent_project_count
FROM "StrategicFront" front
LEFT JOIN "Challenge" challenge ON challenge."strategicFrontId" = front."id"
LEFT JOIN "InitiativePortfolioMeta" meta ON meta."challengeId" = challenge."id"
WHERE front."id" = 'cmuyaldaz0006di01njwnaf55'
GROUP BY front."id";

SELECT
  'strategic_front_record' AS record_type,
  front."id" AS strategic_front_id,
  front."name" AS title,
  front."status"::text AS state,
  front."priority"::text AS priority,
  front."organizationId" AS organization_id,
  front."createdAt" AS created_at,
  front."updatedAt" AS updated_at
FROM "StrategicFront" front
WHERE front."id" = 'cmuyaldaz0006di01njwnaf55';

SELECT
  'challenge_record' AS record_type,
  challenge."id" AS challenge_id,
  challenge."strategicFrontId" AS strategic_front_id,
  challenge."title" AS title,
  challenge."status"::text AS state,
  challenge."type"::text AS challenge_type,
  challenge."createdAt" AS created_at,
  challenge."updatedAt" AS updated_at
FROM "Challenge" challenge
WHERE challenge."id" = 'cmuyaldqg0008di01kbywurz6';

SELECT
  'project_record' AS record_type,
  project."id" AS project_id,
  project."name" AS title,
  project."status"::text AS state,
  project."currentStep" AS current_step,
  project."step0Status"::text AS step_0_state,
  project."isArchived" AS is_archived,
  project."origin"::text AS origin,
  project."createdAt" AS created_at,
  project."lastModified" AS updated_at
FROM "Project" project
WHERE project."id" = 'cmuyalf02000adi010zwlqek0';

SELECT
  'project_challenge_relationship' AS record_type,
  meta."id" AS relationship_id,
  meta."projectId" AS project_id,
  meta."challengeId" AS challenge_id,
  meta."strategicFrontId" AS recorded_strategic_front_id,
  meta."status"::text AS relationship_state,
  meta."currentStep" AS relationship_step,
  meta."createdAt" AS created_at,
  meta."updatedAt" AS updated_at
FROM "InitiativePortfolioMeta" meta
WHERE meta."projectId" = 'cmuyalf02000adi010zwlqek0'
  AND meta."challengeId" = 'cmuyaldqg0008di01kbywurz6';

SELECT
  'front_challenge_dependents' AS record_type,
  CASE WHEN challenge."id" = 'cmuyaldqg0008di01kbywurz6' THEN 'TARGET' ELSE 'OTHER' END AS relation_kind,
  challenge."id" AS challenge_id,
  challenge."title" AS title,
  challenge."status"::text AS state,
  challenge."type"::text AS challenge_type,
  challenge."createdAt" AS created_at,
  challenge."updatedAt" AS updated_at
FROM "Challenge" challenge
WHERE challenge."strategicFrontId" = 'cmuyaldaz0006di01njwnaf55'
ORDER BY relation_kind DESC, challenge."createdAt", challenge."id";

SELECT
  'front_project_dependents' AS record_type,
  CASE WHEN project."id" = 'cmuyalf02000adi010zwlqek0' THEN 'TARGET' ELSE 'OTHER' END AS relation_kind,
  project."id" AS project_id,
  project."name" AS project_title,
  project."status"::text AS project_state,
  project."currentStep" AS current_step,
  project."isArchived" AS is_archived,
  project."origin"::text AS origin,
  project."createdAt" AS project_created_at,
  project."lastModified" AS project_updated_at,
  challenge."id" AS challenge_id,
  challenge."title" AS challenge_title,
  meta."status"::text AS relationship_state,
  meta."createdAt" AS relationship_created_at
FROM "StrategicFront" front
JOIN "Challenge" challenge ON challenge."strategicFrontId" = front."id"
JOIN "InitiativePortfolioMeta" meta ON meta."challengeId" = challenge."id"
JOIN "Project" project ON project."id" = meta."projectId"
WHERE front."id" = 'cmuyaldaz0006di01njwnaf55'
ORDER BY relation_kind DESC, challenge."createdAt", project."createdAt", project."id";

SELECT
  'project_provenance_summary' AS record_type,
  project."id" AS project_id,
  project."origin"::text AS origin,
  project."initialReviewSnapshotId" AS initial_review_snapshot_id,
  (snapshot."id" IS NOT NULL) AS initial_review_snapshot_exists,
  COUNT(DISTINCT source."id")::integer AS source_count,
  COALESCE(
    ARRAY_AGG(DISTINCT source."sourceType"::text ORDER BY source."sourceType"::text)
      FILTER (WHERE source."id" IS NOT NULL),
    ARRAY[]::text[]
  ) AS source_types,
  COUNT(DISTINCT confirmation."id")::integer AS route_confirmation_count,
  MIN(confirmation."confirmedAt") AS earliest_route_confirmation_at
FROM "Project" project
LEFT JOIN "InitialReviewSnapshot" snapshot ON snapshot."id" = project."initialReviewSnapshotId"
LEFT JOIN "SourceRef" source ON source."projectId" = project."id"
LEFT JOIN "RouteConfirmation" confirmation ON confirmation."createdProjectId" = project."id"
WHERE project."id" = 'cmuyalf02000adi010zwlqek0'
GROUP BY project."id", project."origin", project."initialReviewSnapshotId", snapshot."id";

ROLLBACK;
