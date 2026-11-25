"use client";

import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

export default function CopyPublicJobLink({ slug, isActive }: { slug: string; isActive: boolean }) {
  const [copied, setCopied] = useState(false);

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
      className="rounded-xl"
      disabled={!isActive}
      onClick={copyLink}
      aria-label={isActive ? `Copier le lien public de l’offre ${slug}` : "Publiez l’offre pour partager son lien"}
    >
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      {isActive ? (copied ? "Lien copié" : "Copier le lien public") : "Publier pour partager"}
    </Button>
  );
}
