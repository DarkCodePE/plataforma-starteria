-- KAN-253 B2 / ADR-010 (proposed): additive, provisional goal-turn ledger.
-- Does not modify PortfolioAnchor, E1 semantic ledger, Core, Project or Steps.
-- Do not apply to production until ADR ratified and disposable DB evidence passes.

CREATE TABLE "PortfolioBootstrapGoalTurn" (
  "id" TEXT NOT NULL,
  "bootstrapSessionId" TEXT NOT NULL,
  "turnVersion" INTEGER NOT NULL,
  "organizationId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "anchorVersion" INTEGER NOT NULL,
  "contextReviewId" TEXT,
  "contextReviewVersion" INTEGER,
  "questionId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "inputText" TEXT NOT NULL,
  "disposition" TEXT NOT NULL,
  "evidenceJson" JSONB NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PortfolioBootstrapGoalTurn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PBGoalTurn_session_version_key"
  ON "PortfolioBootstrapGoalTurn"("bootstrapSessionId", "turnVersion");
CREATE UNIQUE INDEX "PBGoalTurn_session_idempotency_key"
  ON "PortfolioBootstrapGoalTurn"("bootstrapSessionId", "idempotencyKeyHash");
CREATE INDEX "PortfolioBootstrapGoalTurn_organizationId_createdAt_idx"
  ON "PortfolioBootstrapGoalTurn"("organizationId", "createdAt");
CREATE INDEX "PortfolioBootstrapGoalTurn_actorUserId_createdAt_idx"
  ON "PortfolioBootstrapGoalTurn"("actorUserId", "createdAt");

ALTER TABLE "PortfolioBootstrapGoalTurn"
  ADD CONSTRAINT "PortfolioBootstrapGoalTurn_bootstrapSessionId_fkey"
  FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
