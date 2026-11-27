import Link from "next/link";

type Props =
  | { current: "edit"; jobId?: string }
  | { current: "questions"; jobId: string };

const steps = [
  { route: "edit", label: "1. Poste" },
  { route: "questions", label: "2. Formulaire de candidature" },
] as const;

const stepClassName = "flex min-h-11 items-center rounded-xl px-4 py-2 font-medium";

export default function JobSetupSteps({ current, jobId }: Props) {
  return (
    <nav aria-label="Étapes de configuration de l’offre" className="my-7 border-b border-border pb-3 text-sm">
      <ol className="flex flex-wrap gap-2">
        {steps.map(({ route, label }) => (
          <li key={route}>
            {route === current ? (
              <span aria-current="step" className={`${stepClassName} bg-primary text-primary-foreground`}>{label}</span>
            ) : jobId ? (
              <Link href={`/recruiter/jobs/${jobId}/${route}`} className={`${stepClassName} text-muted-foreground hover:bg-white`}>{label}</Link>
            ) : (
              <span aria-disabled="true" className={`${stepClassName} text-muted-foreground`}>{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
