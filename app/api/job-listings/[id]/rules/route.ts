import { Prisma, ScreeningOperator } from "@/generated/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSensitiveScreeningQuestion } from "@/lib/screening-policy";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ruleSchema = z.object({
  questionId: z.string().cuid(),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "IN", "GTE", "LTE"]),
  value: z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).min(1).max(10)]),
  mandatory: z.boolean(),
});
const bodySchema = z.object({ rules: z.array(ruleSchema).max(20) });
class RulesLockedError extends Error {}

async function authorizedJob(id: string) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true, createdById: true },
  });
  if (!job) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin && job.createdById !== session.user?.id) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { job };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await authorizedJob(id);
  if (access.error) return access.error;
  const rules = await prisma.screeningRule.findMany({
    where: { jobId: id },
    include: { question: { select: { text: true, type: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ rules });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await authorizedJob(id);
  if (access.error) return access.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid rules", details: parsed.error.flatten() }, { status: 400 });

  const questions = await prisma.screeningQuestion.findMany({
    where: { jobId: id },
    include: { options: { select: { text: true } } },
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const rows: Prisma.ScreeningRuleCreateManyInput[] = [];
  for (const rule of parsed.data.rules) {
    const question = byId.get(rule.questionId);
    if (!question || seen.has(rule.questionId)) {
      return NextResponse.json({ error: "Unknown or duplicate question" }, { status: 400 });
    }
    if (question.type === "TEXT") {
      return NextResponse.json({ error: "Free-text questions require human review and cannot have automatic rules" }, { status: 400 });
    }
    if (isSensitiveScreeningQuestion(question.text)) {
      return NextResponse.json({ error: "Cette question concerne une caractéristique personnelle et ne peut pas servir de critère automatique." }, { status: 400 });
    }
    seen.add(rule.questionId);
    const options = new Set(question.options.map((option) => option.text.trim()));
    const isNumeric = (value: string) => /^-?\d+(?:[.,]\d+)?$/.test(value.trim());
    const isIn = rule.operator === ScreeningOperator.IN;
    if (isIn !== Array.isArray(rule.value)) {
      return NextResponse.json({ error: "IN requires an array; other operators require a string" }, { status: 400 });
    }
    if (Array.isArray(rule.value)) {
      if (!rule.value.every((value) => options.has(value.trim()))) {
        return NextResponse.json({ error: "Rule value must match a question option" }, { status: 400 });
      }
    } else if (rule.operator === ScreeningOperator.GTE || rule.operator === ScreeningOperator.LTE) {
      if (question.type !== "SINGLE" || !isNumeric(rule.value) || !question.options.every((option) => isNumeric(option.text))) {
        return NextResponse.json({ error: "Numeric rules require a single-choice question with numeric options" }, { status: 400 });
      }
    } else if (!options.has(rule.value.trim())) {
      return NextResponse.json({ error: "Rule value must match a question option" }, { status: 400 });
    }
    rows.push({
      jobId: id,
      questionId: rule.questionId,
      operator: rule.operator,
      value: Array.isArray(rule.value) ? JSON.stringify(rule.value.map((value) => value.trim())) : rule.value.trim(),
      mandatory: rule.mandatory,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Keep this check and replacement in one transaction so the active grid
      // cannot be changed after applications have started arriving.
      if (await tx.candidate.count({ where: { jobId: id } })) throw new RulesLockedError();
      await tx.screeningRule.deleteMany({ where: { jobId: id } });
      if (rows.length) await tx.screeningRule.createMany({ data: rows });
    });
  } catch (error) {
    if (error instanceof RulesLockedError) {
      return NextResponse.json({ error: "Rules cannot be changed after applications exist" }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
