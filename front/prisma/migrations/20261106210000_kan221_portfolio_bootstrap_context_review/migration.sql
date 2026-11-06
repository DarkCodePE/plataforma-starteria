-- KAN-221 / E1: additive, versioned Portfolio Bootstrap context review.
CREATE TYPE "PortfolioBootstrapContextReviewStatus" AS ENUM ('draft', 'confirmed');
CREATE TYPE "PortfolioBootstrapContextReviewAction" AS ENUM ('draft_saved', 'confirmed');
CREATE TYPE "PortfolioBootstrapContextOperationType" AS ENUM ('save_draft', 'confirm');

CREATE TABLE "PortfolioBootstrapContextReview" (
  "id" TEXT NOT NULL,
  "bootstrapSessionId" TEXT NOT NULL,
  "status" "PortfolioBootstrapContextReviewStatus" NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 1,
  "draftJson" JSONB NOT NULL,
  "confirmedSnapshotJson" JSONB,
  "sourceCompanyId" TEXT,
  "sourceCompanyContextVersionId" TEXT,
  "sourceCompanyContextVersionNumber" INTEGER,
  "provenanceJson" JSONB NOT NULL,
  "confirmedBy" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PortfolioBootstrapContextReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioBootstrapContextReviewVersion" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "action" "PortfolioBootstrapContextReviewAction" NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioBootstrapContextReviewVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioBootstrapContextOperation" (
  "id" TEXT NOT NULL,
  "bootstrapSessionId" TEXT NOT NULL,
  "operation" "PortfolioBootstrapContextOperationType" NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "responseJson" JSONB NOT NULL,
  "resultingReviewVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioBootstrapContextOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioBootstrapContextReview_bootstrapSessionId_key" ON "PortfolioBootstrapContextReview"("bootstrapSessionId");
CREATE INDEX "PortfolioBootstrapContextReview_bootstrapSessionId_status_idx" ON "PortfolioBootstrapContextReview"("bootstrapSessionId", "status");
CREATE INDEX "PortfolioBootstrapContextReview_sourceCompanyId_idx" ON "PortfolioBootstrapContextReview"("sourceCompanyId");
CREATE INDEX "PortfolioBootstrapContextReview_sourceCompanyContextVersion_idx" ON "PortfolioBootstrapContextReview"("sourceCompanyContextVersionId");
CREATE INDEX "PortfolioBootstrapContextReview_confirmedBy_idx" ON "PortfolioBootstrapContextReview"("confirmedBy");
CREATE UNIQUE INDEX "PortfolioBootstrapContextReviewVersion_reviewId_version_key" ON "PortfolioBootstrapContextReviewVersion"("reviewId", "version");
CREATE INDEX "PortfolioBootstrapContextReviewVersion_actorUserId_idx" ON "PortfolioBootstrapContextReviewVersion"("actorUserId");
CREATE INDEX "PortfolioBootstrapContextReviewVersion_createdAt_idx" ON "PortfolioBootstrapContextReviewVersion"("createdAt");
CREATE UNIQUE INDEX "PortfolioBootstrapContextOperation_bootstrapSessionId_opera_key" ON "PortfolioBootstrapContextOperation"("bootstrapSessionId", "operation", "idempotencyKeyHash");
CREATE INDEX "PortfolioBootstrapContextOperation_bootstrapSessionId_creat_idx" ON "PortfolioBootstrapContextOperation"("bootstrapSessionId", "createdAt");

ALTER TABLE "PortfolioBootstrapContextReview" ADD CONSTRAINT "PortfolioBootstrapContextReview_bootstrapSessionId_fkey" FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioBootstrapContextReview" ADD CONSTRAINT "PortfolioBootstrapContextReview_sourceCompanyId_fkey" FOREIGN KEY ("sourceCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioBootstrapContextReview" ADD CONSTRAINT "PortfolioBootstrapContextReview_sourceCompanyContextVersio_fkey" FOREIGN KEY ("sourceCompanyContextVersionId") REFERENCES "CompanyContextVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortfolioBootstrapContextReview" ADD CONSTRAINT "PortfolioBootstrapContextReview_confirmedBy_fkey" FOREIGN KEY ("confirmedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioBootstrapContextReviewVersion" ADD CONSTRAINT "PortfolioBootstrapContextReviewVersion_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PortfolioBootstrapContextReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioBootstrapContextReviewVersion" ADD CONSTRAINT "PortfolioBootstrapContextReviewVersion_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortfolioBootstrapContextOperation" ADD CONSTRAINT "PortfolioBootstrapContextOperation_bootstrapSessionId_fkey" FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
