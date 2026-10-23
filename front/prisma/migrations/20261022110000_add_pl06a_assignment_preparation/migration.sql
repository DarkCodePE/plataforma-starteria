-- PL-06A keeps PortfolioHandoffAssignment as the only aggregate and adds only
-- editable preparation context plus a durable update command kind.
ALTER TYPE "PortfolioActivationCommandType" ADD VALUE IF NOT EXISTS 'UPDATE_ASSIGNMENT';

ALTER TABLE "PortfolioHandoffAssignment"
  ADD COLUMN IF NOT EXISTS "contextNote" TEXT;
