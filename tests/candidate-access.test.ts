import assert from "node:assert/strict";
import test from "node:test";

import { recruiterVisibleCandidateWhere } from "../lib/candidate-access";

test("recruiter reads are constrained by owner and include every status", () => {
  const where = recruiterVisibleCandidateWhere("recruiter-1", false, { jobId: "job-1" });
  assert.deepEqual(where, {
    AND: [
      { jobId: "job-1" },
      { job: { is: { createdById: "recruiter-1" } } },
    ],
  });
});

test("admin can reach review queues and absent recruiter id is denied", () => {
  assert.deepEqual(recruiterVisibleCandidateWhere(undefined, true, { status: "NEEDS_REVIEW" }), {
    status: "NEEDS_REVIEW",
  });
  assert.deepEqual(recruiterVisibleCandidateWhere(undefined, false), { id: "__no_access__" });
});
