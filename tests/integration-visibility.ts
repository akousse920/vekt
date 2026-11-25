import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const root = process.cwd();
if (!existsSync(path.join(root, ".next", "BUILD_ID"))) {
  throw new Error("Run `npm run build` before `npm run test:access`.");
}

const scratch = mkdtempSync(path.join(tmpdir(), "vekt-access-"));
const dbPath = path.join(scratch, "access.db");
const uploadsDir = path.join(root, "private", "uploads");
const createdFiles: string[] = [];
const port = Number(process.env.VEKT_TEST_PORT ?? 3317);
const base = `http://127.0.0.1:${port}`;
let serverOutput = "";
let server: ReturnType<typeof spawn> | undefined;

type CandidateFixture = { id: string; filename: string; status: string; jobId: string };

function cookiesFrom(response: Response): string[] {
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]);
}

async function login(email: string): Promise<string> {
  const csrfResponse = await fetch(`${base}/api/auth/csrf`);
  assert.equal(csrfResponse.status, 200);
  const csrfCookie = cookiesFrom(csrfResponse);
  const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie.join("; "),
    },
    body: new URLSearchParams({ csrfToken, email, password: "Test-Access-2026!" }),
  });
  assert.equal(response.status, 302, `login failed for ${email}`);
  const sessionCookie = cookiesFrom(response).find((cookie) => cookie.includes("session-token="));
  assert.ok(sessionCookie, `session cookie missing for ${email}`);
  return sessionCookie;
}

async function request(url: string, cookie?: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}${url}`, {
    ...init,
    redirect: "manual",
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...init?.headers },
  });
}

async function assertPdf(pathname: string, cookie: string | undefined, expected: number) {
  const response = await request(pathname, cookie);
  assert.equal(response.status, expected, pathname);
  if (expected === 200) assert.equal(response.headers.get("content-type"), "application/pdf");
  await response.arrayBuffer();
}

async function main() {
  const database = new Database(dbPath);
  for (const migration of readdirSync(path.join(root, "schema", "migrations")).sort()) {
    if (migration === "migration_lock.toml") continue;
    database.exec(readFileSync(path.join(root, "schema", "migrations", migration, "migration.sql"), "utf8"));
  }
  database.close();
  process.env.DATABASE_URL = `file:${dbPath}`;
  const { prisma } = await import("../lib/prisma");
  const password = await bcrypt.hash("Test-Access-2026!", 10);
  for (const [id, role] of [["access-admin", "ADMIN"], ["access-owner", "RECRUITER"], ["access-other", "RECRUITER"]]) {
    await prisma.user.create({ data: { id, email: `${id}@example.test`, password, role } });
  }
  await prisma.job.create({ data: { id: "access-job", slug: "access-job", title: "Access test job", description: "Test", createdById: "access-owner" } });
  await prisma.job.create({ data: { id: "access-other-job", slug: "access-other-job", title: "Other test job", description: "Test", createdById: "access-other" } });
  await prisma.job.create({ data: { id: "access-empty-job", slug: "access-empty-job", title: "Empty test job", description: "Test", createdById: "access-owner" } });

  mkdirSync(uploadsDir, { recursive: true });
  const fixtures: CandidateFixture[] = [];
  for (const [status, jobId] of [
    ["SHORTLISTED", "access-job"], ["ACCEPTED", "access-job"],
    ["NEEDS_REVIEW", "access-job"], ["REJECTED", "access-job"],
    ["APPLIED", "access-job"], ["ANALYZING", "access-job"],
    ["SHORTLISTED", "access-other-job"],
  ]) {
    const filename = `${randomUUID()}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    writeFileSync(filePath, "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n");
    createdFiles.push(filePath);
    const candidate = await prisma.candidate.create({
      data: {
        name: `access-${status.toLowerCase()}-${jobId}`,
        email: `${randomUUID()}@example.test`,
        resumePath: `/api/uploads/${filename}`,
        resumeText: "Test CV",
        status: status as "SHORTLISTED" | "ACCEPTED" | "NEEDS_REVIEW" | "REJECTED" | "APPLIED" | "ANALYZING",
        jobId,
      },
    });
    fixtures.push({ id: candidate.id, filename, status, jobId });
  }
  const reviewFixture = fixtures.find((item) => item.status === "NEEDS_REVIEW" && item.jobId === "access-job")!;
  const reviewQuestion = await prisma.screeningQuestion.create({ data: {
    jobId: "access-job", text: "Décrivez votre expérience", type: "TEXT",
  } });
  await prisma.candidateTextAnswer.create({ data: {
    candidateId: reviewFixture.id, questionId: reviewQuestion.id, text: "Réponse libre confidentielle de test",
  } });
  await prisma.$disconnect();

  server = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      AUTH_SECRET: "validation-secret-2026-minimum-thirty-two-characters",
      AUTH_URL: base,
      NEXTAUTH_URL: base,
      AUTH_TRUST_HOST: "true",
      APP_URL: base,
      AI_PROVIDER: "mock",
      RESEND_API_KEY: "",
      INNGEST_EVENT_KEY: "",
      INNGEST_BASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream?.on("data", (chunk: Buffer) => { serverOutput = (serverOutput + chunk.toString()).slice(-4000); });
  }

  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) break;
    try {
      const response = await request("/api/candidates");
      if (response.status === 401) { ready = true; break; }
    } catch { /* Startup is still in progress. */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, `Next.js did not start: ${serverOutput}`);

  const ownerCookie = await login("access-owner@example.test");
  const otherCookie = await login("access-other@example.test");
  const adminCookie = await login("access-admin@example.test");
  const configureText = await request("/api/job-listings/access-empty-job/questions", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [{ text: "Décrivez votre expérience", type: "TEXT", options: [] }] }),
  });
  assert.equal(configureText.status, 200, "owner could not configure a free-text question");
  const publicQuestions = await (await request("/api/job-listings/access-empty-job/questions")).json() as { questions: { id: string; type: string; options: unknown[] }[] };
  assert.equal(publicQuestions.questions.length, 1);
  assert.equal(publicQuestions.questions[0].type, "TEXT");
  assert.deepEqual(publicQuestions.questions[0].options, []);
  const foreignEdit = await request("/api/job-listings/access-empty-job/questions", otherCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [] }),
  });
  assert.equal(foreignEdit.status, 403);
  const automaticTextRule = await request("/api/job-listings/access-empty-job/rules", adminCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [{ questionId: publicQuestions.questions[0].id, operator: "EQUALS", value: "oui", mandatory: true }] }),
  });
  assert.equal(automaticTextRule.status, 400, "free text accepted an automatic rule");
  const choiceQuestions = await request("/api/job-listings/access-empty-job/questions", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [{ text: "Avez-vous déjà utilisé TypeScript ?", type: "SINGLE", options: [{ text: "Oui" }, { text: "Non" }] }] }),
  });
  assert.equal(choiceQuestions.status, 200);
  const combinedSave = await request("/api/job-listings/access-empty-job/questions", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [
      { text: "Avez-vous déjà utilisé TypeScript ?", type: "SINGLE", options: [{ text: "Oui" }, { text: "Non" }], rule: { operator: "EQUALS", value: "Oui", mandatory: true } },
      { text: "Quelles technologies utilisez-vous ?", type: "MULTIPLE", options: [{ text: "React" }, { text: "Vue" }, { text: "Angular" }], rule: { operator: "IN", value: ["React", "Vue"], mandatory: true } },
    ] }),
  });
  assert.equal(combinedSave.status, 200, "question and criterion could not be saved together");
  const combinedRules = await (await request("/api/job-listings/access-empty-job/rules", ownerCookie)).json() as { rules: { value: string; mandatory: boolean }[] };
  assert.equal(combinedRules.rules.length, 2);
  assert.equal(combinedRules.rules[0].value, "Oui");
  assert.equal(combinedRules.rules[0].mandatory, true);
  assert.equal(combinedRules.rules[1].value, '["React","Vue"]');
  const choiceList = await (await request("/api/job-listings/access-empty-job/questions")).json() as { questions: { id: string }[] };
  const ownerRule = await request("/api/job-listings/access-empty-job/rules", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [{ questionId: choiceList.questions[0].id, operator: "EQUALS", value: "Oui", mandatory: true }] }),
  });
  assert.equal(ownerRule.status, 200, "recruiter could not configure a rule for their own offer");
  const foreignRule = await request("/api/job-listings/access-empty-job/rules", otherCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [] }),
  });
  assert.equal(foreignRule.status, 403, "another recruiter changed the offer's rules");
  const ageQuestion = await request("/api/job-listings/access-empty-job/questions", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [{ text: "Avez vous plus de 30ans ?", type: "SINGLE", options: [{ text: "Oui" }, { text: "Non" }] }] }),
  });
  assert.equal(ageQuestion.status, 200);
  const combinedAgeRule = await request("/api/job-listings/access-empty-job/questions", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions: [{ text: "Avez vous plus de 30ans ?", type: "SINGLE", options: [{ text: "Oui" }, { text: "Non" }], rule: { operator: "EQUALS", value: "Oui", mandatory: true } }] }),
  });
  assert.equal(combinedAgeRule.status, 400, "age criterion was accepted during question save");
  const ageList = await (await request("/api/job-listings/access-empty-job/questions")).json() as { questions: { id: string }[] };
  const ageRule = await request("/api/job-listings/access-empty-job/rules", ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [{ questionId: ageList.questions[0].id, operator: "EQUALS", value: "Oui", mandatory: true }] }),
  });
  assert.equal(ageRule.status, 400, "age criterion was accepted");
  const ownedVisible = fixtures.filter((item) => item.jobId === "access-job");
  const otherCandidate = fixtures.find((item) => item.jobId === "access-other-job")!;

  assert.equal((await request("/api/candidates")).status, 401);
  assert.equal((await request("/api/recruiter/queue")).status, 401);
  assert.equal((await request("/recruiter/all")).status, 307);
  const ownerApi = await (await request("/api/candidates", ownerCookie)).json() as { id: string }[];
  assert.deepEqual(new Set(ownerApi.map((item) => item.id)), new Set(ownedVisible.map((item) => item.id)));
  const ownerQueue = await (await request("/api/recruiter/queue", ownerCookie)).json() as { id: string }[];
  assert.deepEqual(ownerQueue.map((item) => item.id), ownedVisible.filter((item) => item.status === "SHORTLISTED").map((item) => item.id));
  const adminApi = await (await request("/api/candidates", adminCookie)).json() as { id: string }[];
  assert.deepEqual(new Set(adminApi.map((item) => item.id)), new Set(fixtures.map((item) => item.id)));
  const otherApi = await (await request("/api/candidates", otherCookie)).json() as { id: string }[];
  assert.deepEqual(otherApi.map((item) => item.id), [otherCandidate.id]);

  for (const page of ["/recruiter/all", "/recruiter/jobs/access-job"]) {
    const ownerPage = await request(page, ownerCookie);
    assert.equal(ownerPage.status, 200, page);
    const ownerHtml = await ownerPage.text();
    for (const item of ownedVisible) assert.ok(ownerHtml.includes(item.id) || ownerHtml.includes(`access-${item.status.toLowerCase()}-${item.jobId}`), `${page} omits ${item.status}`);
    assert.ok(!ownerHtml.includes(otherCandidate.id), `${page} leaks another job`);
    const adminPage = await request(page, adminCookie);
    assert.equal(adminPage.status, 200);
    const adminHtml = await adminPage.text();
    for (const item of ownedVisible) assert.ok(adminHtml.includes(item.id) || adminHtml.includes(`access-${item.status.toLowerCase()}-${item.jobId}`), `${page} hides admin case ${item.status}`);
  }
  assert.equal((await request("/recruiter/jobs/access-job", otherCookie)).status, 404);

  const shortlisted = ownedVisible.find((item) => item.status === "SHORTLISTED")!;
  const hidden = ownedVisible.find((item) => item.status === "NEEDS_REVIEW")!;
  const adminDetail = await request(`/recruiter/jobs/access-job/candidates/${hidden.id}`, adminCookie);
  assert.ok((await adminDetail.text()).includes("Réponse libre confidentielle de test"), "admin cannot read the text answer");
  assert.equal((await request(`/recruiter/jobs/access-job/candidates/${hidden.id}`, ownerCookie)).status, 200);
  await assertPdf(`/api/uploads/${shortlisted.filename}`, ownerCookie, 200);
  await assertPdf(`/api/uploads/${hidden.filename}`, ownerCookie, 200);
  await assertPdf(`/api/uploads/${otherCandidate.filename}`, ownerCookie, 404);
  await assertPdf(`/api/uploads/${hidden.filename}`, adminCookie, 200);
  await assertPdf(`/api/uploads/${shortlisted.filename}`, undefined, 401);

  for (const id of [otherCandidate.id]) {
    const response = await request(`/api/recruiter/review/${id}`, ownerCookie, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "REJECT" }),
    });
    assert.equal(response.status, 404, `review route accepted ${id}`);
  }
  const pending = ownedVisible.find((item) => item.status === "APPLIED")!;
  const prematureDecision = await request(`/api/recruiter/review/${pending.id}`, ownerCookie, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "ACCEPT" }),
  });
  assert.equal(prematureDecision.status, 409, "a pending application was decided before processing completed");
  const ownerDecision = await request(`/api/recruiter/review/${hidden.id}`, ownerCookie, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "SHORTLIST" }),
  });
  assert.equal(ownerDecision.status, 200, "offer owner could not decide a reviewed dossier");
  const transmitted = await (await request("/api/candidates", ownerCookie)).json() as { id: string }[];
  assert.ok(transmitted.some((item) => item.id === hidden.id), "transmitted dossier is missing from recruiter API");
  await assertPdf(`/api/uploads/${hidden.filename}`, ownerCookie, 200);
  const transmittedPage = await request(`/recruiter/jobs/access-job/candidates/${hidden.id}`, ownerCookie);
  assert.ok((await transmittedPage.text()).includes("Réponse libre confidentielle de test"), "transmitted text answer is missing for recruiter");
  console.log("Access integration checks passed: pages, APIs, PDFs, review route, and roles.");
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server?.kill("SIGTERM");
    for (const filePath of createdFiles) rmSync(filePath, { force: true });
    rmSync(scratch, { recursive: true, force: true });
  });
