-- AI-01/AI-02 QA: additive storage for individual, non-canonical Step reasoning.
CREATE TABLE "StepReasoningSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastContextHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StepReasoningSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StepReasoningTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientTurnId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "sourceContextHash" TEXT NOT NULL,
    "contextSnapshotJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assistantText" TEXT,
    "structuredOutputJson" JSONB,
    "executionMode" TEXT,
    "requestId" TEXT NOT NULL,
    "providerModel" TEXT,
    "providerRunId" TEXT,
    "promptVersion" TEXT,
    "promptHash" TEXT,
    "tokensUsed" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "StepReasoningTurn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StepReasoningSession_organizationId_projectId_cycleId_stepNumber_createdById_key"
ON "StepReasoningSession"("organizationId", "projectId", "cycleId", "stepNumber", "createdById");
CREATE INDEX "StepReasoningSession_projectId_cycleId_stepNumber_idx" ON "StepReasoningSession"("projectId", "cycleId", "stepNumber");
CREATE INDEX "StepReasoningSession_createdById_status_idx" ON "StepReasoningSession"("createdById", "status");
CREATE UNIQUE INDEX "StepReasoningTurn_sessionId_clientTurnId_key" ON "StepReasoningTurn"("sessionId", "clientTurnId");
CREATE INDEX "StepReasoningTurn_sessionId_createdAt_idx" ON "StepReasoningTurn"("sessionId", "createdAt");
CREATE INDEX "StepReasoningTurn_actorId_status_idx" ON "StepReasoningTurn"("actorId", "status");
CREATE INDEX "StepReasoningTurn_requestId_idx" ON "StepReasoningTurn"("requestId");

ALTER TABLE "StepReasoningSession" ADD CONSTRAINT "StepReasoningSession_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepReasoningSession" ADD CONSTRAINT "StepReasoningSession_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepReasoningSession" ADD CONSTRAINT "StepReasoningSession_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "InitiativeCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepReasoningSession" ADD CONSTRAINT "StepReasoningSession_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StepReasoningTurn" ADD CONSTRAINT "StepReasoningTurn_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "StepReasoningSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StepReasoningTurn" ADD CONSTRAINT "StepReasoningTurn_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
