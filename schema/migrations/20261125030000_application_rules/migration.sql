CREATE TABLE "ApplicationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ALL',
    "action" TEXT NOT NULL DEFAULT 'FLAG',
    "conditions" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ApplicationRule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ApplicationRule_jobId_key_key" ON "ApplicationRule"("jobId", "key");
CREATE INDEX "ApplicationRule_jobId_order_idx" ON "ApplicationRule"("jobId", "order");
