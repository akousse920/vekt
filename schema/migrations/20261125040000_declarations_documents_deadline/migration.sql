ALTER TABLE "Job" ADD COLUMN "applicationDeadline" DATETIME;
ALTER TABLE "ApplicationField" ADD COLUMN "maxFiles" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Candidate" ADD COLUMN "criteriaDeclaredAt" DATETIME;
