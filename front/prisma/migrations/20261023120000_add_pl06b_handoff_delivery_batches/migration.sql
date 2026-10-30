ALTER TABLE "PortfolioHandoffDeliveryAttempt"
ADD COLUMN "requestFingerprint" TEXT;

UPDATE "PortfolioHandoffDeliveryAttempt"
SET "requestFingerprint" = 'legacy:' || "id"
WHERE "requestFingerprint" IS NULL;

ALTER TABLE "PortfolioHandoffDeliveryAttempt"
ALTER COLUMN "requestFingerprint" SET NOT NULL;

CREATE TYPE "PortfolioHandoffDeliveryBatchStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TABLE "PortfolioHandoffDeliveryBatch" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "retryOfBatchId" TEXT,
  "assignmentIds" TEXT[] NOT NULL,
  "status" "PortfolioHandoffDeliveryBatchStatus" NOT NULL DEFAULT 'PROCESSING',
  "results" JSONB NOT NULL,
  "succeededCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PortfolioHandoffDeliveryBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioHandoffDeliveryBatch_organizationId_idempotencyKey_key"
ON "PortfolioHandoffDeliveryBatch"("organizationId", "idempotencyKey");
CREATE INDEX "PortfolioHandoffDeliveryBatch_challengeId_createdAt_idx"
ON "PortfolioHandoffDeliveryBatch"("challengeId", "createdAt");
CREATE INDEX "PortfolioHandoffDeliveryBatch_retryOfBatchId_idx"
ON "PortfolioHandoffDeliveryBatch"("retryOfBatchId");
