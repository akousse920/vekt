import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCandidate } from "../lib/ai";

test("evaluateCandidate uses OpenRouter when configured", async () => {
  const originalProvider = process.env.AI_PROVIDER;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalFetch = global.fetch;

  process.env.AI_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-key";

  const calls: Array<{ url: string; body: string }> = [];
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: input.toString(),
      body: init?.body ? String(init.body) : "",
    });

    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ score: 82, reasoning: "Good fit", pros: ["A"], cons: ["B"] }) } }],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await evaluateCandidate({
      jobTitle: "Engineer",
      jobDescription: "Build software",
      customPrompt: null,
      resumeText: "Experienced engineer",
    });

    assert.equal(result.result.score, 82);
    assert.equal(calls[0]?.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.match(calls[0]?.body ?? "", /"model":"openai\/gpt-4o-mini"/);
  } finally {
    global.fetch = originalFetch;
    if (originalProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = originalProvider;
    }

    if (originalApiKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalApiKey;
    }
  }
});

test("configured rubric overrides the model's global score and records evidence", async () => {
  const originalProvider = process.env.AI_PROVIDER;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalFetch = global.fetch;
  process.env.AI_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-key";
  let requestBody = "";
  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBody = String(init?.body ?? "");
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        score: 99,
        reasoning: "Criterion evidence is mixed. Human review is advisable.",
        pros: ["Design"],
        cons: ["TypeScript"],
        criteria: [
          { criterionId: "a", score: 40, evidence: "Limited project evidence" },
          { criterionId: "b", score: 90, evidence: "Strong portfolio" },
        ],
      }) } }] }),
    } as Response;
  }) as typeof fetch;

  try {
    const evaluation = await evaluateCandidate({
      jobTitle: "Engineer",
      jobDescription: "Build software",
      customPrompt: null,
      resumeText: "Jane Doe built software for five years.",
      candidateName: "Jane Doe",
      rubric: [
        { id: "a", label: "TypeScript", weight: 60, required: true, order: 0 },
        { id: "b", label: "Design", weight: 40, required: false, order: 1 },
      ],
    });
    assert.equal(evaluation.result.score, 60);
    assert.equal(evaluation.rubricReviewReasons.length, 1);
    assert.equal(evaluation.rubricBreakdown.length, 2);
    assert.ok(!requestBody.includes("Jane Doe"));
  } finally {
    global.fetch = originalFetch;
    if (originalProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = originalProvider;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
  }
});
