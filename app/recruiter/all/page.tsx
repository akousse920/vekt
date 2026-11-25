import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { recruiterVisibleCandidateWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { CandidateStatus } from "@/generated/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import CandidatesTable from "./CandidatesTable";

export default async function AllCandidatesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const currentUserId = session.user?.id;

  if (!isAdmin && !currentUserId) redirect("/login");
  const reviewOnly = isAdmin && (await searchParams).status === "review";

  const candidates = await prisma.candidate.findMany({
    where: recruiterVisibleCandidateWhere(currentUserId, isAdmin, reviewOnly ? { status: CandidateStatus.NEEDS_REVIEW } : {}),
    orderBy: { appliedAt: "desc" },
    include: {
      job: { select: { id: true, title: true } },
      evaluation: {
        select: {
          score: true,
          reasoning: true,
          pros: true,
          cons: true,
          promptSnapshot: true,
        },
      },
    },
  });

  return (
    <div className="min-h-[82vh] bg-background">
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <Link href="/recruiter" className="text-sm font-medium text-primary hover:underline">← Retour aux offres</Link>
        <h1 className="mt-4 text-3xl font-bold">Candidatures</h1>
        <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Examinez les dossiers et transmettez les profils pertinents aux recruteurs." : "Retrouvez toutes les candidatures de vos offres."}</p>
        {isAdmin && (
          <nav className="my-6 flex flex-wrap gap-2" aria-label="Filtrer les candidatures">
            <Link href="/recruiter/all?status=review" className={`rounded-full px-4 py-2 text-sm font-semibold ${reviewOnly ? "bg-primary text-white" : "border bg-white text-foreground"}`}>À revoir</Link>
            <Link href="/recruiter/all" className={`rounded-full px-4 py-2 text-sm font-semibold ${!reviewOnly ? "bg-primary text-white" : "border bg-white text-foreground"}`}>Toutes</Link>
          </nav>
        )}
        <Card className="border-[#d8e0e8] bg-white shadow-sm">
          <CardContent className="p-0">
            {candidates.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Aucune candidature dans cette vue.</p>
            ) : <CandidatesTable candidates={candidates} />}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
