"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSensitiveScreeningQuestion } from "@/lib/screening-policy";
import { PencilSimpleIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Operator = "EQUALS" | "NOT_EQUALS" | "IN" | "GTE" | "LTE";
type Rule = { operator: Operator; value: string | string[]; mandatory: boolean };
type Draft = { text: string; type: "SINGLE" | "MULTIPLE" | "TEXT"; options: { text: string }[]; rule: Rule | null };
const blankQuestion = (): Draft => ({ text: "", type: "SINGLE", options: [{ text: "" }, { text: "" }], rule: null });
const typeLabel: Record<Draft["type"], string> = { SINGLE: "Un choix", MULTIPLE: "Plusieurs choix", TEXT: "Réponse libre" };
const operatorLabel: Record<Operator, string> = {
  EQUALS: "Doit être", NOT_EQUALS: "Ne doit pas être", IN: "Au moins une parmi", GTE: "Au moins", LTE: "Au plus",
};

export default function QuestionsEditor({ jobId, initial, locked }: { jobId: string; initial: Draft[]; locked: boolean }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Draft[]>(initial);
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(blankQuestion);
  const [dialogError, setDialogError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function openEditor(index: number) {
    setDialogIndex(index);
    setDraft(index < 0 ? blankQuestion() : {
      ...questions[index],
      options: questions[index].options.map((option) => ({ ...option })),
      rule: questions[index].rule ? { ...questions[index].rule, value: Array.isArray(questions[index].rule.value) ? [...questions[index].rule.value] : questions[index].rule.value } : null,
    });
    setDialogError("");
    setError("");
  }

  async function persist(next: Draft[], inDialog: boolean) {
    setSaving(true);
    setError("");
    setDialogError("");
    try {
      const response = await fetch(`/api/job-listings/${jobId}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: next }),
      });
      if (!response.ok) {
        const result = await response.json();
        const message = result.error ?? "Enregistrement impossible.";
        if (inDialog) setDialogError(message); else setError(message);
        return;
      }
      setQuestions(next);
      setDialogIndex(null);
      router.refresh();
    } catch {
      if (inDialog) setDialogError("Connexion impossible. Réessayez."); else setError("Connexion impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  function finishEditor() {
    if (!draft.text.trim()) return setDialogError("Renseignez la question.");
    if (draft.type !== "TEXT" && (draft.options.length < 2 || draft.options.some((option) => !option.text.trim()))) {
      return setDialogError("Ajoutez au moins deux réponses complètes.");
    }
    if (draft.rule) {
      if (draft.type === "TEXT" || isSensitiveScreeningQuestion(draft.text)) return setDialogError("Cette question ne peut pas servir de critère automatique.");
      if (Array.isArray(draft.rule.value) ? draft.rule.value.length === 0 : !draft.rule.value.trim()) {
        return setDialogError("Choisissez la réponse attendue.");
      }
    }
    const cleaned: Draft = {
      text: draft.text.trim(), type: draft.type,
      options: draft.type === "TEXT" ? [] : draft.options.map((option) => ({ text: option.text.trim() })),
      rule: draft.rule,
    };
    const next = dialogIndex === -1 ? [...questions, cleaned] : questions.map((question, index) => index === dialogIndex ? cleaned : question);
    void persist(next, true);
  }

  const sensitive = isSensitiveScreeningQuestion(draft.text);
  const numeric = draft.type === "SINGLE" && draft.options.every((option) => option.text.trim() !== "" && /^-?\d+(?:[.,]\d+)?$/.test(option.text.trim()));

  return (
    <section className="rounded-2xl border border-[#d9e5f2] bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Questions aux candidats</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ajoutez une question et, si nécessaire, la réponse attendue pour ce poste.</p>
        </div>
        {!locked && <Button type="button" variant="outline" className="rounded-xl" disabled={saving || questions.length >= 20} onClick={() => openEditor(-1)}><PlusIcon className="size-4" /> Ajouter une question</Button>}
      </div>
      {locked && <p className="mt-5 rounded-xl bg-secondary p-4 text-sm">Les questions et critères sont figés depuis la première candidature pour conserver les réponses reçues.</p>}
      <div className="mt-5 space-y-3">
        {questions.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aucune question. Ajoutez-en une, ou publiez l’offre sans questions.</p>}
        {questions.map((question, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-xl border border-[#d8e0e8] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Question {index + 1} · {typeLabel[question.type]}</p>
              <p className="mt-1 font-medium">{question.text}</p>
              {question.type !== "TEXT" && <p className="mt-1 text-xs text-muted-foreground">{question.options.map((option) => option.text).join(" · ")}</p>}
              {question.rule && <p className="mt-2 text-xs font-medium text-primary">{question.rule.mandatory ? "Indispensable" : "Réponse attendue"} · {operatorLabel[question.rule.operator]} {Array.isArray(question.rule.value) ? question.rule.value.join(", ") : question.rule.value}</p>}
              {isSensitiveScreeningQuestion(question.text) && <p className="mt-2 text-xs text-amber-800">Cette question ne peut pas servir de critère automatique.</p>}
            </div>
            {!locked && <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={saving} onClick={() => openEditor(index)}><PencilSimpleIcon className="size-4" /> Modifier</Button>
              <Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={saving} aria-label={`Supprimer la question ${index + 1}`} onClick={() => void persist(questions.filter((_, i) => i !== index), false)}><TrashIcon className="size-4" /></Button>
            </div>}
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {!locked && <p className="mt-5 text-xs text-muted-foreground">Chaque question est enregistrée avec sa réponse attendue. Un critère indispensable non rempli envoie le dossier en revue humaine.</p>}

      <Dialog open={dialogIndex !== null} onOpenChange={(open) => { if (!open && !saving) setDialogIndex(null); }}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden border border-[#d8e0e8] bg-white p-5 shadow-2xl sm:max-w-4xl sm:p-7 lg:max-w-5xl">
          <DialogHeader className="border-b border-[#e1e7ed] pb-4">
            <DialogTitle className="text-xl font-semibold text-[#17375f]">{dialogIndex === -1 ? "Ajouter une question" : "Modifier la question"}</DialogTitle>
            <DialogDescription>Configurez la question et, si besoin, sa règle de présélection.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2867b8]">Étape 1</p>
                  <h3 className="mt-1 text-base font-semibold text-[#17375f]">Question et réponses</h3>
                  <p className="mt-1 text-xs text-[#536b84]">Ce que verra la personne qui postule.</p>
                </div>
            <div className="space-y-2">
              <Label htmlFor="draft-question">Question</Label>
              <Input id="draft-question" value={draft.text} maxLength={500} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value, rule: isSensitiveScreeningQuestion(event.target.value) ? null : current.rule }))} placeholder="Ex. Avez-vous déjà utilisé Java ?" className="h-11 border-[#c7d3df] bg-white shadow-sm focus-visible:border-[#e8922c] focus-visible:ring-[#f3b86c]/35" />
              {sensitive && <p className="text-xs text-amber-800">Cette question concerne une caractéristique personnelle et ne peut pas servir de critère automatique.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="draft-type">Type de réponse</Label>
              <select id="draft-type" value={draft.type} onChange={(event) => setDraft((current) => {
                const type = event.target.value as Draft["type"];
                return { ...current, type, rule: null, options: type === "TEXT" ? [] : current.options.length >= 2 ? current.options : [{ text: "" }, { text: "" }] };
              })} className="h-11 w-full rounded-xl border border-[#c7d3df] bg-white px-3 text-sm focus-visible:outline-[#e8922c]">
                <option value="SINGLE">Un choix</option><option value="MULTIPLE">Plusieurs choix</option><option value="TEXT">Réponse libre</option>
              </select>
            </div>
            {draft.type !== "TEXT" && <div className="space-y-3">
              <Label>Réponses proposées</Label>
              {draft.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input aria-label={`Choix ${index + 1}`} value={option.text} maxLength={100} onChange={(event) => setDraft((current) => ({ ...current, options: current.options.map((item, i) => i === index ? { text: event.target.value } : item), rule: current.rule ? { ...current.rule, operator: current.type === "MULTIPLE" ? "IN" : "EQUALS", value: current.type === "MULTIPLE" ? [] : "" } : null }))} placeholder={`Choix ${index + 1}`} className="h-10 border-[#c7d3df] bg-white shadow-sm focus-visible:border-[#e8922c] focus-visible:ring-[#f3b86c]/35" />
                  {draft.options.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer le choix ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, options: current.options.filter((_, i) => i !== index), rule: current.rule ? { ...current.rule, operator: current.type === "MULTIPLE" ? "IN" : "EQUALS", value: current.type === "MULTIPLE" ? [] : "" } : null }))}><TrashIcon className="size-4" /></Button>}
                </div>
              ))}
              {draft.options.length < 10 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, options: [...current.options, { text: "" }] }))}>+ Ajouter un choix</Button>}
            </div>}
            {draft.type === "TEXT" && <p className="rounded-xl border border-[#e1e7ed] bg-[#f9fafb] p-3 text-xs text-muted-foreground">Une personne lira la réponse libre. Aucun critère automatique ne sera appliqué.</p>}
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#a75d12]">Étape 2 · Facultatif</p>
                  <h3 className="mt-1 text-base font-semibold text-[#17375f]">Présélection</h3>
                  <p className="mt-1 text-xs text-[#536b84]">Indiquez les réponses qui comptent pour ce poste.</p>
                </div>
            {draft.type !== "TEXT" && !sensitive && <div className="rounded-xl border border-[#efcf9e] bg-[#fff8ec] p-4 sm:p-5">
              <label className="flex cursor-pointer items-start gap-3 text-sm font-medium"><input type="checkbox" checked={draft.rule !== null} onChange={(event) => setDraft((current) => ({ ...current, rule: event.target.checked ? { operator: current.type === "MULTIPLE" ? "IN" : "EQUALS", value: current.type === "MULTIPLE" ? [] : "", mandatory: true } : null }))} className="mt-0.5 size-4 accent-[#de821f]" /> Définir une réponse attendue pour la présélection</label>
              {!draft.rule && <p className="mt-3 pl-7 text-xs text-[#795635]">Activez cette option uniquement si une réponse doit guider l’examen du dossier.</p>}
              {draft.rule && <div className="mt-4 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="draft-operator">Condition</Label><select id="draft-operator" value={draft.rule.operator} onChange={(event) => setDraft((current) => ({ ...current, rule: { operator: event.target.value as Operator, value: event.target.value === "IN" ? [] : "", mandatory: current.rule?.mandatory ?? true } }))} className="h-10 w-full rounded-xl border border-[#d9c3a2] bg-white px-3 text-sm focus-visible:outline-[#e8922c]">{draft.type === "MULTIPLE" ? <><option value="IN">Au moins une des réponses cochées</option><option value="EQUALS">Une réponse précise doit figurer</option><option value="NOT_EQUALS">Une réponse précise doit être absente</option></> : <><option value="EQUALS">La réponse doit être</option><option value="NOT_EQUALS">La réponse ne doit pas être</option><option value="IN">Une de ces réponses</option>{numeric && <><option value="GTE">Au moins cette valeur</option><option value="LTE">Au plus cette valeur</option></>}</>}</select></div>
                  <div className="space-y-2"><Label htmlFor={draft.rule.operator === "IN" ? undefined : "draft-expected"}>{draft.rule.operator === "IN" ? "Réponses attendues" : "Réponse attendue"}</Label>
                    {draft.rule.operator === "IN" ? <div id="draft-expected" className="space-y-2 rounded-xl border border-[#d9c3a2] bg-white p-3">{draft.options.filter((option) => option.text.trim()).map((option, index) => <label key={`${index}-${option.text}`} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(draft.rule?.value as string[]).includes(option.text.trim())} onChange={(event) => setDraft((current) => ({ ...current, rule: current.rule ? { ...current.rule, value: event.target.checked ? [...current.rule.value as string[], option.text.trim()] : (current.rule.value as string[]).filter((value) => value !== option.text.trim()) } : null }))} className="size-4 accent-[#de821f]" />{option.text}</label>)}</div>
                      : draft.rule.operator === "GTE" || draft.rule.operator === "LTE" ? <Input id="draft-expected" type="number" step="any" value={draft.rule.value as string} onChange={(event) => setDraft((current) => ({ ...current, rule: current.rule ? { ...current.rule, value: event.target.value } : null }))} className="h-10 border-[#d9c3a2] bg-white focus-visible:border-[#e8922c] focus-visible:ring-[#f3b86c]/35" />
                      : <select id="draft-expected" value={draft.rule.value as string} onChange={(event) => setDraft((current) => ({ ...current, rule: current.rule ? { ...current.rule, value: event.target.value } : null }))} className="h-10 w-full rounded-xl border border-[#d9c3a2] bg-white px-3 text-sm focus-visible:outline-[#e8922c]"><option value="">Choisir</option>{draft.options.filter((option) => option.text.trim()).map((option, index) => <option key={`${index}-${option.text}`} value={option.text.trim()}>{option.text}</option>)}</select>}
                  </div>
                </div>
                {draft.rule.operator === "IN" && <p className="text-xs text-muted-foreground">Le critère est satisfait si la personne choisit au moins une des réponses cochées.</p>}
                <label className="flex cursor-pointer items-start gap-3 border-t border-[#eed9b9] pt-4 text-sm"><input type="checkbox" checked={draft.rule.mandatory} onChange={(event) => setDraft((current) => ({ ...current, rule: current.rule ? { ...current.rule, mandatory: event.target.checked } : null }))} className="mt-0.5 size-4 accent-[#de821f]" /><span><strong>Réponse indispensable</strong><span className="block text-xs text-[#795635]">Si le critère n’est pas satisfait, le dossier passe en revue humaine.</span></span></label>
              </div>}
            </div>}
            {(draft.type === "TEXT" || sensitive) && <p className="rounded-xl border border-[#e1e7ed] bg-[#f9fafb] p-4 text-sm text-[#536b84]">{sensitive ? "Cette question ne peut pas servir de critère automatique." : "Les réponses libres sont lues par une personne."}</p>}
              </div>
            </div>
            {dialogError && <p role="alert" className="mt-4 text-sm text-destructive">{dialogError}</p>}
          </div>
          <DialogFooter className="shrink-0 border-t border-[#e1e7ed] bg-white pt-4"><Button type="button" variant="outline" disabled={saving} onClick={() => setDialogIndex(null)}>Annuler</Button><Button type="button" disabled={saving} onClick={finishEditor} className="bg-[#f39a35] font-semibold text-[#17375f] hover:bg-[#ffad49]">{saving ? "Enregistrement…" : "Enregistrer la question"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
