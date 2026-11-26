"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    BriefcaseIcon,
    CheckCircleIcon,
    MapPinIcon,
    SpinnerGapIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { AiDisclosure } from "@/components/ai-disclosure";
import type { PublicApplicationField } from "@/lib/application-fields";
import { beninToday } from "@/lib/age-range";
import { useRef, useState } from "react";
import { toast } from "sonner";

type ScreeningOption = { id: string; text: string };
type ScreeningQuestion = {
  id: string;
  text: string;
  type: "SINGLE" | "MULTIPLE" | "TEXT";
  options: ScreeningOption[];
};

type Job = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  screeningQuestions: ScreeningQuestion[];
  applicationFields: PublicApplicationField[];
  applicationDeadline: string | null;
};

type Props = {
  job?: Job | null;
  supportEmail: string;
  aiEnabled: boolean;
  closed?: boolean;
};

type SubmissionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; statusPath: string }
  | { status: "error"; message: string };

const MAX_RESUME_SIZE = 5 * 1024 * 1024;

function resumeValidationError(file: File | null): string | null {
  if (!file || file.type !== "application/pdf") return "Ajoutez votre CV au format PDF.";
  if (file.size > MAX_RESUME_SIZE) return "Votre CV dépasse la limite de 5 Mo. Choisissez un fichier plus léger.";
  return null;
}

function StepDot({ active, done }: { active?: boolean; done?: boolean }) {
  return (
    <div
      className={cn(
        "size-2 rounded-full transition-colors",
        done
          ? "bg-primary"
          : active
            ? "ring-2 ring-primary ring-offset-1 bg-primary"
            : "bg-muted-foreground/30",
      )}
    />
  );
}

export default function ApplyForm({ job, supportEmail, aiEnabled, closed = false }: Props) {
  const hasQuestions = (job?.screeningQuestions?.length ?? 0) > 0;

  const [step, setStep] = useState<"details" | "questions">("details");
  const [state, setState] = useState<SubmissionState>({ status: "idle" });
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [criteriaDeclared, setCriteriaDeclared] = useState(false);
  const [selectedResumeName, setSelectedResumeName] = useState("");
  const [resumeError, setResumeError] = useState<string | null>(null);

  // answers: questionId → Set of selected optionIds
  const [answers, setAnswers] = useState<Record<string, Set<string>>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [extraValues, setExtraValues] = useState<Record<string, string | string[] | File | File[]>>({});
  const extraFields = job?.applicationFields ?? [];
  const missingExtraField = extraFields.find((field) => {
    if (!field.required) return false;
    const value = extraValues[field.id];
    return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  });
  const allQuestionsAnswered = !job || job.screeningQuestions.every((question) =>
    question.type === "TEXT"
      ? Boolean(textAnswers[question.id]?.trim())
      : (answers[question.id]?.size ?? 0) > 0,
  );

  // hold step-1 values so we can re-populate after going back
  const [detailsSnapshot, setDetailsSnapshot] = useState<{
    name: string;
    email: string;
    resume: File | null;
  }>({ name: "", email: "", resume: null });

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleOption(question: ScreeningQuestion, optionId: string) {
    setAnswers((prev) => {
      const current = new Set(prev[question.id] ?? []);
      if (question.type === "SINGLE") {
        return { ...prev, [question.id]: new Set([optionId]) };
      }
      if (current.has(optionId)) {
        current.delete(optionId);
      } else {
        current.add(optionId);
      }
      return { ...prev, [question.id]: current };
    });
  }

  function handleNextStep(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get("name") as string;
    const email = data.get("email") as string;
    // If the user navigated back, the file input may be empty — fall back to
    // the previously captured snapshot so they don't have to re-upload.
    const resumeFile = fileInputRef.current?.files?.[0] ?? detailsSnapshot.resume;

    const fileError = resumeValidationError(resumeFile);
    if (fileError) {
      setResumeError(fileError);
      return;
    }
    if (name.length > 30 || email.length > 30) {
      toast.error("Le nom et l’adresse email doivent contenir moins de 30 caractères.");
      return;
    }
    if (missingExtraField) {
      toast.error(`Renseignez « ${missingExtraField.label} » avant de continuer.`);
      return;
    }
    setDetailsSnapshot({ name, email, resume: resumeFile });
    setResumeError(null);
    setState({ status: "idle" });
    setStep("questions");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (job && !criteriaDeclared) {
      toast.error("Confirmez avoir lu les critères de l’offre.");
      return;
    }
    if (!allQuestionsAnswered) {
      toast.error("Répondez à toutes les questions avant de continuer.");
      return;
    }
    if (missingExtraField) {
      toast.error(`Renseignez « ${missingExtraField.label} » avant d’envoyer la candidature.`);
      if (hasQuestions) setStep("details");
      return;
    }
    const formData = new FormData();

    if (hasQuestions) {
      // Values were captured in detailsSnapshot at step 1
      const fileError = resumeValidationError(detailsSnapshot.resume);
      if (fileError) {
        setResumeError(fileError);
        setStep("details");
        return;
      }
      formData.append("name", detailsSnapshot.name);
      formData.append("email", detailsSnapshot.email);
      if (detailsSnapshot.resume) {
        formData.append("resume", detailsSnapshot.resume);
      }
    } else {
      // Single-step: read straight from the form
      const raw = new FormData(e.currentTarget);
      const resumeFile = raw.get("resume") as File | null;
      const fileError = resumeValidationError(resumeFile);
      if (fileError || !resumeFile) {
        setResumeError(fileError);
        return;
      }
      const name = raw.get("name") as string;
      const email = raw.get("email") as string;
      if (name.length > 30 || email.length > 30) {
        toast.error("Le nom et l’adresse email doivent contenir moins de 30 caractères.");
        return;
      }
      formData.append("name", name);
      formData.append("email", email);
      formData.append("resume", resumeFile);
    }

    if (job) {
      formData.append("jobId", job.id);
    }
    for (const field of extraFields) {
      const value = extraValues[field.id];
      if (value === undefined || value === "") continue;
      if (field.type === "FILES" && Array.isArray(value)) {
        for (const file of value) if (file instanceof File) formData.append(`field:${field.id}`, file);
      } else if (value instanceof File) formData.append(`field:${field.id}`, value);
      else if (Array.isArray(value)) formData.append(`field:${field.id}`, JSON.stringify(value));
      else formData.append(`field:${field.id}`, value);
    }
    formData.append("consentGiven", "true");
    if (job) formData.append("criteriaDeclared", "true");

    if (hasQuestions) {
      const answersPayload = job!.screeningQuestions.map((question) => question.type === "TEXT"
        ? { questionId: question.id, text: textAnswers[question.id].trim() }
        : { questionId: question.id, optionIds: Array.from(answers[question.id] ?? []) });
      formData.append("answers", JSON.stringify(answersPayload));
    }

    setState({ status: "loading" });
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setState({
          status: "error",
          message: data.error ?? "Envoi impossible. Veuillez réessayer.",
        });
        return;
      }

      setState({ status: "success", statusPath: data.statusPath });
      formRef.current?.reset();
    } catch {
      setState({ status: "error", message: "Connexion impossible. Veuillez réessayer." });
    }
  }

  return (
    <div className="flex min-h-[82vh] flex-col bg-background">
      <main className="flex-1">
        {job && (
          <div className="brand-hero text-white">
            <div className="mx-auto max-w-[1480px] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
              <Link href="/" className="text-sm text-white/80 hover:text-white">← Toutes les offres</Link>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#ffd196]">Postuler à l’offre</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{job.title}</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-white/85"><MapPinIcon className="size-4" />{job.location || "Lieu à préciser"}</p>
              {job.applicationDeadline && <p className="mt-2 text-sm font-medium text-white/90">Date limite : {new Date(job.applicationDeadline).toLocaleDateString("fr-BJ", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Porto-Novo" })}</p>}
            </div>
          </div>
        )}
        <div
          className={
            job
              ? "mx-auto grid max-w-[1480px] grid-cols-1 items-start gap-5 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:px-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:gap-10"
              : "mx-auto flex max-w-2xl flex-col px-5 py-10"
          }
        >
          {job && (
            <>
              <details className="group rounded-2xl border border-[#d8e0e8] bg-white p-5 shadow-sm sm:p-6 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-primary">
                  <span className="flex items-center gap-2"><BriefcaseIcon className="size-5" /> Voir la description du poste</span>
                  <span className="text-sm group-open:rotate-180">⌄</span>
                </summary>
                <div className="prose prose-sm mt-5 max-w-none border-t pt-5 text-foreground" dangerouslySetInnerHTML={{ __html: job.description }} />
              </details>
              <aside aria-label="Description du poste" className="sticky top-6 hidden min-w-0 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-[#d8e0e8] bg-white p-6 shadow-sm lg:block">
                <h2 className="flex items-center gap-2 text-xl font-bold"><BriefcaseIcon className="size-5 text-primary" /> Le poste</h2>
                <div className="prose prose-sm mt-5 max-w-none border-t pt-5 text-foreground" dangerouslySetInnerHTML={{ __html: job.description }} />
              </aside>
            </>
          )}

          <div className="min-w-0">
            {state.status === "success" ? (
              /* ── Success state ── */
              <Card className="border-[#d8e0e8] bg-white shadow-lg shadow-slate-900/5">
                <CardHeader>
                  <CheckCircleIcon className="size-8 text-primary" weight="fill" />
                  <CardTitle>Candidature envoyée</CardTitle>
                  <CardDescription>
                    {aiEnabled
                      ? "Votre candidature sera examinée avec une assistance IA, puis par une personne."
                      : "Vos réponses sont vérifiées selon les critères de l’offre. Si aucun critère ne bloque votre dossier, il est transmis au recruteur."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-muted-foreground text-xs">
                    Conservez ce lien privé pour suivre votre candidature :
                  </p>
                  <Link
                    href={state.statusPath}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline underline-offset-3"
                  >
                    Suivre ma candidature
                  </Link>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setState({ status: "idle" });
                      setStep("details");
                      setAnswers({});
                      setTextAnswers({});
                      setExtraValues({});
                      setConsentPrivacy(false);
                      setCriteriaDeclared(false);
                      setSelectedResumeName("");
                    }}
                  >
                    Envoyer une autre candidature
                  </Button>
                </CardFooter>
              </Card>
            ) : closed ? (
              <Card className="border-[#d8e0e8] bg-white"><CardHeader><CardTitle>Candidatures closes</CardTitle><CardDescription>La date limite pour cette offre est dépassée.</CardDescription></CardHeader></Card>
            ) : step === "details" || !hasQuestions ? (
              /* ── Step 1: Details ── */
              <Card className="border-[#d8e0e8] bg-white shadow-lg shadow-slate-900/5">
                <CardHeader>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{hasQuestions ? "Étape 1 sur 2 · Profil et CV" : "Votre candidature"}</p>
                  <CardTitle className="text-2xl">Postuler simplement</CardTitle>
                  <CardDescription>
                    {job
                      ? "Renseignez vos coordonnées et ajoutez votre CV en PDF."
                      : aiEnabled
                        ? "Envoyez votre candidature pour une évaluation assistée."
                        : "Envoyez votre candidature pour une revue humaine."}
                  </CardDescription>
                  {hasQuestions && (
                    <div className="flex items-center gap-2 pt-1">
                      <StepDot active />
                      <div className="h-px w-6 bg-border" />
                      <StepDot />
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <form
                    ref={formRef}
                    onSubmit={hasQuestions ? handleNextStep : handleSubmit}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        maxLength={30}
                        required
                        placeholder="Votre nom et prénom"
                        className="h-11"
                        defaultValue={detailsSnapshot.name}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">Adresse email</Label>
                      <Input
                        id="email"
                        name="email"
                        maxLength={30}
                        type="email"
                        required
                        placeholder="vous@exemple.com"
                        className="h-11"
                        defaultValue={detailsSnapshot.email}
                      />
                    </div>

                    <div className="relative flex flex-col gap-2">
                      <Label htmlFor="resume">CV au format PDF</Label>
                      <Input
                        ref={fileInputRef}
                        id="resume"
                        name="resume"
                        type="file"
                        accept="application/pdf"
                        required={!detailsSnapshot.resume}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setSelectedResumeName(file?.name ?? "");
                          setResumeError(file ? resumeValidationError(file) : null);
                          setState({ status: "idle" });
                        }}
                        className="absolute left-0 top-0 !h-px !w-px overflow-hidden !p-0 opacity-0"
                      />
                      <label htmlFor="resume" className="flex min-h-12 cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#e6ba7c] bg-[#fff9ef] px-4 py-3 text-sm hover:border-[#d98625]">
                        <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-primary">Choisir un PDF</span>
                        <span className="min-w-0 truncate text-muted-foreground">{selectedResumeName || detailsSnapshot.resume?.name || "Aucun fichier choisi"}</span>
                      </label>
                      <p className="text-xs text-muted-foreground">PDF uniquement, 5 Mo maximum.</p>
                      {resumeError && <p role="alert" className="text-sm font-medium text-destructive">{resumeError}</p>}
                    </div>

                    {extraFields.map((field) => {
                      const current = extraValues[field.id];
                      const options: string[] = JSON.parse(field.options);
                      return (
                        <div key={field.id} className="flex flex-col gap-2">
                          <Label htmlFor={`extra-${field.id}`}>{field.label}{field.required ? " *" : ""}</Label>
                          {(field.type === "SHORT_TEXT" || field.type === "NUMBER" || field.type === "BIRTH_YEAR") && (
                            <Input id={`extra-${field.id}`} type={field.type === "SHORT_TEXT" ? "text" : "number"}
                              inputMode={field.type === "NUMBER" ? "decimal" : field.type === "BIRTH_YEAR" ? "numeric" : undefined}
                              step={field.type === "BIRTH_YEAR" || field.key === "age" ? "1" : "any"}
                              min={field.type === "BIRTH_YEAR" ? new Date().getUTCFullYear() - 120 : undefined}
                              max={field.type === "BIRTH_YEAR" ? new Date().getUTCFullYear() : undefined}
                              required={field.required} maxLength={field.type === "SHORT_TEXT" ? 200 : undefined}
                              value={typeof current === "string" ? current : ""} className="h-11"
                              onChange={(event) => setExtraValues((previous) => ({ ...previous, [field.id]: event.target.value }))} />
                          )}
                          {field.type === "BIRTH_DATE" && (
                            <Input id={`extra-${field.id}`} type="date" max={beninToday()} required={field.required}
                              value={typeof current === "string" ? current : ""} className="h-11"
                              onChange={(event) => setExtraValues((previous) => ({ ...previous, [field.id]: event.target.value }))} />
                          )}
                          {field.type === "LONG_TEXT" && (
                            <textarea id={`extra-${field.id}`} maxLength={2000} rows={3} required={field.required}
                              value={typeof current === "string" ? current : ""}
                              onChange={(event) => setExtraValues((previous) => ({ ...previous, [field.id]: event.target.value }))}
                              className="w-full rounded-xl border px-3 py-2 text-sm" />
                          )}
                          {field.type === "SINGLE_SELECT" && (
                            <select id={`extra-${field.id}`} required={field.required} value={typeof current === "string" ? current : ""}
                              onChange={(event) => setExtraValues((previous) => ({ ...previous, [field.id]: event.target.value }))}
                              className="h-11 rounded-xl border bg-white px-3 text-sm">
                              <option value="">Choisir une réponse</option>
                              {options.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                          )}
                          {field.type === "YES_NO" && (
                            <div className="flex gap-2" role="group" aria-label={field.label}>
                              {[["true", "Oui"], ["false", "Non"]].map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={current === value} className={cn("min-h-11 rounded-xl", current === value && "border-primary bg-primary/10")} onClick={() => setExtraValues((previous) => ({ ...previous, [field.id]: value }))}>{label}</Button>)}
                            </div>
                          )}
                          {field.type === "DECLARATION" && (
                            <label className="flex items-start gap-3 text-sm"><input id={`extra-${field.id}`} type="checkbox" checked={current === "true"} onChange={(event) => setExtraValues((previous) => ({ ...previous, [field.id]: event.target.checked ? "true" : "" }))} className="mt-1 size-4 accent-primary" /><span>Je confirme cette déclaration.</span></label>
                          )}
                          {field.type === "MULTI_SELECT" && (
                            <div className="flex flex-wrap gap-2" role="group" aria-label={field.label}>
                              {options.map((option) => {
                                const selected = Array.isArray(current) && current.some((item) => item === option);
                                return <Button key={option} type="button" variant="outline" aria-pressed={selected}
                                  className={cn("min-h-11 rounded-xl", selected && "border-primary bg-primary/10")}
                                  onClick={() => setExtraValues((previous) => {
                                    const chosen = Array.isArray(previous[field.id]) ? previous[field.id] as string[] : [];
                                    return { ...previous, [field.id]: chosen.includes(option) ? chosen.filter((item) => item !== option) : [...chosen, option] };
                                  })}>{option}</Button>;
                              })}
                            </div>
                          )}
                          {field.type === "FILE" && (
                            <Input id={`extra-${field.id}`} type="file" accept="application/pdf" required={field.required && !(current instanceof File)}
                              onChange={(event) => setExtraValues((previous) => {
                                const next = { ...previous };
                                const file = event.target.files?.[0];
                                if (file) next[field.id] = file;
                                else delete next[field.id];
                                return next;
                              })} className="h-11" />
                          )}
                          {field.type === "FILE" && current instanceof File && <p className="text-xs text-muted-foreground">{current.name} · PDF, 5 Mo maximum</p>}
                          {field.type === "FILES" && (
                            <><Input id={`extra-${field.id}`} type="file" accept="application/pdf" multiple
                              onChange={(event) => {
                                const files = Array.from(event.target.files ?? []);
                                if (files.length > (field.maxFiles ?? 5)) toast.error(`Sélectionnez au maximum ${field.maxFiles ?? 5} PDF pour « ${field.label} ».`);
                                setExtraValues((previous) => ({ ...previous, [field.id]: files }));
                              }} className="h-11" />
                              <p className="text-xs text-muted-foreground">Jusqu’à {field.maxFiles ?? 5} PDF, 5 Mo chacun. {Array.isArray(current) && current.length > 0 ? current.filter((file): file is File => file instanceof File).map((file) => file.name).join(", ") : ""}</p></>
                          )}
                        </div>
                      );
                    })}

                    {!hasQuestions && state.status === "error" && (
                      <Alert variant="destructive">
                        <WarningCircleIcon />
                        <AlertTitle>Envoi impossible</AlertTitle>
                        <AlertDescription>{state.message}</AlertDescription>
                      </Alert>
                    )}

                    {!hasQuestions && <AiDisclosure aiEnabled={aiEnabled} />}

                    {/* GDPR consent (single-step only) */}
                    {!hasQuestions && (
                      <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
                        {job && <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={criteriaDeclared} onChange={(event) => setCriteriaDeclared(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" /><span>J’ai lu les critères de l’offre et je déclare y répondre.</span></label>}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            id="consentPrivacy"
                            checked={consentPrivacy}
                            onChange={(e) => setConsentPrivacy(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                          />
                          <label
                            htmlFor="consentPrivacy"
                            className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                          >
                            J’ai lu et accepté la{" "}
                            <Link
                              href="/privacy"
                              target="_blank"
                              className="text-primary underline underline-offset-3 font-medium"
                            >
                              politique de confidentialité
                            </Link>{" "}
                            et j’accepte le traitement de mes données pour cette candidature.
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">Pour exercer vos droits sur vos données : <a href={`mailto:${supportEmail}`} className="font-medium text-primary underline">{supportEmail}</a>.</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={
                        state.status === "loading" ||
                        (!hasQuestions && (!consentPrivacy || Boolean(job && !criteriaDeclared)))
                      }
                      className="brand-cta h-12 w-full rounded-xl text-sm font-semibold"
                    >
                      {state.status === "loading" && !hasQuestions && (
                        <SpinnerGapIcon
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      )}
                      {hasQuestions
                        ? "Continuer vers les questions →"
                        : state.status === "loading"
                          ? "Envoi en cours…"
                          : "Envoyer ma candidature"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              /* ── Step 2: Screening Questions ── */
              (() => {
                const allAnswered = allQuestionsAnswered;
                return (
              <Card className="border-[#d8e0e8] bg-white shadow-lg shadow-slate-900/5">
                <CardHeader>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Étape 2 sur 2 · Questions</p>
                  <CardTitle className="text-2xl">Quelques questions pour cette offre</CardTitle>
                  <CardDescription>
                    Répondez à chaque question avant d’envoyer votre candidature.
                  </CardDescription>
                  <div className="flex items-center gap-2 pt-1">
                    <StepDot done />
                    <div className="h-px w-6 bg-primary/40" />
                    <StepDot active />
                  </div>
                </CardHeader>
                <CardContent>
                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-6"
                  >
                    {job!.screeningQuestions.map((q) => (
                      <div key={q.id} className="flex flex-col gap-3 rounded-xl border border-[#d8e0e8] bg-white p-4 sm:p-5">
                        <div>
                          <p className="text-base font-semibold leading-snug">
                            {q.text}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {q.type === "SINGLE"
                              ? "Choisissez une réponse"
                              : q.type === "MULTIPLE" ? "Choisissez toutes les réponses utiles" : "Réponse libre · 2 000 caractères maximum"}
                          </p>
                        </div>
                        {q.type === "TEXT" ? (
                          <textarea
                            value={textAnswers[q.id] ?? ""}
                            onChange={(event) => setTextAnswers((current) => ({ ...current, [q.id]: event.target.value }))}
                            maxLength={2000}
                            rows={4}
                            aria-label={q.text}
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          />
                        ) : <div className="flex flex-wrap gap-2">
                          {q.options.map((opt) => {
                            const selected = answers[q.id]?.has(opt.id) ?? false;
                            return (
                              <Button
                                key={opt.id}
                                type="button"
                                variant="outline"
                                aria-pressed={selected}
                                onClick={() => toggleOption(q, opt.id)}
                                className={cn(
                                  "min-h-11 h-auto whitespace-normal rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all",
                                  selected
                                    ? "border-[#df8c2d] bg-[#fff0d9] text-[#17375f] hover:bg-[#ffe4bd] hover:text-[#17375f]"
                                    : "border-[#c7d3df] bg-white text-foreground hover:border-[#df8c2d] hover:bg-[#fff9ef]",
                                )}
                              >
                                {opt.text}
                              </Button>
                            );
                          })}
                        </div>}
                      </div>
                    ))}

                    {state.status === "error" && (
                      <Alert variant="destructive">
                        <WarningCircleIcon />
                        <AlertTitle>Envoi impossible</AlertTitle>
                        <AlertDescription>{state.message}</AlertDescription>
                      </Alert>
                    )}

                    <AiDisclosure aiEnabled={aiEnabled} />

                    {/* GDPR consent */}
                    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
                      {job && <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={criteriaDeclared} onChange={(event) => setCriteriaDeclared(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" /><span>J’ai lu les critères de l’offre et je déclare y répondre.</span></label>}
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="consentPrivacy2"
                          checked={consentPrivacy}
                          onChange={(e) => setConsentPrivacy(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                        />
                        <label
                          htmlFor="consentPrivacy2"
                          className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                        >
                          J’ai lu et accepté la{" "}
                          <Link
                            href="/privacy"
                            target="_blank"
                            className="text-primary underline underline-offset-3 font-medium"
                          >
                            politique de confidentialité
                          </Link>{" "}
                          et j’accepte le traitement de mes données pour cette candidature.
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">Pour exercer vos droits sur vos données : <a href={`mailto:${supportEmail}`} className="font-medium text-primary underline">{supportEmail}</a>.</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="brand-cta h-11 flex-1 rounded-xl font-semibold"
                        onClick={() => setStep("details")}
                        disabled={state.status === "loading"}
                      >
                        ← Retour
                      </Button>
                      <Button
                        type="submit"
                        className="h-11 flex-1 rounded-xl"
                        disabled={
                          state.status === "loading" ||
                          !consentPrivacy ||
                          Boolean(job && !criteriaDeclared) ||
                          !allAnswered
                        }
                      >
                        {state.status === "loading" && (
                          <SpinnerGapIcon
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        )}
                        {state.status === "loading"
                          ? "Envoi en cours…"
                          : "Envoyer ma candidature"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
                );
              })()
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
