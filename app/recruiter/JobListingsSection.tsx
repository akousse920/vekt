import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BriefcaseIcon, MagnifyingGlassIcon, MapPinIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import CopyPublicJobLink from "./CopyPublicJobLink";

type Job = {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  isActive: boolean;
  notifyOnApplication: boolean;
  _count: { candidates: number; screeningQuestions: number; applicationFields: number };
};

type Props = {
  listings: Job[];
  total: number;
  page: number;
  totalPages: number;
  q: string;
  status: "all" | "active" | "inactive";
};

function url(q: string, status: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/recruiter${params.size ? `?${params}` : ""}`;
}

export default function JobListingsSection({ listings, total, page, totalPages, q, status }: Props) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Espace recruteur</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Vos offres</h1>
          <p className="mt-2 text-sm text-muted-foreground">Retrouvez les candidatures et les réglages de chaque poste.</p>
        </div>
        <Button asChild className="brand-cta h-12 rounded-xl px-5 font-semibold">
          <Link href="/recruiter/jobs/new"><PlusIcon className="size-4" /> Créer une offre</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[#d8e0e8] bg-white p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <form action="/recruiter" className="flex w-full max-w-sm gap-2">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <label className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Rechercher une offre</span>
            <input name="q" defaultValue={q} placeholder="Rechercher une offre" className="h-11 w-full rounded-xl border border-input bg-white pl-10 pr-3 text-sm outline-none focus:border-[#e8922c]" />
          </label>
          <Button type="submit" variant="outline" className="h-11 rounded-xl">Chercher</Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["all", "active", "inactive"] as const).map((value) => (
            <Link key={value} href={url(q, value)} className={`rounded-xl px-3 py-2 font-medium transition-colors ${status === value ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}>
              {value === "all" ? "Toutes" : value === "active" ? "Publiées" : "En pause"}
            </Link>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{total} {total === 1 ? "offre" : "offres"}</p>
      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cbdcf0] bg-white px-6 py-14 text-center">
          <BriefcaseIcon className="mx-auto size-10 text-primary/50" />
          <h2 className="mt-3 font-semibold">Aucune offre à afficher</h2>
          <p className="mt-1 text-sm text-muted-foreground">{q || status !== "all" ? "Essayez une autre recherche." : "Créez votre première offre pour commencer."}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {listings.map((job) => {
            const count = job._count.screeningQuestions + job._count.applicationFields;
            return (
              <Card key={job.id} size="sm" className="border-[#d8e0e8] bg-white shadow-sm">
                <CardContent className="flex flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{job.title}</h2>
                      <Badge variant={job.isActive ? "default" : "secondary"}>{job.isActive ? "Publiée" : "En pause"}</Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPinIcon className="size-4" /> {job.location || "Lieu non précisé"}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{job._count.candidates} {job._count.candidates === 1 ? "candidature" : "candidatures"} · {count ? `${count} question${count > 1 ? "s" : ""} spécifique${count > 1 ? "s" : ""}` : "Formulaire standard"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Alertes e-mail {job.notifyOnApplication ? "activées" : "désactivées"} ·{" "}
                      <Link href={`/recruiter/jobs/${job.id}/edit`} className="font-medium text-primary underline underline-offset-2">Modifier</Link>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="rounded-xl"><Link href={`/recruiter/jobs/${job.id}`}>Candidatures</Link></Button>
                    <Button asChild variant="outline" className="rounded-xl"><Link href={`/recruiter/jobs/${job.id}/questions`}>Configurer l’offre</Link></Button>
                    <CopyPublicJobLink slug={job.slug} isActive={job.isActive} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <nav aria-label="Pagination des offres" className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link className="text-primary underline" href={url(q, status, page - 1)}>Précédent</Link> : null}
          <span>Page {page} sur {totalPages}</span>
          {page < totalPages ? <Link className="text-primary underline" href={url(q, status, page + 1)}>Suivant</Link> : null}
        </nav>
      )}
    </section>
  );
}
