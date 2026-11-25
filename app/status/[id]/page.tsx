import { AiDisclosure } from "@/components/ai-disclosure";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { verifyStatusToken } from "@/lib/public-tokens";
import {
    CheckCircleIcon,
    ClockIcon,
    HourglassMediumIcon,
    SparkleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";

export default async function StatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: token } = await params;
  const candidateId = verifyStatusToken(token);

  if (!candidateId) return notFound();

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      name: true,
      status: true,
      appliedAt: true,
      job: { select: { title: true } },
    },
  });

  if (!candidate) return notFound();

  const statusConfig = {
    APPLIED: {
      label: "Candidature reçue",
      description: "Votre candidature a bien été reçue. Son examen va commencer prochainement.",
      icon: <ClockIcon className="size-8 text-muted-foreground" weight="fill" />,
      variant: "secondary" as const,
    },
    ANALYZING: {
      label: "Analyse en cours",
      description: "Votre candidature est en cours d’analyse. Vous pourrez consulter son évolution sur cette page.",
      icon: <HourglassMediumIcon className="size-8 text-blue-500" weight="fill" />,
      variant: "outline" as const,
    },
    SHORTLISTED: {
      label: "Transmise au recruteur",
      description: "Votre dossier a été transmis au recruteur pour examen. Aucune décision finale n’a encore été prise.",
      icon: <SparkleIcon className="size-8 text-primary" weight="fill" />,
      variant: "default" as const,
    },
    ACCEPTED: {
      label: "Candidature acceptée",
      description: "Votre candidature a été acceptée. L’équipe de recrutement vous contactera pour la suite.",
      icon: <CheckCircleIcon className="size-8 text-green-500" weight="fill" />,
      variant: "default" as const,
    },
    NEEDS_REVIEW: {
      label: "Candidature à l’étude",
      description:
        "Votre candidature a bien été reçue. Vous pouvez suivre son évolution sur cette page.",
      icon: <ClockIcon className="size-8 text-muted-foreground" weight="fill" />,
      variant: "secondary" as const,
    },
    REJECTED: {
      label: "Candidature non retenue",
      description: "Votre candidature n’a pas été retenue pour cette offre. Merci de l’intérêt que vous lui avez porté.",
      icon: <CheckCircleIcon className="size-8 text-muted-foreground" weight="fill" />,
      variant: "secondary" as const,
    },
  } as const;

  const config = statusConfig[candidate.status as keyof typeof statusConfig] ?? {
    label: "Candidature en cours",
    description: "Votre candidature est en cours de traitement.",
    icon: <ClockIcon className="size-8 text-muted-foreground" />,
    variant: "secondary" as const,
  };

  return (
    <div className="flex min-h-[89vh] items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-xl">
        <Card className="border-[#d8e0e8] bg-white shadow-sm">
          <CardHeader className="space-y-4 text-center">
            <div className="mb-1 flex justify-center">{config.icon}</div>
            <CardTitle className="text-2xl font-bold sm:text-3xl">{config.label}</CardTitle>
            <CardDescription className="text-base leading-relaxed">{config.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-3 rounded-xl border border-[#d8e0e8] bg-[#f7f8fa] p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <span className="text-sm text-muted-foreground">Candidat</span>
                <span className="text-sm font-semibold text-right">{candidate.name}</span>
              </div>
              {candidate.job && (
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <span className="text-sm text-muted-foreground">Offre</span>
                  <span className="text-sm font-semibold text-right">{candidate.job.title}</span>
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <span className="text-sm text-muted-foreground">Date de candidature</span>
                <span className="text-sm font-semibold text-right">
                  {new Date(candidate.appliedAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <span className="text-sm text-muted-foreground">Statut</span>
                <Badge variant={config.variant} className="max-w-full whitespace-normal text-center text-sm">
                  {config.label}
                </Badge>
              </div>
            </div>

            {/* EU AI Act Art. 50 — the candidate must be able to see that an AI
                system is involved, and how to reach a human, at any point. */}
            <AiDisclosure compact aiEnabled={(process.env.AI_PROVIDER ?? "none").toLowerCase() !== "none"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
