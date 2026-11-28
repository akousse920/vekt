"use client";

import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

export default function CopyPublicJobLink({ slug, title, isActive }: { slug: string; title: string; isActive: boolean }) {
  const [copied, setCopied] = useState(false);
  const label = copied ? "Lien copié" : "Copier le lien";

  async function copyLink() {
    try {
      const publicUrl = new URL(`/jobs/${encodeURIComponent(slug)}`, window.location.origin);
      await navigator.clipboard.writeText(publicUrl.toString());
      setCopied(true);
      toast.success("Lien public copié.");
    } catch {
      toast.error("Impossible de copier le lien. Réessayez.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-10 lg:min-h-9"
      disabled={!isActive}
      onClick={copyLink}
      aria-label={isActive ? `${label} · ${title}` : `Lien indisponible · ${title}`}
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      {isActive ? label : "Lien indisponible"}
    </Button>
  );
}
