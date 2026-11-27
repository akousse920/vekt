import type { ReactNode, SelectHTMLAttributes } from "react";
import type { ApplicationFieldConfig, ApplicationRuleConfig } from "@/lib/application-fields";
import { isSensitiveScreeningQuestion } from "@/lib/screening-policy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";

export type Field = ApplicationFieldConfig;
export type Rule = ApplicationRuleConfig;
export type Condition = Rule["conditions"][number];
export const types: Record<Field["type"], string> = {
  SHORT_TEXT: "Texte court", LONG_TEXT: "Texte long", NUMBER: "Nombre",
  SINGLE_SELECT: "Liste déroulante", MULTI_SELECT: "Choix multiples", YES_NO: "Oui / Non",
  BIRTH_DATE: "Date de naissance", BIRTH_YEAR: "Année de naissance", DECLARATION: "Déclaration à cocher",
  FILE: "Document PDF", FILES: "Plusieurs documents PDF",
};
export const operators: Record<Condition["operator"], string> = {
  PRESENT: "Réponse fournie", EQUALS: "Égal à", NOT_EQUALS: "Différent de", GTE: "Au moins", LTE: "Au plus",
  BETWEEN: "Compris entre", IN: "Un des choix suivants", CONTAINS_ANY: "Au moins un des choix",
  CONTAINS_ALL: "Tous les choix", CONTAINS_NONE: "Aucun des choix",
};

export function isBirth(type: Field["type"]) {
  return type === "BIRTH_YEAR" || type === "BIRTH_DATE";
}

export function canUseInRule(field: Field) {
  return !isBirth(field.type) && field.key !== "age" && !isSensitiveScreeningQuestion(field.label);
}

export function hasExpectation(field: Field, existing = false) {
  if (!canUseInRule(field)) return false;
  return existing || !["SHORT_TEXT", "LONG_TEXT", "DECLARATION"].includes(field.type);
}

export const isCombined = (rule: Rule) => rule.conditions.length > 1;

export function simpleRules(rules: Rule[], field: Field) {
  return rules.filter(rule => !isCombined(rule) && rule.conditions[0]?.fieldKey === field.key);
}

export function allowedOperators(field: Field): Condition["operator"][] {
  switch (field.type) {
    case "NUMBER": return ["GTE", "LTE", "BETWEEN", "EQUALS", "PRESENT"];
    case "YES_NO": return ["EQUALS", "NOT_EQUALS", "IN", "PRESENT"];
    case "SINGLE_SELECT":
      return field.options.length && field.options.every(value => /^-?\d+(?:[.,]\d+)?$/.test(value))
        ? ["EQUALS", "NOT_EQUALS", "IN", "GTE", "LTE", "PRESENT"] : ["EQUALS", "NOT_EQUALS", "IN", "PRESENT"];
    case "MULTI_SELECT": return ["CONTAINS_ANY", "CONTAINS_ALL", "CONTAINS_NONE", "PRESENT"];
    default: return ["PRESENT"];
  }
}

export function newKey(prefix: string) {
  return prefix + "_" + crypto.randomUUID().replaceAll("-", "");
}

export function displayValue(field: Field, value: string | number) {
  if (field.type === "YES_NO") return value === "true" ? "Oui" : "Non";
  return String(value);
}

export const actions: Record<Rule["action"], string> = {
  FLAG: "Signaler le point dans le dossier", REVIEW: "Envoyer le dossier en revue humaine",
};

function describeCondition(condition: Condition, fields: Field[]) {
  const field = fields.find(f => f.key === condition.fieldKey);
  if (!field) return "question à choisir";
  const values = (Array.isArray(condition.value) ? condition.value : condition.value === undefined ? [] : [condition.value])
    .map(v => typeof v === "number" && !Number.isFinite(v) ? "…" : displayValue(field, v));
  const list = values.join(", ") || "…";
  const answer = `la réponse à « ${field.label} »`;
  switch (condition.operator) {
    case "PRESENT": return `${answer} est renseignée`;
    case "EQUALS": return `${answer} est ${list}`;
    case "NOT_EQUALS": return `${answer} n’est pas ${list}`;
    case "GTE": return `${answer} est d’au moins ${list}`;
    case "LTE": return `${answer} est d’au plus ${list}`;
    case "BETWEEN": return `${answer} est comprise entre ${values[0] ?? "…"} et ${values[1] ?? "…"}`;
    case "IN": return `${answer} est l’un de ces choix : ${list}`;
    case "CONTAINS_ANY": return `${answer} inclut au moins un de ces choix : ${list}`;
    case "CONTAINS_ALL": return `${answer} inclut tous ces choix : ${list}`;
    case "CONTAINS_NONE": return `${answer} n’inclut aucun de ces choix : ${list}`;
  }
}

export function describeRule(rule: Rule, fields: Field[]) {
  return rule.conditions.map(c => describeCondition(c, fields)).join(rule.mode === "ALL" ? " et " : " ou ");
}

export function RuleSummary({ rule, fields }: { rule: Rule; fields: Field[] }) {
  return <span className="break-words">
    <strong className="font-semibold">Attendu :</strong> {describeRule(rule, fields)}. <strong className="font-semibold">Sinon :</strong> {actions[rule.action].toLowerCase()}.
  </span>;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="min-h-11 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-base">{children}</select>;
}

export function EditorDialog({ title, close, children, actions, submit, error }: {
  title: string; close: () => void; children: ReactNode; actions: ReactNode; submit: () => void; error?: string;
}) {
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent aria-describedby={undefined} className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogTitle className="pr-7 text-xl">{title}</DialogTitle>
      <form className="grid gap-5" onSubmit={event => { event.preventDefault(); submit(); }}>
        {children}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="flex-wrap">
          <Button type="button" variant="outline" onClick={close}>Annuler</Button>{actions}
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
