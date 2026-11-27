import assert from "node:assert/strict";
import test from "node:test";
import { readRecruiterForm, formSelection } from "../lib/recruiter-form";
import { applicationFormSchema } from "../lib/application-fields";
import { evaluateApplicationRules } from "../lib/application-rules";
import type { Prisma } from "../generated/client";

type Stored = Prisma.JobGetPayload<{ select: typeof formSelection }>;

test("mixed forms keep candidate order, required answers and legacy rule semantics", () => {
  const job: Stored = {
    applicationRules: [],
    applicationFields: [{
      id: "doc", jobId: "job", order: 0, label: "Attestation", key: "q_one", type: "FILES",
      required: true, options: "[]", minValue: null, maxValue: null, flagOutsideRange: false, maxFiles: 6,
    }],
    screeningQuestions: [
      { id: "one", type: "MULTIPLE" as const, operator: "NOT_EQUALS" as const, options: ["A", "B"], value: "B" },
      { id: "two", type: "SINGLE" as const, operator: "GTE" as const, options: ["1", "2,5"], value: "2,5" },
    ].map(({ id, type, options, operator, value }, order) => ({
      jobId: "job", id, order, type, text: id,
      options: options.map((text, index) => ({ id: id + index, questionId: id, order: index, text })),
      rules: [{ id, jobId: "job", questionId: id, createdAt: new Date(0), operator, value, mandatory: true }],
    })),
  };
  const { fields, rules, revision } = readRecruiterForm(job);
  assert.ok(applicationFormSchema.safeParse({ fields, rules }).success);
  assert.deepEqual(fields.map(f => f.label), ["Attestation", "one", "two"]);
  assert.equal(new Set(fields.map(f => f.key)).size, 3);
  assert.ok(fields.every(f => f.required));
  const ctx = fields.map(f => ({ ...f, id: f.key }));
  const storedRules = rules.map(rule => ({ ...rule, id: rule.key, conditions: JSON.stringify(rule.conditions) }));
  const evaluate = (choices: string[], number: string) => evaluateApplicationRules(storedRules, ctx, [
    { fieldId: fields[1].key, value: JSON.stringify(choices) }, { fieldId: fields[2].key, value: number },
  ]);
  assert.equal(evaluate(["A"], "2,5").needsReview, false);
  assert.equal(evaluate(["A", "B"], "2,5").needsReview, true);
  assert.equal(evaluate(["A"], "1").needsReview, true);
  assert.equal(evaluate([], "2,5").needsReview, true);
  assert.equal(readRecruiterForm(job).revision, revision);
  job.applicationFields[0].required = false;
  assert.notEqual(readRecruiterForm(job).revision, revision);
});
