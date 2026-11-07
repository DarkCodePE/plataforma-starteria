ALTER TABLE "PortfolioLabNotificationAttempt"
  ADD COLUMN "acceptedRecipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "rejectedRecipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
