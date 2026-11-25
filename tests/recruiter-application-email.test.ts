import assert from "node:assert/strict";
import test from "node:test";

import { buildRecruiterApplicationEmail, recruiterNotificationRecipient } from "../lib/recruiter-application-email";
import { jobSchema } from "../lib/schemas";

test("new application alert goes only to the offer owner when enabled", () => {
  const job = { notifyOnApplication: true, createdBy: { email: "recruteur@example.com" } };
  assert.equal(recruiterNotificationRecipient(job), "recruteur@example.com");
  assert.equal(recruiterNotificationRecipient({ ...job, notifyOnApplication: false }), null);
  assert.equal(recruiterNotificationRecipient({ ...job, createdBy: null }), null);
  assert.equal(recruiterNotificationRecipient(null), null);
});

test("alert is in French, links to the owned offer, and escapes the offer title", () => {
  const email = buildRecruiterApplicationEmail('<Poste & "test">', "job-1", "https://vekt.example");
  assert.match(email.subject, /Nouvelle candidature/);
  assert.match(email.html, /&lt;Poste &amp; &quot;test&quot;&gt;/);
  assert.match(email.html, /https:\/\/vekt\.example\/recruiter\/jobs\/job-1/);
  assert.doesNotMatch(email.html, /<Poste/);
});

test("job notification preference accepts a boolean and rejects an invalid value", () => {
  const job = { title: "Développeur", description: "Un poste à pourvoir", notifyOnApplication: false };
  assert.equal(jobSchema.parse(job).notifyOnApplication, false);
  assert.equal(jobSchema.safeParse({ ...job, notifyOnApplication: "false" }).success, false);
});
