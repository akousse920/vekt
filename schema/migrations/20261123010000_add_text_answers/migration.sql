CREATE TABLE "CandidateTextAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "CandidateTextAnswer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CandidateTextAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ScreeningQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CandidateTextAnswer_candidateId_questionId_key" ON "CandidateTextAnswer"("candidateId", "questionId");
