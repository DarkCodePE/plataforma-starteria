-- Feedback IA del deck del Step 4: el PDF leído contra el análisis confirmado de la iniciativa.
CREATE TABLE "DeckFeedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pdfId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeckFeedback_projectId_createdAt_idx" ON "DeckFeedback"("projectId", "createdAt");

ALTER TABLE "DeckFeedback" ADD CONSTRAINT "DeckFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeckFeedback" ADD CONSTRAINT "DeckFeedback_pdfId_fkey" FOREIGN KEY ("pdfId") REFERENCES "InitiativePdf"("id") ON DELETE CASCADE ON UPDATE CASCADE;
