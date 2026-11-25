import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize-html";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import JobDetailsForm from "../../JobDetailsForm";

export default async function EditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const { jobId } = await params;
  const job = await prisma.job.findFirst({
    where: { id: jobId, ...(!isAdmin ? { createdById: session.user?.id } : {}) },
    select: { id: true, title: true, location: true, description: true, customPrompt: true, threshold: true, isActive: true, notifyOnApplication: true },
  });
  if (!job) notFound();
  return (
    <main className="mx-auto min-h-[80vh] max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href={`/recruiter/jobs/${jobId}/questions`} className="text-sm font-medium text-primary hover:underline">← Configuration de l’offre</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-primary">Modifier le poste</p>
      <h1 className="mt-2 text-3xl font-bold">{job.title}</h1>
      <p className="mb-7 mt-2 text-sm text-muted-foreground">Mettez à jour la description ou la publication de l’offre.</p>
      <JobDetailsForm job={{ ...job, description: sanitizeRichText(job.description) }} aiEnabled={["openai", "openrouter", "ollama"].includes((process.env.AI_PROVIDER ?? "none").toLowerCase())} />
    </main>
  );
}
