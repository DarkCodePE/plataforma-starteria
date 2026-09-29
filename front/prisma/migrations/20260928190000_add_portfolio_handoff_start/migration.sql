-- H-TECH-07: bounded Start audit and idempotency command.
ALTER TYPE "PortfolioHandoffState" ADD VALUE 'STARTED';

ALTER TABLE "PortfolioHandoffAssignment"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "startedBy" TEXT;

ALTER TYPE "PortfolioHandoffResponseCommandType" ADD VALUE 'START';
