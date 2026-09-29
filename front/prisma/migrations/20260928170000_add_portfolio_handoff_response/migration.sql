-- H-TECH-05: bounded accept/reject/Portfolio response audit persistence.
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'ACCEPTED';
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'REJECTED';

ALTER TABLE "PortfolioHandoffAssignment"
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "acceptedBy" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedBy" TEXT,
  ADD COLUMN "portfolioResponse" TEXT,
  ADD COLUMN "portfolioResponseRecordedAt" TIMESTAMP(3),
  ADD COLUMN "portfolioResponseRecordedBy" TEXT;

CREATE TYPE "PortfolioHandoffResponseCommandType" AS ENUM ('ACCEPT', 'REJECT', 'PORTFOLIO_RESPONSE');
CREATE TABLE "PortfolioHandoffResponseCommand" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "type" "PortfolioHandoffResponseCommandType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "resultingVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioHandoffResponseCommand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortfolioHandoffResponseCommand_assignmentId_type_idempotencyKey_key" ON "PortfolioHandoffResponseCommand"("assignmentId", "type", "idempotencyKey");
CREATE INDEX "PortfolioHandoffResponseCommand_assignmentId_createdAt_idx" ON "PortfolioHandoffResponseCommand"("assignmentId", "createdAt");
ALTER TABLE "PortfolioHandoffResponseCommand" ADD CONSTRAINT "PortfolioHandoffResponseCommand_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PortfolioHandoffAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
