import { auth } from "@/lib/auth";
import { APPLICATION_TEMPLATES, applicationFormSchema } from "@/lib/application-fields";
import { formSelection, readRecruiterForm } from "@/lib/recruiter-form";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.union([
  z.object({ template: z.enum(["simple", "profil"]) }),
  applicationFormSchema.safeExtend({ editorRevision: z.string().length(64).optional() }),
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, select: { createdById: true, applicationFields: { orderBy: { order: "asc" } }, applicationRules: { orderBy: { order: "asc" } } } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if ((session.user as { role?: string }).role !== "ADMIN" && job.createdById !== session.user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    fields: job.applicationFields.map(({ options, ...field }) => ({ ...field, options: JSON.parse(options) })),
    rules: job.applicationRules.map(({ conditions, ...rule }) => ({ ...rule, conditions: JSON.parse(conditions) })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, select: { createdById: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if ((session.user as { role?: string }).role !== "ADMIN" && job.createdById !== session.user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  const fields = "template" in parsed.data ? APPLICATION_TEMPLATES[parsed.data.template] : parsed.data.fields;
  const rules = "template" in parsed.data ? [] : parsed.data.rules;

  try {
    const editorRevision = "editorRevision" in parsed.data ? parsed.data.editorRevision : undefined;
    const revision = await prisma.$transaction(async (tx) => {
      if (await tx.candidate.count({ where: { jobId: id } })) throw new Error("FIELDS_LOCKED");
      if (editorRevision) {
        const stored = await tx.job.findUniqueOrThrow({ where: { id }, select: formSelection });
        if (readRecruiterForm(stored).revision !== editorRevision) throw new Error("FORM_CHANGED");
        if (stored.screeningQuestions.length) await tx.screeningQuestion.deleteMany({ where: { jobId: id } });
      }
      await tx.applicationRule.deleteMany({ where: { jobId: id, key: { notIn: rules.map(rule => rule.key) } } });
      await tx.applicationField.deleteMany({ where: { jobId: id, key: { notIn: fields.map(field => field.key) } } });
      for (const [order, field] of fields.entries()) {
        const data = {
          label: field.label, type: field.type, required: field.required, options: JSON.stringify(field.options),
          minValue: field.minValue, maxValue: field.maxValue, flagOutsideRange: field.flagOutsideRange,
          maxFiles: field.type === "FILES" ? field.maxFiles ?? 5 : 1, order,
        };
        await tx.applicationField.upsert({
          where: { jobId_key: { jobId: id, key: field.key } },
          create: { jobId: id, key: field.key, ...data }, update: data,
        });
      }
      for (const [order, rule] of rules.entries()) {
        const data = { label: rule.label, mode: rule.mode, action: rule.action, conditions: JSON.stringify(rule.conditions), order };
        await tx.applicationRule.upsert({
          where: { jobId_key: { jobId: id, key: rule.key } },
          create: { jobId: id, key: rule.key, ...data }, update: data,
        });
      }
      if (editorRevision) return readRecruiterForm(await tx.job.findUniqueOrThrow({ where: { id }, select: formSelection })).revision;
    });
    return NextResponse.json({ ok: true, fields: fields.length, rules: rules.length, revision });
  } catch (error) {
    if (error instanceof Error && error.message === "FORM_CHANGED") return NextResponse.json({ error: "Le formulaire a été modifié dans une autre session. Rechargez la page pour reprendre la dernière version." }, { status: 409 });
    if (error instanceof Error && error.message === "FIELDS_LOCKED") return NextResponse.json({ error: "Le formulaire est figé depuis la première candidature." }, { status: 409 });
    throw error;
  }
}
