import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  criteria: z.array(z.object({
    label: z.string().trim().min(2).max(100),
    weight: z.number().int().min(1).max(100),
    required: z.boolean(),
  })).max(10),
});
class RubricLockedError extends Error {}

async function accessFor(jobId: string) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { createdById: true } });
  if (!job) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin && job.createdById !== session.user?.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { isAdmin };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await accessFor(id);
  if (access.error) return access.error;
  const criteria = await prisma.rubricCriterion.findMany({
    where: { jobId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ criteria });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await accessFor(id);
  if (access.error) return access.error;
  if (!access.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid rubric", details: parsed.error.flatten() }, { status: 400 });
  const criteria = parsed.data.criteria;
  if (criteria.length > 0 && criteria.reduce((sum, item) => sum + item.weight, 0) !== 100) {
    return NextResponse.json({ error: "Weights must total 100" }, { status: 400 });
  }
  if (new Set(criteria.map((item) => item.label.toLocaleLowerCase())).size !== criteria.length) {
    return NextResponse.json({ error: "Duplicate skill labels" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.candidate.count({ where: { jobId: id } })) throw new RubricLockedError();
      await tx.rubricCriterion.deleteMany({ where: { jobId: id } });
      if (criteria.length) {
        await tx.rubricCriterion.createMany({
          data: criteria.map((item, order) => ({ jobId: id, ...item, order })),
        });
      }
    });
  } catch (error) {
    if (error instanceof RubricLockedError) {
      return NextResponse.json({ error: "Rubric cannot be changed after applications exist" }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
