"use client";

import { isSensitiveScreeningQuestion } from "@/lib/screening-policy";
import { useState } from "react";

type Operator = "NONE" | "EQUALS" | "NOT_EQUALS" | "IN" | "GTE" | "LTE";
type Question = { id: string; text: string; type: "SINGLE" | "MULTIPLE" | "TEXT"; options: { text: string }[] };
type Rule = { questionId: string; operator: Exclude<Operator, "NONE">; value: string; mandatory: boolean };
type Draft = { operator: Operator; value: string | string[]; mandatory: boolean };

export default function ScreeningRulesEditor({
  jobId,
  questions,
  rules,
  locked,
}: {
  jobId: string;
  questions: Question[];
  rules: Rule[];
  locked: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(questions.map((question) => {
      const rule = rules.find((item) => item.questionId === question.id);
      return [question.id, rule
        ? { operator: rule.operator, value: rule.operator === "IN" ? JSON.parse(rule.value) as string[] : rule.value, mandatory: rule.mandatory }
        : { operator: "NONE", value: "", mandatory: true }];
    })),
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const eligibleQuestions = questions.filter((question) => !isSensitiveScreeningQuestion(question.text));

  function update(questionId: string, change: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [questionId]: { ...current[questionId], ...change },
    }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const selected = eligibleQuestions.flatMap((question) => {
        const draft = drafts[question.id];
        if (!draft || draft.operator === "NONE") return [];
        return [{ questionId: question.id, operator: draft.operator, value: draft.value, mandatory: draft.mandatory }];
      });
      const response = await fetch(`/api/job-listings/${jobId}/rules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: selected }),
      });
      if (response.ok) {
        setMessage("Critères enregistrés.");
      } else {
        const result = await response.json();
        setMessage(result.error ?? "Enregistrement impossible. Vérifiez les valeurs et réessayez.");
      }
    } catch {
      setMessage("Connexion impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="criteres-eliminatoires" className="scroll-mt-24 rounded-2xl border border-[#d9e5f2] bg-white p-5 sm:p-7" aria-labelledby="screening-title">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Étape suivante</p>
      <h2 id="screening-title" className="mt-2 text-xl font-bold">Critères éliminatoires</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Définissez la réponse attendue pour les questions importantes. Si un critère indispensable n’est pas rempli, le dossier passe en revue humaine ; il n’est pas refusé automatiquement.
      </p>
      {locked ? (
        <p className="mt-3 text-sm">Les critères sont figés après la première candidature afin de préserver l’historique des décisions.</p>
      ) : questions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-[#f7faff] p-4 text-sm">Enregistrez d’abord une question à choix ci-dessus, puis revenez ici pour définir la réponse attendue.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {questions.map((question) => {
            if (isSensitiveScreeningQuestion(question.text)) {
              return <div key={question.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium">{question.text}</p><p className="mt-1 text-xs text-amber-900">Une caractéristique personnelle ne peut pas servir de critère automatique. Remplacez cette question par une exigence liée au poste.</p></div>;
            }
            const draft = drafts[question.id];
            const numeric = question.type === "SINGLE" && question.options.every((option) => /^-?\d+(?:[.,]\d+)?$/.test(option.text.trim()));
            return (
              <div key={question.id} className="rounded-xl border border-[#d9e5f2] bg-[#f7faff] p-4 sm:p-5">
                <p className="text-sm font-semibold">{question.text}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Condition
                  <select className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-normal" value={draft.operator} onChange={(event) => update(question.id, { operator: event.target.value as Operator, value: event.target.value === "IN" ? [] : "" })}>
                    <option value="NONE">Aucun critère</option>
                    <option value="EQUALS">La réponse doit être</option>
                    <option value="NOT_EQUALS">La réponse ne doit pas être</option>
                    <option value="IN">Une de ces réponses</option>
                    {numeric ? <option value="GTE">Au moins cette valeur</option> : null}
                    {numeric ? <option value="LTE">Au plus cette valeur</option> : null}
                  </select>
                </label>
                {draft.operator === "GTE" || draft.operator === "LTE" ? (
                  <label className="text-sm font-medium">Valeur attendue
                    <input className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-normal" type="number" step="any" value={draft.value as string} onChange={(event) => update(question.id, { value: event.target.value })} />
                  </label>
                ) : draft.operator === "IN" ? (
                  <label className="text-sm font-medium">Réponses attendues
                    <select multiple className="mt-2 min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm font-normal" value={draft.value as string[]} onChange={(event) => update(question.id, { value: Array.from(event.target.selectedOptions, (option) => option.value) })}>
                      {question.options.map((option) => <option key={option.text} value={option.text}>{option.text}</option>)}
                    </select>
                  </label>
                ) : draft.operator !== "NONE" ? (
                  <label className="text-sm font-medium">Réponse attendue
                    <select className="mt-2 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm font-normal" value={draft.value as string} onChange={(event) => update(question.id, { value: event.target.value })}>
                      <option value="">Choisir</option>
                      {question.options.map((option) => <option key={option.text} value={option.text}>{option.text}</option>)}
                    </select>
                  </label>
                ) : null}
                </div>
                {draft.operator !== "NONE" ? (
                  <label className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 text-sm"><input type="checkbox" checked={draft.mandatory} onChange={(event) => update(question.id, { mandatory: event.target.checked })} className="size-4 accent-primary" /> Critère indispensable pour la présélection</label>
                ) : null}
              </div>
            );
          })}
          {eligibleQuestions.length > 0 && <button type="button" disabled={saving} onClick={save} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Enregistrer les critères</button>}
          {message ? <p role="status" className="text-sm">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
