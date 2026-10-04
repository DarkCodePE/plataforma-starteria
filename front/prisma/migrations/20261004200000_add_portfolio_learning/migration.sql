-- E2E Job-Driven Ola 4 (G8, §23): lo que el portfolio aprende de una decisión organizacional.
-- Tabla nueva; no toca columnas existentes.

-- CreateTable
CREATE TABLE "PortfolioLearning" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "challengeId" TEXT,
    "strategicFrontId" TEXT,
    "outcome" "DecisionOutcome" NOT NULL,
    "rationale" TEXT NOT NULL,
    "learning" TEXT,
    "nextAction" TEXT,
    "coverageBefore" TEXT,
    "coverageAfter" TEXT,
    "suggestedReformulation" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioLearning_decisionId_key" ON "PortfolioLearning"("decisionId");

-- CreateIndex
CREATE INDEX "PortfolioLearning_projectId_idx" ON "PortfolioLearning"("projectId");

-- CreateIndex
CREATE INDEX "PortfolioLearning_challengeId_idx" ON "PortfolioLearning"("challengeId");

-- CreateIndex
CREATE INDEX "PortfolioLearning_strategicFrontId_idx" ON "PortfolioLearning"("strategicFrontId");

-- CreateIndex
CREATE INDEX "PortfolioLearning_decidedAt_idx" ON "PortfolioLearning"("decidedAt");

-- AddForeignKey
ALTER TABLE "PortfolioLearning" ADD CONSTRAINT "PortfolioLearning_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioLearning" ADD CONSTRAINT "PortfolioLearning_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioLearning" ADD CONSTRAINT "PortfolioLearning_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioLearning" ADD CONSTRAINT "PortfolioLearning_strategicFrontId_fkey" FOREIGN KEY ("strategicFrontId") REFERENCES "StrategicFront"("id") ON DELETE SET NULL ON UPDATE CASCADE;

