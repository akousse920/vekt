import { auth } from "@/lib/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { jobSchema } from "@/lib/schemas";
import { deadlineFromDateOnly } from "@/lib/application-deadline";
import { applicationFilePaths } from "@/lib/application-file-paths";
import { generateSlug } from "@/lib/utils";
import { unlink } from "fs/promises";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

async function getCurrentDbUser(session: Session | null) {
  const email = session?.user?.email;
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, email: true },
  });
}

async function generateUniqueSlug(title: string, excludeId: string): Promise<string> {
  const base = generateSlug(title) || "job";
  let slug = base;
  let counter = 2;
  while (true) {
    const existing = await prisma.job.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) break;
    slug = `${base}-${counter++}`;
  }
  return slug;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getCurrentDbUser(session);
  if (!currentUser) {
    return NextResponse.json({ error: "Session is stale. Please sign in again." }, { status: 401 });
  }

  const { id } = await params;

  // Check ownership — admins can edit any job, recruiters only their own
  if (currentUser.role !== "ADMIN") {
    const job = await prisma.job.findUnique({ where: { id }, select: { createdById: true } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (job.createdById !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();

    // Toggle-only call (just isActive boolean)
    if (Object.keys(body).length === 1 && "isActive" in body) {
      const job = await prisma.job.update({
        where: { id },
        data: { isActive: body.isActive },
      });
      logger.info({ jobId: id, isActive: job.isActive }, "API: job toggled");
      return NextResponse.json(job);
    }

    // Full update — validate all editable fields
    const validation = jobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 },
      );
    }
    const description = sanitizeRichText(validation.data.description);
    const slug = await generateUniqueSlug(validation.data.title, id);
    const { applicationDeadlineDate, ...jobData } = validation.data;
    const job = await prisma.job.update({
      where: { id },
      data: { ...jobData, description, slug, ...(applicationDeadlineDate !== undefined ? { applicationDeadline: deadlineFromDateOnly(applicationDeadlineDate) } : {}) },
    });
    logger.info({ jobId: id }, "API: job updated");
    return NextResponse.json(job);
  } catch (err) {
    logger.error({ err }, "API: PATCH /api/job-listings/[id] error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getCurrentDbUser(session);
  if (!currentUser) {
    return NextResponse.json({ error: "Session is stale. Please sign in again." }, { status: 401 });
  }

  const { id } = await params;

  // Check ownership — admins can delete any job, recruiters only their own
  if (currentUser.role !== "ADMIN") {
    const job = await prisma.job.findUnique({ where: { id }, select: { createdById: true } });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (job.createdById !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const attachments = await prisma.applicationAnswer.findMany({
      where: { field: { jobId: id, type: { in: ["FILE", "FILES"] } } },
      select: { value: true, field: { select: { type: true } } },
    });
    await prisma.job.delete({ where: { id } });
    await Promise.allSettled(attachments.flatMap(({ value, field }) => applicationFilePaths(value, field.type)).map((storedPath) => {
      const filename = path.basename(storedPath);
      return /^[a-f0-9-]{36}\.pdf$/i.test(filename)
        ? unlink(path.join(process.cwd(), "private", "uploads", filename))
        : Promise.resolve();
    }));
    logger.info({ jobId: id }, "API: job deleted");
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, "API: DELETE /api/job-listings/[id] error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

