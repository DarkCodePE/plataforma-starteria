-- P6 Route A: one pre-Project formulation may be associated with one started handoff.
-- The Project remains the canonical Initiative and is created only by confirmation.
ALTER TABLE "InitialReview" ADD COLUMN "handoffAssignmentId" TEXT;
CREATE UNIQUE INDEX "InitialReview_handoffAssignmentId_key" ON "InitialReview"("handoffAssignmentId");
CREATE INDEX "InitialReview_handoffAssignmentId_idx" ON "InitialReview"("handoffAssignmentId");
