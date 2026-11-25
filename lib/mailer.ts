import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "noreply@vekt.io";

interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

/** Returns the provider-side message ID (Resend ID or SMTP Message-ID). */
type SendMail = (message: MailMessage) => Promise<string | null>;

let smtpTransport: Transporter | null = null;

function getSmtpTransport(): Transporter {
  if (!smtpTransport) {
    const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Implicit TLS on 465, STARTTLS otherwise (587)
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
        : undefined,
    });
  }
  return smtpTransport;
}

/**
 * Picks the email transport: SMTP when SMTP_HOST is set, otherwise Resend when
 * RESEND_API_KEY is set. Returns null when neither is configured.
 */
export function getMailer(): SendMail | null {
  if (process.env.SMTP_HOST) {
    return async ({ to, subject, html }) => {
      const info = await getSmtpTransport().sendMail({ from: FROM, to, subject, html });
      return info.messageId ?? null;
    };
  }

  const key = process.env.RESEND_API_KEY;
  if (key) {
    const resend = new Resend(key);
    return async ({ to, subject, html }) => {
      const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
      if (error) throw new Error(error.message);
      return data?.id ?? null;
    };
  }

  return null;
}
