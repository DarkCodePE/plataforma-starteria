-- KAN-182 / ADR-009 forward-only compatibility gate.
-- The published 20261023090000 migration is immutable. This migration never
-- guesses a tenant and never rewrites Project.organizationId: inconsistent
-- historical data must be reconciled explicitly before deployment continues.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Project" p
    JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
    LEFT JOIN "User" u ON u."id" = p."ownerId"
    LEFT JOIN "Organization" owner_org ON owner_org."id" = u."organizationId"
    WHERE p."ownerId" IS NOT NULL
      AND (u."id" IS NULL OR (u."organizationId" IS NOT NULL AND owner_org."id" IS NULL))
  ) THEN
    RAISE EXCEPTION 'ADR009_INVALID_PROJECT_OWNER';
  END IF;

  IF EXISTS (
    SELECT ipm."projectId"
    FROM "InitiativePortfolioMeta" ipm
    JOIN "Challenge" c ON c."id" = ipm."challengeId"
    JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
    WHERE sf."organizationId" IS NOT NULL
    GROUP BY ipm."projectId"
    HAVING COUNT(DISTINCT sf."organizationId") > 1
  ) THEN
    RAISE EXCEPTION 'ADR009_PROJECT_MULTIPLE_FRONT_ORGANIZATIONS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Project" p
    WHERE EXISTS (SELECT 1 FROM "InitiativePortfolioMeta" ipm WHERE ipm."projectId" = p."id")
      AND NOT EXISTS (
        SELECT 1
        FROM "InitiativePortfolioMeta" ipm
        JOIN "Challenge" c ON c."id" = ipm."challengeId"
        JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
        WHERE ipm."projectId" = p."id" AND sf."organizationId" IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'ADR009_PORTFOLIO_PROJECT_WITHOUT_ORGANIZATION_CANDIDATE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Project" p
    JOIN "InitiativePortfolioMeta" ipm ON ipm."projectId" = p."id"
    JOIN "Challenge" c ON c."id" = ipm."challengeId"
    JOIN "StrategicFront" sf ON sf."id" = c."strategicFrontId"
    WHERE sf."organizationId" IS NOT NULL
      AND p."organizationId" IS DISTINCT FROM sf."organizationId"
  ) THEN
    RAISE EXCEPTION 'ADR009_PROJECT_FRONT_TENANT_MISMATCH';
  END IF;
END $$;

-- Legacy delivery reservations are quarantined by the runtime on first read.
-- Legacy PROCESSING batches are reclaimed through a new fenced generation.
-- Keeping those compatibility transitions in CAS-protected runtime code makes
-- this migration additive and safe for the automatic CD migration gate.
