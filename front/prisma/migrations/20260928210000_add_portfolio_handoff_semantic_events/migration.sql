-- H-TECH-08: bounded durable semantic events and derived Portfolio handoff read model.
CREATE TABLE "PortfolioHandoffSemanticEvent" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityVersion" INTEGER NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "interactionChannel" TEXT NOT NULL,
  "organizationId" TEXT,
  "portfolioScopeRef" TEXT,
  "challengeId" TEXT,
  "initiativeId" TEXT,
  "sourceRefs" TEXT[] NOT NULL,
  "originAssignmentId" TEXT,
  "correlationId" TEXT,
  "causationEventId" TEXT,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioHandoffSemanticEvent_pkey" PRIMARY KEY ("eventId")
);
CREATE INDEX "PortfolioHandoffSemanticEvent_entityType_entityId_entityVersion_idx" ON "PortfolioHandoffSemanticEvent"("entityType", "entityId", "entityVersion");
CREATE INDEX "PortfolioHandoffSemanticEvent_originAssignmentId_occurredAt_idx" ON "PortfolioHandoffSemanticEvent"("originAssignmentId", "occurredAt");
ALTER TABLE "PortfolioHandoffSemanticEvent" ADD CONSTRAINT "PortfolioHandoffSemanticEvent_originAssignmentId_fkey" FOREIGN KEY ("originAssignmentId") REFERENCES "PortfolioHandoffAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PortfolioHandoffProjection" (
  "assignmentId" TEXT NOT NULL,
  "organizationId" TEXT,
  "portfolioScopeRef" TEXT,
  "strategicFrontRef" TEXT,
  "challengeRef" TEXT NOT NULL,
  "challengeVersionRef" TEXT,
  "targetKind" "PortfolioHandoffTargetKind" NOT NULL,
  "initiativeRef" TEXT,
  "invitedIdentity" TEXT,
  "initiativeOwnerRef" TEXT,
  "executionTeam" JSONB NOT NULL,
  "observers" JSONB NOT NULL,
  "inviterRef" TEXT,
  "handoffState" "PortfolioHandoffState" NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "portfolioResponse" TEXT,
  "startedAt" TIMESTAMP(3),
  "resultingInitiativeRef" TEXT,
  "lastMaterialEvent" TEXT,
  "sourceEventRefs" TEXT[] NOT NULL,
  "projectionVersion" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioHandoffProjection_pkey" PRIMARY KEY ("assignmentId")
);
CREATE INDEX "PortfolioHandoffProjection_challengeRef_idx" ON "PortfolioHandoffProjection"("challengeRef");
CREATE INDEX "PortfolioHandoffProjection_initiativeRef_idx" ON "PortfolioHandoffProjection"("initiativeRef");
CREATE INDEX "PortfolioHandoffProjection_organizationId_idx" ON "PortfolioHandoffProjection"("organizationId");
ALTER TABLE "PortfolioHandoffProjection" ADD CONSTRAINT "PortfolioHandoffProjection_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PortfolioHandoffAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
