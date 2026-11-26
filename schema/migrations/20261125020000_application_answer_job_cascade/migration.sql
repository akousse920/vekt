PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ApplicationAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "ApplicationAnswer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ApplicationField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ApplicationAnswer" ("id", "candidateId", "fieldId", "value")
SELECT "id", "candidateId", "fieldId", "value" FROM "ApplicationAnswer";
DROP TABLE "ApplicationAnswer";
ALTER TABLE "new_ApplicationAnswer" RENAME TO "ApplicationAnswer";
CREATE UNIQUE INDEX "ApplicationAnswer_candidateId_fieldId_key" ON "ApplicationAnswer"("candidateId", "fieldId");

PRAGMA foreign_keys=ON;
