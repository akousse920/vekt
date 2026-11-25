import assert from "node:assert/strict";
import test from "node:test";
import { isSensitiveScreeningQuestion } from "../lib/screening-policy";

test("age and other personal characteristics cannot drive automatic screening", () => {
  assert.equal(isSensitiveScreeningQuestion("Avez vous plus de 30ans ?"), true);
  assert.equal(isSensitiveScreeningQuestion("Quel est votre âge ?"), true);
  assert.equal(isSensitiveScreeningQuestion("Quelle est votre religion ?"), true);
  assert.equal(isSensitiveScreeningQuestion("Avez-vous 3 ans d'expérience en Java ?"), false);
  assert.equal(isSensitiveScreeningQuestion("Avez-vous une certification Java ?"), false);
});
