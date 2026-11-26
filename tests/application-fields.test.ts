import assert from "node:assert/strict";
import test from "node:test";
import { applicationFormSchema, parseApplicationFields } from "../lib/application-fields";
import { evaluateApplicationRules } from "../lib/application-rules";
import { ageOnDate, assessBirthYear, beninToday } from "../lib/age-range";
import { deadlineFromDateOnly, isApplicationClosed } from "../lib/application-deadline";

const birthYearField = {
  id: "birth-year-field",
  key: "annee_naissance",
  label: "Année de naissance",
  type: "BIRTH_YEAR" as const,
  required: true,
  options: "[]",
  minValue: 25,
  maxValue: 40,
  flagOutsideRange: true,
};

test("a birth year is assessed against the age range, including uncertain birthdays", () => {
  assert.equal(assessBirthYear(2008, 25, 40, 2026), "outside");
  assert.equal(assessBirthYear(2001, 25, 40, 2026), "boundary");
  assert.equal(assessBirthYear(2000, 25, 40, 2026), "within");
  assert.equal(assessBirthYear(1985, 25, 40, 2026), "boundary");
  assert.equal(assessBirthYear(1984, 25, 40, 2026), "outside");
});

test("a complete birth date gives an exact age on the local application day", () => {
  assert.equal(beninToday(new Date("2026-11-25T22:59:59.000Z")), "2026-11-25");
  assert.equal(beninToday(new Date("2026-11-25T23:00:00.000Z")), "2026-11-26");
  assert.equal(ageOnDate("2008-11-26", "2026-11-25"), 17);
  assert.equal(ageOnDate("2008-11-26", "2026-11-26"), 18);
  assert.equal(ageOnDate("1991-11-26", "2026-11-26"), 35);
  assert.equal(ageOnDate("1990-11-26", "2026-11-26"), 36);
  assert.equal(ageOnDate("2000-02-29", "2026-02-28"), 25);
  assert.equal(ageOnDate("2000-02-29", "2026-03-01"), 26);
  assert.equal(ageOnDate("2026-02-30", "2026-11-26"), null);
  assert.equal(ageOnDate("2027-01-01", "2026-11-26"), null);
});

test("a complete birth date outside the configured age range is flagged, not rejected", () => {
  const field = { ...birthYearField, type: "BIRTH_DATE" as const, label: "Date de naissance" };
  const form = new FormData();
  form.set(`field:${field.id}`, "1980-01-01");
  const now = new Date("2026-11-26T10:00:00Z");
  const result = parseApplicationFields(form, [field], now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.answers[0].value, "1980-01-01");
  assert.equal(result.flags.length, 1);
  assert.match(result.flags[0].detail, /hors de la plage indicative 25 à 40 ans/);
  form.set(`field:${field.id}`, "2026-02-30");
  assert.equal(parseApplicationFields(form, [field], now).ok, false);
  assert.equal(applicationFormSchema.safeParse({ fields: [{ ...field, options: [] }], rules: [] }).success, true);
});

test("inclusive age limits accept exact birthdays and flag adjacent days", () => {
  const field = { ...birthYearField, type: "BIRTH_DATE" as const, label: "Date de naissance", minValue: 18, maxValue: 35 };
  const form = new FormData();
  const now = new Date("2026-11-26T10:00:00Z");
  for (const birthDate of ["2008-11-26", "1991-11-26"]) {
    form.set(`field:${field.id}`, birthDate);
    const result = parseApplicationFields(form, [field], now);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.flags.length, 0);
  }
  for (const birthDate of ["2008-11-27", "1990-11-26"]) {
    form.set(`field:${field.id}`, birthDate);
    const result = parseApplicationFields(form, [field], now);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.flags.length, 1);
  }
});

test("a date limit includes the full local day in Benin", () => {
  const deadline = deadlineFromDateOnly("2026-11-25");
  assert.equal(deadline?.toISOString(), "2026-11-25T22:59:59.999Z");
  assert.equal(isApplicationClosed(deadline, new Date("2026-11-25T22:59:59.999Z")), false);
  assert.equal(isApplicationClosed(deadline, new Date("2026-11-25T23:00:00.000Z")), true);
  assert.throws(() => deadlineFromDateOnly("2026-02-31"));
});

test("declarative answers and multiple PDFs are validated", () => {
  const yesNo = { ...birthYearField, id: "claim", key: "claim", type: "YES_NO" as const, minValue: null, maxValue: null, flagOutsideRange: false };
  const declaration = { ...yesNo, id: "declaration", key: "declaration", type: "DECLARATION" as const };
  const documents = { ...yesNo, id: "documents", key: "documents", type: "FILES" as const, maxFiles: 2 };
  const form = new FormData();
  form.set("field:claim", "false");
  form.set("field:declaration", "true");
  form.append("field:documents", new File(["a"], "a.pdf", { type: "application/pdf" }));
  form.append("field:documents", new File(["b"], "b.pdf", { type: "application/pdf" }));
  const parsed = parseApplicationFields(form, [yesNo, declaration, documents]);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.answers[0].value, "false");
  assert.equal(parsed.answers[2].files?.length, 2);
  form.append("field:documents", new File(["c"], "c.pdf", { type: "application/pdf" }));
  assert.equal(parseApplicationFields(form, [yesNo, declaration, documents]).ok, false);
  form.delete("field:documents");
  form.set("field:declaration", "false");
  assert.equal(parseApplicationFields(form, [yesNo, declaration]).ok, false);
});

test("an out-of-range birth year is stored and flagged, never rejected by the field parser", () => {
  const form = new FormData();
  form.set("field:birth-year-field", "2008");
  const result = parseApplicationFields(form, [birthYearField]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.answers, [{ fieldId: "birth-year-field", value: "2008" }]);
  assert.equal(result.flags.length, 1);
  assert.match(result.flags[0].detail, /hors de la plage indicative 25 à 40 ans/);
});

test("the age range is validated as ages when configuring a birth-year field", () => {
  const valid = applicationFormSchema.safeParse({ fields: [{ ...birthYearField, options: [], id: undefined }] });
  assert.equal(valid.success, true);
  const invalid = applicationFormSchema.safeParse({ fields: [{ ...birthYearField, options: [], minValue: 40, maxValue: 25 }] });
  assert.equal(invalid.success, false);
});

test("a rule can combine an expected diploma and a numeric threshold", () => {
  const fields = [
    { key: "diplome", label: "Diplôme", type: "SINGLE_SELECT", options: ["Licence", "Master", "Autre"] },
    { key: "experience", label: "Années d’expérience", type: "NUMBER", options: [] },
  ];
  const rule = {
    key: "qualification", label: "Qualification attendue", mode: "ALL", action: "REVIEW",
    conditions: [
      { fieldKey: "diplome", operator: "IN", value: ["Licence", "Master"] },
      { fieldKey: "experience", operator: "GTE", value: 3 },
    ],
  };
  const config = applicationFormSchema.safeParse({ fields, rules: [rule] });
  assert.equal(config.success, true);
  const dbFields = [
    { id: "d", key: "diplome", type: "SINGLE_SELECT" },
    { id: "e", key: "experience", type: "NUMBER" },
  ];
  const dbRule = { id: "r", label: rule.label, mode: rule.mode, action: rule.action, conditions: JSON.stringify(rule.conditions) };
  const passing = evaluateApplicationRules([dbRule], dbFields, [{ fieldId: "d", value: "Master" }, { fieldId: "e", value: "4" }]);
  assert.equal(passing.needsReview, false);
  const failing = evaluateApplicationRules([dbRule], dbFields, [{ fieldId: "d", value: "Master" }, { fieldId: "e", value: "1" }]);
  assert.equal(failing.needsReview, true);
  assert.equal(failing.flags.length, 1);
  assert.equal(failing.reasons[0].ruleId, "r");
  assert.equal(evaluateApplicationRules([{ ...dbRule, action: "FLAG" }], dbFields, [{ fieldId: "d", value: "Autre" }]).needsReview, false);
  assert.equal(evaluateApplicationRules([{ ...dbRule, mode: "ANY" }], dbFields, [{ fieldId: "d", value: "Master" }]).needsReview, false);
});

test("selection rules reject unknown options and birth-year rules cannot route automatically", () => {
  const base = { key: "diplome", label: "Diplôme", type: "SINGLE_SELECT", options: ["Licence", "Master"] };
  const rule = { key: "expected", label: "Diplôme attendu", mode: "ALL", action: "REVIEW", conditions: [{ fieldKey: "diplome", operator: "EQUALS", value: "Doctorat" }] };
  assert.equal(applicationFormSchema.safeParse({ fields: [base], rules: [rule] }).success, false);
  const ageRule = { ...rule, conditions: [{ fieldKey: "annee_naissance", operator: "GTE", value: 25 }] };
  assert.equal(applicationFormSchema.safeParse({ fields: [{ ...birthYearField, options: [] }], rules: [ageRule] }).success, false);
  assert.equal(applicationFormSchema.safeParse({ fields: [{ ...birthYearField, type: "BIRTH_DATE", options: [] }], rules: [ageRule] }).success, false);
});

test("multiple selections and a document can be required by a combined rule", () => {
  const fields = [
    { id: "skills", key: "competences", type: "MULTI_SELECT" },
    { id: "proof", key: "justificatif", type: "FILE" },
  ];
  const rule = { id: "combined", label: "Compétences et justificatif", mode: "ALL", action: "FLAG", conditions: JSON.stringify([
    { fieldKey: "competences", operator: "CONTAINS_ALL", value: ["Java", "SQL"] },
    { fieldKey: "justificatif", operator: "PRESENT" },
  ]) };
  const passing = evaluateApplicationRules([rule], fields, [
    { fieldId: "skills", value: '["Java","SQL"]' },
    { fieldId: "proof", value: "/api/application-files/document.pdf" },
  ]);
  assert.equal(passing.flags.length, 0);
  const missingProof = evaluateApplicationRules([rule], fields, [{ fieldId: "skills", value: '["Java","SQL"]' }]);
  assert.equal(missingProof.flags.length, 1);
  assert.equal(missingProof.needsReview, false);
});
