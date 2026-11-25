"use client";

import { useState } from "react";

type Criterion = { label: string; weight: number; required: boolean };

export default function RubricEditor({
  jobId,
  initialCriteria,
  locked,
}: {
  jobId: string;
  initialCriteria: Criterion[];
  locked: boolean;
}) {
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const total = criteria.reduce((sum, item) => sum + item.weight, 0);

  function change(index: number, update: Partial<Criterion>) {
    setCriteria((current) => current.map((item, i) => i === index ? { ...item, ...update } : item));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/job-listings/${jobId}/rubric`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });
      setMessage(response.ok ? "Grille enregistrée." : "Enregistrement impossible. Vérifiez les compétences et les poids.");
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-card p-4" aria-labelledby="rubric-title">
      <h2 id="rubric-title" className="font-semibold">Grille de score IA</h2>
      <p className="mt-1 text-sm text-muted-foreground">Les poids doivent totaliser 100 %. Une compétence obligatoire évaluée sous 50/100 passe en revue humaine.</p>
      {locked ? <p className="mt-2 text-sm">Grille figée après la première candidature.</p> : null}
      <div className="mt-4 space-y-2">
        {criteria.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_8rem_auto] sm:items-end">
            <label className="text-xs">Compétence
              <input className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={item.label} maxLength={100} disabled={locked} onChange={(event) => change(index, { label: event.target.value })} />
            </label>
            <label className="text-xs">Poids (%)
              <input className="mt-1 w-full rounded-md border bg-background p-2 text-sm" type="number" min={1} max={100} value={item.weight} disabled={locked} onChange={(event) => change(index, { weight: Number(event.target.value) })} />
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.required} disabled={locked} onChange={(event) => change(index, { required: event.target.checked })} /> Obligatoire</label>
            {!locked ? <button type="button" className="rounded-md border px-2 py-2 text-sm" onClick={() => setCriteria((current) => current.filter((_, i) => i !== index))} aria-label={`Supprimer ${item.label || `la compétence ${index + 1}`}`}>Supprimer</button> : null}
          </div>
        ))}
      </div>
      {!locked ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="rounded-md border px-3 py-2 text-sm" disabled={criteria.length >= 10} onClick={() => setCriteria((current) => [...current, { label: "", weight: 0, required: false }])}>Ajouter une compétence</button>
          <span className="text-sm">Total : {total} %</span>
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={saving || (criteria.length > 0 && total !== 100)} onClick={save}>Enregistrer la grille</button>
          {message ? <p role="status" className="text-sm">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
