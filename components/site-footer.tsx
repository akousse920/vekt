import Link from "next/link";

export default function SiteFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="mt-auto border-t border-[#d9e5f2] bg-white">
      <div className="mx-auto flex min-h-18 max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {companyName}. Tous droits réservés.</p>
        </div>
        <Link
          href="/privacy"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-3"
        >
          Confidentialité
        </Link>
      </div>
    </footer>
  );
}
