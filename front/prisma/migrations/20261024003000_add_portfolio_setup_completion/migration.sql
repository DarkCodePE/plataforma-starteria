-- KAN-171/KAN-172: a contextual, human-confirmed completion checkpoint.
-- It does not close the Portfolio and does not create domain entities.
ALTER TABLE "PortfolioBootstrapSession"
  ADD COLUMN "setupCompletedAt" TIMESTAMP(3),
  ADD COLUMN "setupCompletedByActorId" TEXT,
  ADD COLUMN "setupCompletionIdempotencyKey" TEXT;

CREATE INDEX "PortfolioBootstrapSession_organizationId_setupCompletedAt_idx"
  ON "PortfolioBootstrapSession"("organizationId", "setupCompletedAt");
