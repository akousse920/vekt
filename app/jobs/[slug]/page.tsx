import { getCompanyName } from "@/lib/brand";
import { isApplicationClosed } from "@/lib/application-deadline";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize-html";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import ApplyForm from "./ApplyForm";

export const dynamic = "force-dynamic";

/** Plain-text excerpt of the (HTML) job description for link previews: its first paragraph. */
function excerpt(html: string, max = 160): string {
  const firstParagraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  const text = sanitizeHtml(firstParagraph.replace(/<\/(p|li|h[1-6])>/gi, " "), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await prisma.job.findUnique({
    where: { slug, isActive: true },
    select: { title: true, description: true, location: true },
  });
  if (!job) return {};

  const companyName = await getCompanyName();
  const title = `${job.title} - ${companyName}`;
  const location = job.location ? `${job.location} · ` : "";
  const description = `${location}${excerpt(job.description)}`;
  return {
    title,
    description,
    // Page-level openGraph replaces the layout's, so repeat the shared fields.
    openGraph: { title, description, url: `/jobs/${slug}`, siteName: companyName, locale: "fr_FR", type: "website" },
  };
}

export default async function JobApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const job = await prisma.job.findUnique({
    where: { slug, isActive: true },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      applicationDeadline: true,
      applicationFields: {
        orderBy: { order: "asc" },
        select: { id: true, key: true, label: true, type: true, required: true, options: true, minValue: true, maxValue: true, flagOutsideRange: true, maxFiles: true },
      },
      screeningQuestions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          text: true,
          type: true,
          options: {
            orderBy: { order: "asc" },
            select: { id: true, text: true },
          },
        },
      },
    },
  });

  if (!job) {
    notFound();
  }

  return (
    <ApplyForm
      job={{ ...job, applicationDeadline: job.applicationDeadline?.toISOString() ?? null, description: sanitizeRichText(job.description) }}
      closed={isApplicationClosed(job.applicationDeadline)}
      supportEmail={process.env.SUPPORT_EMAIL || "example-support@email.com"}
      aiEnabled={["openai", "openrouter", "ollama"].includes((process.env.AI_PROVIDER ?? "none").toLowerCase())}
    />
  );
}
