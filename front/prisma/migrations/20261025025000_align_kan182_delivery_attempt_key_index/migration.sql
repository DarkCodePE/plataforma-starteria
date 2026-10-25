-- PostgreSQL truncates identifiers to 63 bytes. The initial explicit name in
-- 20261025015000 was truncated differently from Prisma's canonical name.
-- This metadata-only rename keeps persistent histories forward-compatible.
ALTER INDEX "PortfolioHandoffDeliveryAttemptKey_assignmentId_idempotencyKey_"
  RENAME TO "PortfolioHandoffDeliveryAttemptKey_assignmentId_idempotency_key";
