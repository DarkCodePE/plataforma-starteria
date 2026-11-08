-- KAN-244 / B1: additive Portfolio Bootstrap E1 semantic history.
-- PortfolioBootstrapContextReview remains the canonical confirmed snapshot.

CREATE TYPE "PortfolioBootstrapSemanticTurnStatus" AS ENUM (
  'completed',
  'failed_retryable',
  'failed_terminal'
);

CREATE TABLE "PortfolioBootstrapSemanticState" (
  "id" TEXT NOT NULL,
  "bootstrapSessionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "factLedgerJson" JSONB NOT NULL,
  "hypothesesJson" JSONB NOT NULL,
  "dispositionsJson" JSONB NOT NULL,
  "answeredGapsJson" JSONB NOT NULL,
  "questionHistoryJson" JSONB NOT NULL,
  "answeredQuestionIdsJson" JSONB NOT NULL,
  "activeQuestionJson" JSONB,
  "convergenceJson" JSONB NOT NULL,
  "questionBudgetJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortfolioBootstrapSemanticState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioBootstrapSemanticTurn" (
  "id" TEXT NOT NULL,
  "semanticStateId" TEXT NOT NULL,
  "semanticVersion" INTEGER NOT NULL,
  "organizationId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "inputText" TEXT NOT NULL,
  "status" "PortfolioBootstrapSemanticTurnStatus" NOT NULL,
  "factsJson" JSONB NOT NULL,
  "hypothesesJson" JSONB NOT NULL,
  "dispositionsJson" JSONB NOT NULL,
  "answeredGapsJson" JSONB NOT NULL,
  "answeredQuestionId" TEXT,
  "emittedQuestionJson" JSONB,
  "convergenceJson" JSONB NOT NULL,
  "questionBudgetJson" JSONB NOT NULL,
  "errorJson" JSONB,
  "provider" TEXT,
  "model" TEXT,
  "durationMs" INTEGER NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "totalTokens" INTEGER NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "attemptsJson" JSONB NOT NULL DEFAULT '[]',
  "idempotencyKeyHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PortfolioBootstrapSemanticTurn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioBootstrapSemanticState_bootstrapSessionId_key"
  ON "PortfolioBootstrapSemanticState"("bootstrapSessionId");
CREATE INDEX "PortfolioBootstrapSemanticState_bootstrapSessionId_version_idx"
  ON "PortfolioBootstrapSemanticState"("bootstrapSessionId", "version");
CREATE UNIQUE INDEX "PBSemanticTurn_state_version_key"
  ON "PortfolioBootstrapSemanticTurn"("semanticStateId", "semanticVersion");
CREATE UNIQUE INDEX "PBSemanticTurn_state_idempotency_key"
  ON "PortfolioBootstrapSemanticTurn"("semanticStateId", "idempotencyKeyHash");
CREATE INDEX "PortfolioBootstrapSemanticTurn_organizationId_createdAt_idx"
  ON "PortfolioBootstrapSemanticTurn"("organizationId", "createdAt");
CREATE INDEX "PortfolioBootstrapSemanticTurn_actorUserId_createdAt_idx"
  ON "PortfolioBootstrapSemanticTurn"("actorUserId", "createdAt");
CREATE INDEX "PortfolioBootstrapSemanticTurn_status_createdAt_idx"
  ON "PortfolioBootstrapSemanticTurn"("status", "createdAt");

ALTER TABLE "PortfolioBootstrapSemanticState"
  ADD CONSTRAINT "PortfolioBootstrapSemanticState_bootstrapSessionId_fkey"
  FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioBootstrapSemanticTurn"
  ADD CONSTRAINT "PortfolioBootstrapSemanticTurn_semanticStateId_fkey"
  FOREIGN KEY ("semanticStateId") REFERENCES "PortfolioBootstrapSemanticState"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioBootstrapSemanticTurn"
  ADD CONSTRAINT "PortfolioBootstrapSemanticTurn_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortfolioBootstrapSemanticTurn"
  ADD CONSTRAINT "PortfolioBootstrapSemanticTurn_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
