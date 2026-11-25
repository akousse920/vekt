import { COMPANY_NAME } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize-html";
import { ArrowRightIcon, BriefcaseIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import JobSearchInput from "./JobSearchInput";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const search = ((await searchParams).q ?? "").trim();
  const listings = await prisma.job.findMany({
    where: {
      isActive: true,
      ...(search ? { OR: [{ title: { contains: search } }, { location: { contains: search } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, description: true, location: true },
  });

  return (
    <main className="min-h-[80vh]">
      <section className="brand-hero relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -right-32 -top-36 size-96 rounded-full border border-white/15 bg-white/5" />
        <div className="pointer-events-none absolute -bottom-44 left-1/3 size-96 rounded-full bg-white/5" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-22">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium">
            <BriefcaseIcon className="size-4" /> Recrutement ouvert
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Trouvez votre prochaine <span className="text-[#ffc276]">opportunité</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            Découvrez les postes proposés par {COMPANY_NAME}. Choisissez une offre, répondez à ses questions et déposez votre CV en quelques étapes.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="#offres" className="brand-cta inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
              Voir les offres <ArrowRightIcon className="size-4" />
            </Link>
            <span className="text-sm text-white/85">{listings.length} {listings.length === 1 ? "offre disponible" : "offres disponibles"}</span>
          </div>
        </div>
      </section>

      <section id="offres" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Carrières</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Les postes à pourvoir</h2>
            <p className="mt-2 text-sm text-muted-foreground">Ouvrez une offre pour connaître le poste et envoyer votre candidature.</p>
          </div>
          <div className="w-full sm:w-80"><JobSearchInput defaultValue={search} /></div>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
            <BriefcaseIcon className="mx-auto size-10 text-primary/50" />
            <p className="mt-3 font-semibold">{search ? "Aucune offre ne correspond à votre recherche" : "Aucune offre ouverte pour le moment"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{search ? "Essayez un autre mot-clé." : "Revenez bientôt pour découvrir les nouveaux postes."}</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {listings.map((listing) => (
              <article key={listing.id} className="flex flex-col rounded-2xl border border-[#d8e0e8] bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><BriefcaseIcon className="size-6" weight="duotone" /></div>
                <h3 className="text-xl font-bold">{listing.title}</h3>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPinIcon className="size-4" />{listing.location || "Lieu à préciser"}</p>
                <div className="prose prose-sm mt-4 line-clamp-3 max-w-none text-muted-foreground **:text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeRichText(listing.description) }} />
                <Link href={`/jobs/${listing.slug}`} className="brand-cta mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8922c]">
                  Voir le poste et postuler <ArrowRightIcon className="size-4" />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
