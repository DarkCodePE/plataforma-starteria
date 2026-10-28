CREATE TABLE "PortfolioEntryCriticalHandoffGeneration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceContextRevision" INTEGER NOT NULL,
    "expectedSessionRevision" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "failureClass" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioEntryCriticalHandoffGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioEntryCriticalHandoffGeneration_sessionId_sourceContextRevision_key"
ON "PortfolioEntryCriticalHandoffGeneration"("sessionId", "sourceContextRevision");

CREATE INDEX "PortfolioEntryCriticalHandoffGeneration_status_idx"
ON "PortfolioEntryCriticalHandoffGeneration"("status");

ALTER TABLE "PortfolioEntryCriticalHandoffGeneration"
ADD CONSTRAINT "PortfolioEntryCriticalHandoffGeneration_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "PortfolioEntrySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
