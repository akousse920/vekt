import { CandidateStatus } from "@/generated/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import JobListingsSection from "./JobListingsSection";

const PAGE_SIZE = 10;

export default async function RecruiterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  const currentUserId = session.user?.id;

  if (!isAdmin && !currentUserId) {
    redirect("/login");
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const listingStatus = (sp.status ?? "all") as "all" | "active" | "inactive";
  const listingPage = Math.max(1, parseInt(sp.page ?? "1") || 1);

  const listingWhere = {
    ...(q
      ? { OR: [{ title: { contains: q } }, { location: { contains: q } }] }
      : {}),
    ...(listingStatus === "active"
      ? { isActive: true }
      : listingStatus === "inactive"
        ? { isActive: false }
        : {}),
      ...(!isAdmin && currentUserId ? { createdById: currentUserId } : {}),
  };

  const [jobs, listingTotal, reviewCount] = await Promise.all([
    prisma.job.findMany({
      where: listingWhere,
      orderBy: { createdAt: "desc" },
      skip: (listingPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        location: true,
        isActive: true,
        notifyOnApplication: true,
        _count: {
          select: {
            candidates: true,
            screeningQuestions: true,
          },
        },
      },
    }),
    prisma.job.count({ where: listingWhere }),
    isAdmin ? prisma.candidate.count({ where: { status: CandidateStatus.NEEDS_REVIEW } }) : Promise.resolve(0),
  ]);
  const listingTotalPages = Math.max(1, Math.ceil(listingTotal / PAGE_SIZE));

  return (
    <div className="min-h-[89vh] bg-background">
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {isAdmin && reviewCount > 0 && (
          <Link href="/recruiter/all?status=review" className="mb-7 flex items-center justify-between gap-4 rounded-2xl border border-[#f6d3a6] bg-[#fff2e2] p-4 transition-colors hover:bg-[#ffe8ca]">
            <div>
              <p className="text-sm font-bold text-[#874d15]">Dossiers à examiner</p>
              <p className="mt-1 text-sm text-[#734c26]">{reviewCount} {reviewCount === 1 ? "candidature attend" : "candidatures attendent"} une décision humaine.</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#f39a35] px-4 py-2 text-sm font-semibold text-[#17375f]">Ouvrir →</span>
          </Link>
        )}
        <JobListingsSection
          listings={jobs}
          total={listingTotal}
          page={listingPage}
          totalPages={listingTotalPages}
          q={q}
          status={listingStatus}
        />
      </main>
    </div>
  );
}

