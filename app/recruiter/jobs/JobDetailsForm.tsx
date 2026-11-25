"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useRouter } from "next/navigation";
import { useState } from "react";

type InitialJob = {
  id: string;
  title: string;
  location: string | null;
  description: string;
  customPrompt: string | null;
  threshold: number;
  isActive: boolean;
  notifyOnApplication: boolean;
};

export default function JobDetailsForm({ job, aiEnabled }: { job?: InitialJob; aiEnabled: boolean }) {
  const router = useRouter();
  const [description, setDescription] = useState(job?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(job?.isActive ?? true);
  const [notifyOnApplication, setNotifyOnApplication] = useState(job?.notifyOnApplication ?? true);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description || description === "<p></p>") {
      setError("Ajoutez une description du poste.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? "").trim(),
      location: String(form.get("location") ?? "").trim(),
      description,
      customPrompt: aiEnabled ? String(form.get("customPrompt") ?? "") : job?.customPrompt ?? undefined,
      threshold: aiEnabled ? Number(form.get("threshold") ?? 75) : job?.threshold ?? 75,
      notifyOnApplication,
    };
    try {
      const response = await fetch(job ? `/api/job-listings/${job.id}` : "/api/job-listings", {
        method: job ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "Enregistrement impossible.");
        return;
      }
      const result = await response.json();
      router.push(`/recruiter/jobs/${result.id}/questions`);
      router.refresh();
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/job-listings/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      if (!response.ok) throw new Error();
      setActive(!active);
      router.refresh();
    } catch {
      setError("Impossible de modifier la publication de l’offre.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-6 rounded-2xl border border-[#d8e0e8] bg-white p-5 shadow-sm sm:p-8">
        <div>
          <h2 className="text-xl font-bold">Informations du poste</h2>
          <p className="mt-1 text-sm text-muted-foreground">Présentez clairement le rôle avant de préparer les questions.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="job-title">Intitulé du poste</Label>
            <Input id="job-title" name="title" required maxLength={100} defaultValue={job?.title} placeholder="Ex. Responsable commercial" className="h-12 bg-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-location">Lieu</Label>
            <Input id="job-location" name="location" defaultValue={job?.location ?? ""} placeholder="Ex. Cotonou ou télétravail" className="h-12 bg-white" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description du poste</Label>
          <RichTextEditor value={description} onChange={setDescription} placeholder="Missions, compétences attendues et conditions du poste…" />
        </div>
        {aiEnabled && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job-prompt">Consignes d’analyse IA (facultatif)</Label>
              <textarea id="job-prompt" name="customPrompt" defaultValue={job?.customPrompt ?? ""} rows={3} className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job-threshold">Seuil de score IA</Label>
              <Input id="job-threshold" name="threshold" type="number" min={0} max={100} defaultValue={job?.threshold ?? 75} className="h-11 max-w-32" />
            </div>
          </div>
        )}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d8e0e8] bg-[#f7f8fa] p-4">
          <input
            type="checkbox"
            checked={notifyOnApplication}
            onChange={(event) => setNotifyOnApplication(event.target.checked)}
            className="mt-1 size-4 shrink-0 accent-primary"
          />
          <span>
            <span className="block font-semibold">Recevoir un e-mail pour chaque nouvelle candidature</span>
            <span className="mt-1 block text-sm text-muted-foreground">Désactivez cette option pour consulter les candidatures directement dans votre espace.</span>
          </span>
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end border-t pt-5">
          <Button type="submit" disabled={busy} className="brand-cta h-12 rounded-xl px-6 font-semibold">{busy ? "Enregistrement…" : job ? "Enregistrer et continuer" : "Créer et ajouter les questions"}</Button>
        </div>
      </form>
      {job && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e8d3b5] bg-[#fff9ef] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Publication</h2>
            <p className="text-sm text-muted-foreground">{active ? "L’offre est visible par les candidats." : "L’offre est en pause et n’accepte plus de candidatures."}</p>
          </div>
          <Button type="button" variant="outline" disabled={busy} onClick={toggle} className="rounded-xl">{active ? "Mettre en pause" : "Publier l’offre"}</Button>
        </div>
      )}
    </div>
  );
}
