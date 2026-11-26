import { ScreeningOperator } from "@/generated/client";
import { evaluateApplicationRules } from "@/lib/application-rules";
import { prisma } from "@/lib/prisma";

export type ScreeningReason = {
  stage: "SCREENING" | "DOCUMENT" | "APPLICATION_FORM";
  ruleId: string | null;
  detail: string;
};

type Rule = {
  id: string;
  questionId: string;
  operator: ScreeningOperator;
  value: string;
  mandatory: boolean;
  question: { text: string; type: "SINGLE" | "MULTIPLE" | "TEXT" };
};

type Answer = { questionId: string; option: { text: string } };

function numericValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function ruleMatches(rule: Rule, values: string[]): boolean | null {
  if (values.length === 0) return null;
  switch (rule.operator) {
    case ScreeningOperator.EQUALS:
      return values.some((value) => value === rule.value);
    case ScreeningOperator.NOT_EQUALS:
      return values.every((value) => value !== rule.value);
    case ScreeningOperator.IN: {
      try {
        const allowed: unknown = JSON.parse(rule.value);
        if (!Array.isArray(allowed) || !allowed.every((value) => typeof value === "string")) return null;
        return values.some((value) => allowed.includes(value));
      } catch {
        return null;
      }
    }
    case ScreeningOperator.GTE:
    case ScreeningOperator.LTE: {
      if (values.length !== 1 || rule.question.type !== "SINGLE") return null;
      const actual = numericValue(values[0]);
      const expected = numericValue(rule.value);
      if (actual === null || expected === null) return null;
      return rule.operator === ScreeningOperator.GTE
        ? actual >= expected
        : actual <= expected;
    }
  }
}

export function evaluateScreeningRules(
  rules: Rule[],
  answers: Answer[],
  resumeText: string,
  options: { requireResumeText?: boolean } = {},
): { needsReview: boolean; reasons: ScreeningReason[] } {
  let needsReview = false;
  const reasons: ScreeningReason[] = [];

  if (options.requireResumeText !== false && !resumeText.trim()) {
    needsReview = true;
    reasons.push({ stage: "DOCUMENT", ruleId: null, detail: "Le texte du CV est absent ou son extraction a échoué." });
  }

  for (const rule of rules) {
    const values = answers
      .filter((answer) => answer.questionId === rule.questionId)
      .map((answer) => answer.option.text.trim());
    const matches = ruleMatches(rule, values);
    if (matches === true) continue;
    const detail = matches === null
      ? `Réponse manquante ou non interprétable : ${rule.question.text}`
      : `Critère non satisfait : ${rule.question.text} (${rule.operator} ${rule.value})`;
    reasons.push({ stage: "SCREENING", ruleId: rule.id, detail });
    if (matches === null || rule.mandatory) needsReview = true;
  }

  return { needsReview, reasons };
}

export async function assessCandidateScreening(
  candidateId: string,
  jobId: string | null,
  resumeText: string,
  options: { requireResumeText?: boolean } = {},
) {
  const [rules, answers, applicationRules, applicationFields, applicationAnswers] = await Promise.all([
    jobId
      ? prisma.screeningRule.findMany({
          where: { jobId },
          include: { question: { select: { text: true, type: true } } },
        })
      : Promise.resolve([]),
    prisma.candidateAnswer.findMany({
      where: { candidateId },
      include: { option: { select: { text: true } } },
    }),
    jobId
      ? prisma.applicationRule.findMany({ where: { jobId }, orderBy: { order: "asc" } })
      : Promise.resolve([]),
    jobId
      ? prisma.applicationField.findMany({ where: { jobId }, select: { id: true, key: true, type: true } })
      : Promise.resolve([]),
    prisma.applicationAnswer.findMany({ where: { candidateId }, select: { fieldId: true, value: true } }),
  ]);
  const screening = evaluateScreeningRules(rules, answers, resumeText, options);
  const application = evaluateApplicationRules(applicationRules, applicationFields, applicationAnswers);
  return { needsReview: screening.needsReview || application.needsReview, reasons: [...screening.reasons, ...application.reasons] };
}
