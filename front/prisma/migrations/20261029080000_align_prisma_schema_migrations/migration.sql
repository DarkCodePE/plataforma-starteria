-- Align the durable refresh-family table with Prisma's @updatedAt contract.
-- Existing timestamps are preserved; subsequent writes continue to be set by Prisma.
ALTER TABLE "RefreshTokenFamily"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

-- PostgreSQL truncated the original identifier to 63 bytes. Rename it to the
-- canonical truncated name generated from the current @@unique declaration.
ALTER INDEX "PortfolioEntryCriticalHandoffGeneration_sessionId_sourceContext"
  RENAME TO "PortfolioEntryCriticalHandoffGeneration_sessionId_sourceCon_key";
