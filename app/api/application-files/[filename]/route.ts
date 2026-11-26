import { auth } from "@/lib/auth";
import { recruiterVisibleCandidateWhere } from "@/lib/candidate-access";
import { applicationFilePaths } from "@/lib/application-file-paths";
import { prisma } from "@/lib/prisma";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { Readable } from "stream";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.pdf$/i.test(filename)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin && !session.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requestedPath = `/api/application-files/${filename}`;
  const answers = await prisma.applicationAnswer.findMany({
    where: {
      value: { contains: filename },
      field: { type: { in: ["FILE", "FILES"] } },
      candidate: recruiterVisibleCandidateWhere(session.user?.id, isAdmin),
    },
    select: { value: true, field: { select: { type: true } } },
  });
  if (!answers.some((answer) => applicationFilePaths(answer.value, answer.field.type).includes(requestedPath))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const filePath = path.join(process.cwd(), "private", "uploads", filename);
  try { await stat(filePath); } catch { return NextResponse.json({ error: "Not found" }, { status: 404 }); }
  return new NextResponse(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" },
  });
}
