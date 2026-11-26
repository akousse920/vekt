import { z } from "zod";
import { assessBirthYear } from "./age-range";
import { isSensitiveScreeningQuestion } from "./screening-policy";

const keySchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const applicationFieldSchema = z.object({
  key: keySchema,
  label: z.string().trim().min(1).max(120),
  type: z.enum(["SHORT_TEXT", "LONG_TEXT", "NUMBER", "BIRTH_YEAR", "SINGLE_SELECT", "MULTI_SELECT", "FILE", "FILES", "YES_NO", "DECLARATION"]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  minValue: z.number().finite().nullable().default(null),
  maxValue: z.number().finite().nullable().default(null),
  flagOutsideRange: z.boolean().default(false),
  maxFiles: z.number().int().min(1).max(10).optional(),
}).superRefine((field, ctx) => {
  const isSelect = field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT";
  if (isSelect && field.options.length < 2) ctx.addIssue({ code: "custom", message: "At least two options are required", path: ["options"] });
  if (!isSelect && field.options.length) ctx.addIssue({ code: "custom", message: "Options are only valid for selection fields", path: ["options"] });
  if (new Set(field.options.map((option) => option.toLowerCase())).size !== field.options.length) ctx.addIssue({ code: "custom", message: "Options must be unique", path: ["options"] });
  if (field.type !== "NUMBER" && field.type !== "BIRTH_YEAR" && (field.minValue !== null || field.maxValue !== null || field.flagOutsideRange)) ctx.addIssue({ code: "custom", message: "Ranges are only valid for numeric fields or birth year", path: ["type"] });
  if (field.minValue !== null && field.maxValue !== null && field.minValue > field.maxValue) ctx.addIssue({ code: "custom", message: "Minimum exceeds maximum", path: ["minValue"] });
  if (field.flagOutsideRange && field.minValue === null && field.maxValue === null) ctx.addIssue({ code: "custom", message: "A flagged range needs a minimum or maximum", path: ["flagOutsideRange"] });
  if (field.key === "age" && field.type !== "NUMBER") ctx.addIssue({ code: "custom", message: "Age must be numeric", path: ["type"] });
  if (field.type === "BIRTH_YEAR" && [field.minValue, field.maxValue].some((value) => value !== null && (!Number.isInteger(value) || value < 0 || value > 120))) ctx.addIssue({ code: "custom", message: "Age limits must be whole years between 0 and 120", path: ["minValue"] });
  if (field.type !== "FILES" && field.maxFiles !== undefined) ctx.addIssue({ code: "custom", message: "A file limit only applies to multiple documents", path: ["maxFiles"] });
  if (field.type === "FILES" && field.maxFiles === 1) ctx.addIssue({ code: "custom", message: "Allow at least two documents", path: ["maxFiles"] });
});

export const applicationRuleConditionSchema = z.object({
  fieldKey: keySchema,
  operator: z.enum(["PRESENT", "EQUALS", "NOT_EQUALS", "IN", "CONTAINS_ANY", "CONTAINS_ALL", "GTE", "LTE", "BETWEEN"]),
  value: z.union([
    z.string().trim().min(1).max(100),
    z.number().finite(),
    z.array(z.string().trim().min(1).max(100)).min(1).max(20),
    z.tuple([z.number().finite(), z.number().finite()]),
  ]).optional(),
});

export const applicationRuleSchema = z.object({
  key: keySchema,
  label: z.string().trim().min(1).max(160),
  mode: z.enum(["ALL", "ANY"]),
  action: z.enum(["FLAG", "REVIEW"]),
  conditions: z.array(applicationRuleConditionSchema).min(1).max(10),
});

export const applicationFormSchema = z.object({
  fields: z.array(applicationFieldSchema).max(25),
  rules: z.array(applicationRuleSchema).max(20).default([]),
}).superRefine((form, ctx) => {
  const keys = form.fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", message: "Field keys must be unique", path: ["fields"] });
  const ruleKeys = form.rules.map((rule) => rule.key);
  if (new Set(ruleKeys).size !== ruleKeys.length) ctx.addIssue({ code: "custom", message: "Rule keys must be unique", path: ["rules"] });
  const fields = new Map(form.fields.map((field) => [field.key, field]));
  for (const [ruleIndex, rule] of form.rules.entries()) {
    for (const [conditionIndex, condition] of rule.conditions.entries()) {
      const field = fields.get(condition.fieldKey);
      const issue = (message: string) => ctx.addIssue({ code: "custom", message, path: ["rules", ruleIndex, "conditions", conditionIndex] });
      if (!field) { issue("Unknown field key"); continue; }
      if (field.type === "BIRTH_YEAR" || field.key === "age" || isSensitiveScreeningQuestion(field.label)) {
        issue("Personal characteristics may only produce informational range flags");
        continue;
      }
      const { operator, value } = condition;
      if (operator === "PRESENT") {
        if (value !== undefined) issue("PRESENT does not take a value");
      } else if (field.type === "SINGLE_SELECT" || field.type === "YES_NO") {
        const choices = field.type === "YES_NO" ? ["true", "false"] : field.options;
        if (operator === "EQUALS" || operator === "NOT_EQUALS") {
          if (typeof value !== "string" || !choices.includes(value)) issue("Choose a configured option");
        } else if (operator === "IN") {
          if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string" && choices.includes(item))) issue("Choose configured options");
        } else issue("Operator is not valid for a single choice");
      } else if (field.type === "MULTI_SELECT") {
        if (operator !== "CONTAINS_ANY" && operator !== "CONTAINS_ALL") issue("Operator is not valid for multiple choices");
        else if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === "string" && field.options.includes(item))) issue("Choose configured options");
      } else if (field.type === "NUMBER") {
        if (operator === "BETWEEN") {
          if (!Array.isArray(value) || value.length !== 2 || !value.every((item) => typeof item === "number") || value[0] > value[1]) issue("BETWEEN needs an ascending numeric interval");
        } else if (!["EQUALS", "GTE", "LTE"].includes(operator) || typeof value !== "number") issue("Operator needs a numeric value");
      } else {
        issue("Only PRESENT is available for this field type");
      }
    }
  }
});

export type ApplicationFieldConfig = z.infer<typeof applicationFieldSchema>;
export type ApplicationRuleConfig = z.infer<typeof applicationRuleSchema>;

export const APPLICATION_TEMPLATES: Record<string, ApplicationFieldConfig[]> = {
  simple: [],
  profil: [
    { key: "telephone", label: "Téléphone", type: "SHORT_TEXT", required: false, options: [], minValue: null, maxValue: null, flagOutsideRange: false },
    { key: "diplome", label: "Diplôme le plus élevé", type: "SINGLE_SELECT", required: false, options: ["Sans diplôme", "Baccalauréat", "Bac +2", "Licence", "Master", "Doctorat", "Autre"], minValue: null, maxValue: null, flagOutsideRange: false },
    { key: "experience", label: "Années d’expérience", type: "NUMBER", required: false, options: [], minValue: null, maxValue: null, flagOutsideRange: false },
    { key: "diplome_justificatif", label: "Justificatifs de diplôme (PDF)", type: "FILES", required: false, options: [], minValue: null, maxValue: null, flagOutsideRange: false, maxFiles: 5 },
  ],
};

export type PublicApplicationField = {
  id: string;
  key: string;
  label: string;
  type: ApplicationFieldConfig["type"];
  required: boolean;
  options: string;
  minValue: number | null;
  maxValue: number | null;
  flagOutsideRange: boolean;
  maxFiles?: number;
};

export type ParsedFieldAnswer = { fieldId: string; value: string; file?: File; files?: File[] };
export type ParsedFieldFlag = { fieldId: string; detail: string };

export function parseApplicationFields(formData: FormData, fields: PublicApplicationField[]):
  | { ok: true; answers: ParsedFieldAnswer[]; flags: ParsedFieldFlag[] }
  | { ok: false; error: string } {
  const answers: ParsedFieldAnswer[] = [];
  const flags: ParsedFieldFlag[] = [];

  for (const field of fields) {
    const raw = formData.get(`field:${field.id}`);
    if (field.type === "FILES") {
      const submitted = formData.getAll(`field:${field.id}`);
      if (submitted.some((item) => !(item instanceof File))) return { ok: false, error: `Pièces jointes invalides pour « ${field.label} ».` };
      const files = submitted.filter((item): item is File => item instanceof File && item.size > 0);
      if (files.length === 0) {
        if (field.required) return { ok: false, error: `Le champ « ${field.label} » est obligatoire.` };
        continue;
      }
      if (files.length > (field.maxFiles ?? 5) || files.some((file) => file.type !== "application/pdf" || file.size > 5 * 1024 * 1024)) {
        return { ok: false, error: `« ${field.label} » : ${field.maxFiles ?? 5} PDF maximum, 5 Mo chacun.` };
      }
      answers.push({ fieldId: field.id, value: "", files });
      continue;
    }
    const empty = raw === null || raw === "" || (raw instanceof File && raw.size === 0);
    if (empty) {
      if (field.required) return { ok: false, error: `Le champ « ${field.label} » est obligatoire.` };
      continue;
    }

    if (field.type === "FILE") {
      if (!(raw instanceof File) || raw.type !== "application/pdf" || raw.size > 5 * 1024 * 1024) {
        return { ok: false, error: `Le champ « ${field.label} » exige un PDF de 5 Mo maximum.` };
      }
      answers.push({ fieldId: field.id, value: "", file: raw });
      continue;
    }
    if (typeof raw !== "string") return { ok: false, error: `Valeur invalide pour « ${field.label} ».` };
    const value = raw.trim();
    if (field.type === "YES_NO" && value !== "true" && value !== "false") return { ok: false, error: `Réponse invalide pour « ${field.label} ».` };
    if (field.type === "DECLARATION" && value !== "true") return { ok: false, error: `La déclaration « ${field.label} » doit être cochée.` };

    if (field.type === "MULTI_SELECT") {
      let chosen: unknown;
      try { chosen = JSON.parse(value); } catch { return { ok: false, error: `Choix invalides pour « ${field.label} ».` }; }
      const options: string[] = JSON.parse(field.options);
      if (!Array.isArray(chosen) || chosen.length > options.length || !chosen.every((item) => typeof item === "string" && options.includes(item)) || new Set(chosen).size !== chosen.length || (field.required && chosen.length === 0)) {
        return { ok: false, error: `Choix invalides pour « ${field.label} ».` };
      }
      answers.push({ fieldId: field.id, value: JSON.stringify(chosen) });
      continue;
    }
    if (field.type === "SINGLE_SELECT") {
      const options: string[] = JSON.parse(field.options);
      if (!options.includes(value)) return { ok: false, error: `Choix invalide pour « ${field.label} ».` };
    } else if (field.type === "NUMBER" || field.type === "BIRTH_YEAR") {
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) return { ok: false, error: `Nombre invalide pour « ${field.label} ».` };
      const number = Number(value);
      if (!Number.isFinite(number)) return { ok: false, error: `Nombre invalide pour « ${field.label} ».` };
      if (field.type === "BIRTH_YEAR") {
        const currentYear = new Date().getUTCFullYear();
        if (!Number.isInteger(number) || number < currentYear - 120 || number > currentYear) return { ok: false, error: "Indiquez une année de naissance valide." };
        if (field.flagOutsideRange) {
          const result = assessBirthYear(number, field.minValue, field.maxValue, currentYear);
          if (result !== "within") {
            const possibleAges = `${currentYear - number - 1} ou ${currentYear - number} ans`;
            const range = `${field.minValue ?? "sans minimum"} à ${field.maxValue ?? "sans maximum"} ans`;
            const detail = result === "outside"
              ? `${field.label} déclarée : ${number} (âge possible : ${possibleAges}), hors de la plage indicative ${range}. À examiner par le recruteur.`
              : `${field.label} déclarée : ${number} (âge possible : ${possibleAges}), à la limite de la plage indicative ${range}. Âge exact à vérifier par le recruteur.`;
            flags.push({ fieldId: field.id, detail });
          }
        }
      } else if (field.key === "age" && (!Number.isInteger(number) || number < 0 || number > 120)) {
        return { ok: false, error: "Indiquez un âge valide en années." };
      } else if (field.flagOutsideRange && ((field.minValue !== null && number < field.minValue) || (field.maxValue !== null && number > field.maxValue))) {
        const range = `${field.minValue ?? "−∞"} à ${field.maxValue ?? "+∞"}`;
        flags.push({ fieldId: field.id, detail: `${field.label} déclaré : ${number} (plage indicative : ${range}). À examiner par le recruteur.` });
      }
    } else if (value.length > (field.type === "LONG_TEXT" ? 2000 : 200)) {
      return { ok: false, error: `La réponse « ${field.label} » est trop longue.` };
    }
    answers.push({ fieldId: field.id, value });
  }
  return { ok: true, answers, flags };
}
