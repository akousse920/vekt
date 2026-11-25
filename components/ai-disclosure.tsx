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
            : "Votre candidature est examinée par notre équipe."}
        </p>
        {!compact && (
          <p className="mt-1">
            {aiEnabled
              ? "Le CV est comparé aux critères de l’offre. Les informations d’identité sont retirées avant l’analyse. Une personne prend la décision."
              : "Vos réponses aux questions nous aident à orienter votre dossier vers la bonne personne. Votre CV n’est pas analysé par une IA."}
          </p>
        )}
        <p className="mt-1">
          Une question sur le traitement de votre candidature ? Consultez notre{" "}
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
