import { COMPANY_NAME } from "@/lib/brand";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

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

export function buildRecruiterApplicationEmail(jobTitle: string, jobId: string, appUrl: string) {
  const title = escapeHtml(jobTitle);
  const jobUrl = new URL(`/recruiter/jobs/${encodeURIComponent(jobId)}`, appUrl).toString();
  return {
    subject: `Nouvelle candidature — ${jobTitle.replace(/[\r\n]+/g, " ")}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#193653;line-height:1.6">
      <h1 style="font-size:22px">Nouvelle candidature reçue</h1>
      <p>Une nouvelle candidature a été déposée pour l’offre <strong>${title}</strong>.</p>
      <p><a href="${escapeHtml(jobUrl)}">Consulter les candidatures de cette offre</a></p>
      <p style="font-size:13px;color:#526a83">Vous pouvez désactiver ces alertes dans les paramètres de l’offre.</p>
      <p style="font-size:13px;color:#526a83">${escapeHtml(COMPANY_NAME)}</p>
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

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn({ candidateId }, "Recruiter email: RESEND_API_KEY not set, skipping");
    return;
  }

  const { subject, html } = buildRecruiterApplicationEmail(
    job.title,
    job.id,
    process.env.APP_URL ?? "http://localhost:3000",
  );
  const { data, error } = await new Resend(key).emails.send({
    from: process.env.EMAIL_FROM ?? "noreply@vekt.io",
    to: recipient,
    subject,
    html,
  });
  if (error) throw new Error(error.message);
  logger.info({ candidateId, jobId: job.id, resendId: data?.id }, "Recruiter email: sent");
}
