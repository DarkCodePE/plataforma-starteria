-- H-TECH-04: assignment lifecycle remains canonical; delivery attempts are transport evidence.
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'SENT';
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'VIEWED';
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'REVOKED';
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'EXPIRED';

ALTER TABLE "PortfolioHandoffAssignment"
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "viewedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "expiredAt" TIMESTAMP(3);

CREATE TYPE "PortfolioHandoffDeliveryAttemptStatus" AS ENUM ('SUCCEEDED', 'FAILED');

CREATE TABLE "PortfolioHandoffDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "status" "PortfolioHandoffDeliveryAttemptStatus" NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerMessageRef" TEXT,
  "errorCategory" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  CONSTRAINT "PortfolioHandoffDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioHandoffDeliveryAttempt_assignmentId_idempotencyKey_key" ON "PortfolioHandoffDeliveryAttempt"("assignmentId", "idempotencyKey");
CREATE INDEX "PortfolioHandoffDeliveryAttempt_assignmentId_attemptedAt_idx" ON "PortfolioHandoffDeliveryAttempt"("assignmentId", "attemptedAt");
ALTER TABLE "PortfolioHandoffDeliveryAttempt" ADD CONSTRAINT "PortfolioHandoffDeliveryAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PortfolioHandoffAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
