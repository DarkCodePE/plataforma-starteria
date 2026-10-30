\set ON_ERROR_STOP on

-- Disposable-only fixture: proves that the production preflight exposes a
-- historical Project whose tenant differs from its Challenge StrategicFront.
BEGIN;

INSERT INTO "Organization" ("id", "name", "slug", "updatedAt") VALUES
  ('kan182-fixture-canonical-org', 'KAN182 canonical', 'kan182-fixture-canonical-org', CURRENT_TIMESTAMP),
  ('kan182-fixture-wrong-org', 'KAN182 wrong', 'kan182-fixture-wrong-org', CURRENT_TIMESTAMP);

INSERT INTO "User" ("id", "email", "name", "initials", "skills", "role", "roles", "organizationId", "updatedAt")
VALUES ('kan182-fixture-owner', 'kan182-fixture-owner@starteria.test', 'KAN182 Owner', 'KO', ARRAY[]::TEXT[], 'participante', ARRAY['participante']::"Role"[], 'kan182-fixture-wrong-org', CURRENT_TIMESTAMP);

INSERT INTO "StrategicFront" ("id", "name", "organizationId", "updatedAt")
VALUES ('kan182-fixture-front', 'KAN182 Front', 'kan182-fixture-canonical-org', CURRENT_TIMESTAMP);

INSERT INTO "Challenge" ("id", "strategicFrontId", "title", "updatedAt")
VALUES ('kan182-fixture-challenge', 'kan182-fixture-front', 'KAN182 Challenge', CURRENT_TIMESTAMP);

INSERT INTO "Project" ("id", "name", "ownerId", "organizationId", "lastModified")
VALUES ('kan182-fixture-project', 'KAN182 historical mismatch', 'kan182-fixture-owner', 'kan182-fixture-wrong-org', CURRENT_TIMESTAMP);

INSERT INTO "InitiativePortfolioMeta" ("id", "projectId", "challengeId", "updatedAt")
VALUES ('kan182-fixture-meta', 'kan182-fixture-project', 'kan182-fixture-challenge', CURRENT_TIMESTAMP);

\ir ../kan182-adr009-production-readonly.sql
