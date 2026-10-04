-- El lifecycle de ChallengeInvitation estaba en schema.prisma sin migración: prod se
-- sincroniza con 'prisma db push', pero la base E2E corre 'migrate deploy' y fallaba
-- cualquier challenge.create (columna recipientEmail inexistente). Generado con
-- 'prisma migrate diff --from-migrations --to-schema-datamodel'.

-- CreateEnum
CREATE TYPE "InvitationTargetType" AS ENUM ('challenge_only', 'existing_initiative');

-- CreateEnum
CREATE TYPE "InvitationLifecycleStatus" AS ENUM ('created', 'sent', 'viewed', 'accepted', 'declined', 'revoked', 'expired');

-- AlterTable
ALTER TABLE "ChallengeInvitation" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "claimTokenHash" TEXT,
ADD COLUMN     "claimedByUserId" TEXT,
ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "existingProjectId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "invitationStatus" "InvitationLifecycleStatus" NOT NULL DEFAULT 'created',
ADD COLUMN     "inviterUserId" TEXT,
ADD COLUMN     "ownerCanInvite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientEmailNormalized" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "role" "TeamRole" NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "targetType" "InvitationTargetType" NOT NULL DEFAULT 'challenge_only',
ADD COLUMN     "viewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeInvitation_claimTokenHash_key" ON "ChallengeInvitation"("claimTokenHash");

-- CreateIndex
CREATE INDEX "ChallengeInvitation_challengeId_recipientEmailNormalized_ro_idx" ON "ChallengeInvitation"("challengeId", "recipientEmailNormalized", "role", "invitationStatus");

-- CreateIndex
CREATE INDEX "ChallengeInvitation_existingProjectId_recipientEmailNormali_idx" ON "ChallengeInvitation"("existingProjectId", "recipientEmailNormalized", "role", "invitationStatus");

-- CreateIndex
CREATE INDEX "ChallengeInvitation_inviterUserId_idx" ON "ChallengeInvitation"("inviterUserId");

-- CreateIndex
CREATE INDEX "ChallengeInvitation_claimedByUserId_idx" ON "ChallengeInvitation"("claimedByUserId");

-- CreateIndex
CREATE INDEX "ChallengeInvitation_expiresAt_idx" ON "ChallengeInvitation"("expiresAt");

-- RenameIndex
ALTER INDEX "OrganizationPortfolioAccessGrant_userId_organizationId_capabili" RENAME TO "OrganizationPortfolioAccessGrant_userId_organizationId_capa_key";

-- RenameIndex
ALTER INDEX "PortfolioBootstrapAnalysisRun_bootstrapSessionId_inputVersion_k" RENAME TO "PortfolioBootstrapAnalysisRun_bootstrapSessionId_inputVersi_key";

-- RenameIndex
ALTER INDEX "PortfolioBootstrapWorkIntakeSource_bootstrapSessionId_requestHa" RENAME TO "PortfolioBootstrapWorkIntakeSource_bootstrapSessionId_reque_key";

-- RenameIndex
ALTER INDEX "PortfolioHandoffResponseCommand_assignmentId_type_idempotencyKe" RENAME TO "PortfolioHandoffResponseCommand_assignmentId_type_idempoten_key";

-- RenameIndex
ALTER INDEX "PortfolioHandoffSemanticEvent_entityType_entityId_entityVersion" RENAME TO "PortfolioHandoffSemanticEvent_entityType_entityId_entityVer_idx";

-- RenameIndex
ALTER INDEX "PortfolioReading_bootstrapSessionId_stateHash_idempotencyKey_ke" RENAME TO "PortfolioReading_bootstrapSessionId_stateHash_idempotencyKe_key";

