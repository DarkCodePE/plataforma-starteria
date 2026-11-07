CREATE TYPE "PortfolioLabRequestStatus" AS ENUM (
  'REQUESTED',
  'CONTACT_PENDING',
  'MEETING_SCHEDULED',
  'UNDER_REVIEW',
  'CLOSED',
  'NOT_PROCEEDING',
  'CANCELLED'
);

CREATE TYPE "PortfolioLabNotificationStatus" AS ENUM ('PENDING', 'FAILED', 'NOTIFIED');

CREATE TYPE "PortfolioLabNotificationAttemptStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'FAILED',
  'DISABLED'
);

CREATE TABLE "PortfolioLabRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "briefVersionId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "consentPurpose" TEXT NOT NULL,
  "status" "PortfolioLabRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "notificationStatus" "PortfolioLabNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKeyHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "providerMessageRef" TEXT,
  "lastNotificationError" TEXT,
  "terminalAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioLabRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioLabNotificationAttempt" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "PortfolioLabNotificationAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageRef" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "PortfolioLabNotificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioLabRequestHistory" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "PortfolioLabRequestStatus",
  "toStatus" "PortfolioLabRequestStatus",
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioLabRequestHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioLabRequest_org_actor_idempotency_key"
  ON "PortfolioLabRequest"("organizationId", "requesterId", "idempotencyKeyHash");
CREATE INDEX "PortfolioLabRequest_organizationId_status_createdAt_idx"
  ON "PortfolioLabRequest"("organizationId", "status", "createdAt");
CREATE INDEX "PortfolioLabRequest_challengeId_briefVersionId_idx"
  ON "PortfolioLabRequest"("challengeId", "briefVersionId");
CREATE INDEX "PortfolioLabRequest_requesterId_createdAt_idx"
  ON "PortfolioLabRequest"("requesterId", "createdAt");

-- A terminal request releases the target identity while preserving the row and
-- its history. This partial unique index is the final race-safe duplicate guard.
CREATE UNIQUE INDEX "PortfolioLabRequest_active_target_key"
  ON "PortfolioLabRequest"("organizationId", "challengeId", "briefVersionId")
  WHERE "status" NOT IN ('CLOSED', 'NOT_PROCEEDING', 'CANCELLED');

CREATE UNIQUE INDEX "PortfolioLabNotificationAttempt_request_idempotency_key"
  ON "PortfolioLabNotificationAttempt"("requestId", "idempotencyKeyHash");
CREATE INDEX "PortfolioLabNotificationAttempt_requestId_createdAt_idx"
  ON "PortfolioLabNotificationAttempt"("requestId", "createdAt");
CREATE INDEX "PortfolioLabRequestHistory_requestId_createdAt_idx"
  ON "PortfolioLabRequestHistory"("requestId", "createdAt");
CREATE INDEX "PortfolioLabRequestHistory_actorId_createdAt_idx"
  ON "PortfolioLabRequestHistory"("actorId", "createdAt");

ALTER TABLE "PortfolioLabRequest"
  ADD CONSTRAINT "PortfolioLabRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioLabRequest"
  ADD CONSTRAINT "PortfolioLabRequest_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioLabRequest"
  ADD CONSTRAINT "PortfolioLabRequest_briefId_organizationId_fkey"
  FOREIGN KEY ("briefId", "organizationId") REFERENCES "ChallengeActivationBrief"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioLabRequest"
  ADD CONSTRAINT "PortfolioLabRequest_briefVersionId_organizationId_challengeId_fkey"
  FOREIGN KEY ("briefVersionId", "organizationId", "challengeId") REFERENCES "ChallengeActivationBriefVersion"("id", "organizationId", "challengeId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioLabRequest"
  ADD CONSTRAINT "PortfolioLabRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortfolioLabNotificationAttempt"
  ADD CONSTRAINT "PortfolioLabNotificationAttempt_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "PortfolioLabRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioLabNotificationAttempt"
  ADD CONSTRAINT "PortfolioLabNotificationAttempt_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortfolioLabRequestHistory"
  ADD CONSTRAINT "PortfolioLabRequestHistory_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "PortfolioLabRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioLabRequestHistory"
  ADD CONSTRAINT "PortfolioLabRequestHistory_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "portfolio_lab_request_validate_exact_confirmed_version"()
RETURNS TRIGGER AS $$
DECLARE
  version_row "ChallengeActivationBriefVersion"%ROWTYPE;
BEGIN
  SELECT * INTO version_row
    FROM "ChallengeActivationBriefVersion"
   WHERE "id" = NEW."briefVersionId";

  IF NOT FOUND
     OR version_row."status" <> 'CONFIRMED'
     OR version_row."organizationId" <> NEW."organizationId"
     OR version_row."challengeId" <> NEW."challengeId"
     OR version_row."briefId" <> NEW."briefId" THEN
    RAISE EXCEPTION 'PortfolioLabRequest requires the exact confirmed BriefVersion';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD."organizationId" <> NEW."organizationId"
    OR OLD."challengeId" <> NEW."challengeId"
    OR OLD."briefId" <> NEW."briefId"
    OR OLD."briefVersionId" <> NEW."briefVersionId"
    OR OLD."requesterId" <> NEW."requesterId"
    OR OLD."consentAt" <> NEW."consentAt"
    OR OLD."consentPurpose" <> NEW."consentPurpose"
  ) THEN
    RAISE EXCEPTION 'PortfolioLabRequest identity and consent are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PortfolioLabRequest_exact_confirmed_version_trg"
  BEFORE INSERT OR UPDATE ON "PortfolioLabRequest"
  FOR EACH ROW EXECUTE FUNCTION "portfolio_lab_request_validate_exact_confirmed_version"();
