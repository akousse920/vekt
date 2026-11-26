import { auth } from "@/lib/auth";
import { APPLICATION_TEMPLATES, applicationFormSchema } from "@/lib/application-fields";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.union([
  z.object({ template: z.enum(["simple", "profil"]) }),
  applicationFormSchema,
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
    await prisma.$transaction(async (tx) => {
      if (await tx.candidate.count({ where: { jobId: id } })) throw new Error("FIELDS_LOCKED");
      await tx.applicationRule.deleteMany({ where: { jobId: id } });
      await tx.applicationField.deleteMany({ where: { jobId: id } });
      for (const [order, field] of fields.entries()) {
        await tx.applicationField.create({
          data: { jobId: id, key: field.key, label: field.label, type: field.type, required: field.required,
            options: JSON.stringify(field.options), minValue: field.minValue, maxValue: field.maxValue,
            flagOutsideRange: field.flagOutsideRange, maxFiles: field.type === "FILES" ? field.maxFiles ?? 5 : 1, order },
        });
      }
      for (const [order, rule] of rules.entries()) {
        await tx.applicationRule.create({
          data: { jobId: id, key: rule.key, label: rule.label, mode: rule.mode, action: rule.action,
            conditions: JSON.stringify(rule.conditions), order },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "FIELDS_LOCKED") return NextResponse.json({ error: "Le formulaire est figé depuis la première candidature." }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true, fields: fields.length, rules: rules.length });
}
