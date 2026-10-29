-- KAN-190: durable refresh-family revocation shared by refresh and logout.
-- The family row is the serialization point; a completed logout leaves a
-- tombstone that every later refresh must observe before rotating a token.
CREATE TABLE "RefreshTokenFamily" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RefreshTokenFamily_pkey" PRIMARY KEY ("id")
);

INSERT INTO "RefreshTokenFamily" ("id", "userId", "createdAt", "updatedAt")
SELECT "family", MIN("userId"), MIN("createdAt"), CURRENT_TIMESTAMP
FROM "RefreshToken"
GROUP BY "family";

CREATE INDEX "RefreshTokenFamily_userId_idx" ON "RefreshTokenFamily"("userId");
CREATE INDEX "RefreshTokenFamily_revokedAt_idx" ON "RefreshTokenFamily"("revokedAt");

ALTER TABLE "RefreshTokenFamily"
  ADD CONSTRAINT "RefreshTokenFamily_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_family_fkey"
  FOREIGN KEY ("family") REFERENCES "RefreshTokenFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;
