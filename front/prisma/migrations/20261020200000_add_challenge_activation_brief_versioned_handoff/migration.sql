-- ADR-008 / P12-R1: additive, versioned Portfolio-to-Handoff mandate.
-- Historical assignments intentionally retain NULL briefVersionId.
CREATE TYPE "ChallengeActivationBriefVersionStatus" AS ENUM ('DRAFT', 'CONFIRMED');
CREATE TYPE "PortfolioActivationCommandType" AS ENUM ('CREATE_BRIEF', 'CREATE_VERSION', 'CONFIRM_VERSION', 'CREATE_ASSIGNMENT');

CREATE TABLE "ChallengeActivationBrief" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "createdByActorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChallengeActivationBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChallengeActivationBriefVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "briefId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "ChallengeActivationBriefVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "intent" TEXT,
  "scope" TEXT,
  "strategicContextRefs" JSONB NOT NULL,
  "inheritedContext" JSONB NOT NULL,
  "constraintsSnapshot" JSONB NOT NULL,
  "knownGaps" JSONB NOT NULL,
  "sourceRefs" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "createdByActorId" TEXT NOT NULL,
  "confirmedByActorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  CONSTRAINT "ChallengeActivationBriefVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioActivationCommandReceipt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "commandType" "PortfolioActivationCommandType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "resultBriefId" TEXT,
  "resultVersionId" TEXT,
  "resultAssignmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioActivationCommandReceipt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PortfolioHandoffAssignment" ADD COLUMN "briefVersionId" TEXT;

CREATE UNIQUE INDEX "ChallengeActivationBrief_id_organizationId_key" ON "ChallengeActivationBrief"("id", "organizationId");
CREATE INDEX "ChallengeActivationBrief_organizationId_idx" ON "ChallengeActivationBrief"("organizationId");
CREATE INDEX "ChallengeActivationBrief_challengeId_idx" ON "ChallengeActivationBrief"("challengeId");
CREATE INDEX "ChallengeActivationBrief_createdByActorId_idx" ON "ChallengeActivationBrief"("createdByActorId");
CREATE UNIQUE INDEX "ChallengeActivationBriefVersion_briefId_versionNumber_key" ON "ChallengeActivationBriefVersion"("briefId", "versionNumber");
CREATE UNIQUE INDEX "ChallengeActivationBriefVersion_id_organizationId_challengeId_key" ON "ChallengeActivationBriefVersion"("id", "organizationId", "challengeId");
CREATE INDEX "ChallengeActivationBriefVersion_organizationId_idx" ON "ChallengeActivationBriefVersion"("organizationId");
CREATE INDEX "ChallengeActivationBriefVersion_challengeId_idx" ON "ChallengeActivationBriefVersion"("challengeId");
CREATE INDEX "ChallengeActivationBriefVersion_briefId_versionNumber_idx" ON "ChallengeActivationBriefVersion"("briefId", "versionNumber");
CREATE INDEX "ChallengeActivationBriefVersion_status_idx" ON "ChallengeActivationBriefVersion"("status");
CREATE UNIQUE INDEX "PortfolioActivationCommandReceipt_organizationId_commandType_idempotencyKey_key" ON "PortfolioActivationCommandReceipt"("organizationId", "commandType", "idempotencyKey");
CREATE INDEX "PortfolioActivationCommandReceipt_organizationId_createdAt_idx" ON "PortfolioActivationCommandReceipt"("organizationId", "createdAt");
CREATE INDEX "PortfolioHandoffAssignment_briefVersionId_idx" ON "PortfolioHandoffAssignment"("briefVersionId");

ALTER TABLE "ChallengeActivationBrief" ADD CONSTRAINT "ChallengeActivationBrief_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeActivationBrief" ADD CONSTRAINT "ChallengeActivationBrief_createdByActorId_fkey" FOREIGN KEY ("createdByActorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeActivationBriefVersion" ADD CONSTRAINT "ChallengeActivationBriefVersion_briefId_organizationId_fkey" FOREIGN KEY ("briefId", "organizationId") REFERENCES "ChallengeActivationBrief"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeActivationBriefVersion" ADD CONSTRAINT "ChallengeActivationBriefVersion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeActivationBriefVersion" ADD CONSTRAINT "ChallengeActivationBriefVersion_createdByActorId_fkey" FOREIGN KEY ("createdByActorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeActivationBriefVersion" ADD CONSTRAINT "ChallengeActivationBriefVersion_confirmedByActorId_fkey" FOREIGN KEY ("confirmedByActorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioHandoffAssignment" ADD CONSTRAINT "PortfolioHandoffAssignment_briefVersionId_fkey" FOREIGN KEY ("briefVersionId") REFERENCES "ChallengeActivationBriefVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioActivationCommandReceipt" ADD CONSTRAINT "PortfolioActivationCommandReceipt_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION assert_challenge_activation_brief_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE challenge_org text;
BEGIN
  SELECT sf."organizationId" INTO challenge_org FROM "Challenge" c JOIN "StrategicFront" sf ON sf.id = c."strategicFrontId" WHERE c.id = NEW."challengeId";
  IF challenge_org IS NULL OR challenge_org <> NEW."organizationId" THEN RAISE EXCEPTION 'ChallengeActivationBrief tenant must equal Challenge tenant'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER challenge_activation_brief_tenant BEFORE INSERT OR UPDATE ON "ChallengeActivationBrief" FOR EACH ROW EXECUTE FUNCTION assert_challenge_activation_brief_tenant();

CREATE OR REPLACE FUNCTION assert_challenge_activation_brief_version_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE brief_org text; brief_challenge text;
BEGIN
  SELECT "organizationId", "challengeId" INTO brief_org, brief_challenge FROM "ChallengeActivationBrief" WHERE id = NEW."briefId";
  IF brief_org IS NULL OR brief_org <> NEW."organizationId" OR brief_challenge <> NEW."challengeId" THEN RAISE EXCEPTION 'Brief Version must retain Brief tenant and Challenge'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER challenge_activation_brief_version_scope BEFORE INSERT OR UPDATE ON "ChallengeActivationBriefVersion" FOR EACH ROW EXECUTE FUNCTION assert_challenge_activation_brief_version_scope();

CREATE OR REPLACE FUNCTION enforce_challenge_activation_brief_version_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "PortfolioHandoffAssignment" a WHERE a."briefVersionId" = OLD.id) THEN RAISE EXCEPTION 'Referenced Brief Version cannot be deleted'; END IF;
    RAISE EXCEPTION 'Brief Versions are immutable and cannot be deleted';
  END IF;
  IF OLD."status" = 'CONFIRMED' THEN RAISE EXCEPTION 'Confirmed Brief Version is immutable'; END IF;
  IF NEW."status" <> 'CONFIRMED' OR NEW."confirmedByActorId" IS NULL OR NEW."confirmedAt" IS NULL THEN RAISE EXCEPTION 'Brief Version update must be the human DRAFT to CONFIRMED transition'; END IF;
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."briefId" IS DISTINCT FROM OLD."briefId" OR NEW."challengeId" IS DISTINCT FROM OLD."challengeId" OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR NEW."intent" IS DISTINCT FROM OLD."intent" OR NEW."scope" IS DISTINCT FROM OLD."scope" OR NEW."strategicContextRefs" IS DISTINCT FROM OLD."strategicContextRefs" OR NEW."inheritedContext" IS DISTINCT FROM OLD."inheritedContext" OR NEW."constraintsSnapshot" IS DISTINCT FROM OLD."constraintsSnapshot" OR NEW."knownGaps" IS DISTINCT FROM OLD."knownGaps" OR NEW."sourceRefs" IS DISTINCT FROM OLD."sourceRefs" OR NEW."provenance" IS DISTINCT FROM OLD."provenance" OR NEW."createdByActorId" IS DISTINCT FROM OLD."createdByActorId" THEN RAISE EXCEPTION 'Editing a Brief creates a new Version'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER challenge_activation_brief_version_immutable BEFORE UPDATE OR DELETE ON "ChallengeActivationBriefVersion" FOR EACH ROW EXECUTE FUNCTION enforce_challenge_activation_brief_version_immutability();

CREATE OR REPLACE FUNCTION assert_challenge_assignment_brief_before_send() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_challenge text; version_org text; version_status "ChallengeActivationBriefVersionStatus"; challenge_org text; assignment_org text;
BEGIN
  IF NEW."targetKind" <> 'CHALLENGE' OR NEW.state <> 'SENT' THEN RETURN NEW; END IF;
  IF NEW."briefVersionId" IS NULL THEN RAISE EXCEPTION 'Challenge Assignment requires confirmed briefVersionId before Send'; END IF;
  SELECT v."challengeId", v."organizationId", v.status INTO version_challenge, version_org, version_status FROM "ChallengeActivationBriefVersion" v WHERE v.id = NEW."briefVersionId";
  SELECT sf."organizationId" INTO challenge_org FROM "Challenge" c JOIN "StrategicFront" sf ON sf.id = c."strategicFrontId" WHERE c.id = NEW."challengeId";
  assignment_org := COALESCE(NEW."organizationId", challenge_org);
  IF version_status IS DISTINCT FROM 'CONFIRMED' OR version_challenge IS DISTINCT FROM NEW."challengeId" OR version_org IS DISTINCT FROM assignment_org OR challenge_org IS DISTINCT FROM assignment_org THEN RAISE EXCEPTION 'Challenge Assignment brief Version must be confirmed and scoped to its Challenge and tenant'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER challenge_assignment_brief_before_send BEFORE INSERT OR UPDATE OF "state", "briefVersionId", "challengeId", "organizationId" ON "PortfolioHandoffAssignment" FOR EACH ROW EXECUTE FUNCTION assert_challenge_assignment_brief_before_send();
