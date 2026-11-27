"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applicationFieldSchema } from "@/lib/application-fields";
import { canUseInRule, EditorDialog, isBirth, Select, types, type Field } from "./form-controls";

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

export default function FieldDialog({ initial, existing, close, apply }: {
  initial: Field; existing: boolean; close: () => void; apply: (field: Field, addRule: boolean) => string | void;
}) {
  const [field, setField] = useState(initial);
  const [optionsText, setOptionsText] = useState(initial.options.join("\n"));
  const [error, setError] = useState("");
  const choice = field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT";
  const age = isBirth(field.type);
  function edit(patch: Partial<Field>) { setField({ ...field, ...patch }); setError(""); }
  function finish(addRule: boolean) {
    const options = choice ? optionsText.split("\n").map(line => line.trim()).filter(Boolean) : [];
    if (!field.label.trim()) return setError("Indiquez la question à poser.");
    if (choice && (options.length < 2 || options.length > 20 || new Set(options.map(s => s.toLowerCase())).size !== options.length || options.some(s => s.length > 100))) {
      return setError("Prévoyez de 2 à 20 choix distincts de 100 caractères maximum chacun.");
    }
    if (field.flagOutsideRange && field.minValue === null && field.maxValue === null) return setError("Indiquez au moins une borne.");
    if (field.minValue !== null && field.maxValue !== null && field.minValue > field.maxValue) return setError("Le minimum doit être inférieur ou égal au maximum.");
    const parsed = applicationFieldSchema.safeParse({ ...field, options });
    if (!parsed.success) return setError("Vérifiez le type, les limites et les choix de cette question.");
    const message = apply(parsed.data, addRule);
    if (message) setError(message);
  }

  return <EditorDialog title={existing ? "Modifier la question" : "Ajouter une question"} close={close}
    submit={() => finish(false)} error={error} actions={<>
      {canUseInRule(field) && <Button type="button" variant="outline" onClick={e => {
        if (e.currentTarget.form?.reportValidity()) finish(true);
      }}>Continuer vers un critère</Button>}
      <Button type="submit">Appliquer</Button>
    </>}>
    <label className="grid gap-2">Type de réponse
      <Select value={field.type} onChange={e => { setField(changeType(field, e.target.value as Field["type"])); setError(""); }}>
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
    {(field.type === "NUMBER" || age) && <div className="space-y-3 rounded-xl border p-4">
      <label className="flex items-center gap-2"><input type="checkbox" checked={field.flagOutsideRange}
        onChange={e => edit({ flagOutsideRange: e.target.checked, ...(!e.target.checked ? { minValue: null, maxValue: null } : {}) })} />
        {age ? "Signaler un âge hors de la tranche souhaitée" : "Signaler une valeur hors de la plage souhaitée"}
      </label>
      {field.flagOutsideRange && <>
        <div className="grid grid-cols-2 gap-3">{(["minValue", "maxValue"] as const).map((key, i) =>
          <label key={key} className="grid gap-1">{age ? ["Âge minimum", "Âge maximum"][i] : ["Minimum", "Maximum"][i]}
            <Input type="number" min={age ? 0 : undefined} max={age ? 120 : undefined} step={age ? 1 : "any"} value={field[key] ?? ""}
              onChange={e => edit({ [key]: e.target.value === "" ? null : Number(e.target.value) })} />
          </label>)}</div>
        <p className="text-sm text-muted-foreground">{age ? "L’âge au dépôt sert à signaler un écart au recruteur." : "Un écart ajoute une indication au dossier."}</p>
      </>}
    </div>}
  </EditorDialog>;
}
