-- ADR-008 clarification: a confirmed Version cannot be deleted while it has a
-- governed Assignment reference. No delete command is exposed by the product;
-- this permits isolated test/administrative cleanup of an unreferenced row.
CREATE OR REPLACE FUNCTION enforce_challenge_activation_brief_version_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "PortfolioHandoffAssignment" a WHERE a."briefVersionId" = OLD.id) THEN RAISE EXCEPTION 'Referenced Brief Version cannot be deleted'; END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'CONFIRMED' THEN RAISE EXCEPTION 'Confirmed Brief Version is immutable'; END IF;
  IF NEW."status" <> 'CONFIRMED' OR NEW."confirmedByActorId" IS NULL OR NEW."confirmedAt" IS NULL THEN RAISE EXCEPTION 'Brief Version update must be the human DRAFT to CONFIRMED transition'; END IF;
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId" OR NEW."briefId" IS DISTINCT FROM OLD."briefId" OR NEW."challengeId" IS DISTINCT FROM OLD."challengeId" OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR NEW."intent" IS DISTINCT FROM OLD."intent" OR NEW."scope" IS DISTINCT FROM OLD."scope" OR NEW."strategicContextRefs" IS DISTINCT FROM OLD."strategicContextRefs" OR NEW."inheritedContext" IS DISTINCT FROM OLD."inheritedContext" OR NEW."constraintsSnapshot" IS DISTINCT FROM OLD."constraintsSnapshot" OR NEW."knownGaps" IS DISTINCT FROM OLD."knownGaps" OR NEW."sourceRefs" IS DISTINCT FROM OLD."sourceRefs" OR NEW."provenance" IS DISTINCT FROM OLD."provenance" OR NEW."createdByActorId" IS DISTINCT FROM OLD."createdByActorId" THEN RAISE EXCEPTION 'Editing a Brief creates a new Version'; END IF;
  RETURN NEW;
END; $$;
