import { EmailType } from "@/generated/client";
import { getCompanyName } from "@/lib/brand";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { createStatusToken, createUnsubscribeToken } from "@/lib/public-tokens";
import { getMailer } from "@/lib/mailer";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function getStatusPageUrl(candidateId: string): string {
  return `${APP_URL}/status/${createStatusToken(candidateId)}`;
}

export function getUnsubscribeUrl(candidateId: string): string {
  return `${APP_URL}/api/unsubscribe?token=${createUnsubscribeToken(candidateId)}`;
}

interface SendEmailOptions {
  candidateId: string;
  type: EmailType;
}

/**
 * Sends a transactional email to a candidate based on the stored template for `type`.
 *
 * Respects `emailOptOut` — except for DATA_RETENTION_WARNING which is always
 * dispatched as a legal GDPR obligation.
 *
 * Throws on send failure so Inngest can retry the step.
 */
export async function sendCandidateEmail({ candidateId, type }: SendEmailOptions): Promise<void> {
  const sendMail = getMailer();
  if (!sendMail) {
    logger.warn({ candidateId, type }, "Email: neither SMTP_HOST nor RESEND_API_KEY set, skipping");
    return;
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { job: true },
  });

  if (!candidate) {
    logger.warn({ candidateId, type }, "Email: candidate not found, skipping");
    return;
  }

  if (candidate.emailOptOut && type !== EmailType.DATA_RETENTION_WARNING) {
    logger.info({ candidateId, type }, "Email: candidate opted out, skipping");
    return;
  }

  const template = await prisma.emailTemplate.findUnique({ where: { type } });
  if (!template) {
    logger.warn({ candidateId, type }, "Email: no template configured, skipping");
    return;
  }

  const retentionSetting = await prisma.setting.findUnique({ where: { key: "RETENTION_DAYS" } });
  const companyName = await getCompanyName();
  const retentionDays = retentionSetting ? parseInt(retentionSetting.value, 10) : 90;
  const retentionDate = new Date(candidate.appliedAt);
  retentionDate.setDate(retentionDate.getDate() + retentionDays);

  const vars: Record<string, string> = {
    candidateName: candidate.name,
    jobTitle: candidate.job?.title ?? "General Position",
    companyName,
    statusPageUrl: getStatusPageUrl(candidateId),
    retentionDate: retentionDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };

  const subject = interpolate(template.subject, vars);
  const renderedBody = interpolate(template.body, vars);

  const unsubscribeFooter = `<p style="font-size:11px;color:#9ca3af;margin-top:24px;text-align:center;">
    Vous recevez cet e-mail parce que vous avez postulé via ${companyName.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)}.<br>
    <a href="${getUnsubscribeUrl(candidateId)}" style="color:#9ca3af;">Unsubscribe</a> from application updates.
  </p>`;

  const html = `${renderedBody}${unsubscribeFooter}`;

  try {
    const messageId = await sendMail({ to: candidate.email, subject, html });

    await prisma.emailLog.create({
      data: { candidateId, type, resendId: messageId },
    });

    logger.info({ candidateId, type, messageId }, "Email: sent");
  } catch (err) {
    logger.error({ candidateId, type, err }, "Email: send failed");
    throw err; // Re-throw so Inngest retries the step
  }
}
