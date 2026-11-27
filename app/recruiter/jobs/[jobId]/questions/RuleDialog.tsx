"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationFormSchema } from "@/lib/application-fields";
import { allowedOperators, displayValue, EditorDialog, operators, Select, type Field, type Rule, type Condition } from "./form-controls";

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

function ExpectedValue({ condition, field, change }: { condition: Condition; field: Field; change: (value: Condition["value"]) => void }) {
  const { operator, value } = condition;
  if (operator === "PRESENT") return null;
  if (operator === "BETWEEN") {
    const bounds = [0, 1].map(i => Array.isArray(value) ? Number(value[i]) : NaN);
    return <div className="grid grid-cols-2 gap-3">{bounds.map((bound, i) =>
      <label key={i} className="grid gap-1">{i === 0 ? "Minimum inclus" : "Maximum inclus"}
        <Input required type="number" step="any" value={Number.isFinite(bound) ? bound : ""} onChange={e => {
          bounds[i] = e.target.valueAsNumber;
          change([bounds[0], bounds[1]]);
        }} />
      </label>)}</div>;
  }
  if (operator === "GTE" || operator === "LTE" || field.type === "NUMBER") {
    return <label className="grid gap-1">Valeur attendue<Input required type="number" step="any" value={typeof value === "number" ? value : ""}
      onChange={e => change(e.target.value === "" ? undefined : e.target.valueAsNumber)} /></label>;
  }
  if (operator === "IN" || operator.startsWith("CONTAINS_")) {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <fieldset className="grid gap-2"><legend className="mb-2">Choix attendus</legend>
      {choices(field).map(option => <label key={option} className="flex items-center gap-2">
        <input type="checkbox" checked={selected.includes(option)} onChange={e => change(e.target.checked ? [...selected, option] : selected.filter(s => s !== option))} />
        {displayValue(field, option)}
      </label>)}
    </fieldset>;
  }
  return <label className="grid gap-1">Réponse attendue<Select value={String(value ?? "")} onChange={e => change(e.target.value)}>
    {choices(field).map(option => <option key={option} value={option}>{displayValue(field, option)}</option>)}
  </Select></label>;
}

export default function RuleDialog({ initial, fields, close, apply }: { initial: Rule; fields: Field[]; close: () => void; apply: (rule: Rule) => void }) {
  const [rule, setRule] = useState(initial);
  const [error, setError] = useState("");
  function update(index: number, condition: Condition) {
    setRule({ ...rule, conditions: rule.conditions.map((item, i) => i === index ? condition : item) });
    setError("");
  }
  function finish() {
    const result = applicationFormSchema.safeParse({ fields, rules: [rule] });
    if (!result.success) return setError("Vérifiez le nom du critère et les valeurs attendues pour chaque condition.");
    apply(result.data.rules[0]);
  }
  return <EditorDialog title="Critère de présélection" close={close} error={error} submit={finish} actions={<Button type="submit">Appliquer</Button>}>
    <label className="grid gap-1">Nom du critère<Input required maxLength={500} value={rule.label} onChange={e => setRule({ ...rule, label: e.target.value })} /></label>
    {rule.conditions.length > 1 && <label className="grid gap-1">Le critère est satisfait si
      <Select value={rule.mode} onChange={e => setRule({ ...rule, mode: e.target.value as Rule["mode"] })}>
        <option value="ALL">Toutes les conditions sont remplies</option><option value="ANY">Au moins une condition est remplie</option>
      </Select></label>}
    {rule.conditions.map((condition, index) => {
      const field = fields.find(item => item.key === condition.fieldKey);
      if (!field) return null;
      return <fieldset key={index} className="grid gap-3 rounded-xl border p-4">
        <legend className="px-1 font-semibold">Condition {index + 1}</legend>
        <label className="grid gap-1">Question ou pièce à vérifier<Select value={field.key} onChange={e => {
          const next = fields.find(item => item.key === e.target.value);
          if (next) update(index, newCondition(next));
        }}>{fields.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</Select></label>
        <label className="grid gap-1">Vérification<Select value={condition.operator} onChange={e => update(index, newCondition(field, e.target.value as Condition["operator"]))}>
          {allowedOperators(field).map(op => <option key={op} value={op}>{operators[op]}</option>)}
        </Select></label>
        <ExpectedValue condition={condition} field={field} change={value => update(index, { ...condition, value })} />
        {rule.conditions.length > 1 && <Button type="button" variant="ghost" className="justify-self-start" onClick={() => setRule({ ...rule, conditions: rule.conditions.filter((_, i) => i !== index) })}>Retirer la condition</Button>}
      </fieldset>;
    })}
    <Button type="button" variant="outline" className="justify-self-start" disabled={rule.conditions.length >= 10}
      onClick={() => {
        const field = fields.find(f => !rule.conditions.some(c => c.fieldKey === f.key)) ?? fields[0];
        setRule({ ...rule, conditions: [...rule.conditions, newCondition(field)] });
      }}>Ajouter une condition</Button>
    <label className="grid gap-1">Si le critère n’est pas rempli
      <Select value={rule.action} onChange={e => setRule({ ...rule, action: e.target.value as Rule["action"] })}>
        <option value="FLAG">Signaler le point dans le dossier</option><option value="REVIEW">Envoyer le dossier en revue humaine</option>
      </Select>
    </label>
  </EditorDialog>;
}
