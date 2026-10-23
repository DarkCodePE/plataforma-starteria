-- ADR-009: imported documentary initiatives remain inert until later human
-- activation. This migration is additive except for allowing Project.ownerId
-- to be NULL under a narrow database-enforced imported-project invariant.

CREATE TYPE "ImportedInitiativeMode" AS ENUM ('LINK_EXISTING', 'REGISTER_EXISTING');
CREATE TYPE "ImportedInitiativeLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "ImportedInitiativeActivationStatus" AS ENUM ('OWNER_PENDING', 'OWNER_CONFIRMED');
CREATE TYPE "RetrospectiveAssessmentStatus" AS ENUM ('PENDING_RETROACTIVE_ASSESSMENT', 'IN_REVIEW', 'ASSESSED');

ALTER TYPE "InitiativePortfolioStatus" ADD VALUE IF NOT EXISTS 'pending_retroactive_assessment' BEFORE 'en_step_0';

ALTER TABLE "Project"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "activationStatus" "ImportedInitiativeActivationStatus",
  ADD COLUMN "retrospectiveAssessmentStatus" "RetrospectiveAssessmentStatus",
  ALTER COLUMN "ownerId" DROP NOT NULL;

-- Deterministic, idempotent compatibility backfill. Owner remains untouched.
-- Historical scalar organization references are not canonical membership: only
-- copy an organization that already exists. Orphan references remain NULL and
-- therefore fail closed in tenant-scoped Project consumers.
UPDATE "Project" AS project
SET "organizationId" = organization."id"
FROM "User" AS owner
JOIN "Organization" AS organization
  ON organization."id" = owner."organizationId"
WHERE project."ownerId" = owner."id"
  AND project."organizationId" IS NULL
  AND owner."organizationId" IS NOT NULL;

UPDATE "Project" AS project
SET "organizationId" = organization."id"
FROM "InitiativePortfolioMeta" AS meta
JOIN "Challenge" AS challenge ON challenge."id" = meta."challengeId"
JOIN "StrategicFront" AS front ON front."id" = challenge."strategicFrontId"
JOIN "Organization" AS organization
  ON organization."id" = front."organizationId"
WHERE meta."projectId" = project."id"
  AND project."organizationId" IS NULL
  AND front."organizationId" IS NOT NULL;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_owner_pending_imported_check"
  CHECK (
    "ownerId" IS NOT NULL OR (
      "origin" = 'imported'
      AND "organizationId" IS NOT NULL
      AND "activationStatus" = 'OWNER_PENDING'
      AND "retrospectiveAssessmentStatus" = 'PENDING_RETROACTIVE_ASSESSMENT'
    )
  );

CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

CREATE TABLE "PortfolioImportedInitiativeLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "bootstrapSessionId" TEXT NOT NULL,
  "workItemId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "mode" "ImportedInitiativeMode" NOT NULL,
  "status" "ImportedInitiativeLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "activeWorkItemKey" TEXT,
  "sourceVersion" TIMESTAMP(3) NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "decisionVersion" INTEGER NOT NULL DEFAULT 1,
  "identitySnapshot" JSONB NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "alignmentDecision" JSONB NOT NULL,
  "confirmedByActorId" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedByActorId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioImportedInitiativeLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioImportedInitiativeLink_activeWorkItemKey_key"
  ON "PortfolioImportedInitiativeLink"("activeWorkItemKey");
CREATE UNIQUE INDEX "PortfolioImportedInitiativeLink_organizationId_idempotencyKey_key"
  ON "PortfolioImportedInitiativeLink"("organizationId", "idempotencyKey");
CREATE INDEX "PortfolioImportedInitiativeLink_organizationId_workItemId_status_idx"
  ON "PortfolioImportedInitiativeLink"("organizationId", "workItemId", "status");
CREATE INDEX "PortfolioImportedInitiativeLink_organizationId_projectId_status_idx"
  ON "PortfolioImportedInitiativeLink"("organizationId", "projectId", "status");
CREATE INDEX "PortfolioImportedInitiativeLink_challengeId_status_idx"
  ON "PortfolioImportedInitiativeLink"("challengeId", "status");
CREATE INDEX "PortfolioImportedInitiativeLink_bootstrapSessionId_idx"
  ON "PortfolioImportedInitiativeLink"("bootstrapSessionId");

ALTER TABLE "PortfolioImportedInitiativeLink"
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_bootstrapSessionId_fkey"
  FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_workItemId_fkey"
  FOREIGN KEY ("workItemId") REFERENCES "PortfolioBootstrapWorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_confirmedByActorId_fkey"
  FOREIGN KEY ("confirmedByActorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PortfolioImportedInitiativeLink_revokedByActorId_fkey"
  FOREIGN KEY ("revokedByActorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
