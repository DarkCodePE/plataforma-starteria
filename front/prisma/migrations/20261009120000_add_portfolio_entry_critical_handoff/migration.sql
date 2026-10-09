CREATE TYPE "PortfolioEntryCriticalHandoffConfirmationState" AS ENUM ('provisional', 'confirmed');

ALTER TABLE "PortfolioEntrySession"
ADD COLUMN "contextRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PortfolioEntryCriticalHandoff" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "artifactVersion" INTEGER NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "sourceContextRevision" INTEGER NOT NULL,
    "sourceTurnId" TEXT,
    "payload" JSONB NOT NULL,
    "confirmationState" "PortfolioEntryCriticalHandoffConfirmationState" NOT NULL DEFAULT 'provisional',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioEntryCriticalHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioEntryCriticalHandoff_sessionId_artifactVersion_key"
ON "PortfolioEntryCriticalHandoff"("sessionId", "artifactVersion");

CREATE INDEX "PortfolioEntryCriticalHandoff_sourceTurnId_idx"
ON "PortfolioEntryCriticalHandoff"("sourceTurnId");

CREATE INDEX "PortfolioEntryCriticalHandoff_confirmationState_idx"
ON "PortfolioEntryCriticalHandoff"("confirmationState");

ALTER TABLE "PortfolioEntryCriticalHandoff"
ADD CONSTRAINT "PortfolioEntryCriticalHandoff_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "PortfolioEntrySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioEntryCriticalHandoff"
ADD CONSTRAINT "PortfolioEntryCriticalHandoff_sourceTurnId_fkey"
FOREIGN KEY ("sourceTurnId") REFERENCES "PortfolioEntryTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
