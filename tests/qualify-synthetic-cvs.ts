import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), "vekt-qualification-"));
const dbPath = path.join(scratch, "qualification.db");
const base = `http://127.0.0.1:${process.env.VEKT_QUALIFY_PORT ?? "3320"}`;
const model = process.env.VEKT_QUALIFY_MODEL ?? "qwen2.5:3b";
const fixturesDir = path.join(root, "tests", "fixtures", "cvs");
const labels = JSON.parse(readFileSync(path.join(fixturesDir, "labels.json"), "utf8")) as {
  humanLabels: Record<string, string>;
};
const uploadedFiles: string[] = [];
let server: ReturnType<typeof spawn> | undefined;
let serverOutput = "";

async function waitForServer() {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server?.exitCode !== null) break;
    try {
      const response = await fetch(`${base}/api/job-listings?limit=1`);
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Next.js did not start: ${serverOutput}`);
}

async function main() {
  const db = new Database(dbPath);
  for (const migration of readdirSync(path.join(root, "schema", "migrations")).sort()) {
    if (migration === "migration_lock.toml") continue;
    db.exec(readFileSync(path.join(root, "schema", "migrations", migration, "migration.sql"), "utf8"));
  }
  db.close();
  process.env.DATABASE_URL = `file:${dbPath}`;
  const { prisma } = await import("../lib/prisma");
  const job = await prisma.job.create({
    data: {
      slug: "qualification-backend",
      title: "Développeur backend TypeScript",
      description: "Nous cherchons une personne ayant au moins trois ans d'expérience en développement backend Node.js et TypeScript, capable de concevoir des API, de travailler avec PostgreSQL et de déployer avec Docker.",
      threshold: 75,
      rubricCriteria: { create: [
        { label: "TypeScript et Node.js backend", weight: 40, required: true, order: 0 },
        { label: "Conception d'API de production", weight: 25, required: true, order: 1 },
        { label: "PostgreSQL", weight: 20, required: false, order: 2 },
        { label: "Docker et déploiement", weight: 15, required: false, order: 3 },
      ] },
      screeningQuestions: { create: {
        text: "Combien d'années d'expérience professionnelle avez-vous ?",
        type: "SINGLE",
        options: { create: [{ text: "2" }, { text: "6" }, { text: "7" }] },
      } },
    },
  });
  const question = await prisma.screeningQuestion.findFirstOrThrow({
    where: { jobId: job.id }, include: { options: true },
  });
  await prisma.screeningRule.create({
    data: { jobId: job.id, questionId: question.id, operator: "GTE", value: "3", mandatory: true },
  });

  server = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", new URL(base).port], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      AUTH_SECRET: "qualification-secret-2026-minimum-thirty-two-characters",
      AUTH_URL: base,
      AUTH_TRUST_HOST: "true",
      APP_URL: base,
      AI_PROVIDER: "ollama",
      OLLAMA_MODEL: model,
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      INNGEST_EVENT_KEY: "",
      INNGEST_BASE_URL: "",
      RESEND_API_KEY: "",
      LOG_LEVEL: "warn",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream?.on("data", (chunk: Buffer) => { serverOutput = (serverOutput + chunk.toString()).slice(-6000); });
  }
  await waitForServer();

  const answers: Record<string, string> = { "pertinent.pdf": "6", "moyen.pdf": "2", "hors_sujet.pdf": "7" };
  const results = [];
  for (const filename of ["pertinent.pdf", "moyen.pdf", "hors_sujet.pdf"]) {
    const form = new FormData();
    form.set("name", filename.replace(".pdf", "") + " Exemple");
    form.set("email", `${filename.replace(".pdf", "")}@example.test`);
    form.set("jobId", job.id);
    form.set("consentGiven", "true");
    form.set("resume", new File([readFileSync(path.join(fixturesDir, filename))], filename, { type: "application/pdf" }));
    form.set("answers", JSON.stringify([{ questionId: question.id, optionIds: [question.options.find((option) => option.text === answers[filename])!.id] }]));
    const response = await fetch(`${base}/api/candidates`, { method: "POST", body: form });
    const submission = await response.json() as { id?: string; error?: string };
    assert.equal(response.status, 201, `${filename}: ${submission.error ?? response.status}`);
    assert.ok(submission.id);

    const uploadedCandidate = await prisma.candidate.findUniqueOrThrow({ where: { id: submission.id } });
    uploadedFiles.push(path.join(root, "private", "uploads", path.basename(uploadedCandidate.resumePath)));

    let candidate;
    for (let attempt = 0; attempt < 600; attempt++) {
      candidate = await prisma.candidate.findUnique({
        where: { id: submission.id },
        include: { evaluation: true, decisionReasons: true },
      });
      if (candidate && !["APPLIED", "ANALYZING"].includes(candidate.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert.ok(candidate, `${filename}: candidate missing`);
    assert.ok(!["APPLIED", "ANALYZING"].includes(candidate.status), `${filename}: evaluation timed out; ${serverOutput}`);
    assert.ok(candidate.resumeText.length > 100, `${filename}: PDF extraction failed`);
    results.push({
      file: filename,
      humanLabel: labels.humanLabels[filename],
      status: candidate.status,
      score: candidate.evaluation?.score ?? null,
      model: candidate.evaluation?.model ?? null,
      rubricBreakdown: candidate.evaluation ? JSON.parse(candidate.evaluation.rubricBreakdown) : [],
      reasons: candidate.decisionReasons.map((reason) => ({ stage: reason.stage, detail: reason.detail })),
      extractedCharacters: candidate.resumeText.length,
    });
    console.log(`${filename}: ${candidate.status}, score ${candidate.evaluation?.score ?? "n/a"}`);
  }

  const falseNegatives = results.filter((item) => item.humanLabel === "PERTINENT" && !["SHORTLISTED", "ACCEPTED"].includes(item.status));
  const falsePositives = results.filter((item) => item.humanLabel === "HORS_SUJET" && ["SHORTLISTED", "ACCEPTED"].includes(item.status));
  const report = {
    generatedAt: new Date().toISOString(),
    provider: "ollama",
    model,
    fixtureCount: results.length,
    falseNegativeCount: falseNegatives.length,
    falsePositiveCount: falsePositives.length,
    caveat: "Trois profils fictifs ne suffisent pas à estimer les performances réelles du filtre.",
    results,
  };
  const modelSlug = model.replace(/[^a-zA-Z0-9.-]+/g, "-");
  writeFileSync(path.join(root, "docs", `qualification-synthetique-${modelSlug}.json`), JSON.stringify(report, null, 2) + "\n");
  console.log(`False negatives: ${falseNegatives.length}; false positives: ${falsePositives.length}`);
  await prisma.$disconnect();
}

void main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => {
    server?.kill("SIGTERM");
    for (const filePath of uploadedFiles) rmSync(filePath, { force: true });
    rmSync(scratch, { recursive: true, force: true });
  });
