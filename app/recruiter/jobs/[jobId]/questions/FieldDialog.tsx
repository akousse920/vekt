"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { applicationFieldSchema, applicationFormSchema } from "@/lib/application-fields";
import { ExpectedValue, newCondition } from "./RuleDialog";
import { actions, allowedOperators, EditorDialog, hasExpectation, isBirth, newKey, operators, RuleSummary, Select, types, type Condition, type Field, type Rule } from "./form-controls";

function changeType(field: Field, type: Field["type"]): Field {
  const choice = type === "SINGLE_SELECT" || type === "MULTI_SELECT";
  const keepRange = (isBirth(type) && isBirth(field.type)) || type === field.type;
  const { maxFiles, ...base } = field;
  const label = isBirth(type) && (!field.label || field.label === types[field.type]) ? types[type] : field.label;
  return {
    ...base, type, label, options: choice ? field.options : [],
    minValue: keepRange ? field.minValue : null, maxValue: keepRange ? field.maxValue : null,
    flagOutsideRange: keepRange && field.flagOutsideRange,
    ...(type === "FILES" ? { maxFiles: maxFiles ?? 5 } : {}),
  };
}

function rangeRule(field: Field): Condition | null {
  if (field.type !== "NUMBER" || !field.flagOutsideRange) return null;
  const { minValue: min, maxValue: max } = field;
  if (min !== null && max !== null) return { fieldKey: field.key, operator: "BETWEEN", value: [min, max] };
  if (min !== null) return { fieldKey: field.key, operator: "GTE", value: min };
  if (max !== null) return { fieldKey: field.key, operator: "LTE", value: max };
  return null;
}

const NONE = "NONE";

function expectationOptions(field: Field, current: Condition | null) {
  if (field.type === "YES_NO") {
    const options: [string, string][] = [["YES", "Oui"], ["NO", "Non"]];
    if (current && current.operator !== "EQUALS") options.push([current.operator, operators[current.operator]]);
    return options;
  }
  const file = field.type === "FILE" || field.type === "FILES";
  return allowedOperators(field).map(op => [op, op === "PRESENT" && file ? "Document fourni" : operators[op]] as [string, string]);
}

function expectationKey(condition: Condition | null) {
  if (!condition) return NONE;
  if (condition.operator === "EQUALS" && (condition.value === "true" || condition.value === "false")) return condition.value === "true" ? "YES" : "NO";
  return condition.operator;
}

export default function FieldDialog({ initial, rule, expect, existing, close, apply }: {
  initial: Field; rule?: Rule; expect?: boolean; existing: boolean; close: () => void; apply: (field: Field, rule: Rule | null) => string | void;
}) {
  const migrated = !rule ? rangeRule(initial) : null;
  const [field, setField] = useState(initial);
  const [optionsText, setOptionsText] = useState(initial.options.join("\n"));
  const [condition, setCondition] = useState<Condition | null>(rule?.conditions[0] ?? migrated ?? (expect ? newCondition(initial) : null));
  const [action, setAction] = useState<Rule["action"]>(rule?.action ?? "FLAG");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(migrated ? "L’ancienne plage souhaitée est reprise ici comme réponse attendue."
    : rule && rangeRule(initial) ? "L’ancienne plage souhaitée sera retirée : cette réponse attendue la remplace." : "");
  const choice = field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT";
  const age = isBirth(field.type);
  const options = choice ? optionsText.split("\n").map(line => line.trim()).filter(Boolean) : [];
  const live = { ...field, options };
  const expectable = hasExpectation(live, !!rule);
  function edit(patch: Partial<Field>) { setField({ ...field, ...patch }); setError(""); }
  function pick(key: string) {
    setError("");
    if (key === NONE) return setCondition(null);
    if (key === "YES" || key === "NO") return setCondition({ fieldKey: field.key, operator: "EQUALS", value: key === "YES" ? "true" : "false" });
    setCondition(newCondition(live, key as Condition["operator"]));
  }
  function finish() {
    if (!field.label.trim()) return setError("Indiquez la question à poser.");
    if (choice && (options.length < 2 || options.length > 20 || new Set(options.map(s => s.toLowerCase())).size !== options.length || options.some(s => s.length > 100))) {
      return setError("Prévoyez de 2 à 20 choix distincts de 100 caractères maximum chacun.");
    }
    const range = age ? field : { ...field, flagOutsideRange: false, minValue: null, maxValue: null };
    if (range.flagOutsideRange && range.minValue === null && range.maxValue === null) return setError("Indiquez au moins une borne.");
    if (range.minValue !== null && range.maxValue !== null && range.minValue > range.maxValue) return setError("Le minimum doit être inférieur ou égal au maximum.");
    const parsed = applicationFieldSchema.safeParse({ ...range, options });
    if (!parsed.success) return setError("Vérifiez le type, les limites et les choix de cette question.");
    let next: Rule | null = null;
    if (condition && expectable) {
      const value = Array.isArray(condition.value) && choice ? condition.value.filter(v => options.includes(String(v))) : condition.value;
      next = {
        key: rule?.key ?? newKey("r"), label: rule?.label || parsed.data.label, mode: "ALL", action,
        conditions: [{ ...condition, fieldKey: parsed.data.key, value } as Condition],
      };
      const check = applicationFormSchema.safeParse({ fields: [parsed.data], rules: [next] });
      if (!check.success) return setError("Indiquez la réponse attendue : une valeur, ou au moins un choix coché.");
    }
    const message = apply(parsed.data, next);
    if (message) setError(message);
  }

  return <EditorDialog title={existing ? "Modifier la question" : "Ajouter une question"} close={close}
    submit={finish} error={error} actions={<Button type="submit">Appliquer</Button>}>
    <label className="grid gap-2">Type de réponse
      <Select value={field.type} onChange={e => {
        setField(changeType(field, e.target.value as Field["type"]));
        if (condition) { setCondition(null); setNotice("La réponse attendue a été retirée car le type a changé."); }
        setError("");
      }}>
        {Object.entries(types).filter(([type]) => type !== "BIRTH_YEAR" || initial.type === type).map(([value, label]) =>
          <option key={value} value={value}>{label}</option>)}
      </Select>
    </label>
    <label className="grid gap-2">Question posée au candidat
      <Input required value={field.label} maxLength={500} onChange={e => edit({ label: e.target.value })} />
    </label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={field.required} onChange={e => edit({ required: e.target.checked })} />Réponse obligatoire</label>
    {choice && <label className="grid gap-2">Choix proposés (un par ligne)
      <textarea className="rounded-xl border p-3" rows={4} value={optionsText} onChange={e => setOptionsText(e.target.value)} />
    </label>}
    {field.type === "FILES" && <label className="grid gap-2">Nombre maximum de PDF
      <Input type="number" required min={2} max={10} value={field.maxFiles ?? ""} onChange={e => edit({ maxFiles: e.target.value === "" ? undefined : Number(e.target.value) })} />
    </label>}
    {age && <div className="space-y-3 rounded-xl border p-4">
      <label className="flex items-center gap-2"><input type="checkbox" checked={field.flagOutsideRange}
        onChange={e => edit({ flagOutsideRange: e.target.checked, ...(!e.target.checked ? { minValue: null, maxValue: null } : {}) })} />
        Signaler un âge hors de la tranche souhaitée
      </label>
      {field.flagOutsideRange && <>
        <div className="grid grid-cols-2 gap-3">{(["minValue", "maxValue"] as const).map((key, i) =>
          <label key={key} className="grid gap-1">{["Âge minimum", "Âge maximum"][i]}
            <Input type="number" min={0} max={120} step={1} value={field[key] ?? ""}
              onChange={e => edit({ [key]: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>)}</div>
        <p className="text-sm text-muted-foreground">L’âge au dépôt sert à signaler un écart au recruteur.</p>
      </>}
    </div>}
    {expectable && <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center gap-2"><p className="font-semibold">Réponse attendue</p><Badge variant="outline">Facultatif</Badge></div>
      <label className="grid gap-1 text-sm font-medium">La réponse qui convient au poste
        <Select value={expectationKey(condition)} onChange={e => pick(e.target.value)}>
          <option value={NONE}>Aucune</option>
          {expectationOptions(live, condition).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </label>
      {condition && expectationKey(condition) !== "YES" && expectationKey(condition) !== "NO" &&
        <ExpectedValue condition={condition} field={live} change={value => { setCondition({ ...condition, value }); setError(""); }} />}
      {condition && <>
        <label className="grid gap-1 text-sm font-medium">Si la réponse ne correspond pas
          <Select value={action} onChange={e => setAction(e.target.value as Rule["action"])}>
            {Object.entries(actions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </label>
        <p aria-live="polite" className="rounded-xl bg-secondary p-3 text-sm">
          <RuleSummary rule={{ key: "", label: "", mode: "ALL", action, conditions: [{ ...condition, fieldKey: field.key }] }} fields={[live]} />
        </p>
        <p className="text-sm text-muted-foreground">Aucun dossier n’est refusé automatiquement : la décision reste humaine.</p>
      </>}
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
    </div>}
  </EditorDialog>;
}
