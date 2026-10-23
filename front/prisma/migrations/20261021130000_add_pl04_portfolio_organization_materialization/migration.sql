CREATE TYPE "PortfolioOrganizationProposalStatus" AS ENUM ('reviewed', 'superseded', 'materialized');

CREATE TABLE "PortfolioOrganizationProposal" (
    "id" TEXT NOT NULL,
    "bootstrapSessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PortfolioOrganizationProposalStatus" NOT NULL DEFAULT 'reviewed',
    "sourceVersion" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioOrganizationProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioOrganizationMaterialization" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "bootstrapSessionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "proposalVersion" INTEGER NOT NULL,
    "approvalFingerprint" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "canonicalMappings" JSONB NOT NULL,
    "confirmedBy" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioOrganizationMaterialization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioOrganizationProposal_bootstrapSessionId_version_key"
ON "PortfolioOrganizationProposal"("bootstrapSessionId", "version");
CREATE INDEX "PortfolioOrganizationProposal_organizationId_idx"
ON "PortfolioOrganizationProposal"("organizationId");
CREATE INDEX "PortfolioOrganizationProposal_bootstrapSessionId_status_idx"
ON "PortfolioOrganizationProposal"("bootstrapSessionId", "status");

CREATE UNIQUE INDEX "PortfolioOrganizationMaterialization_proposalId_key"
ON "PortfolioOrganizationMaterialization"("proposalId");
CREATE UNIQUE INDEX "PortfolioOrganizationMaterialization_bootstrapSessionId_key"
ON "PortfolioOrganizationMaterialization"("bootstrapSessionId");
CREATE UNIQUE INDEX "PortfolioOrganizationMaterialization_organizationId_idempotencyKey_key"
ON "PortfolioOrganizationMaterialization"("organizationId", "idempotencyKey");
CREATE INDEX "PortfolioOrganizationMaterialization_organizationId_idx"
ON "PortfolioOrganizationMaterialization"("organizationId");
CREATE INDEX "PortfolioOrganizationMaterialization_bootstrapSessionId_proposalVersion_idx"
ON "PortfolioOrganizationMaterialization"("bootstrapSessionId", "proposalVersion");

ALTER TABLE "PortfolioOrganizationProposal"
ADD CONSTRAINT "PortfolioOrganizationProposal_bootstrapSessionId_fkey"
FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioOrganizationMaterialization"
ADD CONSTRAINT "PortfolioOrganizationMaterialization_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "PortfolioOrganizationProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortfolioOrganizationMaterialization"
ADD CONSTRAINT "PortfolioOrganizationMaterialization_bootstrapSessionId_fkey"
FOREIGN KEY ("bootstrapSessionId") REFERENCES "PortfolioBootstrapSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
