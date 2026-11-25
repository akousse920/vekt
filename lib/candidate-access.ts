import { Prisma } from "@/generated/client";

// Keep this predicate at the database boundary for every recruiter read/write.
// Recruiters can consult all applications for offers they own from submission.
export function recruiterVisibleCandidateWhere(
  userId: string | undefined,
  isAdmin: boolean,
  extra: Prisma.CandidateWhereInput = {},
): Prisma.CandidateWhereInput {
  if (isAdmin) return extra;
  if (!userId) return { id: "__no_access__" };
  return {
    AND: [
      extra,
      { job: { is: { createdById: userId } } },
    ],
  };
}
