-- H-TECH-03: opaque invitation access only; assignment remains canonical.
CREATE TABLE "PortfolioHandoffInvitation" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "claimedByUserId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioHandoffInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioHandoffInvitation_tokenHash_key" ON "PortfolioHandoffInvitation"("tokenHash");
CREATE INDEX "PortfolioHandoffInvitation_assignmentId_idx" ON "PortfolioHandoffInvitation"("assignmentId");
CREATE INDEX "PortfolioHandoffInvitation_expiresAt_idx" ON "PortfolioHandoffInvitation"("expiresAt");
CREATE INDEX "PortfolioHandoffInvitation_revokedAt_idx" ON "PortfolioHandoffInvitation"("revokedAt");

ALTER TABLE "PortfolioHandoffInvitation" ADD CONSTRAINT "PortfolioHandoffInvitation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PortfolioHandoffAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
