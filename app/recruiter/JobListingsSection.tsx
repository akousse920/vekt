import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BriefcaseIcon, CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, MapPinIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
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
  pageSize: number;
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

export default function JobListingsSection({ listings, total, page, pageSize, totalPages, q, status }: Props) {
  const first = (page - 1) * pageSize + 1;
  const last = first + listings.length - 1;

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
          <label className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Rechercher une offre</span>
            <input name="q" defaultValue={q} placeholder="Rechercher une offre" className="h-11 w-full rounded-xl border border-input bg-white pl-10 pr-3 text-sm outline-none focus:border-[#e8922c]" />
          </label>
          <Button type="submit" variant="outline" className="h-11 rounded-xl">Chercher</Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(["all", "active", "inactive"] as const).map((value) => (
            <Link key={value} href={url(q, value)} aria-current={status === value ? "page" : undefined} className={`rounded-xl px-3 py-2 font-medium transition-colors ${status === value ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}>
              {value === "all" ? "Toutes" : value === "active" ? "Publiées" : "En pause"}
            </Link>
          ))}
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cbdcf0] bg-white px-6 py-14 text-center">
          <BriefcaseIcon className="mx-auto size-10 text-primary/50" />
          <h2 className="mt-3 font-semibold">Aucune offre à afficher</h2>
          <p className="mt-1 text-sm text-muted-foreground">{q || status !== "all" ? "Essayez une autre recherche." : "Créez votre première offre pour commencer."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white shadow-xs">
          <Table role="table" aria-label="Vos offres" className="block text-base lg:table">
            <TableHeader role="rowgroup" className="sr-only bg-secondary/60 lg:not-sr-only lg:table-header-group">
              <TableRow role="row" className="hover:bg-transparent">
                <TableHead role="columnheader" scope="col" className="h-12 px-5">Poste</TableHead>
                <TableHead role="columnheader" scope="col" className="px-3">Statut</TableHead>
                <TableHead role="columnheader" scope="col" className="px-3">Candidatures</TableHead>
                <TableHead role="columnheader" scope="col" className="px-3">Formulaire et alertes</TableHead>
                <TableHead role="columnheader" scope="col" className="px-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup" className="block lg:table-row-group">
              {listings.map((job) => {
                const count = job._count.screeningQuestions + job._count.applicationFields;
                const path = `/recruiter/jobs/${job.id}`;
                return (
                  <TableRow key={job.id} role="row" className="grid grid-cols-2 items-start gap-x-3 gap-y-4 px-4 py-5 hover:bg-secondary/35 sm:px-5 lg:table-row">
                    <th scope="row" role="rowheader" className="col-span-2 min-w-0 break-words text-left align-middle font-normal lg:px-5 lg:py-4">
                      <Link href={path} className="font-semibold hover:text-primary hover:underline">{job.title}</Link>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon className="mt-0.5 size-4 shrink-0" />{job.location || "Lieu non précisé"}
                      </p>
                    </th>
                    <TableCell role="cell" className="p-0 lg:px-3 lg:py-4">
                      <span aria-hidden="true" className="mb-1 block text-sm text-muted-foreground lg:hidden">Statut</span>
                      <Badge variant={job.isActive ? "default" : "secondary"} className="h-auto px-2.5 py-0.5 text-sm">
                        {job.isActive ? "Publiée" : "En pause"}
                      </Badge>
                    </TableCell>
                    <TableCell role="cell" className="p-0 lg:px-3 lg:py-4">
                      <span aria-hidden="true" className="mb-1 block text-sm text-muted-foreground lg:hidden">Candidatures</span>
                      <Link href={path} aria-label={`Voir les candidatures pour ${job.title} (${job._count.candidates})`}
                        className="inline-flex min-w-10 items-center justify-center rounded-md bg-primary/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-primary hover:bg-primary/20">
                        {job._count.candidates}
                      </Link>
                    </TableCell>
                    <TableCell role="cell" className="col-span-2 p-0 text-sm whitespace-normal lg:px-3 lg:py-4">
                      <p>{count ? `${count} question${count > 1 ? "s" : ""}` : "Formulaire standard"}</p>
                      <Link href={`${path}/edit`} aria-label={`Modifier les alertes e-mail pour ${job.title}, actuellement ${job.notifyOnApplication ? "activées" : "désactivées"}`}
                        className="mt-1 inline-block text-muted-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary">
                        Alertes e-mail {job.notifyOnApplication ? "activées" : "désactivées"}
                      </Link>
                    </TableCell>
                    <TableCell role="cell" className="col-span-2 p-0 lg:px-5 lg:py-4">
                      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                        <Button asChild variant="outline" className="min-h-10 lg:min-h-9">
                          <Link href={`${path}/questions`} aria-label={`Configurer l’offre ${job.title}`}>Configurer</Link>
                        </Button>
                        <CopyPublicJobLink slug={job.slug} title={job.title} isActive={job.isActive} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t bg-secondary/25 px-4 py-3 sm:px-5">
            <p className="text-sm text-muted-foreground">
              {totalPages > 1 ? `Offres ${first} à ${last} sur ${total}` : `${total} ${total === 1 ? "offre" : "offres"}`}
            </p>
            {totalPages > 1 && (
              <nav aria-label="Pagination des offres" className="flex items-center gap-2">
                {page > 1 ? (
                  <Button asChild variant="outline" size="icon" className="bg-white">
                    <Link href={url(q, status, page - 1)} aria-label="Page précédente"><CaretLeftIcon /></Link>
                  </Button>
                ) : <Button variant="outline" size="icon" disabled aria-label="Page précédente"><CaretLeftIcon /></Button>}
                <span aria-current="page" className="px-1 text-sm tabular-nums">Page {page} sur {totalPages}</span>
                {page < totalPages ? (
                  <Button asChild variant="outline" size="icon" className="bg-white">
                    <Link href={url(q, status, page + 1)} aria-label="Page suivante"><CaretRightIcon /></Link>
                  </Button>
                ) : <Button variant="outline" size="icon" disabled aria-label="Page suivante"><CaretRightIcon /></Button>}
              </nav>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
