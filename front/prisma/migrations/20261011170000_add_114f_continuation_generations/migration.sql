-- KAN-134: preserve old rows as unbound compatibility data and permit independent 114F generations.
ALTER TABLE "PortfolioEntrySession"
  ADD COLUMN "continuationProfileVersion" INTEGER,
  ADD COLUMN "continuationProfileEvidenceRef" TEXT;

ALTER TABLE "PortfolioEntryPortfolioContinuation"
  ALTER COLUMN "handoffId" DROP NOT NULL,
  ALTER COLUMN "confirmationId" DROP NOT NULL,
  ALTER COLUMN "portfolioScope" DROP NOT NULL,
  ALTER COLUMN "sourceSnapshot" DROP NOT NULL,
  ALTER COLUMN "pendingItems" DROP NOT NULL,
  ALTER COLUMN "mappingVersion" DROP NOT NULL,
  ALTER COLUMN "destinationRoute" DROP NOT NULL,
  ADD COLUMN "snapshotFormat" TEXT,
  ADD COLUMN "snapshotGeneration" INTEGER,
  ADD COLUMN "snapshotState" TEXT,
  ADD COLUMN "sourceContextRevision" INTEGER,
  ADD COLUMN "criticalHandoffId" TEXT,
  ADD COLUMN "criticalHandoffVersion" INTEGER,
  ADD COLUMN "criticalHandoffSchemaVersion" TEXT,
  ADD COLUMN "criticalHandoffConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "starteriaPathProjectionVersion" TEXT,
  ADD COLUMN "starteriaPathSchemaVersion" TEXT,
  ADD COLUMN "starteriaPathBoundaryVersion" TEXT,
  ADD COLUMN "continuationProfile" "PortfolioEntryProfile",
  ADD COLUMN "continuationProfileVersion" INTEGER,
  ADD COLUMN "profileEvidenceRef" TEXT,
  ADD COLUMN "organizationScopeId" TEXT,
  ADD COLUMN "snapshotOperation" TEXT,
  ADD COLUMN "idempotencyKeyHash" TEXT,
  ADD COLUMN "requestFingerprint" TEXT,
  ADD COLUMN "sourceBindingHash" TEXT,
  ADD COLUMN "supersededAt" TIMESTAMP(3),
  ADD COLUMN "supersededById" TEXT,
  ADD COLUMN "carriedProjection" JSONB,
  ADD COLUMN "openItems" JSONB;

-- The old unconditional unique constraint is replaced with one that applies only to old rows.
DROP INDEX "PortfolioEntryPortfolioContinuation_sessionId_key";

CREATE UNIQUE INDEX "PEContinuation_legacy_session_key"
  ON "PortfolioEntryPortfolioContinuation"("sessionId") WHERE "snapshotFormat" IS NULL;
CREATE UNIQUE INDEX "PEContinuation_current_session_key"
  ON "PortfolioEntryPortfolioContinuation"("sessionId") WHERE "snapshotFormat" = 'PORTFOLIO_SETUP_114F_V1' AND "snapshotState" = 'CURRENT';
CREATE UNIQUE INDEX "PEContinuation_session_generation_key"
  ON "PortfolioEntryPortfolioContinuation"("sessionId", "snapshotGeneration");
CREATE UNIQUE INDEX "PEContinuation_operation_key"
  ON "PortfolioEntryPortfolioContinuation"("sessionId", "snapshotOperation", "idempotencyKeyHash");
CREATE INDEX "PEContinuation_format_state_idx"
  ON "PortfolioEntryPortfolioContinuation"("sessionId", "snapshotFormat", "snapshotState");

ALTER TABLE "PortfolioEntryPortfolioContinuation"
  ADD CONSTRAINT "PEContinuation_114f_shape_check" CHECK (
    ("snapshotFormat" IS NULL
      AND "handoffId" IS NOT NULL AND "confirmationId" IS NOT NULL
      AND "portfolioScope" IS NOT NULL AND "sourceSnapshot" IS NOT NULL
      AND "pendingItems" IS NOT NULL AND "mappingVersion" IS NOT NULL
      AND "destinationRoute" IS NOT NULL)
    OR (
      "snapshotFormat" = 'PORTFOLIO_SETUP_114F_V1'
      AND "snapshotGeneration" IS NOT NULL
      AND "snapshotGeneration" > 0
      AND "snapshotState" IS NOT NULL
      AND "snapshotState" IN ('CURRENT', 'SUPERSEDED')
      AND "sourceContextRevision" IS NOT NULL
      AND "sourceContextRevision" >= 0
      AND "criticalHandoffId" IS NOT NULL
      AND "criticalHandoffVersion" IS NOT NULL
      AND "criticalHandoffVersion" > 0
      AND "criticalHandoffSchemaVersion" IS NOT NULL
      AND "criticalHandoffConfirmedAt" IS NOT NULL
      AND (("starteriaPathProjectionVersion" IS NULL AND "starteriaPathSchemaVersion" IS NULL AND "starteriaPathBoundaryVersion" IS NULL)
        OR ("starteriaPathProjectionVersion" IS NOT NULL AND "starteriaPathSchemaVersion" IS NOT NULL AND "starteriaPathBoundaryVersion" IS NOT NULL))
      AND "continuationProfile" IS NOT NULL
      AND "continuationProfileVersion" IS NOT NULL
      AND "continuationProfileVersion" > 0
      AND "profileEvidenceRef" IS NOT NULL
      AND "snapshotOperation" IS NOT NULL
      AND "idempotencyKeyHash" IS NOT NULL
      AND "requestFingerprint" IS NOT NULL
      AND "sourceBindingHash" IS NOT NULL
      AND ("snapshotState" <> 'SUPERSEDED' OR "supersededAt" IS NOT NULL)
      AND "handoffId" IS NULL AND "confirmationId" IS NULL
      AND "portfolioScope" IS NULL AND "sourceSnapshot" IS NULL
      AND "pendingItems" IS NULL AND "mappingVersion" IS NULL
      AND "destinationRoute" IS NULL
    )
  );
