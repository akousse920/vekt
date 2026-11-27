"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPLICATION_TEMPLATES, applicationFormSchema } from "@/lib/application-fields";
import FieldDialog from "./FieldDialog";
import RuleDialog, { newCondition } from "./RuleDialog";
import { canUseInRule, EditorDialog, isBirth, newKey, RuleSummary, Select, types, type Field, type Rule } from "./form-controls";

type EditorForm = { fields: Field[]; rules: Rule[]; revision: string };
type Modal = { kind: "field"; field: Field } | { kind: "rule"; rule: Rule; existing: boolean } | { kind: "template" };

function upsert<T extends { key: string }>(items: T[], next: T) {
  return items.some(item => item.key === next.key) ? items.map(item => item.key === next.key ? next : item) : [...items, next];
}

const panel = "space-y-4 rounded-2xl border bg-white p-5 sm:p-7";

export default function FormEditor({ jobId, initial, locked, publicSlug }: {
  jobId: string; initial: EditorForm; locked: boolean; publicSlug: string | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState(initial.fields);
  const [rules, setRules] = useState(initial.rules);
  const [modal, setModal] = useState<Modal | null>(null);
  const [template, setTemplate] = useState("profil");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const dirty = fields !== saved.fields || rules !== saved.rules;
  const eligible = fields.filter(canUseInRule);
  const close = () => setModal(null);

  function startField() {
    setModal({ kind: "field", field: {
      key: newKey("f"), label: "", type: "SHORT_TEXT", required: false, options: [],
      minValue: null, maxValue: null, flagOutsideRange: false,
    } });
  }
  function startRule(field?: Field) {
    const condition = field ? newCondition(field) : { fieldKey: "", operator: "PRESENT" as const };
    setModal({ kind: "rule", existing: false, rule: { key: newKey("r"), label: field?.label ?? "", mode: "ALL", action: "FLAG", conditions: [condition] } });
  }
  const editRule = (rule: Rule) => setModal({ kind: "rule", rule, existing: true });
  const removeRule = (rule: Rule) => setRules(rules.filter(r => r.key !== rule.key));
  function applyField(field: Field, addRule: boolean) {
    const next = upsert(fields, field);
    const conflict = rules.find(rule => !applicationFormSchema.safeParse({ fields: next, rules: [rule] }).success);
    if (conflict) return `Ce changement rend le critère « ${conflict.label} » invalide. Modifiez d’abord ce critère.`;
    if (addRule && rules.length >= 40) return "Le formulaire contient déjà 40 critères.";
    setFields(next);
    if (addRule) startRule(field); else close();
  }
  function move(index: number, distance: number) {
    const next = [...fields];
    next.splice(index + distance, 0, ...next.splice(index, 1));
    setFields(next);
  }
  function removeField(field: Field) {
    const linked = rules.filter(rule => rule.conditions.some(condition => condition.fieldKey === field.key));
    if (linked.length) {
      setError(`Avant de retirer « ${field.label} », modifiez ou retirez les critères associés : ${linked.map(r => r.label).join(", ")}.`);
      return;
    }
    setError("");
    setFields(fields.filter(f => f.key !== field.key));
  }
  async function save() {
    if (!dirty || saving || locked) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/job-listings/${jobId}/application-form`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, rules, editorRevision: saved.revision }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(response.status === 409 ? result.error : "Enregistrement impossible. Vérifiez les questions et les critères puis réessayez.");
        return;
      }
      setSaved({ fields, rules, revision: result.revision });
      setNotice("Formulaire enregistré.");
      router.refresh();
    } catch {
      setError("Enregistrement impossible. Vérifiez votre connexion puis réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5">
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Formulaire de candidature</h2>
        {publicSlug && <Link target="_blank" href={`/jobs/${publicSlug}`} className="text-sm text-primary underline">Voir le formulaire publié ↗</Link>}
      </div>
      <p className="text-muted-foreground">Le candidat renseigne toujours son nom, son adresse e-mail et joint son CV. Ajoutez ici vos questions, puis définissez la réponse attendue sur celles qui comptent pour le poste.</p>
      {locked ? <p className="rounded-xl bg-secondary p-3">Formulaire en lecture seule depuis la première candidature.</p> :
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={saving || fields.length >= 45} onClick={startField}>Ajouter une question</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => setModal({ kind: "template" })}>Charger un modèle</Button>
        </div>}
      {fields.length > 0 && <ol className="divide-y border-y">{fields.map((field, index) => {
        const linked = rules.filter(r => r.conditions.some(c => c.fieldKey === field.key));
        return <li key={field.key} className="space-y-2 py-4">
          <p className="break-words font-semibold">{index + 1}. {field.label}</p>
          <p className="text-sm text-muted-foreground">{types[field.type]} · {field.required ? "Obligatoire" : "Facultatif"}
            {field.type === "FILES" && ` · Jusqu’à ${field.maxFiles ?? 5} PDF`}</p>
          {field.options.length > 0 && <p className="break-words text-sm">{field.options.join(" · ")}</p>}
          {field.flagOutsideRange && <p className="text-sm">Plage indicative{isBirth(field.type) ? " d’âge" : ""} · {field.minValue ?? "sans minimum"} à {field.maxValue ?? "sans maximum"}{isBirth(field.type) && " ans"}</p>}
          {linked.map(rule => <div key={rule.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary p-3 text-sm">
            <span className="min-w-0 flex-1"><RuleSummary rule={rule} fields={fields} /></span>
            {!locked && <span className="flex gap-1">
              <Button type="button" variant="outline" size="sm" disabled={saving} aria-label={`Modifier le critère « ${rule.label} »`} onClick={() => editRule(rule)}>Modifier</Button>
              <Button type="button" variant="ghost" size="sm" disabled={saving} aria-label={`Retirer le critère « ${rule.label} »`} onClick={() => removeRule(rule)}>Retirer</Button>
            </span>}
          </div>)}
          {!locked && !canUseInRule(field) && <p className="text-xs text-muted-foreground">Cette question ne peut pas servir de critère de présélection.</p>}
          {!locked && <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setModal({ kind: "field", field })}>Modifier la question</Button>
            {canUseInRule(field) && <Button type="button" variant={linked.length ? "ghost" : "outline"} size="sm" disabled={saving || rules.length >= 40} onClick={() => startRule(field)}>
              {linked.length ? "Ajouter un autre critère" : "Définir la réponse attendue"}</Button>}
            <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Monter « ${field.label} »`} disabled={saving || index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Descendre « ${field.label} »`} disabled={saving || index === fields.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer « ${field.label} »`} disabled={saving} onClick={() => removeField(field)}><Trash2 /></Button>
          </div>}
        </li>;
      })}</ol>}
      <p className="text-sm text-muted-foreground">Avant l’envoi, le candidat confirme avoir lu les critères de l’offre et accepte la politique de confidentialité.</p>
    </section>

    {(rules.length > 0 || !locked) && <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Critères de présélection</h2>
        {!locked && <Button type="button" variant="outline" disabled={saving || !eligible.length || rules.length >= 40} onClick={() => startRule()}>Nouveau critère</Button>}
      </div>
      <p className="text-sm text-muted-foreground">{!eligible.length && !locked
        ? "Ajoutez d’abord une question au formulaire. Les questions sur l’âge ou des sujets sensibles ne peuvent pas servir de critère."
        : "Un critère vous signale les dossiers dont la réponse ne correspond pas à vos attentes. Le plus simple : cliquez sur « Définir la réponse attendue » sous la question concernée. Aucun dossier n’est refusé automatiquement."}</p>
      {rules.map(rule => <div key={rule.key} className="space-y-2 border-t pt-4">
        <p className="break-words font-semibold">{rule.label}</p>
        <p className="text-sm"><RuleSummary rule={rule} fields={fields} /></p>
        {!locked && <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => editRule(rule)}>Modifier le critère</Button>
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => removeRule(rule)}>Retirer le critère</Button>
        </div>}
      </div>)}
    </section>}
    {!locked && <div className="sticky bottom-2 z-10 space-y-2 rounded-xl border bg-white p-3 shadow-md">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span role="status" className="text-sm text-muted-foreground">{dirty ? "Modifications à enregistrer" : notice}</span>
        <Button type="button" disabled={!dirty || saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer le formulaire"}</Button>
      </div>
    </div>}
    {modal?.kind === "field" && <FieldDialog initial={modal.field} existing={fields.some(f => f.key === modal.field.key)} close={close} apply={applyField} />}
    {modal?.kind === "rule" && <RuleDialog initial={modal.rule} existing={modal.existing} fields={eligible} close={close} apply={rule => { setRules(upsert(rules, rule)); close(); }} />}
    {modal?.kind === "template" && <EditorDialog title="Charger un modèle" close={close} submit={() => {
      setFields([...APPLICATION_TEMPLATES[template]]); setRules([]); setError(""); close();
    }} actions={<Button type="submit">Utiliser ce modèle</Button>}>
      <label className="grid gap-2">Modèle<Select value={template} onChange={e => setTemplate(e.target.value)}>
        <option value="simple">Simple · Coordonnées et CV</option><option value="profil">Profil · Diplôme et expérience</option>
      </Select></label>
      {template === "profil" && <ul className="list-inside list-disc">{APPLICATION_TEMPLATES.profil.map(f => <li key={f.key}>{f.label}</li>)}</ul>}
      <p className="text-sm text-muted-foreground">Le modèle remplace les questions et les critères du brouillon. Vous pourrez les adapter avant d’enregistrer le formulaire.</p>
    </EditorDialog>}
  </div>;
}
