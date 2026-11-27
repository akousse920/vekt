import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/client";
import type { ApplicationFieldConfig as Field, ApplicationRuleConfig as Rule } from "./application-fields";

export const formSelection = {
  applicationFields: { orderBy: { order: "asc" } },
  applicationRules: { orderBy: { order: "asc" } },
  screeningQuestions: {
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } }, rules: { orderBy: { id: "asc" } } },
  },
} as const satisfies Prisma.JobSelect;

type StoredForm = Prisma.JobGetPayload<{ select: typeof formSelection }>;

function unusedKey(prefix: string, id: string, used: Set<string>) {
  let key = prefix + id;
  while (used.has(key) || !/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
    key = prefix + createHash("sha256").update(key).digest("hex").slice(0, 24);
  }
  used.add(key);
  return key;
}

export function readRecruiterForm(job: StoredForm) {
  const fields: Field[] = job.applicationFields.map(field => ({
    key: field.key, label: field.label, type: field.type, required: field.required,
    options: JSON.parse(field.options), minValue: field.minValue, maxValue: field.maxValue,
    flagOutsideRange: field.flagOutsideRange, ...(field.type === "FILES" ? { maxFiles: field.maxFiles } : {}),
  }));
  const rules: Rule[] = job.applicationRules.map(rule => ({
    key: rule.key, label: rule.label, mode: rule.mode, action: rule.action,
    conditions: JSON.parse(rule.conditions),
  }));
  const fieldKeys = new Set(fields.map(field => field.key));
  const ruleKeys = new Set(rules.map(rule => rule.key));

  // Public applications display profile fields first, followed by screening questions.
  for (const question of job.screeningQuestions) {
    const key = unusedKey("q_", question.id, fieldKeys);
    fields.push({
      key, label: question.text, type: { SINGLE: "SINGLE_SELECT", MULTIPLE: "MULTI_SELECT", TEXT: "LONG_TEXT" }[question.type] as Field["type"],
      required: true, options: question.options.map(option => option.text.trim()),
      minValue: null, maxValue: null, flagOutsideRange: false,
    });
    for (const rule of question.rules) {
      const condition: Rule["conditions"][number] = { fieldKey: key, operator: rule.operator, value: rule.value };
      if (rule.operator === "IN") {
        condition.operator = question.type === "MULTIPLE" ? "CONTAINS_ANY" : "IN";
        condition.value = JSON.parse(rule.value);
      } else if (rule.operator === "GTE" || rule.operator === "LTE") {
        condition.value = Number(rule.value.replace(",", "."));
      } else if (question.type === "MULTIPLE") {
        condition.operator = rule.operator === "NOT_EQUALS" ? "CONTAINS_NONE" : "CONTAINS_ANY";
        condition.value = [rule.value];
      }
      rules.push({
        key: unusedKey("r_", rule.id, ruleKeys), label: question.text, mode: "ALL",
        action: rule.mandatory ? "REVIEW" : "FLAG", conditions: [condition],
      });
    }
  }
  const revision = createHash("sha256").update(JSON.stringify([fields, rules, job.screeningQuestions.map(q => q.id)])).digest("hex");
  return { fields, rules, revision };
}
