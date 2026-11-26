import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

test("direct pipeline follows the shared human-review policy and records provenance", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "vekt-direct-test-"));
  const dbPath = path.join(directory, "test.db");
  const migrationRoot = path.join(process.cwd(), "schema", "migrations");
  try {
    const database = new Database(dbPath);
    for (const migration of readdirSync(migrationRoot).sort()) {
      if (migration === "migration_lock.toml") continue;
      const sqlPath = path.join(migrationRoot, migration, "migration.sql");
      database.exec(readFileSync(sqlPath, "utf8"));
    }
    database.close();

    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.AI_PROVIDER = "openrouter";
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.RESEND_API_KEY;
    global.fetch = (async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        score: 93,
        reasoning: "Strong relevant experience. Skills match the role.",
        pros: ["Relevant experience"],
        cons: [],
      }) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

    const { prisma } = await import("../lib/prisma");
    const { analyzeCandidate, runEvaluationPipelineDirect } = await import("../lib/queue");
    const job = await prisma.job.create({
      data: { slug: "direct-test", title: "Engineer", description: "Build software", threshold: 75 },
    });

    for (const [label, threshold, autoReject, resumeText, expectedStatus, expectedAutoDecision] of [
      ["above", 0, false, "Experienced engineer", "SHORTLISTED", false],
      ["review", 100, false, "Experienced engineer", "NEEDS_REVIEW", false],
      ["reject", 100, true, "Experienced engineer", "REJECTED", true],
      ["missing-cv", 100, true, "", "NEEDS_REVIEW", false],
    ] as const) {
      await prisma.job.update({ where: { id: job.id }, data: { threshold } });
      await prisma.setting.upsert({
        where: { key: "AUTO_REJECT_BELOW_THRESHOLD" },
        update: { value: String(autoReject) },
        create: { key: "AUTO_REJECT_BELOW_THRESHOLD", value: String(autoReject) },
      });
      const candidate = await prisma.candidate.create({
        data: {
          name: "Jane Example",
          email: `${label}@example.test`,
          resumePath: `/api/uploads/${label}.pdf`,
          resumeText,
          jobId: job.id,
        },
      });
      await runEvaluationPipelineDirect(candidate.id);
      const saved = await prisma.candidate.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { evaluation: true, emailLogs: true },
      });
      assert.equal(saved.status, expectedStatus, label);
      assert.equal(saved.evaluation?.autoDecision, expectedAutoDecision, label);
      assert.equal(saved.evaluation?.provider, "openrouter", label);
      assert.ok(saved.evaluation?.promptHash, label);
      assert.ok(!saved.evaluation?.promptSnapshot.includes("Jane Example"), label);
      assert.equal(saved.emailLogs.length, 0, label);
    }

    const durableJob = await prisma.job.create({
      data: { slug: "durable-test", title: "Engineer", description: "Build software", threshold: 75 },
    });
    const durableHandler = (analyzeCandidate as unknown as { fn: (context: unknown) => Promise<void> }).fn;
    for (const [label, threshold, autoReject, expectedStatus, expectedEmail] of [
      ["durable-above", 0, false, "SHORTLISTED", "SHORTLISTED"],
      ["durable-review", 100, false, "NEEDS_REVIEW", null],
      ["durable-reject", 100, true, "REJECTED", "REJECTED"],
    ] as const) {
      await prisma.job.update({ where: { id: durableJob.id }, data: { threshold } });
      await prisma.setting.upsert({ where: { key: "AUTO_REJECT_BELOW_THRESHOLD" }, update: { value: String(autoReject) }, create: { key: "AUTO_REJECT_BELOW_THRESHOLD", value: String(autoReject) } });
      const candidate = await prisma.candidate.create({
        data: { name: "Jane Example", email: `${label}@example.test`, resumePath: `/api/uploads/${label}.pdf`, resumeText: "Experienced engineer", jobId: durableJob.id },
      });
      const events: { data: { emailType: string } }[] = [];
      await durableHandler({
        event: { data: { candidateId: candidate.id } },
        step: {
          run: async (_name: string, operation: () => Promise<unknown>) => operation(),
          sendEvent: async (_name: string, event: { data: { emailType: string } }) => { events.push(event); },
        },
      });
      const saved = await prisma.candidate.findUniqueOrThrow({ where: { id: candidate.id }, include: { evaluation: true } });
      assert.equal(saved.status, expectedStatus, label);
      assert.equal(saved.evaluation?.autoDecision, expectedStatus === "REJECTED", label);
      assert.equal(events[0]?.data.emailType ?? null, expectedEmail, label);
    }
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    const durableFailure = await prisma.candidate.create({
      data: { name: "Jane Example", email: "durable-error@example.test", resumePath: "/api/uploads/durable-error.pdf", resumeText: "Experienced engineer", jobId: durableJob.id },
    });
    const failureEvents: unknown[] = [];
    await durableHandler({
      event: { data: { candidateId: durableFailure.id } },
      step: {
        run: async (_name: string, operation: () => Promise<unknown>) => operation(),
        sendEvent: async (_name: string, event: unknown) => { failureEvents.push(event); },
      },
    });
    const failedDurableResult = await prisma.candidate.findUniqueOrThrow({
      where: { id: durableFailure.id },
      include: { evaluation: true, decisionReasons: true },
    });
    assert.equal(failedDurableResult.status, "NEEDS_REVIEW");
    assert.equal(failedDurableResult.evaluation, null);
    assert.ok(failedDurableResult.decisionReasons.some((reason) => reason.stage === "AI_ERROR"));
    assert.equal(failureEvents.length, 0);
    process.env.AI_PROVIDER = "mock";

    await prisma.job.update({ where: { id: durableJob.id }, data: { threshold: 0 } });
    const mockCandidate = await prisma.candidate.create({
      data: { name: "Jane Example", email: "mock@example.test", resumePath: "/api/uploads/mock.pdf", resumeText: "Experienced engineer", jobId: durableJob.id },
    });
    await runEvaluationPipelineDirect(mockCandidate.id);
    const mockResult = await prisma.candidate.findUniqueOrThrow({ where: { id: mockCandidate.id }, include: { decisionReasons: true } });
    assert.equal(mockResult.status, "NEEDS_REVIEW");
    assert.ok(mockResult.decisionReasons.some((reason) => reason.stage === "MOCK_PROVIDER"));

    const durableMock = await prisma.candidate.create({
      data: { name: "Jane Example", email: "durable-mock@example.test", resumePath: "/api/uploads/durable-mock.pdf", resumeText: "Experienced engineer", jobId: durableJob.id },
    });
    const mockEvents: unknown[] = [];
    await durableHandler({
      event: { data: { candidateId: durableMock.id } },
      step: {
        run: async (_name: string, operation: () => Promise<unknown>) => operation(),
        sendEvent: async (_name: string, event: unknown) => { mockEvents.push(event); },
      },
    });
    assert.equal((await prisma.candidate.findUniqueOrThrow({ where: { id: durableMock.id } })).status, "NEEDS_REVIEW");
    assert.equal(mockEvents.length, 0);

    process.env.AI_PROVIDER = "none";
    global.fetch = (async () => { throw new Error("An AI request must not occur in rules-only mode"); }) as typeof fetch;
    for (const [label, pipeline, resumeText] of [["direct-none", "direct", "Experienced engineer"], ["durable-none", "durable", "" ]] as const) {
      const noAiCandidate = await prisma.candidate.create({
        data: { name: "Jane Example", email: `${label}@example.test`, resumePath: `/api/uploads/${label}.pdf`, resumeText, jobId: durableJob.id },
      });
      if (pipeline === "direct") {
        await runEvaluationPipelineDirect(noAiCandidate.id);
      } else {
        await durableHandler({
          event: { data: { candidateId: noAiCandidate.id } },
          step: {
            run: async (_name: string, operation: () => Promise<unknown>) => operation(),
            sendEvent: async () => { throw new Error("No decision email should be scheduled"); },
          },
        });
      }
      const saved = await prisma.candidate.findUniqueOrThrow({ where: { id: noAiCandidate.id }, include: { evaluation: true, decisionReasons: true } });
      assert.equal(saved.status, "SHORTLISTED", label);
      assert.equal(saved.evaluation, null, label);
      assert.equal(saved.decisionReasons.length, 0, label);
    }

    process.env.AI_PROVIDER = "mock";

    const question = await prisma.screeningQuestion.create({
      data: {
        jobId: job.id,
        text: "Années d'expérience",
        type: "SINGLE",
        options: { create: [{ text: "4", order: 0 }, { text: "5", order: 1 }] },
      },
      include: { options: true },
    });
    const rule = await prisma.screeningRule.create({
      data: { jobId: job.id, questionId: question.id, operator: "GTE", value: "5", mandatory: true },
    });
    await prisma.job.update({ where: { id: job.id }, data: { threshold: 0 } });
    const screened = await prisma.candidate.create({
      data: {
        name: "Jane Example",
        email: "screened@example.test",
        resumePath: "/api/uploads/screened.pdf",
        resumeText: "Experienced engineer",
        jobId: job.id,
        answers: { create: { questionId: question.id, optionId: question.options[0].id } },
      },
    });
    await runEvaluationPipelineDirect(screened.id);
    const screenedResult = await prisma.candidate.findUniqueOrThrow({
      where: { id: screened.id },
      include: { evaluation: true, decisionReasons: true },
    });
    assert.equal(screenedResult.status, "NEEDS_REVIEW");
    assert.equal(screenedResult.evaluation?.autoDecision, false);
    assert.ok(screenedResult.decisionReasons.some((reason) => reason.ruleId === rule.id));

    process.env.AI_PROVIDER = "none";
    const rulesOnlyCandidate = await prisma.candidate.create({
      data: {
        name: "Jane Example",
        email: "rules-only@example.test",
        resumePath: "/api/uploads/rules-only.pdf",
        resumeText: "Experienced engineer",
        jobId: job.id,
        answers: { create: { questionId: question.id, optionId: question.options[0].id } },
      },
    });
    await runEvaluationPipelineDirect(rulesOnlyCandidate.id);
    const rulesOnlyResult = await prisma.candidate.findUniqueOrThrow({
      where: { id: rulesOnlyCandidate.id }, include: { evaluation: true, decisionReasons: true },
    });
    assert.equal(rulesOnlyResult.status, "NEEDS_REVIEW");
    assert.equal(rulesOnlyResult.evaluation, null);
    assert.ok(rulesOnlyResult.decisionReasons.some((reason) => reason.ruleId === rule.id));
    assert.ok(rulesOnlyResult.decisionReasons.some((reason) => reason.stage === "HUMAN_REVIEW"));
    const passingRulesOnlyCandidate = await prisma.candidate.create({
      data: {
        name: "Jane Example",
        email: "rules-only-pass@example.test",
        resumePath: "/api/uploads/rules-only-pass.pdf",
        resumeText: "",
        jobId: job.id,
        answers: { create: { questionId: question.id, optionId: question.options[1].id } },
      },
    });
    await runEvaluationPipelineDirect(passingRulesOnlyCandidate.id);
    const passingRulesOnlyResult = await prisma.candidate.findUniqueOrThrow({
      where: { id: passingRulesOnlyCandidate.id }, include: { evaluation: true, decisionReasons: true },
    });
    assert.equal(passingRulesOnlyResult.status, "SHORTLISTED");
    assert.equal(passingRulesOnlyResult.evaluation, null);
    assert.equal(passingRulesOnlyResult.decisionReasons.length, 0);

    const formJob = await prisma.job.create({
      data: { slug: "application-rule-test", title: "Engineer", description: "Build software" },
    });
    const diplomaField = await prisma.applicationField.create({
      data: { jobId: formJob.id, key: "diplome", label: "Diplôme", type: "SINGLE_SELECT", options: '["Licence","Master","Autre"]' },
    });
    const experienceField = await prisma.applicationField.create({
      data: { jobId: formJob.id, key: "experience", label: "Années d’expérience", type: "NUMBER" },
    });
    const formRule = await prisma.applicationRule.create({
      data: { jobId: formJob.id, key: "qualification", label: "Qualification attendue", mode: "ALL", action: "REVIEW", conditions: JSON.stringify([
        { fieldKey: "diplome", operator: "IN", value: ["Licence", "Master"] },
        { fieldKey: "experience", operator: "GTE", value: 3 },
      ]) },
    });
    const formCandidate = await prisma.candidate.create({
      data: { name: "Jane Example", email: "form-rule@example.test", resumePath: "/api/uploads/form-rule.pdf", jobId: formJob.id,
        applicationAnswers: { create: [{ fieldId: diplomaField.id, value: "Master" }, { fieldId: experienceField.id, value: "1" }] } },
    });
    await runEvaluationPipelineDirect(formCandidate.id);
    const formResult = await prisma.candidate.findUniqueOrThrow({ where: { id: formCandidate.id }, include: { decisionReasons: true } });
    assert.equal(formResult.status, "NEEDS_REVIEW");
    assert.ok(formResult.decisionReasons.some((reason) => reason.ruleId === formRule.id && reason.stage === "APPLICATION_FORM"));

    process.env.AI_PROVIDER = "mock";

    const rubricJob = await prisma.job.create({
      data: {
        slug: "rubric-test",
        title: "Designer",
        description: "Design products",
        threshold: 0,
        rubricCriteria: { create: [
          { label: "Interface", weight: 70, required: false, order: 0 },
          { label: "Recherche", weight: 30, required: false, order: 1 },
        ] },
      },
    });
    const rubricCandidate = await prisma.candidate.create({
      data: { name: "Jane Example", email: "rubric@example.test", resumePath: "/api/uploads/rubric.pdf", resumeText: "Product designer", jobId: rubricJob.id },
    });
    await runEvaluationPipelineDirect(rubricCandidate.id);
    const rubricEvaluation = await prisma.evaluation.findUniqueOrThrow({ where: { candidateId: rubricCandidate.id } });
    const savedRubric: { id: string; weight: number }[] = JSON.parse(rubricEvaluation.rubricSnapshot);
    const savedBreakdown: { criterionId: string; score: number }[] = JSON.parse(rubricEvaluation.rubricBreakdown);
    const weights = new Map(savedRubric.map((item) => [item.id, item.weight]));
    assert.equal(savedRubric.length, 2);
    assert.equal(savedBreakdown.length, 2);
    assert.equal(rubricEvaluation.score, Math.round(savedBreakdown.reduce((sum, item) => sum + item.score * (weights.get(item.criterionId) ?? 0) / 100, 0)));

    const failedCandidate = await prisma.candidate.create({
      data: { name: "Jane Example", email: "ai-error@example.test", resumePath: "/api/uploads/ai-error.pdf", resumeText: "Product designer", jobId: rubricJob.id },
    });
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    await runEvaluationPipelineDirect(failedCandidate.id);
    const failedResult = await prisma.candidate.findUniqueOrThrow({
      where: { id: failedCandidate.id },
      include: { evaluation: true, decisionReasons: true },
    });
    assert.equal(failedResult.status, "NEEDS_REVIEW");
    assert.equal(failedResult.evaluation, null);
    assert.ok(failedResult.decisionReasons.some((reason) => reason.stage === "AI_ERROR"));
    process.env.AI_PROVIDER = "mock";
    await prisma.$disconnect();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
