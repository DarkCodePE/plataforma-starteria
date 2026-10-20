-- P11: retries of the same authenticated PDF upload must return its original
-- durable InitiativePdf, while reusing a key for different bytes conflicts.
ALTER TABLE "InitiativePdf" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "InitiativePdf" ADD COLUMN "requestFingerprint" TEXT;
CREATE UNIQUE INDEX "InitiativePdf_projectId_idempotencyKey_key"
  ON "InitiativePdf"("projectId", "idempotencyKey");
