-- E2E Job-Driven Ola 2 (G3, G4): restricciones del Frente (Core §13) y Challenge
-- Constraint Envelope (Core §14.1). Columnas nullable: aditivo y seguro para db push.
ALTER TABLE "StrategicFront" ADD COLUMN "constraints" TEXT;

ALTER TABLE "Challenge" ADD COLUMN "knownFacts" TEXT,
ADD COLUMN "openQuestions" TEXT,
ADD COLUMN "constraints" TEXT,
ADD COLUMN "dependencies" TEXT,
ADD COLUMN "expectedDecision" TEXT;
