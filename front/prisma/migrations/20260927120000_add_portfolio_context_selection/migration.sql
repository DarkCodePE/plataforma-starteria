-- ADR-032 / SF-7B.2D: empty technical session-scoped selection store.
-- No business-data backfill and no reinterpretation of User.organizationId.
CREATE TABLE "PortfolioContextSelection" (
    "id" TEXT NOT NULL,
    "authSessionId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,

    CONSTRAINT "PortfolioContextSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioContextSelection_authSessionId_key"
    ON "PortfolioContextSelection"("authSessionId");
CREATE INDEX "PortfolioContextSelection_actorUserId_idx"
    ON "PortfolioContextSelection"("actorUserId");
CREATE INDEX "PortfolioContextSelection_organizationId_idx"
    ON "PortfolioContextSelection"("organizationId");
CREATE INDEX "PortfolioContextSelection_authSessionId_invalidatedAt_idx"
    ON "PortfolioContextSelection"("authSessionId", "invalidatedAt");

ALTER TABLE "PortfolioContextSelection"
    ADD CONSTRAINT "PortfolioContextSelection_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioContextSelection"
    ADD CONSTRAINT "PortfolioContextSelection_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
