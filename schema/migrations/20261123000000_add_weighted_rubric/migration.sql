CREATE TABLE "RubricCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RubricCriterion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RubricCriterion_jobId_idx" ON "RubricCriterion"("jobId");

ALTER TABLE "Evaluation" ADD COLUMN "rubricSnapshot" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Evaluation" ADD COLUMN "rubricBreakdown" TEXT NOT NULL DEFAULT '[]';
