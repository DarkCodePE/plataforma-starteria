-- KAN-217: durable, auditable lifecycle for confirmed hard advancement conditions.
-- Existing rows remain fail-closed through the conservative ACTIVE default.
CREATE TYPE "PortfolioAdvancementConditionDisposition" AS ENUM ('active', 'resolved', 'dismissed');

ALTER TABLE "PortfolioAdvancementCondition"
ADD COLUMN "disposition" "PortfolioAdvancementConditionDisposition" NOT NULL DEFAULT 'active',
ADD COLUMN "dispositionVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "dispositionUpdatedBy" TEXT,
ADD COLUMN "dispositionUpdatedAt" TIMESTAMP(3),
ADD COLUMN "dispositionReason" TEXT,
ADD COLUMN "dispositionEvidenceRefs" JSONB,
ADD COLUMN "dispositionIdempotencyKey" TEXT;

CREATE INDEX "PortfolioAdvancementCondition_bootstrapSessionId_severity_disposition_idx"
ON "PortfolioAdvancementCondition"("bootstrapSessionId", "severity", "disposition");
