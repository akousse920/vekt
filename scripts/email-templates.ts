/**
 * Default (French) candidate email templates, inserted by scripts/seed.ts.
 * Placeholders: {{candidateName}}, {{jobTitle}}, {{companyName}},
 * {{statusPageUrl}}, {{retentionDate}}. Admins can edit them afterwards.
 */
import { EmailType } from "../generated/enums";

function layout(header: string, title: string, paragraphs: string[], button: string, footer: string): string {
  const body = paragraphs
    .map((text, i) => `    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 ${i === paragraphs.length - 1 ? 32 : 16}px;">${text}</p>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f9fafb;margin:0;padding:40px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e5e7eb;padding:40px;">
    <p style="font-size:12px;color:#9ca3af;margin:0 0 20px;text-transform:uppercase;letter-spacing:.05em;">${header}</p>
    <h1 style="font-size:20px;font-weight:600;color:#111827;margin:0 0 24px;">${title}</h1>
    <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 16px;">Bonjour {{candidateName}},</p>
${body}
    <div style="text-align:center;margin:0 0 32px;">
      <a href="{{statusPageUrl}}" style="background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;display:inline-block;">
        ${button}
      </a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
    <p style="font-size:12px;color:#9ca3af;margin:0;">${footer}</p>
  </div>
</body></html>`;
}

const FOOTER = "{{companyName}} · Propulsé par Vekt";
const STATUS_BUTTON = "Suivre ma candidature";

export const DEFAULT_EMAIL_TEMPLATES: { type: EmailType; subject: string; body: string }[] = [
  {
    type: EmailType.APPLIED,
    subject: "Candidature reçue - {{jobTitle}}",
    body: layout("{{companyName}}", "Candidature reçue", [
      "Merci d’avoir postulé au poste de <strong>{{jobTitle}}</strong>. Nous avons bien reçu votre candidature et notre équipe reviendra vers vous pour vous tenir informé(e) de la suite.",
      "Vous pouvez suivre l’avancement de votre candidature à tout moment grâce au lien ci-dessous.",
    ], STATUS_BUTTON, FOOTER),
  },
  {
    type: EmailType.SHORTLISTED,
    subject: "Votre candidature est présélectionnée - {{jobTitle}}",
    body: layout("{{companyName}}", "Bonne nouvelle !", [
      "Nous avons le plaisir de vous informer que votre candidature au poste de <strong>{{jobTitle}}</strong> a été présélectionnée. Notre équipe étudie votre profil et vous contactera prochainement pour la suite du processus.",
    ], STATUS_BUTTON, FOOTER),
  },
  {
    type: EmailType.REJECTED,
    subject: "Suite donnée à votre candidature - {{jobTitle}}",
    body: layout("{{companyName}}", "Suite donnée à votre candidature", [
      "Merci d’avoir pris le temps de postuler au poste de <strong>{{jobTitle}}</strong>. Après examen attentif, nous ne donnerons pas suite à votre candidature pour le moment.",
      "Nous vous remercions de l’intérêt que vous portez à {{companyName}} et vous encourageons à postuler à nos futures offres.",
    ], STATUS_BUTTON, FOOTER),
  },
  {
    type: EmailType.ACCEPTED,
    subject: "Félicitations, votre candidature au poste de {{jobTitle}} est retenue",
    body: layout("{{companyName}}", "Félicitations !", [
      "Nous avons le plaisir de vous annoncer que votre candidature au poste de <strong>{{jobTitle}}</strong> a été retenue. Un membre de notre équipe vous contactera très prochainement pour vous présenter les prochaines étapes.",
    ], STATUS_BUTTON, FOOTER),
  },
  {
    type: EmailType.DATA_RETENTION_WARNING,
    subject: "Important : vos données de candidature seront supprimées le {{retentionDate}}",
    body: layout("{{companyName}} · Protection des données", "Suppression prochaine de vos données", [
      "Conformément à notre politique de conservation des données et au RGPD, les données de votre candidature au poste de <strong>{{jobTitle}}</strong> (y compris votre CV et vos informations personnelles) seront définitivement supprimées le <strong>{{retentionDate}}</strong>.",
      "Si vous souhaitez en obtenir une copie avant leur suppression, suivez les instructions indiquées sur la page de suivi de votre candidature.",
    ], "Voir ma candidature et télécharger mes données", "{{companyName}} · Cet avis est envoyé au titre d’une obligation légale (RGPD) de conservation des données et ne peut pas être désactivé."),
  },
];
