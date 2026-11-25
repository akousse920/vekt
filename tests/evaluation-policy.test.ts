import assert from "node:assert/strict";
import test from "node:test";

import { evaluationEmailTypeFor } from "../lib/evaluation-policy";
import { decideStatus } from "../lib/scoring";

for (const [label, score, enabled, status, email] of [
  ["above threshold", 80, false, "SHORTLISTED", "SHORTLISTED"],
  ["below threshold, human review", 40, false, "NEEDS_REVIEW", null],
  ["below threshold, explicit auto-reject", 40, true, "REJECTED", "REJECTED"],
] as const) {
  test(label, () => {
    assert.equal(decideStatus(score, 75, enabled), status);
    assert.equal(evaluationEmailTypeFor(score, 75, enabled), email);
  });
}
