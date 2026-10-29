-- Add an explicit monotonic generation to every refresh-token family.
-- Existing families are ranked deterministically so subsequent rotations can
-- compare-and-set the exact token generation without losing session history.
ALTER TABLE "RefreshToken" ADD COLUMN "generation" INTEGER;

-- The previous non-atomic rotation could have produced parallel active rows in
-- one family. Keep only the newest branch before assigning generations.
WITH active_ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "family" ORDER BY "createdAt" DESC, "id" DESC) AS "activeRank"
  FROM "RefreshToken"
  WHERE "revokedAt" IS NULL
)
UPDATE "RefreshToken" AS token
SET "revokedAt" = CURRENT_TIMESTAMP
FROM active_ranked
WHERE token."id" = active_ranked."id"
  AND active_ranked."activeRank" > 1;

WITH ranked AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (PARTITION BY "family" ORDER BY "createdAt", "id") - 1)::INTEGER AS "generation"
  FROM "RefreshToken"
)
UPDATE "RefreshToken" AS token
SET "generation" = ranked."generation"
FROM ranked
WHERE token."id" = ranked."id";

ALTER TABLE "RefreshToken" ALTER COLUMN "generation" SET DEFAULT 0;
ALTER TABLE "RefreshToken" ALTER COLUMN "generation" SET NOT NULL;

CREATE UNIQUE INDEX "RefreshToken_family_generation_key"
ON "RefreshToken"("family", "generation");
