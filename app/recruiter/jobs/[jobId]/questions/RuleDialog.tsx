"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationFormSchema } from "@/lib/application-fields";
import { actions, allowedOperators, displayValue, EditorDialog, operators, RuleSummary, Select, type Field, type Rule, type Condition } from "./form-controls";

function choices(field: Field) {
  return field.type === "YES_NO" ? ["true", "false"] : field.options;
}

export function newCondition(field: Field, operator = allowedOperators(field)[0]): Condition {
  const base = { fieldKey: field.key, operator };
  if (operator === "PRESENT") return base;
  if (operator === "BETWEEN") return { ...base, value: [NaN, NaN] };
  if (operator === "IN" || operator.startsWith("CONTAINS_")) return { ...base, value: [] };
  if (field.type === "NUMBER" || operator === "GTE" || operator === "LTE") return base;
  return { ...base, value: choices(field)[0] };
}

export function ExpectedValue({ condition, field, change }: { condition: Condition; field: Field; change: (value: Condition["value"]) => void }) {
  const { operator, value } = condition;
  if (operator === "PRESENT") return null;
  if (operator === "BETWEEN") {
    const bounds = [0, 1].map(i => Array.isArray(value) ? Number(value[i]) : NaN);
    return <div className="grid grid-cols-2 gap-3">{bounds.map((bound, i) =>
      <label key={i} className="grid gap-1 text-sm font-medium">{i === 0 ? "Minimum inclus" : "Maximum inclus"}
        <Input required type="number" step="any" value={Number.isFinite(bound) ? bound : ""} onChange={e => {
          bounds[i] = e.target.valueAsNumber;
          change([bounds[0], bounds[1]]);
        }} />
      </label>)}</div>;
  }
  if (operator === "GTE" || operator === "LTE" || field.type === "NUMBER") {
    return <label className="grid gap-1 text-sm font-medium">Valeur attendue<Input required type="number" step="any" value={typeof value === "number" ? value : ""}
      onChange={e => change(e.target.value === "" ? undefined : e.target.valueAsNumber)} /></label>;
  }
  if (operator === "IN" || operator.startsWith("CONTAINS_")) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">Choix attendus</legend>
      {choices(field).map(option => <label key={option} className="flex items-center gap-2">
        <input type="checkbox" checked={selected.includes(option)} onChange={e => change(e.target.checked ? [...selected, option] : selected.filter(s => s !== option))} />
        {displayValue(field, option)}
      </label>)}
    </fieldset>;
  }
  return <label className="grid gap-1 text-sm font-medium">Choix attendu<Select value={String(value ?? "")} onChange={e => change(e.target.value)}>
    {choices(field).map(option => <option key={option} value={option}>{displayValue(field, option)}</option>)}
  </Select></label>;
}

export default function RuleDialog({ initial, existing, fields, close, apply }: {
  initial: Rule; existing: boolean; fields: Field[]; close: () => void; apply: (rule: Rule) => void;
}) {
  const firstLabel = (r: Rule) => fields.find(f => f.key === r.conditions[0]?.fieldKey)?.label ?? "";
  const [rule, setRule] = useState(initial);
  const [labelTouched, setLabelTouched] = useState(initial.label !== "" && initial.label !== firstLabel(initial));
  const [error, setError] = useState("");
  function change(next: Rule) {
    setRule(labelTouched ? next : { ...next, label: firstLabel(next) });
    setError("");
  }
  function update(index: number, condition: Condition) {
    change({ ...rule, conditions: rule.conditions.map((item, i) => i === index ? condition : item) });
  }
  function finish() {
    if (rule.conditions.some(c => !fields.some(f => f.key === c.fieldKey))) return setError("Choisissez la question à vérifier.");
    const label = rule.label.trim() || firstLabel(rule);
    const result = applicationFormSchema.safeParse({ fields, rules: [{ ...rule, label }] });
    if (!result.success) return setError("Indiquez la réponse attendue pour chaque condition (au moins un choix ou une valeur).");
    apply(result.data.rules[0]);
  }
  const several = rule.conditions.length > 1;
  return <EditorDialog title={existing ? "Modifier le critère" : "Ajouter un critère"} close={close} error={error} submit={finish}
    actions={<Button type="submit">Valider le critère</Button>}>
    <p aria-live="polite" className="rounded-xl bg-secondary p-3 text-sm"><RuleSummary rule={rule} fields={fields} /></p>
    {several && <label className="grid gap-1 text-sm font-medium">Le critère est rempli si
      <Select value={rule.mode} onChange={e => change({ ...rule, mode: e.target.value as Rule["mode"] })}>
        <option value="ALL">Toutes les conditions sont remplies</option><option value="ANY">Au moins une condition est remplie</option>
      </Select></label>}
    {rule.conditions.map((condition, index) => {
      const field = fields.find(item => item.key === condition.fieldKey);
      const yesNo = field?.type === "YES_NO" && condition.operator === "EQUALS";
      const body = <>
        <label className="grid gap-1 text-sm font-medium">Question à vérifier<Select required value={field?.key ?? ""} onChange={e => {
          const next = fields.find(item => item.key === e.target.value);
          if (next) update(index, newCondition(next));
        }}>
          {!field && <option value="" disabled>Choisir une question…</option>}
          {fields.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </Select></label>
        {field && yesNo && <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Réponse attendue</legend>
          <div className="flex gap-2">{["true", "false"].map(option =>
            <Button key={option} type="button" variant={condition.value === option ? "default" : "outline"} aria-pressed={condition.value === option}
              onClick={() => update(index, { ...condition, value: option })}>{displayValue(field, option)}</Button>)}
          </div></fieldset>}
        {field && !yesNo && <>
          {allowedOperators(field).length > 1 && <label className="grid gap-1 text-sm font-medium">Type de vérification
            <Select value={condition.operator} onChange={e => update(index, newCondition(field, e.target.value as Condition["operator"]))}>
              {allowedOperators(field).map(op => <option key={op} value={op}>{operators[op]}</option>)}
            </Select></label>}
          <ExpectedValue condition={condition} field={field} change={value => update(index, { ...condition, value })} />
        </>}
      </>;
      if (!several) return <div key={index} className="grid gap-4">{body}</div>;
      return <fieldset key={index} className="grid gap-3 rounded-xl border p-4">
        <legend className="px-1 font-semibold">Condition {index + 1}</legend>
        {body}
        <Button type="button" variant="ghost" size="sm" className="justify-self-start"
          onClick={() => change({ ...rule, conditions: rule.conditions.filter((_, i) => i !== index) })}>Retirer la condition</Button>
      </fieldset>;
    })}
    <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={rule.conditions.length >= 10}
      onClick={() => {
        const field = fields.find(f => !rule.conditions.some(c => c.fieldKey === f.key)) ?? fields[0];
        change({ ...rule, conditions: [...rule.conditions, newCondition(field)] });
      }}>+ Ajouter une autre condition</Button>
    <label className="grid gap-1 text-sm font-medium">Si la réponse ne correspond pas
      <Select value={rule.action} onChange={e => change({ ...rule, action: e.target.value as Rule["action"] })}>
        {Object.entries(actions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <span className="font-normal text-muted-foreground">Aucun dossier n’est refusé automatiquement : la décision reste humaine.</span>
    </label>
    <label className="grid gap-1 text-sm font-medium">Nom affiché dans le dossier
      <Input maxLength={500} value={rule.label} placeholder={firstLabel(rule)} onChange={e => { setLabelTouched(true); setRule({ ...rule, label: e.target.value }); }} />
      <span className="font-normal text-muted-foreground">Reprend la question tant que vous ne le modifiez pas.</span>
    </label>
  </EditorDialog>;
}
