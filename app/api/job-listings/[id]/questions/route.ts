import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSensitiveScreeningQuestion } from "@/lib/screening-policy";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const optionSchema = z.object({
  text: z.string().min(1).max(100),
});

const ruleSchema = z.object({
  operator: z.enum(["EQUALS", "NOT_EQUALS", "IN", "GTE", "LTE"]),
  value: z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).min(1).max(10)]),
  mandatory: z.boolean(),
});

const questionSchema = z.discriminatedUnion("type", [
  z.object({ text: z.string().min(1).max(500), type: z.literal("SINGLE"), options: z.array(optionSchema).min(2).max(10), rule: ruleSchema.nullable().optional() }),
  z.object({ text: z.string().min(1).max(500), type: z.literal("MULTIPLE"), options: z.array(optionSchema).min(2).max(10), rule: ruleSchema.nullable().optional() }),
  z.object({ text: z.string().min(1).max(500), type: z.literal("TEXT"), options: z.array(optionSchema).length(0), rule: ruleSchema.nullable().optional() }),
]);

const putBodySchema = z.object({
  questions: z.array(questionSchema).max(20),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Only return questions for active jobs — prevents enumeration of
  // closed/archived job screening criteria by external parties.
  const job = await prisma.job.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!job || !job.isActive) {
    return NextResponse.json({ questions: [] });
  }

  const questions = await prisma.screeningQuestion.findMany({
    where: { jobId: id },
    orderBy: { order: "asc" },
    select: {
      id: true,
      text: true,
      type: true,
      order: true,
      options: {
        orderBy: { order: "asc" },
        select: { id: true, text: true, order: true },
      },
    },
  });

  return NextResponse.json({ questions });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    select: { createdById: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";
  if (!isAdmin && job.createdById !== session.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  for (const question of parsed.data.questions) {
    const rule = question.rule;
    if (!rule) continue;
    if (question.type === "TEXT" || isSensitiveScreeningQuestion(question.text)) {
      return NextResponse.json({ error: "Cette question ne peut pas servir de critère automatique." }, { status: 400 });
    }
    const options = new Set(question.options.map((option) => option.text.trim()));
    const numeric = (value: string) => /^-?\d+(?:[.,]\d+)?$/.test(value.trim());
    if (rule.operator === "IN") {
      if (!Array.isArray(rule.value) || !rule.value.every((value) => options.has(value.trim()))) {
        return NextResponse.json({ error: "Choisissez des réponses proposées pour le critère." }, { status: 400 });
      }
    } else if (Array.isArray(rule.value)) {
      return NextResponse.json({ error: "Une seule valeur est attendue pour ce critère." }, { status: 400 });
    } else if (rule.operator === "GTE" || rule.operator === "LTE") {
      if (question.type !== "SINGLE" || !numeric(rule.value) || !question.options.every((option) => numeric(option.text))) {
        return NextResponse.json({ error: "Ce critère exige des réponses numériques à choix unique." }, { status: 400 });
      }
    } else if (!options.has(rule.value.trim())) {
      return NextResponse.json({ error: "La réponse attendue doit correspondre à un choix proposé." }, { status: 400 });
    }
  }

  // Replacing questions after an application would destroy its answer history.
  const existingCandidateCount = await prisma.candidate.count({ where: { jobId: id } });
  if (existingCandidateCount > 0) {
    return NextResponse.json(
      {
        error:
          "Les questions ne peuvent plus être remplacées après la première candidature afin de conserver les réponses reçues.",
      },
      { status: 409 },
    );
  }

  // Replace questions and their rules together so the form has one save action.
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.candidate.count({ where: { jobId: id } })) throw new Error("QUESTIONS_LOCKED");
      await tx.screeningQuestion.deleteMany({ where: { jobId: id } });

      for (let qi = 0; qi < parsed.data.questions.length; qi++) {
      const q = parsed.data.questions[qi];
      const created = await tx.screeningQuestion.create({
        data: {
          jobId: id,
          text: q.text,
          type: q.type,
          order: qi,
          options: {
            create: q.options.map((opt, oi) => ({
              text: opt.text,
              order: oi,
            })),
          },
        },
      });
      if (q.rule) {
        await tx.screeningRule.create({
          data: {
            jobId: id,
            questionId: created.id,
            operator: q.rule.operator,
            value: Array.isArray(q.rule.value) ? JSON.stringify(q.rule.value.map((value) => value.trim())) : q.rule.value.trim(),
            mandatory: q.rule.mandatory,
          },
        });
      }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "QUESTIONS_LOCKED") {
      return NextResponse.json({ error: "Les questions sont figées depuis la première candidature." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
