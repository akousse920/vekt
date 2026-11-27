import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { recruiterVisibleCandidateWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { applicationFilePaths } from "@/lib/application-file-paths";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReviewButton from "../../../../ReviewButton";

const statusLabels: Record<string, string> = {
  APPLIED: "Reçue",
  ANALYZING: "En cours",
  NEEDS_REVIEW: "À examiner",
  SHORTLISTED: "Transmise",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
};

export default async function CandidateDetailPage({ params }: { params: Promise<{ jobId: string; candidateId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const { jobId, candidateId } = await params;
  const candidate = await prisma.candidate.findFirst({
    where: recruiterVisibleCandidateWhere(session.user?.id, isAdmin, { id: candidateId, jobId }),
    include: {
      job: { select: { title: true } },
      evaluation: { select: { score: true, reasoning: true, pros: true, cons: true, rubricSnapshot: true, rubricBreakdown: true } },
      answers: { orderBy: { question: { order: "asc" } }, select: { questionId: true, question: { select: { text: true } }, option: { select: { text: true } } } },
      textAnswers: { orderBy: { question: { order: "asc" } }, select: { id: true, text: true, question: { select: { text: true } } } },
      applicationAnswers: { orderBy: { field: { order: "asc" } }, select: { id: true, value: true, field: { select: { label: true, type: true } } } },
      flags: { orderBy: { createdAt: "asc" }, select: { id: true, detail: true } },
      decisionReasons: { orderBy: { createdAt: "asc" }, select: { id: true, detail: true } },
    },
  });
  if (!candidate) notFound();
  const grouped = new Map<string, { title: string; choices: string[] }>();
  for (const answer of candidate.answers) {
    const item = grouped.get(answer.questionId) ?? { title: answer.question.text, choices: [] };
    item.choices.push(answer.option.text);
    grouped.set(answer.questionId, item);
  }
  const pros: string[] = candidate.evaluation?.pros ? JSON.parse(candidate.evaluation.pros) : [];
  const cons: string[] = candidate.evaluation?.cons ? JSON.parse(candidate.evaluation.cons) : [];

  return (
    <main className="mx-auto min-h-[80vh] max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href={`/recruiter/jobs/${jobId}`} className="text-sm font-medium text-primary hover:underline">← Candidatures · {candidate.job?.title}</Link>
      <div className="mt-7 flex flex-col gap-5 rounded-2xl border border-[#d8e0e8] bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Dossier candidat</p>
          <h1 className="mt-2 text-3xl font-bold">{candidate.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{candidate.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Candidature du {new Date(candidate.appliedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
          <Badge className="mt-4" variant={candidate.status === "REJECTED" ? "destructive" : "secondary"}>{statusLabels[candidate.status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl"><a href={candidate.resumePath} target="_blank" rel="noopener noreferrer">Voir le CV ↗</a></Button>
          <ReviewButton candidateId={candidate.id} currentStatus={candidate.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        {candidate.flags.length > 0 && (
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-7">
            <h2 className="text-lg font-bold text-amber-950">Points à examiner</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-950">{candidate.flags.map((flag) => <li key={flag.id}>{flag.detail}</li>)}</ul>
          </section>
        )}
        {candidate.applicationAnswers.length > 0 && (
          <section className="rounded-2xl border border-[#d8e0e8] bg-white p-5 sm:p-7">
            <h2 className="text-lg font-bold">Informations complémentaires</h2>
            <dl className="mt-4 space-y-4">{candidate.applicationAnswers.map((answer) => {
              const display = answer.field.type === "MULTI_SELECT" ? (JSON.parse(answer.value) as string[]).join(", ") : answer.field.type === "YES_NO" ? answer.value === "true" ? "Oui" : "Non" : answer.field.type === "DECLARATION" ? "Déclaration confirmée" : answer.value;
              const files = applicationFilePaths(answer.value, answer.field.type);
              const historicalBirthYear = answer.field.type === "BIRTH_DATE" && /^\d{4}$/.test(answer.value);
              return <div key={answer.id} className="border-t pt-3 first:border-0 first:pt-0"><dt className="text-sm font-medium">{historicalBirthYear ? "Année de naissance (ancien formulaire)" : answer.field.label}</dt><dd className="mt-1 text-sm text-muted-foreground">{files.length ? <span className="flex flex-wrap gap-3">{files.map((file, index) => <a key={file} href={file} target="_blank" rel="noopener noreferrer" className="text-primary underline">Document {index + 1} ↗</a>)}</span> : display}</dd></div>;
            })}</dl>
          </section>
        )}
        {(grouped.size > 0 || candidate.textAnswers.length > 0 || !candidate.applicationAnswers.length) && <section className="rounded-2xl border border-[#d8e0e8] bg-white p-5 sm:p-7">
          <h2 className="text-lg font-bold">Réponses aux questions</h2>
          {grouped.size === 0 && candidate.textAnswers.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Aucune réponse complémentaire enregistrée.</p>
          ) : (
            <div className="mt-5 space-y-5">
              {[...grouped.entries()].map(([id, item]) => (
                <div key={id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">{item.choices.map((choice) => <span key={choice} className="rounded-lg border border-[#e8d3b5] bg-[#fff9ef] px-3 py-1.5 text-sm text-[#795635]">{choice}</span>)}</div>
                </div>
              ))}
              {candidate.textAnswers.map((answer) => (
                <div key={answer.id} className="border-t pt-4 first:border-t-0 first:pt-0">
                  <p className="text-sm font-medium">{answer.question.text}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-[#e1e7ed] bg-[#fafbfc] p-4 text-sm leading-relaxed">{answer.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>}

        {candidate.evaluation && (
          <section className="rounded-2xl border border-[#d8e0e8] bg-white p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Analyse assistée par IA</h2>
              <span className="text-xl font-bold text-primary">{candidate.evaluation.score}/100</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{candidate.evaluation.reasoning}</p>
            {(pros.length > 0 || cons.length > 0) && (
              <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
                {pros.length > 0 && <div><h3 className="text-sm font-semibold">Points forts</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{pros.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                {cons.length > 0 && <div><h3 className="text-sm font-semibold">Points à vérifier</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{cons.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
              </div>
            )}
          </section>
        )}
        {isAdmin && candidate.decisionReasons.length > 0 && (
          <section className="rounded-2xl border border-[#d8e0e8] bg-white p-5 sm:p-7">
            <h2 className="text-lg font-bold">Motifs de décision</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">{candidate.decisionReasons.map((reason) => <li key={reason.id}>{reason.detail}</li>)}</ul>
          </section>
        )}
      </div>
    </main>
  );
}
