import { DEFAULT_COMPANY_NAME, getCompanyName } from "@/lib/brand";
import logger from "@/lib/logger";
import { getMailer } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

type NotificationJob = {
  notifyOnApplication: boolean;
  createdBy: { email: string } | null;
};

export function recruiterNotificationRecipient(job: NotificationJob | null): string | null {
  return job?.notifyOnApplication ? job.createdBy?.email ?? null : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

export function buildRecruiterApplicationEmail(jobTitle: string, jobId: string, appUrl: string, companyName = DEFAULT_COMPANY_NAME) {
  const title = escapeHtml(jobTitle);
  const jobUrl = new URL(`/recruiter/jobs/${encodeURIComponent(jobId)}`, appUrl).toString();
  return {
    subject: `Nouvelle candidature - ${jobTitle.replace(/[\r\n]+/g, " ")}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#193653;line-height:1.6">
      <h1 style="font-size:22px">Nouvelle candidature reçue</h1>
      <p>Une nouvelle candidature a été déposée pour l’offre <strong>${title}</strong>.</p>
      <p><a href="${escapeHtml(jobUrl)}">Consulter les candidatures de cette offre</a></p>
      <p style="font-size:13px;color:#526a83">Vous pouvez désactiver ces alertes dans les paramètres de l’offre.</p>
      <p style="font-size:13px;color:#526a83">${escapeHtml(companyName)}</p>
    </div>`,
  };
}

export async function sendRecruiterApplicationEmail(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      job: {
        select: {
          id: true, title: true, notifyOnApplication: true,
          createdBy: { select: { email: true } },
        },
      },
    },
  });
  const job = candidate?.job ?? null;
  const recipient = recruiterNotificationRecipient(job);
  if (!job || !recipient) return;

  const sendMail = getMailer();
  if (!sendMail) {
    logger.warn({ candidateId }, "Recruiter email: neither SMTP_HOST nor RESEND_API_KEY set, skipping");
    return;
  }

  const { subject, html } = buildRecruiterApplicationEmail(
    job.title,
    job.id,
    process.env.APP_URL ?? "http://localhost:3000",
    await getCompanyName(),
  );
  const messageId = await sendMail({ to: recipient, subject, html });
  logger.info({ candidateId, jobId: job.id, messageId }, "Recruiter email: sent");
}
