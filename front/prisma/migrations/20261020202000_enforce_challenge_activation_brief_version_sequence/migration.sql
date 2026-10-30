-- ADR-008 / P12-R1: version numbers form an append-only sequence per Brief.
-- The row lock serializes concurrent writers for the same Brief; the existing
-- unique index remains the final race guard.
CREATE OR REPLACE FUNCTION assert_challenge_activation_brief_version_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest_version integer;
BEGIN
  PERFORM 1
    FROM "ChallengeActivationBrief"
   WHERE id = NEW."briefId"
   FOR UPDATE;

  SELECT COALESCE(MAX("versionNumber"), 0)
    INTO latest_version
    FROM "ChallengeActivationBriefVersion"
   WHERE "briefId" = NEW."briefId";

  IF NEW."versionNumber" <> latest_version + 1 THEN
    RAISE EXCEPTION 'Brief Version number must append monotonically per Brief';
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER challenge_activation_brief_version_sequence
  BEFORE INSERT ON "ChallengeActivationBriefVersion"
  FOR EACH ROW EXECUTE FUNCTION assert_challenge_activation_brief_version_sequence();
