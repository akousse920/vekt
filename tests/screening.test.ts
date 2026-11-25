import assert from "node:assert/strict";
import test from "node:test";

import { ScreeningOperator } from "../generated/client";
import { evaluateScreeningRules } from "../lib/screening";

const question = { text: "Années d'expérience", type: "SINGLE" as const };
const rule = {
  id: "rule-1",
  questionId: "question-1",
  operator: ScreeningOperator.GTE,
  value: "5",
  mandatory: true,
  question,
};
const answer = (text: string) => [{ questionId: "question-1", option: { text } }];

test("a numeric answer at the exact boundary passes", () => {
  assert.deepEqual(evaluateScreeningRules([rule], answer("5"), "CV valide"), {
    needsReview: false,
    reasons: [],
  });
});

test("a failed mandatory rule is sent to human review with its reason", () => {
  const result = evaluateScreeningRules([rule], answer("4"), "CV valide");
  assert.equal(result.needsReview, true);
  assert.equal(result.reasons[0]?.ruleId, "rule-1");
});

test("missing or ambiguous answers and missing CV require review", () => {
  for (const answers of [[], answer("quatre"), [...answer("4"), ...answer("5")]]) {
    assert.equal(evaluateScreeningRules([rule], answers, "CV valide").needsReview, true);
  }
  assert.equal(evaluateScreeningRules([], [], " ").reasons[0]?.stage, "DOCUMENT");
  assert.deepEqual(evaluateScreeningRules([], [], " ", { requireResumeText: false }), { needsReview: false, reasons: [] });
});

test("optional failed rule records a reason without blocking", () => {
  const result = evaluateScreeningRules([{ ...rule, mandatory: false }], answer("4"), "CV valide");
  assert.equal(result.needsReview, false);
  assert.equal(result.reasons.length, 1);
});

test("IN and NOT_EQUALS evaluate selected options", () => {
  const base = { ...rule, question: { text: "Langue", type: "MULTIPLE" as const } };
  const answers = [
    { questionId: "question-1", option: { text: "Français" } },
    { questionId: "question-1", option: { text: "Anglais" } },
  ];
  assert.equal(evaluateScreeningRules([{ ...base, operator: ScreeningOperator.IN, value: '["Anglais"]' }], answers, "CV").needsReview, false);
  assert.equal(evaluateScreeningRules([{ ...base, operator: ScreeningOperator.NOT_EQUALS, value: "Espagnol" }], answers, "CV").needsReview, false);
});
