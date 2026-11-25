import Link from "next/link";

/**
 * Candidate-facing disclosure that an AI system is involved in the process.
 *
 * EU AI Act Article 50 transparency duties took effect on 2 August 2026 and
 * apply based on what a system does, not on its risk tier — so this text is
 * required now, independently of the December 2027 high-risk deadline. It has
 * to be visible before the candidate submits, not buried in the privacy policy.
 *
 * Deployers: keep the four facts below. What the system does, that a human
 * decides, what data it sees, and how to ask for a human explanation.
 */
export function AiDisclosure({ compact = false, aiEnabled = true }: { compact?: boolean; aiEnabled?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-4">
      <span
        aria-hidden
        className="mt-0.5 size-2 shrink-0 rounded-full bg-muted-foreground/60"
      />
      <div className="text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground">
          {aiEnabled
            ? "Une IA aide à analyser cette candidature."
            : "Vos réponses sont comparées aux critères de l’offre."}
        </p>
        {!compact && (
          <p className="mt-1">
            {aiEnabled
              ? "Le CV est comparé aux critères de l’offre. Les informations d’identité sont retirées avant l’analyse. Une personne prend la décision."
              : "Si elles y correspondent, votre candidature est transmise directement au recruteur ; sinon, un membre de l’équipe l’examine avant toute décision. Votre CV n’est pas analysé par une IA."}
          </p>
        )}
        <p className="mt-1">
          Vous pouvez demander à tout moment comment votre candidature a été examinée. Plus d’informations dans la{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary underline underline-offset-3 font-medium"
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
