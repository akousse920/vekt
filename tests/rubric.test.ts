import assert from "node:assert/strict";
import test from "node:test";

import { scoreWeightedRubric } from "../lib/rubric";

const rubric = [
  { id: "a", label: "TypeScript", weight: 60, required: true, order: 0 },
  { id: "b", label: "Design", weight: 40, required: false, order: 1 },
];

test("weighted score uses the saved weights and flags weak required skills", () => {
  const result = scoreWeightedRubric(rubric, [
    { criterionId: "a", score: 40, evidence: "Projet limité" },
    { criterionId: "b", score: 90, evidence: "Portfolio solide" },
  ]);
  assert.equal(result.score, 60);
  assert.equal(result.reviewReasons.length, 1);
  assert.match(result.reviewReasons[0], /TypeScript/);
});

test("exactly 50 on a required skill does not force review", () => {
  const result = scoreWeightedRubric(rubric, [
    { criterionId: "a", score: 50, evidence: "Projet pertinent" },
    { criterionId: "b", score: 100, evidence: "Portfolio solide" },
  ]);
  assert.equal(result.score, 70);
  assert.deepEqual(result.reviewReasons, []);
});

test("missing, duplicate or unjustified criterion scores are rejected", () => {
  assert.throws(() => scoreWeightedRubric(rubric, undefined));
  assert.throws(() => scoreWeightedRubric(rubric, [
    { criterionId: "a", score: 60, evidence: "CV" },
    { criterionId: "a", score: 70, evidence: "CV" },
  ]));
  assert.throws(() => scoreWeightedRubric(rubric, [
    { criterionId: "a", score: 60, evidence: "" },
    { criterionId: "b", score: 70, evidence: "CV" },
  ]));
});
