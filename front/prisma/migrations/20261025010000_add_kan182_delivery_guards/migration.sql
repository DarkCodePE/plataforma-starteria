-- KAN-182: one durable delivery intent per Assignment, plus fenced execution leases.
-- Fail closed if an earlier runtime already produced duplicate semantic intents.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PortfolioHandoffDeliveryAttempt"
    GROUP BY "assignmentId", "requestFingerprint"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'KAN182_DELIVERY_INTENT_COLLISION';
  END IF;
END $$;

CREATE UNIQUE INDEX "HandoffDeliveryAttempt_assignment_intent_key"
  ON "PortfolioHandoffDeliveryAttempt"("assignmentId", "requestFingerprint");

ALTER TYPE "PortfolioHandoffDeliveryAttemptStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';
ALTER TYPE "PortfolioHandoffDeliveryBatchStatus" ADD VALUE IF NOT EXISTS 'RECONCILIATION_REQUIRED';

ALTER TABLE "PortfolioHandoffDeliveryAttempt"
  ADD COLUMN "executionGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "executionOwnerId" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3);

CREATE INDEX "PortfolioHandoffDeliveryAttempt_status_leaseUntil_idx"
  ON "PortfolioHandoffDeliveryAttempt"("status", "leaseUntil");

ALTER TABLE "PortfolioHandoffDeliveryBatch"
  ADD COLUMN "processingLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "processingGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processingOwnerId" TEXT;

CREATE INDEX "PortfolioHandoffDeliveryBatch_status_processingLeaseUntil_idx"
  ON "PortfolioHandoffDeliveryBatch"("status", "processingLeaseUntil");
