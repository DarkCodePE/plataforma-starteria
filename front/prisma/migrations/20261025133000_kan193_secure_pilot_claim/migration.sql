-- Invalidate every legacy/plaintext pilot credential at rest. The random
-- tombstone has no corresponding bearer; a contact-bound resubmission can
-- replace it with the SHA-256 hash of the newly derived 256-bit credential.
UPDATE "PilotLead"
SET "pilotCode" = lower(
  replace(gen_random_uuid()::text, '-', '')
  || replace(gen_random_uuid()::text, '-', '')
)
WHERE "pilotCode" !~ '^[0-9a-f]{64}$';

-- KAN-193: the database is the final arbiter for one Project per pilot lead.
-- PostgreSQL permits multiple NULL values in a unique index.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Project"
    WHERE "pilotLeadId" IS NOT NULL
    GROUP BY "pilotLeadId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'KAN-193 requires duplicate Project.pilotLeadId rows to be reconciled before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "Project_pilotLeadId_key" ON "Project"("pilotLeadId");

DROP INDEX IF EXISTS "Project_pilotLeadId_idx";
