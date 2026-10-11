CREATE TABLE "PortfolioEntryConversionSubmission" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "destinationConfigVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "contactEmail" TEXT NOT NULL,
    "contactName" TEXT,
    "organization" TEXT,
    "contextSharingMode" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3),
    "sharedDecisionInView" TEXT,
    "criticalHandoffId" TEXT NOT NULL,
    "criticalHandoffVersion" INTEGER NOT NULL,
    "sourceContextRevision" INTEGER NOT NULL,
    "projectionVersion" TEXT NOT NULL,
    "businessCapabilityBoundaryVersion" TEXT NOT NULL,
    "pathSchemaVersion" TEXT NOT NULL,
    "consentScopeVersion" TEXT,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PortfolioEntryConversionSubmission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConversionSubmission_destination_check" CHECK (
      ("destinationType" = 'DEMO' AND "purpose" = 'DEMO_REQUEST') OR
      ("destinationType" = 'EARLY_ACCESS' AND "purpose" = 'EARLY_ACCESS_REQUEST')
    ),
    CONSTRAINT "ConversionSubmission_status_check" CHECK ("status" = 'ACCEPTED'),
    CONSTRAINT "ConversionSubmission_consent_check" CHECK (
      ("contextSharingMode" = 'NO_ENTRY_CONTEXT_SHARED' AND "consentedAt" IS NULL AND "sharedDecisionInView" IS NULL AND "consentScopeVersion" IS NULL) OR
      ("contextSharingMode" = 'SHARE_CONTEXT_WITH_CONVERSION' AND "consentedAt" IS NOT NULL AND "consentScopeVersion" = 'DECISION_IN_VIEW_V1')
    )
);

CREATE UNIQUE INDEX "ConversionSubmission_idempotency_key"
  ON "PortfolioEntryConversionSubmission"("sessionId", "destinationType", "idempotencyKeyHash");
CREATE INDEX "PortfolioEntryConversionSubmission_sessionId_submittedAt_idx"
  ON "PortfolioEntryConversionSubmission"("sessionId", "submittedAt");
ALTER TABLE "PortfolioEntryConversionSubmission"
  ADD CONSTRAINT "PortfolioEntryConversionSubmission_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "PortfolioEntrySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
