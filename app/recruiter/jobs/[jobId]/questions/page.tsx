import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import JobSetupSteps from "../../JobSetupSteps";
import RubricEditor from "../RubricEditor";
import FormEditor from "./FormEditor";
import { formSelection, readRecruiterForm } from "@/lib/recruiter-form";

export default async function JobQuestionsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin && !session.user?.id) redirect("/login");
  const { jobId } = await params;
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...(!isAdmin ? { createdById: session.user?.id } : {}) },
    select: {
      id: true, title: true, slug: true, isActive: true,
      ...formSelection,
      rubricCriteria: { orderBy: { order: "asc" }, select: { label: true, weight: true, required: true } },
      _count: { select: { candidates: true } },
    },
  });
  if (!job) notFound();
  const aiEnabled = ["openai", "openrouter", "ollama"].includes((process.env.AI_PROVIDER ?? "none").toLowerCase());

  return (
    <main className="mx-auto min-h-[80vh] max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/recruiter" className="text-sm font-medium text-primary hover:underline">← Toutes les offres</Link>
      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Configuration de l’offre</p>
          <h1 className="mt-2 text-3xl font-bold">{job.title}</h1>
        </div>
        <Button asChild variant="outline" className="rounded-xl"><Link href={`/recruiter/jobs/${jobId}`}>Voir les candidatures</Link></Button>
      </div>
      <JobSetupSteps current="questions" jobId={jobId} />
      <div className="space-y-6">
        <FormEditor key={job.id} jobId={job.id} initial={readRecruiterForm(job)} locked={job._count.candidates > 0} publicSlug={job.isActive ? job.slug : null} />
        {isAdmin && aiEnabled && <RubricEditor jobId={jobId} initialCriteria={job.rubricCriteria} locked={job._count.candidates > 0} />}
      </div>
    </main>
  );
}
