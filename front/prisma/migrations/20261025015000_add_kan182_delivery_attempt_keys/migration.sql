-- KAN-182: append-only binding of every HTTP idempotency key used by a
-- delivery intent. A retry must not erase protection for an earlier key.
CREATE TABLE "PortfolioHandoffDeliveryAttemptKey" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioHandoffDeliveryAttemptKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioHandoffDeliveryAttemptKey_assignmentId_idempotencyKey_key"
  ON "PortfolioHandoffDeliveryAttemptKey"("assignmentId", "idempotencyKey");
CREATE INDEX "PortfolioHandoffDeliveryAttemptKey_attemptId_idx"
  ON "PortfolioHandoffDeliveryAttemptKey"("attemptId");

ALTER TABLE "PortfolioHandoffDeliveryAttemptKey"
  ADD CONSTRAINT "PortfolioHandoffDeliveryAttemptKey_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "PortfolioHandoffDeliveryAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PortfolioHandoffDeliveryAttemptKey" ("id", "assignmentId", "idempotencyKey", "attemptId")
SELECT 'kan182-key-' || "id", "assignmentId", "idempotencyKey", "id"
FROM "PortfolioHandoffDeliveryAttempt"
ON CONFLICT ("assignmentId", "idempotencyKey") DO NOTHING;
