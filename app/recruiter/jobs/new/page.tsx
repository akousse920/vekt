import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import JobDetailsForm from "../JobDetailsForm";
import JobSetupSteps from "../JobSetupSteps";

export default async function NewJobPage() {
  if (!await auth()) redirect("/login");
  return (
    <main className="mx-auto min-h-[80vh] max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/recruiter" className="text-sm font-medium text-primary hover:underline">← Toutes les offres</Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-primary">Nouvelle offre</p>
      <h1 className="mt-2 text-3xl font-bold">Créer une offre</h1>
      <p className="mt-2 text-sm text-muted-foreground">Décrivez le poste. Vous pourrez ensuite ajouter ses questions et critères.</p>
      <JobSetupSteps current="edit" />
      <JobDetailsForm aiEnabled={["openai", "openrouter", "ollama"].includes((process.env.AI_PROVIDER ?? "none").toLowerCase())} />
    </main>
  );
}
