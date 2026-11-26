CREATE TABLE "ApplicationField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT NOT NULL DEFAULT '[]',
    "minValue" REAL,
    "maxValue" REAL,
    "flagOutsideRange" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ApplicationField_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ApplicationAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "ApplicationAnswer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ApplicationField" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CandidateFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidateFlag_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ApplicationField_jobId_key_key" ON "ApplicationField"("jobId", "key");
CREATE INDEX "ApplicationField_jobId_order_idx" ON "ApplicationField"("jobId", "order");
CREATE UNIQUE INDEX "ApplicationAnswer_candidateId_fieldId_key" ON "ApplicationAnswer"("candidateId", "fieldId");
CREATE INDEX "CandidateFlag_candidateId_idx" ON "CandidateFlag"("candidateId");
