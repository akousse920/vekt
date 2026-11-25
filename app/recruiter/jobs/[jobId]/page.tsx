import { CandidateStatus } from "@/generated/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { recruiterVisibleCandidateWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

const filters = [
  { key: "all", label: "Toutes", statuses: null },
  { key: "review", label: "À examiner", statuses: [CandidateStatus.NEEDS_REVIEW] },
  { key: "shortlisted", label: "Transmises", statuses: [CandidateStatus.SHORTLISTED] },
  { key: "accepted", label: "Acceptées", statuses: [CandidateStatus.ACCEPTED] },
  { key: "pending", label: "En cours", statuses: [CandidateStatus.APPLIED, CandidateStatus.ANALYZING] },
  { key: "rejected", label: "Refusées", statuses: [CandidateStatus.REJECTED] },
] as const;

const statusLabels: Record<CandidateStatus, string> = {
  APPLIED: "Reçue",
  ANALYZING: "En cours",
  NEEDS_REVIEW: "À examiner",
  SHORTLISTED: "Transmise",
  ACCEPTED: "Acceptée",
  REJECTED: "Refusée",
};

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const { jobId } = await params;
  const selected = (await searchParams).status ?? "all";
  const currentFilter = filters.find((item) => item.key === selected) ?? filters[0];
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...(!isAdmin ? { createdById: session.user?.id } : {}) },
    select: { id: true, title: true, location: true, isActive: true },
  });
  if (!job) notFound();
  const candidates = await prisma.candidate.findMany({
    where: recruiterVisibleCandidateWhere(session.user?.id, isAdmin, { jobId }),
    orderBy: { appliedAt: "desc" },
    select: { id: true, name: true, email: true, appliedAt: true, status: true, evaluation: { select: { score: true } } },
  });
  const visible = currentFilter.statuses ? candidates.filter((candidate) => (currentFilter.statuses as readonly CandidateStatus[]).includes(candidate.status)) : candidates;
  const ordered = [...visible].sort((a, b) => {
    const priority = (status: CandidateStatus) => status === "NEEDS_REVIEW" ? 0 : status === "SHORTLISTED" ? 1 : 2;
    return priority(a.status) - priority(b.status);
  });

  return (
    <main className="mx-auto min-h-[80vh] max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/recruiter" className="text-sm font-medium text-primary hover:underline">← Toutes les offres</Link>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Candidatures</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{job.title}</h1>
            <Badge variant={job.isActive ? "default" : "secondary"}>{job.isActive ? "Publiée" : "En pause"}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{job.location || "Lieu non précisé"} · {candidates.length} {candidates.length === 1 ? "dossier" : "dossiers"}</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl"><Link href={`/recruiter/jobs/${jobId}/questions`}>Configurer l’offre</Link></Button>
      </div>

      <nav aria-label="Filtrer les candidatures" className="mb-6 mt-8 flex flex-wrap gap-2 border-b border-[#d9e5f2] pb-4">
        {filters.map((item) => {
          const count = item.statuses ? candidates.filter((candidate) => (item.statuses as readonly CandidateStatus[]).includes(candidate.status)).length : candidates.length;
          return <Link key={item.key} href={item.key === "all" ? `/recruiter/jobs/${jobId}` : `/recruiter/jobs/${jobId}?status=${item.key}`} aria-current={currentFilter.key === item.key ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-medium ${currentFilter.key === item.key ? "bg-primary text-white" : "bg-white text-muted-foreground hover:text-primary"}`}>{item.label} <span className="ml-1 opacity-75">{count}</span></Link>;
        })}
      </nav>

      {ordered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cbdcf0] bg-white px-6 py-14 text-center">
          <h2 className="font-semibold">{candidates.length === 0 ? "Aucune candidature reçue" : "Aucun dossier dans cette catégorie"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{candidates.length === 0 ? "Les candidatures apparaîtront ici après leur envoi." : "Choisissez un autre filtre pour voir les autres dossiers."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((candidate) => (
            <div key={candidate.id} className="flex flex-col gap-4 rounded-2xl border border-[#d9e5f2] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{candidate.name}</h2>
                  <Badge variant={candidate.status === "REJECTED" ? "destructive" : candidate.status === "NEEDS_REVIEW" ? "secondary" : "outline"}>{statusLabels[candidate.status]}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{candidate.email}</p>
                <p className="mt-2 text-xs text-muted-foreground">Reçue le {new Date(candidate.appliedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}{candidate.evaluation ? ` · Score IA : ${candidate.evaluation.score}/100` : ""}</p>
              </div>
              <Button asChild variant={candidate.status === "NEEDS_REVIEW" ? "default" : "outline"} className="shrink-0 rounded-xl">
                <Link href={`/recruiter/jobs/${jobId}/candidates/${candidate.id}`}>Voir le dossier →</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
