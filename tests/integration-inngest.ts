import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const root = process.cwd();
const scratch = mkdtempSync(path.join(tmpdir(), "vekt-inngest-"));
const dbPath = path.join(scratch, "test.db");
const base = "http://127.0.0.1:3321";
const signingKey = "0123456789abcdef0123456789abcdef";
const eventKey = "vekt-integration-event-key";
let app: ChildProcess | undefined;
let inngest: ChildProcess | undefined;
let appLog = "";
let inngestLog = "";
let uploadedFile: string | undefined;
let disconnectDb: (() => Promise<void>) | undefined;

async function waitFor(url: string, accept: (response: Response) => boolean, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (accept(response)) return;
    } catch { /* Starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Service unavailable: ${url}\nApp: ${appLog}\nInngest: ${inngestLog}`);
}

async function main() {
  const db = new Database(dbPath);
  for (const migration of readdirSync(path.join(root, "schema", "migrations")).sort()) {
    if (migration !== "migration_lock.toml") {
      db.exec(readFileSync(path.join(root, "schema", "migrations", migration, "migration.sql"), "utf8"));
    }
  }
  db.close();

  process.env.DATABASE_URL = `file:${dbPath}`;
  const { prisma } = await import("../lib/prisma");
  disconnectDb = () => prisma.$disconnect();
  const job = await prisma.job.create({ data: {
    slug: "inngest-integration", title: "Backend TypeScript", description: "Node.js et API",
    threshold: 75,
  } });
  const freeTextQuestion = await prisma.screeningQuestion.create({ data: {
    jobId: job.id,
    text: "Décrivez une API que vous avez conçue.",
    type: "TEXT",
  } });
  const otherJob = await prisma.job.create({ data: {
    slug: "inngest-other-job", title: "Other job", description: "Other role",
  } });
  const foreignQuestion = await prisma.screeningQuestion.create({ data: {
    jobId: otherJob.id, text: "Question d'une autre offre", type: "TEXT",
  } });
  const noQuestionsJob = await prisma.job.create({ data: {
    slug: "inngest-no-questions", title: "No questions", description: "No screening questions",
  } });

  app = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "0.0.0.0", "--port", "3321"], {
    cwd: root,
    env: {
      ...process.env,
      AUTH_SECRET: "inngest-test-secret-minimum-thirty-two-characters",
      AUTH_URL: base,
      AUTH_TRUST_HOST: "true",
      AI_PROVIDER: "none",
      INNGEST_BASE_URL: "http://127.0.0.1:8288",
      INNGEST_EVENT_KEY: eventKey,
      INNGEST_SIGNING_KEY: signingKey,
      RESEND_API_KEY: "",
      LOG_LEVEL: "info",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [app.stdout, app.stderr]) {
    stream?.on("data", (chunk: Buffer) => { appLog = (appLog + chunk.toString()).slice(-20_000); });
  }
  await waitFor(`${base}/api/job-listings?limit=1`, (response) => response.ok);
  const applicationPage = await fetch(`${base}/jobs/${noQuestionsJob.slug}`);
  assert.equal(applicationPage.status, 200);
  const applicationHtml = await applicationPage.text();
  assert.ok(applicationHtml.includes("Vos réponses sont vérifiées selon les critères"), "rules-only disclosure missing");
  assert.ok(!applicationHtml.includes("Your application is being evaluated by our AI engine"), "stale AI disclosure shown");
  const questionsResponse = await fetch(`${base}/api/job-listings/${job.id}/questions`);
  const questionsBody = await questionsResponse.json() as { questions: { id: string; type: string }[] };
  assert.ok(questionsBody.questions.some((question) => question.id === freeTextQuestion.id && question.type === "TEXT"));

  inngest = spawn("docker", [
    "run", "--rm", "--name", "vekt-inngest-integration", "-p", "127.0.0.1:8288:8288",
    "inngest/inngest:latest", "inngest", "start", "--sdk-url", "http://host.docker.internal:3321/api/inngest",
    "--event-key", eventKey, "--signing-key", signingKey, "--log-level", "warn",
  ], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [inngest.stdout, inngest.stderr]) {
    stream?.on("data", (chunk: Buffer) => { inngestLog = (inngestLog + chunk.toString()).slice(-20_000); });
  }
  await waitFor("http://127.0.0.1:8288/health", (response) => response.ok, 60_000);

  const form = new FormData();
  form.set("name", "Camille Exemple");
  form.set("email", "camille@example.test");
  form.set("jobId", job.id);
  form.set("consentGiven", "true");
  form.set("answers", JSON.stringify([
    { questionId: freeTextQuestion.id, text: "J'ai conçu une API REST de suivi des commandes." },
    { questionId: foreignQuestion.id, text: "Cette réponse ne doit pas être enregistrée." },
  ]));
  form.set("resume", new File([readFileSync(path.join(root, "tests/fixtures/cvs/pertinent.pdf"))], "pertinent.pdf", { type: "application/pdf" }));
  const response = await fetch(`${base}/api/candidates`, { method: "POST", body: form });
  const submission = await response.json() as { id?: string; error?: string };
  assert.equal(response.status, 201, submission.error ?? JSON.stringify(submission));
  assert.ok(submission.id);
  const created = await prisma.candidate.findUniqueOrThrow({ where: { id: submission.id } });
  const savedAnswer = await prisma.candidateTextAnswer.findUnique({
    where: { candidateId_questionId: { candidateId: created.id, questionId: freeTextQuestion.id } },
  });
  assert.equal(savedAnswer?.text, "J'ai conçu une API REST de suivi des commandes.");
  assert.equal(await prisma.candidateTextAnswer.count({ where: { candidateId: created.id } }), 1);
  uploadedFile = path.join(root, "private/uploads", path.basename(created.resumePath));

  let candidate = created;
  for (let attempt = 0; attempt < 200; attempt++) {
    candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: submission.id } });
    if (candidate.status === "NEEDS_REVIEW") break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.equal(candidate.status, "NEEDS_REVIEW", `Pipeline did not finish. App: ${appLog}\nInngest: ${inngestLog}`);
  assert.match(appLog, /candidate evaluation queued/, "Expected event dispatch rather than direct fallback");
  assert.match(appLog, /analyzeCandidate started/, "Expected Inngest callback to start the function");
  const evaluation = await prisma.evaluation.findUnique({ where: { candidateId: submission.id } });
  assert.equal(evaluation, null);
  const reason = await prisma.decisionReason.findFirst({ where: { candidateId: submission.id, stage: "HUMAN_REVIEW" } });
  assert.ok(reason);
  console.log("Real Inngest event, per-job free-text answer, rules-only review, and no AI score passed.");
  await prisma.$disconnect();
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  app?.kill("SIGTERM");
  inngest?.kill("SIGTERM");
  try { await new Promise((resolve) => setTimeout(resolve, 500)); } catch { /* Cleanup. */ }
  if (uploadedFile) rmSync(uploadedFile, { force: true });
  rmSync(scratch, { recursive: true, force: true });
  spawn("docker", ["rm", "-f", "vekt-inngest-integration"], { stdio: "ignore" });
  await disconnectDb?.();
});
