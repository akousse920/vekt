import { applicationRuleConditionSchema } from "./application-fields";

type Field = { id: string; key: string; type: string };
type Answer = { fieldId: string; value: string };
type Rule = { id: string; label: string; mode: string; action: string; conditions: string };

function numeric(value: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function matchesCondition(
  condition: { fieldKey: string; operator: string; value?: unknown },
  fields: Map<string, Field>,
  answers: Map<string, string>,
): boolean {
  const field = fields.get(condition.fieldKey);
  if (!field) return false;
  const raw = answers.get(field.id);
  if (raw === undefined || raw.trim() === "") return false;
  if (condition.operator === "PRESENT") {
    if (field.type === "MULTI_SELECT" || field.type === "FILES") {
      try { return Array.isArray(JSON.parse(raw)) && JSON.parse(raw).length > 0; } catch { return false; }
    }
    if (field.type === "DECLARATION") return raw === "true";
    return true;
  }
  if (field.type === "SINGLE_SELECT" || field.type === "YES_NO") {
    if (condition.operator === "EQUALS") return raw === condition.value;
    if (condition.operator === "NOT_EQUALS") return raw !== condition.value;
    if (field.type === "SINGLE_SELECT" && (condition.operator === "GTE" || condition.operator === "LTE")) {
      const actual = numeric(raw.replace(",", "."));
      if (actual === null || typeof condition.value !== "number") return false;
      return condition.operator === "GTE" ? actual >= condition.value : actual <= condition.value;
    }
    if (condition.operator === "IN") return Array.isArray(condition.value) && condition.value.includes(raw);
  }
  if (field.type === "MULTI_SELECT") {
    let selected: unknown;
    try { selected = JSON.parse(raw); } catch { return false; }
    if (!Array.isArray(selected) || !selected.length || !selected.every((item) => typeof item === "string")) return false;
    if (!Array.isArray(condition.value)) return false;
    if (condition.operator === "CONTAINS_ANY") return condition.value.some((item) => selected.includes(item));
    if (condition.operator === "CONTAINS_NONE") return condition.value.every((item) => !selected.includes(item));
    if (condition.operator === "CONTAINS_ALL") return condition.value.every((item) => selected.includes(item));
  }
  if (field.type === "NUMBER") {
    const actual = numeric(raw);
    if (actual === null) return false;
    if (condition.operator === "BETWEEN" && Array.isArray(condition.value)) return actual >= condition.value[0] && actual <= condition.value[1];
    if (typeof condition.value !== "number") return false;
    if (condition.operator === "EQUALS") return actual === condition.value;
    if (condition.operator === "GTE") return actual >= condition.value;
    if (condition.operator === "LTE") return actual <= condition.value;
  }
  return false;
}

export function evaluateApplicationRules(rules: Rule[], fields: Field[], answers: Answer[]) {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const answersByField = new Map(answers.map((answer) => [answer.fieldId, answer.value]));
  const flags: { fieldId: string; detail: string }[] = [];
  const reasons: { stage: "APPLICATION_FORM"; ruleId: string; detail: string }[] = [];

  for (const rule of rules) {
    let conditions: { fieldKey: string; operator: string; value?: unknown }[] | null = null;
    try {
      const parsed = applicationRuleConditionSchema.array().min(1).max(10).safeParse(JSON.parse(rule.conditions));
      if (parsed.success) conditions = parsed.data;
    } catch { /* A malformed stored rule fails closed into review or a flag. */ }
    const passed = conditions !== null && (rule.mode === "ANY"
      ? conditions.some((condition) => matchesCondition(condition, fieldsByKey, answersByField))
      : conditions.every((condition) => matchesCondition(condition, fieldsByKey, answersByField)));
    if (passed) continue;

    const detail = `Critère « ${rule.label} » non satisfait. Vérifiez les réponses du dossier.`;
    flags.push({ fieldId: rule.id, detail });
    if (rule.action === "REVIEW") reasons.push({ stage: "APPLICATION_FORM", ruleId: rule.id, detail });
  }
  return { needsReview: reasons.length > 0, flags, reasons };
}
